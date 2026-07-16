# Multiple Platform Admins + Roles Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans, single-agent, no subagent dispatch.

**Goal:** Today there's exactly one `role:"platform"` user (seeded, no invite flow), with full power. Add a second tier — `platformRole: "owner" | "support"` — so an owner can invite/remove other platform staff, and support staff get read-only access (view businesses/analytics/activity log, cannot onboard/edit/suspend a business, cannot manage the team or platform contact info).

**Architecture:** `User.platformRole` is a new field, meaningful only when `role === "platform"` (null/unset = "owner", for backward compatibility with the existing seeded admin — no migration needed, mirrors how new optional fields are handled elsewhere in this codebase). `verifyToken` already re-fetches the full `User` row on every request (for the suspended-tenant check) — it now also stamps `req.user.platformRole` onto that same fetch, at no extra query cost. A new `isPlatformOwner` middleware gates the write-ish platform routes; the existing `isPlatformAdmin` (either role) still gates read-only ones.

**Tech Stack:** Same as the rest of the backend/frontend.

## Global Constraints

- No migration script needed: `platformRole` unset is treated as `"owner"` everywhere it's read, so the existing seeded `admin@stampd.co` keeps full access with zero data changes.
- A platform admin can never remove their own account (safety guard against self-lockout).
- Every new backend behavior gets a real `node tests/*.js` suite, added to `backend/package.json`'s `test` chain.
- Frontend verification: `npx tsc --noEmit` + browser walk.

---

### Task 1: Backend — role field, owner-only guard, team service + routes

**Files:**
- Modify: `backend/models/User.js`
- Modify: `backend/models/PlatformAuditLog.js` (extend `action` enum)
- Modify: `backend/middleware/authMiddleware.js`
- Modify: `backend/services/platformService.js` (`loginPlatformAdmin` returns `platformRole`)
- Create: `backend/services/platformTeamService.js`
- Create: `backend/controllers/platformTeamController.js`
- Modify: `backend/routes/platformRoutes.js` (mount `/admins`, upgrade write routes to `isPlatformOwner`)
- Test: `backend/tests/platform-team.js` (new)
- Modify: `backend/package.json`

**Interfaces:**
- Produces: `listAdmins()` → `[{id, name, email, platformRole, createdAt}]`. `inviteAdmin({name, email, password, platformRole, actorId, actorName})` → `{id, name, email, platformRole}`, logs an `invite_admin` audit row. `removeAdmin({id, actorId, actorName})` → throws 400 on self-removal, 404 if not found; logs a `remove_admin` audit row on success.
- Routes: `GET /api/platform/admins` (owner-only), `POST /api/platform/admins` (owner-only), `DELETE /api/platform/admins/:id` (owner-only).

- [ ] **Step 1: Write the failing test**

