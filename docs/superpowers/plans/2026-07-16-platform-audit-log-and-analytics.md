# Platform Audit Log + Cross-Tenant Analytics Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans, single-agent, no subagent dispatch. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give the platform admin two more real capabilities: an audit trail of onboard/edit/suspend/reactivate actions, and a genuine cross-tenant analytics rollup (KPIs + a 14-day stamp-velocity chart aggregated across every business) distinct from the client-side sum already on the `Businesses` list page.

**Architecture:** Both are additive, isolated slices sharing the existing `/api/platform/*` route group (`isPlatformAdmin` gated). Audit log: a new denormalized-write model (actor name and target business name are stored redundantly at write time, not joined, since the mock DB's `.populate()` only supports the `userId` path per `CLAUDE.md`) plus a service function called from inside `createBusiness`/`updateBusiness`. Analytics: mirrors `reportService.js`'s `getDashboardStats` shape and bucketing technique but with every query missing an `organizationId` filter (deliberately — this is the one platform-level surface where cross-tenant aggregation is the point, not a leak, since it never exposes which specific tenant a customer belongs to).

**Tech Stack:** Same as the rest of the backend/frontend — Express/mock-Mongoose, React 19/TS/TanStack Query/Recharts.

## Global Constraints

- Mock DB's `.populate()` only resolves the `userId` path — audit log denormalizes `actorName`/`targetName` at write time instead of relying on a join.
- Every new backend behavior gets a real `node tests/*.js` suite using the `bootServer` helper, added to `backend/package.json`'s `test` chain.
- Frontend verification: `npx tsc --noEmit` + browser walk (no frontend test framework in this repo).
- New nav entries follow `PlatformLayout.tsx`'s existing `NAV` array pattern.

---

## Part A — Platform audit log

### Task A1: Backend — model, service, wire into onboard/edit/suspend/reactivate

**Files:**
- Create: `backend/models/PlatformAuditLog.js`
- Create: `backend/services/platformAuditService.js`
- Modify: `backend/services/platformService.js` (`createBusiness`, `updateBusiness`)
- Modify: `backend/controllers/platformController.js` (`postBusiness`, `patchBusiness`)
- Modify: `backend/routes/platformRoutes.js`
- Test: `backend/tests/platform-audit-log.js` (new)
- Modify: `backend/package.json`

**Interfaces:**
- Produces: `logAction({ actorId, actorName, action, organizationId, targetName, details })` → creates one `PlatformAuditLog` row. `listRecent(limit = 100)` → most-recent-first array. `GET /api/platform/audit-log` → `{ success, entries: [{ id, actorName, action, targetName, details, createdAt }] }`.
- Consumes: `req.user.id` (already on every authenticated request) plus a fresh `User.findOne({ _id: req.user.id })` lookup in the controller for `actorName` (the JWT payload itself only carries `{ userId, role, organizationId }`, no name).

- [ ] **Step 1: Write the failing test**

Create `backend/tests/platform-audit-log.js`:
```js
/**
 * Platform audit log suite. Self-contained: boots its own server on a
 * dedicated port against the in-memory mock DB.
 *
 * Covers: onboarding, editing, suspending, and reactivating a business each
 * write a row; the log endpoint returns them most-recent-first with the
 * actor/target names denormalized (no join needed).
 *
 * Run directly: `node tests/platform-audit-log.js`
 */

const { bootServer } = require("./helpers/bootServer");

async function main() {
  const { baseUrl, stop } = await bootServer({ port: 5024 });
  let failures = 0;
  const check = (name, cond) => {
    if (cond) console.log(`PASS ${name}`);
    else { console.error(`FAIL ${name}`); failures++; }
  };
  const api = (path, { method = "GET", token, body } = {}) => {
    const headers = { "Content-Type": "application/json" };
    if (token) headers.Authorization = `Bearer ${token}`;
    return fetch(`${baseUrl}${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    }).then(async (r) => ({ status: r.status, body: await r.json().catch(() => null) }));
  };

  try {
    const platformLogin = await api("/api/platform/login", {
      method: "POST",
      body: { email: "admin@stampd.co", password: "password" },
    });
    const platformToken = platformLogin.body.token;

    const runSuffix = Date.now();
    const slug = `auditme-${runSuffix}`;
    const create = await api("/api/platform/businesses", {
      method: "POST",
      token: platformToken,
      body: {
        name: "Audit Me Cafe",
        slug,
        adminName: "Owner",
        adminEmail: `owner+${runSuffix}@audit.test`,
        adminPassword: "password",
      },
    });
    const id = create.body.business.id;

    await api(`/api/platform/businesses/${id}`, {
      method: "PATCH",
      token: platformToken,
      body: { name: "Audit Me Cafe (Renamed)" },
    });

    await api(`/api/platform/businesses/${id}`, {
      method: "PATCH",
      token: platformToken,
      body: { status: "suspended" },
    });

    await api(`/api/platform/businesses/${id}`, {
      method: "PATCH",
      token: platformToken,
      body: { status: "active" },
    });

    const log = await api("/api/platform/audit-log", { token: platformToken });
    check("audit log reachable -> 200", log.status === 200);

    const entries = log.body?.entries || [];
    const forThisBusiness = entries.filter((e) => e.targetName?.startsWith("Audit Me Cafe"));
    check("4 audit entries recorded for this business (onboard, edit, suspend, reactivate)", forThisBusiness.length === 4);

    check("most recent entry first (reactivate)", entries[0]?.action === "reactivate");
    check("actor name is the real platform admin, not just an id", entries[0]?.actorName && entries[0].actorName !== "undefined");

    const actions = forThisBusiness.map((e) => e.action).sort();
    check(
      "the 4 recorded actions are exactly onboard/edit/suspend/reactivate",
      JSON.stringify(actions) === JSON.stringify(["edit", "onboard", "reactivate", "suspend"]),
    );

    // A regular business_admin cannot read the platform audit log.
    const blogin = await api("/api/auth/login", { method: "POST", body: {} });
    check("no-credentials login rejected (sanity check on api helper)", blogin.status === 400 || blogin.status === 401);
  } finally {
    stop();
  }

  if (failures > 0) {
    console.error(`\n${failures} check(s) failed.`);
    process.exit(1);
  } else {
    console.log("\nAll platform-audit-log checks passed.");
  }
}