Create `backend/tests/platform-team.js`:
```js
/**
 * Platform team (multiple admins + roles) suite. Self-contained: boots its
 * own server on a dedicated port against the in-memory mock DB.
 *
 * Covers: the seeded admin is an implicit "owner" (no migration needed);
 * an owner can invite a "support" admin; a support admin can read
 * businesses/analytics/audit-log but is rejected from onboard/edit/suspend
 * and from managing the team; an owner can remove a support admin but not
 * themselves.
 *
 * Run directly: `node tests/platform-team.js`
 */

const { bootServer } = require("./helpers/bootServer");

async function main() {
  const { baseUrl, stop } = await bootServer({ port: 5026 });
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
    const ownerLogin = await api("/api/platform/login", {
      method: "POST",
      body: { email: "admin@stampd.co", password: "password" },
    });
    check("seeded admin logs in", ownerLogin.status === 200);
    check("seeded admin is implicitly owner (no migration)", ownerLogin.body.user.platformRole === "owner");
    const ownerToken = ownerLogin.body.token;
    const ownerId = ownerLogin.body.user.id;

    const list0 = await api("/api/platform/admins", { token: ownerToken });
    check("owner can list admins -> 200", list0.status === 200);
    check("exactly 1 admin so far (the seed)", list0.body.admins.length === 1);

    const runSuffix = Date.now();
    const supportEmail = `support+${runSuffix}@stampd.co`;
    const invite = await api("/api/platform/admins", {
      method: "POST",
      token: ownerToken,
      body: { name: "Support Sam", email: supportEmail, password: "password", platformRole: "support" },
    });
    check("owner invites a support admin -> 201", invite.status === 201);
    check("invited admin has platformRole support", invite.body.admin?.platformRole === "support");

    const supportLogin = await api("/api/platform/login", {
      method: "POST",
      body: { email: supportEmail, password: "password" },
    });
    check("support admin logs in", supportLogin.status === 200);
    check("support admin's own login reflects platformRole support", supportLogin.body.user.platformRole === "support");
    const supportToken = supportLogin.body.token;

    const readAsSupport = await api("/api/platform/businesses", { token: supportToken });
    check("support can read businesses list -> 200", readAsSupport.status === 200);

    const analyticsAsSupport = await api("/api/platform/analytics", { token: supportToken });
    check("support can read analytics -> 200", analyticsAsSupport.status === 200);

    const auditAsSupport = await api("/api/platform/audit-log", { token: supportToken });
    check("support can read audit log -> 200", auditAsSupport.status === 200);

    const onboardAsSupport = await api("/api/platform/businesses", {
      method: "POST",
      token: supportToken,
      body: { name: "Nope", slug: `nope-${runSuffix}`, adminName: "X", adminEmail: `x+${runSuffix}@nope.test`, adminPassword: "password" },
    });
    check("support CANNOT onboard a business -> 403", onboardAsSupport.status === 403);

    const teamAsSupport = await api("/api/platform/admins", { token: supportToken });
    check("support CANNOT list the team -> 403", teamAsSupport.status === 403);

    const inviteAsSupport = await api("/api/platform/admins", {
      method: "POST",
      token: supportToken,
      body: { name: "Nope", email: `nope+${runSuffix}@x.com`, password: "password" },
    });
    check("support CANNOT invite another admin -> 403", inviteAsSupport.status === 403);

    const selfRemove = await api(`/api/platform/admins/${ownerId}`, { method: "DELETE", token: ownerToken });
    check("owner cannot remove themselves -> 400", selfRemove.status === 400);

    const supportId = invite.body.admin.id;
    const remove = await api(`/api/platform/admins/${supportId}`, { method: "DELETE", token: ownerToken });
    check("owner removes the support admin -> 200", remove.status === 200);

    const listAfter = await api("/api/platform/admins", { token: ownerToken });
    check("team is back to 1 admin after removal", listAfter.body.admins.length === 1);

    const auditLog = await api("/api/platform/audit-log", { token: ownerToken });
    const actions = auditLog.body.entries.filter((e) => e.action === "invite_admin" || e.action === "remove_admin").map((e) => e.action);
    check("invite_admin and remove_admin both got logged", actions.includes("invite_admin") && actions.includes("remove_admin"));
  } finally {
    stop();
  }

  if (failures > 0) {
    console.error(`\n${failures} check(s) failed.`);
    process.exit(1);
  } else {
    console.log("\nAll platform-team checks passed.");
  }
}

main();
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `cd backend && node tests/platform-team.js`
Expected: fails immediately (no `platformRole` on login response, no `/admins` route).

- [ ] **Step 3: Add the field to `User.js`**

Replace:
```js
  role: { type: String, enum: ["customer", "business_admin", "platform"], default: "customer" },
```
With:
```js
  role: { type: String, enum: ["customer", "business_admin", "platform"], default: "customer" },
  // Only meaningful when role === "platform". null/unset is treated as
  // "owner" everywhere it's read — this is deliberate so the existing
  // seeded admin (created before this field existed) keeps full access
  // with no migration needed.
  platformRole: { type: String, enum: ["owner", "support"], default: null },
```

- [ ] **Step 4: Extend the audit log's action enum**

In `backend/models/PlatformAuditLog.js`, replace:
```js
  action: { type: String, enum: ["onboard", "edit", "suspend", "reactivate"], required: true },
```
With:
```js
  action: { type: String, enum: ["onboard", "edit", "suspend", "reactivate", "invite_admin", "remove_admin"], required: true },
```

- [ ] **Step 5: Stamp `platformRole` in `verifyToken`, add `isPlatformOwner`**

In `backend/middleware/authMiddleware.js`, replace:
```js
    req.user = {
      id: decoded.userId,
      role: decoded.role,
      // Tenant the authenticated user belongs to (null for platform admins).
      // Loyalty operations scope to this value, so a user can only ever act
      // within their own tenant regardless of any client-supplied slug.
      organizationId: decoded.organizationId || null
    };
```
With:
```js
    req.user = {
      id: decoded.userId,
      role: decoded.role,
      // Tenant the authenticated user belongs to (null for platform admins).
      // Loyalty operations scope to this value, so a user can only ever act
      // within their own tenant regardless of any client-supplied slug.
      organizationId: decoded.organizationId || null,
      // Only meaningful for role === "platform". Read fresh from the DB on
      // every request (the `user` row is already fetched above for the
      // suspended-tenant check) rather than trusting the JWT, so a
      // demotion/promotion takes effect immediately, not just on next login.
      platformRole: user.role === "platform" ? (user.platformRole || "owner") : null
    };
```

Replace:
```js
// A tenant's admin (barista/owner console).
const isBusinessAdmin = requireRole("business_admin", "Business admin");
// The platform super-admin (SaaS owner).
const isPlatformAdmin = requireRole("platform", "Platform admin");

module.exports = {
  verifyToken,
  isBusinessAdmin,
  isPlatformAdmin
};
```
With:
```js
// A tenant's admin (barista/owner console).
const isBusinessAdmin = requireRole("business_admin", "Business admin");
// The platform super-admin (SaaS owner). Either platformRole — owner or
// support — passes this gate; it's the existing baseline for read-only
// platform surfaces.
const isPlatformAdmin = requireRole("platform", "Platform admin");

// The stricter platform gate: only platformRole "owner" passes. Used for
// onboarding/editing/suspending a business, platform contact settings, and
// managing the platform team itself — "support" is read-only everywhere
// this guard is used.
const isPlatformOwner = (req, res, next) => {
  if (!req.user || req.user.role !== "platform" || req.user.platformRole !== "owner") {
    return res.status(403).json({
      success: false,
      message: "Forbidden: platform owner access required."
    });
  }
  next();
};

module.exports = {
  verifyToken,
  isBusinessAdmin,
  isPlatformAdmin,
  isPlatformOwner
};
```

- [ ] **Step 6: `loginPlatformAdmin` returns `platformRole`**

In `backend/services/platformService.js`, replace:
```js
  return {
    success: true,
    token,
    user: {
      id: user._id.toString(),
      name: user.name,
      role: user.role
    }
  };
};
```
(the one inside `loginPlatformAdmin`) with:
```js
  return {
    success: true,
    token,
    user: {
      id: user._id.toString(),
      name: user.name,
      role: user.role,
      platformRole: user.platformRole || "owner"
    }
  };
};
```

- [ ] **Step 7: Create the team service**

```js
const bcrypt = require("bcryptjs");
const User = require("../models/User");
const { logAction } = require("./platformAuditService");

const SALT_ROUNDS = 10;

const createHttpError = (message, statusCode) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

const normalizeEmail = (email) => email.trim().toLowerCase();

const listAdmins = async () => {
  const admins = await User.find({ role: "platform" });
  return admins.map((a) => ({
    id: a._id.toString(),
    name: a.name,
    email: a.email,
    platformRole: a.platformRole || "owner",
    createdAt: a.createdAt
  }));
};

const inviteAdmin = async ({ name, email, password, platformRole, actorId, actorName }) => {
  if (!name || !email || !password) {
    throw createHttpError("name, email, and password are required.", 400);
  }

  const safeRole = platformRole === "support" ? "support" : "owner";
  const normalizedEmail = normalizeEmail(email);

  const existing = await User.findOne({ organizationId: null, email: normalizedEmail });
  if (existing) {
    throw createHttpError("A platform admin with this email already exists.", 409);
  }

  const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);
  const admin = await User.create({
    organizationId: null,
    name: name.trim(),
    email: normalizedEmail,
    password: hashedPassword,
    role: "platform",
    platformRole: safeRole,
    emailVerified: true
  });

  await logAction({
    actorId,
    actorName,
    action: "invite_admin",
    organizationId: null,
    targetName: admin.name,
    details: `Invited as ${safeRole} (${admin.email})`
  });

  return { id: admin._id.toString(), name: admin.name, email: admin.email, platformRole: safeRole };
};