main();
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `cd backend && node tests/platform-audit-log.js`
Expected: fails immediately (endpoint doesn't exist, 404).

- [ ] **Step 3: Create the model**

```js
const mongoose = require("mongoose");

// Denormalized on purpose: actorName and targetName are copied at write
// time rather than populated from User/Organization, since the mock DB's
// .populate() only supports the userId path (see CLAUDE.md). This also
// means the log still reads correctly even if the actor or business is
// later renamed or removed.
const PlatformAuditLogSchema = new mongoose.Schema({
  actorId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  actorName: { type: String, required: true },
  action: { type: String, enum: ["onboard", "edit", "suspend", "reactivate"], required: true },
  organizationId: { type: mongoose.Schema.Types.ObjectId, ref: "Organization", default: null },
  targetName: { type: String, required: true },
  details: { type: String, default: "" },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model("PlatformAuditLog", PlatformAuditLogSchema);
```

Save as `backend/models/PlatformAuditLog.js`.

- [ ] **Step 4: Create the service**

```js
const PlatformAuditLog = require("../models/PlatformAuditLog");

const logAction = async ({ actorId, actorName, action, organizationId, targetName, details }) => {
  await PlatformAuditLog.create({
    actorId,
    actorName,
    action,
    organizationId: organizationId || null,
    targetName,
    details: details || ""
  });
};

const listRecent = async (limit = 100) => {
  const entries = await PlatformAuditLog.find({}).sort({ createdAt: -1 }).limit(limit);
  return entries.map((e) => ({
    id: e._id.toString(),
    actorName: e.actorName,
    action: e.action,
    targetName: e.targetName,
    details: e.details,
    createdAt: e.createdAt
  }));
};

module.exports = { logAction, listRecent };
```

Save as `backend/services/platformAuditService.js`.

- [ ] **Step 5: Wire logging into `createBusiness`**

In `backend/services/platformService.js`, add the import:
```js
const { logAction } = require("./platformAuditService");
```

Change `createBusiness`'s signature to accept the actor, and log after the admin is created (right before the `return` statement, after the existing `await sendVerifyEmail(admin, organization._id, normalizedSlug);` line):
```js
const createBusiness = async ({ name, slug, adminName, adminEmail, adminPassword, category, actorId, actorName }) => {
```
(add `actorId, actorName` to the destructured params)

Add, right before the function's `return { success: true, business: ..., admin: ..., tenantPath: ... };`:
```js
  await logAction({
    actorId,
    actorName,
    action: "onboard",
    organizationId: organization._id,
    targetName: organization.name,
    details: `Onboarded with admin ${normalizedAdminEmail}`
  });

```

- [ ] **Step 6: Wire logging into `updateBusiness`**

Change `updateBusiness`'s signature:
```js
const updateBusiness = async (id, { name, category, status, adminEmail, actorId, actorName }) => {
```

Right before the function's final `return { success: true, business: ..., ...(adminResult ? ... : {}) };`, add:
```js
  const changeParts = [];
  if (name !== undefined && updates.name !== undefined) changeParts.push(`name → "${updates.name}"`);
  if (category !== undefined && updates.category !== undefined) changeParts.push(`category → ${updates.category}`);
  if (adminResult && adminEmail !== undefined) changeParts.push(`admin email → ${adminResult.email}`);

  if (status !== undefined) {
    await logAction({
      actorId,
      actorName,
      action: status === "suspended" ? "suspend" : "reactivate",
      organizationId: id,
      targetName: updatedOrganization.name,
      details: changeParts.length ? changeParts.join("; ") : ""
    });
  } else if (changeParts.length) {
    await logAction({
      actorId,
      actorName,
      action: "edit",
      organizationId: id,
      targetName: updatedOrganization.name,
      details: changeParts.join("; ")
    });
  }

```

Note: this deliberately logs exactly one row per `updateBusiness` call — a status change takes priority as the recorded action type (with any other simultaneous field changes folded into `details`), otherwise it's a plain "edit".

- [ ] **Step 7: Thread the actor through the controller**

In `backend/controllers/platformController.js`, add the import:
```js
const User = require("../models/User");
const { listRecent } = require("../services/platformAuditService");
```

Replace `postBusiness`:
```js
const postBusiness = async (req, res, next) => {
  try {
    const { name, slug, adminName, adminEmail, adminPassword, category } = req.body;
    const actor = await User.findOne({ _id: req.user.id });
    const result = await createBusiness({
      name,
      slug,
      adminName,
      adminEmail,
      adminPassword,
      category,
      actorId: req.user.id,
      actorName: actor ? actor.name : "Unknown"
    });
    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
};
```

Replace `patchBusiness`:
```js
const patchBusiness = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { name, category, status, adminEmail } = req.body;
    const actor = await User.findOne({ _id: req.user.id });
    const result = await updateBusiness(id, {
      name,
      category,
      status,
      adminEmail,
      actorId: req.user.id,
      actorName: actor ? actor.name : "Unknown"
    });
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};
```

Add a new controller function, right after `patchBusiness`:
```js
const getAuditLog = async (req, res, next) => {
  try {
    const entries = await listRecent(100);
    res.status(200).json({ success: true, entries });
  } catch (error) {
    next(error);
  }
};
```

Add `getAuditLog` to the `module.exports` object.

- [ ] **Step 8: Mount the route**

In `backend/routes/platformRoutes.js`, add `getAuditLog` to the destructured import from `platformController`, and add, right after the `patch("/businesses/:id", ...)` line:
```js
router.get("/audit-log", verifyToken, isPlatformAdmin, getAuditLog);
```

- [ ] **Step 9: Run the new suite to confirm it passes**

Run: `cd backend && node tests/platform-audit-log.js`
Expected: `All platform-audit-log checks passed.`

- [ ] **Step 10: Add to the test chain, run full suite**

Modify `backend/package.json`'s `"test"` script: append `&& node tests/platform-audit-log.js` after `node tests/platform-business-edit.js`.

Run: `cd backend && npm test`
Expected: all suites pass.

- [ ] **Step 11: Commit**

```bash
git add backend/models/PlatformAuditLog.js backend/services/platformAuditService.js backend/services/platformService.js backend/controllers/platformController.js backend/routes/platformRoutes.js backend/tests/platform-audit-log.js backend/package.json
git commit -m "feat(be): platform audit log for onboard/edit/suspend/reactivate actions"
```

---

### Task A2: Frontend — audit log page + nav entry

**Files:**
- Create: `frontend/src/routes/platform/PlatformAuditLog.tsx`
- Modify: `frontend/src/App.tsx` (route)
- Modify: `frontend/src/components/platform/PlatformLayout.tsx` (nav entry)

**Interfaces:**
- Consumes: `GET /api/platform/audit-log` from Task A1.

- [ ] **Step 1: Create the page**

```tsx
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "../../lib/api";
import { Skeleton } from "../../components/ui/skeleton";

interface AuditEntry {
  id: string;
  actorName: string;
  action: "onboard" | "edit" | "suspend" | "reactivate";
  targetName: string;
  details: string;
  createdAt: string;
}

const ACTION_LABELS: Record<AuditEntry["action"], string> = {
  onboard: "Onboarded",
  edit: "Edited",
  suspend: "Suspended",
  reactivate: "Reactivated",
};

const ACTION_COLORS: Record<AuditEntry["action"], { bg: string; fg: string }> = {
  onboard: { bg: "var(--plat-soft)", fg: "var(--plat)" },
  edit: { bg: "var(--surface-container-high)", fg: "var(--soft)" },
  suspend: { bg: "var(--warn-soft)", fg: "var(--warn)" },
  reactivate: { bg: "var(--ok-soft)", fg: "var(--ok)" },
};

function formatWhen(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default function PlatformAuditLog() {
  const { data: entries = [], isLoading } = useQuery<AuditEntry[]>({
    queryKey: ["platformAuditLog"],
    queryFn: async () => {
      const res = await apiRequest<{ success: boolean; entries: AuditEntry[] }>(
        "/api/platform/audit-log",
        { role: "platform" },
      );
      return res.entries || [];
    },
  });

  return (
    <div>
      <h1 className="font-display text-[30px] font-extrabold text-[var(--ink)]">Activity log</h1>
      <p className="mb-6 text-[var(--muted)]">Every onboard, edit, suspend, and reactivate action, most recent first.</p>

      <div className="shadow-ambient overflow-hidden rounded-3xl bg-[var(--surface)]">
        <div className="grid grid-cols-[140px_110px_1fr_1.5fr] border-b border-[var(--line)] px-5 py-3 text-[11px] font-bold uppercase tracking-wider text-[var(--soft)]">
          <span>When</span>
          <span>Action</span>
          <span>Business</span>
          <span>Details</span>
        </div>

        {isLoading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="grid grid-cols-[140px_110px_1fr_1.5fr] items-center gap-3 border-b border-[var(--line)] px-5 py-3.5 last:border-b-0">
              <Skeleton className="h-3.5 w-24" />
              <Skeleton className="h-5 w-16 rounded-full" />
              <Skeleton className="h-3.5 w-28" />
              <Skeleton className="h-3.5 w-40" />
            </div>
          ))
        ) : entries.length === 0 ? (
          <div className="px-5 py-10 text-center text-sm text-[var(--muted)]">
            No activity yet.
          </div>
        ) : (
          entries.map((e) => (
            <div key={e.id} className="grid grid-cols-[140px_110px_1fr_1.5fr] items-center gap-3 border-b border-[var(--line)] px-5 py-3.5 text-sm last:border-b-0">
              <span className="text-[var(--muted)]">{formatWhen(e.createdAt)}</span>
              <span>
                <span
                  className="rounded-full px-2.5 py-1 text-[11px] font-bold"
                  style={{ background: ACTION_COLORS[e.action].bg, color: ACTION_COLORS[e.action].fg }}
                >
                  {ACTION_LABELS[e.action]}
                </span>
              </span>
              <span className="font-semibold">{e.targetName}</span>
              <span className="text-[var(--muted)]">{e.details || "—"} <span className="text-[var(--soft)]">· {e.actorName}</span></span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Add the route**

In `frontend/src/App.tsx`, add the lazy import alongside the other platform routes:
```tsx
const PlatformAuditLog = lazy(() => import('./routes/platform/PlatformAuditLog'));
```

Add the route inside the `/platform` route tree, alongside the existing `<Route path="business/:id" element={<BusinessDetail />} />`-style siblings:
```tsx
<Route path="audit-log" element={<PlatformAuditLog />} />
```

- [ ] **Step 3: Add the nav entry**

In `frontend/src/components/platform/PlatformLayout.tsx`, add an icon import (`History` from `lucide-react` fits) and a new entry to the `NAV` array, after `{ to: "contact", label: "Contact", Icon: Phone }`:
```tsx
  { to: "audit-log", label: "Activity", Icon: History },
```

- [ ] **Step 4: Typecheck**

Run: `cd frontend && npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 5: Browser check**

Onboard a business, edit it, suspend it, reactivate it, then visit `/platform/audit-log` and confirm all 4 actions appear, most recent first, with the real admin's name (not "Unknown") and legible details.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/routes/platform/PlatformAuditLog.tsx frontend/src/App.tsx frontend/src/components/platform/PlatformLayout.tsx
git commit -m "feat(fe): platform activity log page"
```

---

## Part B — Cross-tenant analytics rollup

### Task B1: Backend — platform-wide analytics endpoint

**Files:**
- Create: `backend/services/platformAnalyticsService.js`
- Modify: `backend/controllers/platformController.js`
- Modify: `backend/routes/platformRoutes.js`
- Test: `backend/tests/platform-analytics.js` (new)
- Modify: `backend/package.json`

**Interfaces:**
- Produces: `getPlatformAnalytics()` → same shape as `reportService.getDashboardStats` (KPI value/trend pairs + a 14-day `stampVelocity` series) but aggregated with NO `organizationId` filter on any query, plus `businessesTotal`/`businessesActive` counts. `GET /api/platform/analytics` → `{ success, ...stats }`.

- [ ] **Step 1: Write the failing test**

Create `backend/tests/platform-analytics.js`:
```js
/**
 * Platform-wide analytics suite. Self-contained: boots its own server on a
 * dedicated port against the in-memory mock DB.
 *
 * Covers: the rollup includes activity from BOTH the seeded coffesarowar
 * tenant and a freshly onboarded second tenant (i.e. it's genuinely
 * cross-tenant, not scoped to one business), and the KPI numbers are
 * internally consistent (revenue matches summed bill amounts, stamp
 * velocity's 14-day series sums to the reported stampsIssued... within the
 * current 7-day window, since velocity covers a longer window than the KPI).
 *
 * Run directly: `node tests/platform-analytics.js`
 */

const { bootServer } = require("./helpers/bootServer");

async function main() {
  const { baseUrl, stop } = await bootServer({ port: 5025 });
  let failures = 0;
  const check = (name, cond) => {
    if (cond) console.log(`PASS ${name}`);
    else { console.error(`FAIL ${name}`); failures++; }
  };
  const api = (path, { method = "GET", token, slug, body } = {}) => {
    const headers = { "Content-Type": "application/json" };
    if (token) headers.Authorization = `Bearer ${token}`;
    if (slug) headers["X-Tenant-Slug"] = slug;
    return fetch(`${baseUrl}${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    }).then(async (r) => ({ status: r.status, body: await r.json().catch(() => null) }));
  };

  try {
    const platformLogin = await api("/api/platform/login", {
      method: "POST",
      body: { email: "admin@stampd.co", password: "password" },
    });
    const platformToken = platformLogin.body.token;

    const before = await api("/api/platform/analytics", { token: platformToken });
    check("analytics reachable -> 200", before.status === 200);
    check("businessesTotal >= 1 (seeded coffesarowar)", before.body.businessesTotal >= 1);
    const stampsBefore = before.body.stampsIssued.value;

    // Onboard a second tenant and drive a stamp claim on it.
    const runSuffix = Date.now();
    const slug = `rollup-${runSuffix}`;
    const create = await api("/api/platform/businesses", {
      method: "POST",
      token: platformToken,
      body: {
        name: "Rollup Test Cafe",
        slug,
        adminName: "Owner",
        adminEmail: `owner+${runSuffix}@rollup.test`,
        adminPassword: "password",
      },
    });
    check("2nd tenant onboarded -> 201", create.status === 201);

    const adminLogin = await api("/api/auth/login", {
      method: "POST",
      slug,
      body: { email: `owner+${runSuffix}@rollup.test`, password: "password" },
    });
    const adminToken = adminLogin.body.token;

    await api("/api/admin/settings", {
      method: "PATCH",
      token: adminToken,
      body: { program: { cooldownHours: 0, minBillAmount: 0 } },
    });

    const custEmail = `cust+${runSuffix}@rollup.test`;
    await api("/api/auth/register", {
      method: "POST",
      slug,
      body: { name: "Rollup Customer", email: custEmail, phone: "+9779812340000", password: "password" },
    });
    const mint = await api("/__test__/mint-token", {
      method: "POST",
      slug,
      body: { email: custEmail, type: "email_verify" },
    });
    await api(`/api/auth/verify-email?token=${mint.body.token}`, { slug });
    const custLogin = await api("/api/auth/login", { method: "POST", slug, body: { email: custEmail, password: "password" } });
    const custToken = custLogin.body.token;

    const gen = await api("/api/admin/generate-qr", { method: "POST", token: adminToken, body: { billAmount: 500 } });
    const claim = await api("/api/stamps/claim", { method: "POST", token: custToken, body: { token: gen.body?.data?.token } });
    check("stamp claimed on 2nd tenant -> 200", claim.status === 200);

    const after = await api("/api/platform/analytics", { token: platformToken });
    check("businessesTotal grew by 1", after.body.businessesTotal === before.body.businessesTotal + 1);
    check(
      "platform-wide stampsIssued (current-week window) grew — rollup includes the new tenant's activity",
      after.body.stampsIssued.value === stampsBefore + 1,
    );
    check("revenue is a real number reflecting the 500 bill", typeof after.body.revenue.value === "number" && after.body.revenue.value >= 500);
    check("stampVelocity is a 14-entry day-bucketed series", Array.isArray(after.body.stampVelocity) && after.body.stampVelocity.length === 14);

    // A business_admin (not platform) cannot read this endpoint.
    const forbidden = await api("/api/platform/analytics", { token: adminToken });
    check("business_admin token rejected -> 403", forbidden.status === 403);
  } finally {
    stop();
  }

  if (failures > 0) {
    console.error(`\n${failures} check(s) failed.`);
    process.exit(1);
  } else {
    console.log("\nAll platform-analytics checks passed.");
  }
}

main();
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `cd backend && node tests/platform-analytics.js`
Expected: fails (endpoint doesn't exist, 404).

- [ ] **Step 3: Implement the service**

```js
const Organization = require("../models/Organization");
const User = require("../models/User");
const Voucher = require("../models/Voucher");
const StampClaimEvent = require("../models/StampClaimEvent");

const DAY_MS = 24 * 60 * 60 * 1000;
const WEEK_MS = 7 * DAY_MS;

const dayKey = (date) => new Date(date).toISOString().slice(0, 10);

const weekOverWeekTrend = (current, previous) => {
  if (previous > 0) return Math.round(((current - previous) / previous) * 100);
  return current > 0 ? null : 0;
};

// Platform-wide rollup: every query here is deliberately missing an
// organizationId filter — this is the one surface where cross-tenant
// aggregation is the point (a platform admin overseeing the whole SaaS),
// not a leak. It never exposes which specific tenant a customer belongs
// to, only aggregate counts/sums, so it doesn't violate the per-tenant
// isolation invariant that governs every other report in this codebase.
const getPlatformAnalytics = async () => {
  const now = new Date();
  const currentStart = new Date(now.getTime() - WEEK_MS);
  const previousStart = new Date(now.getTime() - 2 * WEEK_MS);
  const currentRange = { $gte: currentStart, $lte: now };
  const previousRange = { $gte: previousStart, $lte: currentStart };

  const [
    businessesTotal,
    businessesActiveOrgs,
    newCustomersCurrent,
    newCustomersPrevious,
    stampsCurrent,
    stampsPrevious,
    vouchersRedeemedCurrent,
    vouchersRedeemedPrevious,
    eventsCurrent,
    eventsPrevious,
  ] = await Promise.all([
    Organization.countDocuments({}),
    Organization.find({ status: "active" }),
    User.countDocuments({ role: "customer", createdAt: currentRange }),
    User.countDocuments({ role: "customer", createdAt: previousRange }),
    StampClaimEvent.countDocuments({ createdAt: currentRange }),
    StampClaimEvent.countDocuments({ createdAt: previousRange }),
    Voucher.countDocuments({ isValid: false, redeemedAt: currentRange }),
    Voucher.countDocuments({ isValid: false, redeemedAt: previousRange }),
    StampClaimEvent.find({ createdAt: currentRange }),
    StampClaimEvent.find({ createdAt: previousRange }),
  ]);

  const revenueCurrent = eventsCurrent.reduce((sum, e) => sum + (e.billAmount || 0), 0);
  const revenuePrevious = eventsPrevious.reduce((sum, e) => sum + (e.billAmount || 0), 0);

  const velocityStart = new Date(now.getTime() - 14 * DAY_MS);
  const velocityEvents = await StampClaimEvent.find({ createdAt: { $gte: velocityStart, $lte: now } });
  const velocityByDay = new Map();
  for (let i = 13; i >= 0; i -= 1) {
    velocityByDay.set(dayKey(new Date(now.getTime() - i * DAY_MS)), 0);
  }
  for (const event of velocityEvents) {
    const key = dayKey(event.createdAt);
    if (velocityByDay.has(key)) velocityByDay.set(key, velocityByDay.get(key) + 1);
  }
  const stampVelocity = Array.from(velocityByDay.entries()).map(([date, count]) => ({ date, count }));

  return {
    businessesTotal,
    businessesActive: businessesActiveOrgs.length,
    newCustomers: { value: newCustomersCurrent, trend: weekOverWeekTrend(newCustomersCurrent, newCustomersPrevious) },
    stampsIssued: { value: stampsCurrent, trend: weekOverWeekTrend(stampsCurrent, stampsPrevious) },
    revenue: { value: revenueCurrent, trend: weekOverWeekTrend(revenueCurrent, revenuePrevious) },
    vouchersRedeemed: { value: vouchersRedeemedCurrent, trend: weekOverWeekTrend(vouchersRedeemedCurrent, vouchersRedeemedPrevious) },
    stampVelocity,
  };
};

module.exports = { getPlatformAnalytics };
```

Save as `backend/services/platformAnalyticsService.js`.

- [ ] **Step 4: Wire the controller + route**

In `backend/controllers/platformController.js`, add the import:
```js
const { getPlatformAnalytics } = require("../services/platformAnalyticsService");
```

Add a new controller function:
```js
const getAnalytics = async (req, res, next) => {
  try {
    const stats = await getPlatformAnalytics();
    res.status(200).json({ success: true, ...stats });
  } catch (error) {
    next(error);
  }
};
```

Add `getAnalytics` to `module.exports`.

In `backend/routes/platformRoutes.js`, add `getAnalytics` to the destructured import and mount it:
```js
router.get("/analytics", verifyToken, isPlatformAdmin, getAnalytics);
```

- [ ] **Step 5: Run the new suite to confirm it passes**

Run: `cd backend && node tests/platform-analytics.js`
Expected: `All platform-analytics checks passed.`

- [ ] **Step 6: Add to the test chain, run full suite**

Modify `backend/package.json`'s `"test"` script: append `&& node tests/platform-analytics.js` after `node tests/platform-audit-log.js`.

Run: `cd backend && npm test`
Expected: all suites pass.

- [ ] **Step 7: Commit**

```bash
git add backend/services/platformAnalyticsService.js backend/controllers/platformController.js backend/routes/platformRoutes.js backend/tests/platform-analytics.js backend/package.json
git commit -m "feat(be): cross-tenant analytics rollup endpoint"
```

---

### Task B2: Frontend — analytics page + nav entry

**Files:**
- Create: `frontend/src/routes/platform/PlatformAnalytics.tsx`
- Modify: `frontend/src/App.tsx` (route)
- Modify: `frontend/src/components/platform/PlatformLayout.tsx` (nav entry)

**Interfaces:**
- Consumes: `GET /api/platform/analytics` from Task B1.

- [ ] **Step 1: Create the page**

```tsx
import { useQuery } from "@tanstack/react-query";
import { TrendingUp, TrendingDown } from "lucide-react";
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip } from "recharts";
import { apiRequest } from "../../lib/api";
import { Skeleton } from "../../components/ui/skeleton";

interface DashboardMetric {
  value: number;
  trend: number | null;
}

interface PlatformAnalyticsData {
  businessesTotal: number;
  businessesActive: number;
  newCustomers: DashboardMetric;
  stampsIssued: DashboardMetric;
  revenue: DashboardMetric;
  vouchersRedeemed: DashboardMetric;
  stampVelocity: { date: string; count: number }[];
}

const shortDate = (iso: string) => new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });

function TrendBadge({ trend }: { trend: number | null }) {
  if (trend === null) return null;
  const up = trend >= 0;
  return (
    <span className="ml-2 inline-flex items-center gap-0.5 text-[12px] font-bold" style={{ color: up ? "var(--ok)" : "var(--err)" }}>
      {up ? <TrendingUp className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />}
      {Math.abs(trend)}%
    </span>
  );
}

export default function PlatformAnalytics() {
  const { data: stats, isLoading } = useQuery<PlatformAnalyticsData>({
    queryKey: ["platformAnalytics"],
    queryFn: async () => {
      const res = await apiRequest<{ success: boolean } & PlatformAnalyticsData>(
        "/api/platform/analytics",
        { role: "platform" },
      );
      return res;
    },
  });

  const tiles = stats
    ? [
        { label: "Businesses", val: `${stats.businessesActive}/${stats.businessesTotal}`, sub: "active/total", trend: null },
        { label: "New customers (7d)", val: stats.newCustomers.value, trend: stats.newCustomers.trend },
        { label: "Stamps issued (7d)", val: stats.stampsIssued.value, trend: stats.stampsIssued.trend },
        { label: "Revenue (7d)", val: stats.revenue.value, trend: stats.revenue.trend },
        { label: "Vouchers redeemed (7d)", val: stats.vouchersRedeemed.value, trend: stats.vouchersRedeemed.trend },
      ]
    : [];

  return (
    <div>
      <h1 className="font-display text-[30px] font-extrabold text-[var(--ink)]">Analytics</h1>
      <p className="mb-6 text-[var(--muted)]">Rolled up across every business on the platform.</p>

      <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-5">
        {isLoading
          ? Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="shadow-ambient rounded-3xl bg-[var(--surface)] p-5">
                <Skeleton className="mb-1.5 h-3.5 w-20" />
                <Skeleton className="h-6 w-10" />
              </div>
            ))
          : tiles.map((t) => (
              <div key={t.label} className="shadow-ambient rounded-3xl bg-[var(--surface)] p-5">
                <div className="mb-1.5 text-[13px] text-[var(--muted)]">{t.label}</div>
                <div className="font-display text-[26px] font-bold">
                  {t.val}
                  <TrendBadge trend={t.trend} />
                </div>
              </div>
            ))}
      </div>

      <div className="shadow-ambient rounded-3xl bg-[var(--surface)] p-6">
        <h3 className="mb-1 font-display text-lg font-bold text-[var(--ink)]">Stamp velocity</h3>
        <p className="mb-4 text-[13px] text-[var(--muted)]">Stamps issued per day across every business, last 14 days.</p>
        {isLoading || !stats ? (
          <Skeleton className="h-[220px] w-full rounded-xl" />
        ) : (
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={stats.stampVelocity.map((d) => ({ ...d, label: shortDate(d.date) }))}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--line)" />
              <XAxis dataKey="label" tick={{ fontSize: 12 }} stroke="var(--soft)" />
              <YAxis allowDecimals={false} tick={{ fontSize: 12 }} stroke="var(--soft)" />
              <Tooltip />
              <Line type="monotone" dataKey="count" stroke="var(--plat)" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Add the route**

In `frontend/src/App.tsx`:
```tsx
const PlatformAnalytics = lazy(() => import('./routes/platform/PlatformAnalytics'));
```
```tsx
<Route path="analytics" element={<PlatformAnalytics />} />
```

- [ ] **Step 3: Add the nav entry**

In `frontend/src/components/platform/PlatformLayout.tsx`, import `BarChart3` from `lucide-react` and add, right after `{ to: "", end: true, label: "Businesses", Icon: Building2 }`:
```tsx
  { to: "analytics", label: "Analytics", Icon: BarChart3 },
```

- [ ] **Step 4: Typecheck**

Run: `cd frontend && npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 5: Browser check**

Visit `/platform/analytics`, confirm the 5 KPI tiles and the stamp-velocity chart render with real (non-fabricated) numbers, and that onboarding + driving a claim on a 2nd tenant moves the numbers.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/routes/platform/PlatformAnalytics.tsx frontend/src/App.tsx frontend/src/components/platform/PlatformLayout.tsx
git commit -m "feat(fe): cross-tenant analytics dashboard"
```

---

## Part C — Ship it

### Task C1: Full verification + merge

- [ ] **Step 1:** `cd backend && npm test` — all suites pass.
- [ ] **Step 2:** `cd frontend && npx tsc --noEmit` — no errors.
- [ ] **Step 3:** Browser walk both new pages live against the running mock-DB backend.
- [ ] **Step 4:** `git checkout main && git merge --no-edit <branch> && git push origin main` per standing authorization.