const removeAdmin = async ({ id, actorId, actorName }) => {
  if (id === actorId) {
    throw createHttpError("You can't remove your own account.", 400);
  }

  const admin = await User.findOne({ _id: id, role: "platform" });
  if (!admin) {
    throw createHttpError("Platform admin not found.", 404);
  }

  await User.deleteOne({ _id: id });

  await logAction({
    actorId,
    actorName,
    action: "remove_admin",
    organizationId: null,
    targetName: admin.name,
    details: `Removed (${admin.email})`
  });
};

module.exports = { listAdmins, inviteAdmin, removeAdmin };
```

Save as `backend/services/platformTeamService.js`.

- [ ] **Step 8: Create the controller**

```js
const { listAdmins, inviteAdmin, removeAdmin } = require("../services/platformTeamService");
const User = require("../models/User");

const getAdmins = async (req, res, next) => {
  try {
    const admins = await listAdmins();
    res.status(200).json({ success: true, admins });
  } catch (error) {
    next(error);
  }
};

const postAdmin = async (req, res, next) => {
  try {
    const { name, email, password, platformRole } = req.body;
    const actor = await User.findOne({ _id: req.user.id });
    const admin = await inviteAdmin({
      name,
      email,
      password,
      platformRole,
      actorId: req.user.id,
      actorName: actor ? actor.name : "Unknown"
    });
    res.status(201).json({ success: true, admin });
  } catch (error) {
    next(error);
  }
};

const deleteAdmin = async (req, res, next) => {
  try {
    const { id } = req.params;
    const actor = await User.findOne({ _id: req.user.id });
    await removeAdmin({ id, actorId: req.user.id, actorName: actor ? actor.name : "Unknown" });
    res.status(200).json({ success: true });
  } catch (error) {
    next(error);
  }
};

module.exports = { getAdmins, postAdmin, deleteAdmin };
```

Save as `backend/controllers/platformTeamController.js`.

- [ ] **Step 9: Mount routes, upgrade write routes to `isPlatformOwner`**

In `backend/routes/platformRoutes.js`, add the imports:
```js
const { getAdmins, postAdmin, deleteAdmin } = require("../controllers/platformTeamController");
const { verifyToken, isPlatformAdmin, isPlatformOwner } = require("../middleware/authMiddleware");
```
(replacing the existing `const { verifyToken, isPlatformAdmin } = require(...)` line)

Replace the route table with:
```js
router.post("/login", platformLogin);
router.get("/businesses", verifyToken, isPlatformAdmin, getBusinesses);
router.post("/businesses", verifyToken, isPlatformOwner, postBusiness);
router.get("/businesses/:id", verifyToken, isPlatformAdmin, getBusinessById);
router.patch("/businesses/:id", verifyToken, isPlatformOwner, patchBusiness);
router.get("/audit-log", verifyToken, isPlatformAdmin, getAuditLog);
router.get("/analytics", verifyToken, isPlatformAdmin, getAnalytics);
router.get("/admins", verifyToken, isPlatformOwner, getAdmins);
router.post("/admins", verifyToken, isPlatformOwner, postAdmin);
router.delete("/admins/:id", verifyToken, isPlatformOwner, deleteAdmin);
router.get("/public-contact", getPublicPlatformContact);
router.get("/contact", verifyToken, isPlatformAdmin, getPlatformContactAdmin);
router.patch("/contact", verifyToken, isPlatformOwner, patchPlatformContact);
```

Note: `GET /contact` (viewing platform contact info) stays `isPlatformAdmin` (both roles can view), only the `PATCH` (editing it) becomes owner-only.

- [ ] **Step 10: Run the new suite, then the full backend suite**

Run: `cd backend && node tests/platform-team.js`
Expected: `All platform-team checks passed.`

Modify `backend/package.json`'s `"test"` script: append `&& node tests/platform-team.js` after `node tests/platform-analytics.js`.

Run: `cd backend && npm test`
Expected: all suites pass.

- [ ] **Step 11: Commit**

```bash
git add backend/models/User.js backend/models/PlatformAuditLog.js backend/middleware/authMiddleware.js backend/services/platformService.js backend/services/platformTeamService.js backend/controllers/platformTeamController.js backend/routes/platformRoutes.js backend/tests/platform-team.js backend/package.json
git commit -m "feat(be): multiple platform admins with owner/support roles"
```

---

### Task 2: Frontend — team page, role-aware nav, context update

**Files:**
- Modify: `frontend/src/context/PlatformAuthContext.tsx` (carry `platformRole`)
- Create: `frontend/src/routes/platform/PlatformTeam.tsx`
- Modify: `frontend/src/App.tsx` (route)
- Modify: `frontend/src/components/platform/PlatformLayout.tsx` (nav entry, owner-only)

**Interfaces:**
- Consumes: `GET/POST /api/platform/admins`, `DELETE /api/platform/admins/:id` from Task 1.

- [ ] **Step 1: Extend `PlatformUser` and thread `platformRole` through**

In `PlatformAuthContext.tsx`, replace:
```tsx
export interface PlatformUser {
  id: string;
  name: string;
  role: "customer" | "business_admin" | "platform";
}
```
With:
```tsx
export interface PlatformUser {
  id: string;
  name: string;
  role: "customer" | "business_admin" | "platform";
  platformRole: "owner" | "support";
}
```
(no other changes needed in this file — `login()` already stores whatever the login response's `user` object contains)

- [ ] **Step 2: Create the team page**

```tsx
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { apiRequest } from "../../lib/api";
import { usePlatformAuth } from "../../context/PlatformAuthContext";
import { Skeleton } from "../../components/ui/skeleton";
import { ConfirmDialog } from "../../components/shared/ConfirmDialog";

interface PlatformAdmin {
  id: string;
  name: string;
  email: string;
  platformRole: "owner" | "support";
  createdAt: string;
}

const EMPTY_FORM = { name: "", email: "", password: "", platformRole: "support" as "owner" | "support" };

export default function PlatformTeam() {
  const { user } = usePlatformAuth();
  const qc = useQueryClient();
  const [form, setForm] = useState(EMPTY_FORM);
  const [pendingRemoveId, setPendingRemoveId] = useState<string | null>(null);

  const { data: admins = [], isLoading } = useQuery<PlatformAdmin[]>({
    queryKey: ["platformAdmins"],
    queryFn: async () => {
      const res = await apiRequest<{ success: boolean; admins: PlatformAdmin[] }>(
        "/api/platform/admins",
        { role: "platform" },
      );
      return res.admins || [];
    },
  });

  const invite = useMutation({
    mutationFn: (body: typeof EMPTY_FORM) =>
      apiRequest("/api/platform/admins", { method: "POST", role: "platform", body }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["platformAdmins"] });
      toast.success("Admin invited!");
      setForm(EMPTY_FORM);
    },
    onError: (e) => toast.error((e as Error).message || "Couldn't invite that admin — try again."),
  });

  const remove = useMutation({
    mutationFn: (id: string) => apiRequest(`/api/platform/admins/${id}`, { method: "DELETE", role: "platform" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["platformAdmins"] });
      toast.success("Admin removed.");
    },
    onError: (e) => toast.error((e as Error).message || "Couldn't remove that admin — try again."),
  });

  if (user?.platformRole !== "owner") {
    return (
      <div className="shadow-ambient rounded-3xl bg-[var(--surface)] p-8 text-center">
        <p className="text-sm font-bold text-[var(--ink)]">Owners only</p>
        <p className="mt-1 text-sm text-[var(--muted)]">Your support role can't manage the platform team.</p>
      </div>
    );
  }

  return (
    <div>
      <h1 className="font-display text-[30px] font-extrabold text-[var(--ink)]">Team</h1>
      <p className="mb-6 text-[var(--muted)]">Platform staff with access to this console.</p>

      <div className="mb-6 shadow-ambient overflow-hidden rounded-3xl bg-[var(--surface)]">
        <div className="grid grid-cols-[2fr_1fr_1fr_auto] border-b border-[var(--line)] px-5 py-3 text-[11px] font-bold uppercase tracking-wider text-[var(--soft)]">
          <span>Name / email</span>
          <span>Role</span>
          <span>Added</span>
          <span></span>
        </div>
        {isLoading ? (
          Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="grid grid-cols-[2fr_1fr_1fr_auto] items-center gap-3 border-b border-[var(--line)] px-5 py-3.5 last:border-b-0">
              <Skeleton className="h-3.5 w-32" />
              <Skeleton className="h-5 w-14 rounded-full" />
              <Skeleton className="h-3.5 w-16" />
              <Skeleton className="h-8 w-16 rounded-full" />
            </div>
          ))
        ) : (
          admins.map((a) => (
            <div key={a.id} className="grid grid-cols-[2fr_1fr_1fr_auto] items-center gap-3 border-b border-[var(--line)] px-5 py-3.5 text-sm last:border-b-0">
              <span>
                <span className="block font-bold">{a.name}</span>
                <span className="block text-xs text-[var(--soft)]">{a.email}</span>
              </span>
              <span>
                <span
                  className="rounded-full px-2.5 py-1 text-[11px] font-bold"
                  style={
                    a.platformRole === "owner"
                      ? { background: "var(--plat-soft)", color: "var(--plat)" }
                      : { background: "var(--surface-container-high)", color: "var(--soft)" }
                  }
                >
                  {a.platformRole}
                </span>
              </span>
              <span className="text-[var(--muted)]">
                {new Date(a.createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}
              </span>
              <span>
                {a.id !== user.id && (
                  <button
                    onClick={() => setPendingRemoveId(a.id)}
                    className="rounded-full border border-[var(--line)] px-3 py-1.5 text-xs font-bold hover:bg-[var(--bg)]"
                  >
                    Remove
                  </button>
                )}
              </span>
            </div>
          ))
        )}
      </div>

      <div className="shadow-ambient max-w-md rounded-3xl bg-[var(--surface)] p-6">
        <h3 className="mb-4 font-display text-lg font-bold text-[var(--ink)]">Invite an admin</h3>
        <div className="flex flex-col gap-3">
          <input
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            placeholder="Name"
            className="w-full rounded-[11px] border border-[var(--line)] bg-[var(--bg)] px-4 py-3 text-sm focus:border-[var(--plat)] focus:outline-none"
          />
          <input
            value={form.email}
            onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
            placeholder="Email"
            type="email"
            className="w-full rounded-[11px] border border-[var(--line)] bg-[var(--bg)] px-4 py-3 text-sm focus:border-[var(--plat)] focus:outline-none"
          />
          <input
            value={form.password}
            onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
            placeholder="Temporary password"
            type="password"
            className="w-full rounded-[11px] border border-[var(--line)] bg-[var(--bg)] px-4 py-3 text-sm focus:border-[var(--plat)] focus:outline-none"
          />
          <select
            value={form.platformRole}
            onChange={(e) => setForm((f) => ({ ...f, platformRole: e.target.value as "owner" | "support" }))}
            className="w-full rounded-[11px] border border-[var(--line)] bg-[var(--bg)] px-4 py-3 text-sm focus:border-[var(--plat)] focus:outline-none"
          >
            <option value="support">Support (read-only)</option>
            <option value="owner">Owner (full access)</option>
          </select>
          <button
            onClick={() => invite.mutate(form)}
            disabled={invite.isPending || !form.name || !form.email || !form.password}
            className="stamp-interactive rounded-[13px] py-3 text-sm font-bold text-white disabled:opacity-50"
            style={{ background: "var(--plat)" }}
          >
            {invite.isPending ? "Inviting…" : "Invite"}
          </button>
        </div>
      </div>

      <ConfirmDialog
        open={pendingRemoveId !== null}
        onOpenChange={(open) => !open && setPendingRemoveId(null)}
        title="Remove this admin?"
        description="They'll immediately lose access to the platform console."
        confirmLabel="Remove"
        confirmColor="var(--err)"
        onConfirm={() => {
          if (pendingRemoveId) remove.mutate(pendingRemoveId);
          setPendingRemoveId(null);
        }}
      />
    </div>
  );
}
```

- [ ] **Step 3: Add the route**

In `frontend/src/App.tsx`:
```tsx
const PlatformTeam = lazy(() => import('./routes/platform/PlatformTeam'));
```
```tsx
<Route path="team" element={<PlatformTeam />} />
```

- [ ] **Step 4: Add the nav entry, owner-only**

In `PlatformLayout.tsx`, the `NAV` array is currently a flat constant rendered for every platform user regardless of role. Change it to a function of the current user's `platformRole` so "Team" only appears for owners:

Replace:
```tsx
const NAV = [
  { to: "", end: true, label: "Businesses", Icon: Building2 },
  { to: "analytics", label: "Analytics", Icon: BarChart3 },
  { to: "onboard", label: "Onboard new", Icon: PlusCircle },
  { to: "audit-log", label: "Activity", Icon: History },
  { to: "contact", label: "Contact", Icon: Phone },
];
```
With:
```tsx
const BASE_NAV = [
  { to: "", end: true, label: "Businesses", Icon: Building2 },
  { to: "analytics", label: "Analytics", Icon: BarChart3 },
  { to: "onboard", label: "Onboard new", Icon: PlusCircle },
  { to: "audit-log", label: "Activity", Icon: History },
  { to: "contact", label: "Contact", Icon: Phone },
];
const OWNER_ONLY_NAV = [{ to: "team", label: "Team", Icon: Users }];
```

Add `Users` to the `lucide-react` import.

Inside the component, replace the `NAV.map(...)` call with a locally-computed nav list:
```tsx
  const nav = user.platformRole === "owner" ? [...BASE_NAV, ...OWNER_ONLY_NAV] : BASE_NAV;
```
(add this line right after the existing `if (isLoading || !user || ...)` early-return block, before the `return (...)` — `user` is guaranteed non-null past that point)

Change `{NAV.map(({ to, end, label, Icon }) => (` to `{nav.map(({ to, end, label, Icon }) => (`.

Note: `"Onboard new"` is currently reachable by anyone with `isPlatformAdmin` on the nav side but the endpoint itself is now `isPlatformOwner`-gated — a support admin clicking it would hit a 403 on submit. Since onboarding is a full-page form (not a quick action), leaving the nav link visible but having the submit fail with a clear error is acceptable, but for a cleaner UX, also hide `onboard` from support's nav:
```tsx
const OWNER_ONLY_NAV = [
  { to: "onboard", label: "Onboard new", Icon: PlusCircle },
  { to: "team", label: "Team", Icon: Users },
];
```
and remove `{ to: "onboard", ... }` from `BASE_NAV`.

- [ ] **Step 5: Typecheck**

Run: `cd frontend && npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 6: Browser check**

As the seeded owner: invite a support admin, confirm they appear in the team list. Log in as the support admin in a fresh session: confirm "Onboard new" and "Team" are hidden from nav, confirm visiting `/platform/team` directly shows "Owners only", confirm Businesses/Analytics/Activity still work, confirm attempting to onboard via direct API call would 403 (already covered by the backend test, spot-check via one UI action if convenient). Back as owner: remove the support admin, confirm the team list updates and self-removal is blocked.

- [ ] **Step 7: Commit**

```bash
git add frontend/src/context/PlatformAuthContext.tsx frontend/src/routes/platform/PlatformTeam.tsx frontend/src/App.tsx frontend/src/components/platform/PlatformLayout.tsx
git commit -m "feat(fe): platform team page, owner-only nav for onboarding/team management"
```

---

### Task 3: Ship it

- [ ] `cd backend && npm test` — all suites pass.
- [ ] `cd frontend && npx tsc --noEmit` — no errors.
- [ ] Browser walk per Task 2 Step 6.
- [ ] `git push origin main` per standing authorization (working directly on `main` this session, consistent with prior rounds).
