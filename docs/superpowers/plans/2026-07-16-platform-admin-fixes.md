# Platform Admin Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task, single-agent (no subagent dispatch). Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix two real bugs (stale cross-tenant cache in the admin console, wrong onboarding hand-off link), let a platform admin edit a business's details (including fixing a wrong admin email), and replace the current "log out / 404" experience for a suspended business with an honest, non-destructive overlay.

**Architecture:** Four independent slices. (1) Scope every admin/customer React Query key by tenant so cached data never leaks across a business switch in one browser tab. (2) One-line backend fix for the onboarding link. (3) Extend the existing `PATCH /api/platform/businesses/:id` + `BusinessDetail.tsx` with real edit fields, including a same-endpoint admin-email-change path that resets verification and resends the email. (4) Give suspension a distinguishable error `code` from the backend so the frontend can render a blur-overlay (admin) or an honest message (customer) instead of pattern-matching English strings or falling back to a generic 404/logout.

**Tech Stack:** Node/Express + custom in-memory mock-Mongoose shim (dev), React 19 + TS + TanStack Query + Tailwind v4.

## Global Constraints

- Every admin-scoped query key must include the tenant's organizationId (or slug where that's what's already in scope) — no exceptions, this is the actual bug.
- `invalidateQueries({queryKey: ["adminMenu"]})`-style calls with the SHORT (prefix) key still correctly invalidate the longer `["adminMenu", orgId]` cache entries (TanStack Query matches by prefix by default) — do not change existing `invalidateQueries` calls, only the `useQuery`/`queryKey` fetch side.
- Slug stays immutable via the platform-admin edit UI in this pass — renaming a live tenant's URL breaks bookmarks/printed QR codes; that's a deliberate, separate, bigger operation, out of scope here.
- Backend layering stays thin-controller/service-layer per `CLAUDE.md`.
- Backend verification is real: extend/add `node tests/*.js` suites using the existing `bootServer` helper pattern, add new suites to `backend/package.json`'s `test` chain. Frontend verification is `npx tsc --noEmit` plus an explicit browser walk (no frontend test framework exists in this repo).

---

## Part A — Fix the stale cross-tenant cache bug

### Task A1: Backend — expose `organizationId` on the business_admin login response

**Files:**
- Modify: `backend/services/authService.js` (`formatAuthPayload`, ~line 63-79)

**Interfaces:**
- Produces: `POST /api/auth/login`'s response `user` object gains `organizationId: string | null` (previously only `id`, `name`, `role`, `emailVerified`).

- [ ] **Step 1: Add the field**

Replace:
```js
  return {
    success: true,
    token,
    user: {
      id: user._id.toString(),
      name: user.name,
      role: user.role,
      emailVerified: user.emailVerified
    }
```
With:
```js
  return {
    success: true,
    token,
    user: {
      id: user._id.toString(),
      name: user.name,
      role: user.role,
      emailVerified: user.emailVerified,
      organizationId: user.organizationId ? user.organizationId.toString() : null
    }
```

- [ ] **Step 2: Run the full backend suite**

Run: `cd backend && npm test`
Expected: all suites still pass (additive field, no existing assertion checks the response shape doesn't have it).

- [ ] **Step 3: Commit**

```bash
git add backend/services/authService.js
git commit -m "feat(be): expose organizationId on the business_admin/customer login response"
```

---

### Task A2: Frontend — thread `organizationId` through `AdminAuthContext` and scope every admin query key

**Files:**
- Modify: `frontend/src/context/AdminAuthContext.tsx`
- Modify: `frontend/src/hooks/useAdminSettings.ts`
- Modify: `frontend/src/routes/admin/AdminCustomers.tsx`
- Modify: `frontend/src/routes/admin/AdminCustomerDetail.tsx`
- Modify: `frontend/src/routes/admin/MenuManagement.tsx`
- Modify: `frontend/src/routes/admin/AdminEvents.tsx`
- Modify: `frontend/src/routes/admin/AdminOverview.tsx`
- Modify: `frontend/src/routes/admin/AdminReportsVouchers.tsx`
- Modify: `frontend/src/routes/admin/AdminReportsSummary.tsx`

**Interfaces:**
- Consumes: `user.organizationId` from Task A1's backend change.
- Produces: `useAdminAuth().user.organizationId: string | null` (new field on the existing `User` interface). Every admin `queryKey` below gains this as its second element (or is appended after existing params).

- [ ] **Step 1: Extend the `User` interface in `AdminAuthContext.tsx`**

Replace:
```tsx
export interface User {
  id: string;
  name: string;
  role: "customer" | "business_admin" | "platform";
}
```
With:
```tsx
export interface User {
  id: string;
  name: string;
  role: "customer" | "business_admin" | "platform";
  organizationId: string | null;
}
```

- [ ] **Step 2: Scope `useAdminSettings.ts`**

Add the import and use the org id in both the query and the mutation's cache write:
```ts
import { useAdminAuth } from "../context/AdminAuthContext";
```
Replace:
```ts
export function useAdminSettings() {
  return useQuery<AdminSettings>({
    queryKey: ["adminSettings"],
    queryFn: async () => {
      const res = await apiRequest<{ success: boolean; settings: AdminSettings }>(
        "/api/admin/settings",
        { role: "admin" },
      );
      return res.settings;
    },
    staleTime: 1000 * 30,
  });
}
```
With:
```ts
export function useAdminSettings() {
  const { user } = useAdminAuth();
  const orgId = user?.organizationId ?? null;
  return useQuery<AdminSettings>({
    queryKey: ["adminSettings", orgId],
    queryFn: async () => {
      const res = await apiRequest<{ success: boolean; settings: AdminSettings }>(
        "/api/admin/settings",
        { role: "admin" },
      );
      return res.settings;
    },
    staleTime: 1000 * 30,
  });
}
```
Replace:
```ts
export function useUpdateAdminSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (patch: AdminSettingsPatch) => {
      const res = await apiRequest<{ success: boolean; settings: AdminSettings }>(
        "/api/admin/settings",
        { method: "PATCH", role: "admin", body: patch },
      );
      return res.settings;
    },
    onSuccess: (settings) => {
      qc.setQueryData(["adminSettings"], settings);
    },
  });
}
```
With:
```ts
export function useUpdateAdminSettings() {
  const qc = useQueryClient();
  const { user } = useAdminAuth();
  const orgId = user?.organizationId ?? null;
  return useMutation({
    mutationFn: async (patch: AdminSettingsPatch) => {
      const res = await apiRequest<{ success: boolean; settings: AdminSettings }>(
        "/api/admin/settings",
        { method: "PATCH", role: "admin", body: patch },
      );
      return res.settings;
    },
    onSuccess: (settings) => {
      qc.setQueryData(["adminSettings", orgId], settings);
    },
  });
}
```

- [ ] **Step 3: Scope `AdminCustomers.tsx` and `AdminCustomerDetail.tsx` (same key, both files)**

In both files, add `import { useAdminAuth } from "../../context/AdminAuthContext";` and, inside the component, `const { user } = useAdminAuth(); const orgId = user?.organizationId ?? null;` above the `useQuery` call. Change `queryKey: ["adminCustomers"]` to `queryKey: ["adminCustomers", orgId]` in both files — they must match exactly since `AdminCustomerDetail.tsx` deliberately reads from the same cached list rather than its own endpoint (per the existing code comment).

- [ ] **Step 4: Scope `MenuManagement.tsx`**

Add the import and org id as above. Change `queryKey: ["adminMenu"]` (line 27) to `queryKey: ["adminMenu", orgId]`. Do NOT change the `invalidate()` function's `qc.invalidateQueries({ queryKey: ["adminMenu"] })` (line 57) — the shorter key still matches as a prefix.

- [ ] **Step 5: Scope `AdminEvents.tsx`**

Same pattern: change `queryKey: ["adminEvents"]` (line 26) to `queryKey: ["adminEvents", orgId]`. Leave its `invalidate()` (line 98) unchanged for the same prefix-matching reason.

- [ ] **Step 6: Scope `AdminOverview.tsx`**

Add the import/org id once at the top of the component, then change all three:
- `queryKey: ["adminCustomers"]` (line 77) → `queryKey: ["adminCustomers", orgId]`
- `queryKey: ["recentScans"]` (line 88) → `queryKey: ["recentScans", orgId]`
- `queryKey: ["adminDashboardStats"]` (line 99) → `queryKey: ["adminDashboardStats", orgId]`

- [ ] **Step 7: Scope `AdminReportsVouchers.tsx` and `AdminReportsSummary.tsx`**

In each, add the import/org id, then change:
- `AdminReportsVouchers.tsx` line 38: `queryKey: ["adminReportsVouchers", startDate, endDate]` → `queryKey: ["adminReportsVouchers", orgId, startDate, endDate]`
- `AdminReportsSummary.tsx` line 29: `queryKey: ["adminReportsSummary", startDate, endDate]` → `queryKey: ["adminReportsSummary", orgId, startDate, endDate]`

- [ ] **Step 8: Typecheck**

Run: `cd frontend && npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 9: Commit**

```bash
git add frontend/src/context/AdminAuthContext.tsx frontend/src/hooks/useAdminSettings.ts frontend/src/routes/admin/AdminCustomers.tsx frontend/src/routes/admin/AdminCustomerDetail.tsx frontend/src/routes/admin/MenuManagement.tsx frontend/src/routes/admin/AdminEvents.tsx frontend/src/routes/admin/AdminOverview.tsx frontend/src/routes/admin/AdminReportsVouchers.tsx frontend/src/routes/admin/AdminReportsSummary.tsx
git commit -m "fix(fe): scope every admin React Query key by organizationId

Prevents a business_admin session for Tenant B from showing Tenant A's
cached customers/settings/menu/events/stats when both are viewed in the
same browser tab without a hard reload — the backend was always
correctly scoped by JWT, but every admin query key was a fixed string
with no tenant identifier, so React Query's cache served stale
cross-tenant data instantly (or for the whole staleTime window)."
```

---

### Task A3: Frontend — scope the three customer-side query keys by tenant slug

**Files:**
- Modify: `frontend/src/hooks/useStampCard.ts`
- Modify: `frontend/src/hooks/useCustomerMenu.ts`
- Modify: `frontend/src/hooks/useVouchers.ts`

**Interfaces:**
- Consumes: `useTenant().slug` from `frontend/src/context/TenantContext.tsx` (already exists, already used by every consumer of these three hooks since they only ever render inside a `TenantProvider` subtree).
- Produces: no signature change to the hooks themselves (still called with no arguments) — only their internal `queryKey` changes.

- [ ] **Step 1: `useStampCard.ts`**

Add the import and read the slug:
```ts
import { useTenant } from "../context/TenantContext";
```
Replace:
```ts
export function useStampCard() {
  return useQuery<StampCardData>({
    queryKey: ["stampCard"],
```
With:
```ts
export function useStampCard() {
  const { slug } = useTenant();
  return useQuery<StampCardData>({
    queryKey: ["stampCard", slug],
```

- [ ] **Step 2: `useCustomerMenu.ts`** — same pattern

```ts
import { useTenant } from "../context/TenantContext";
```
Replace `queryKey: ["customerMenu"]` with `queryKey: ["customerMenu", slug]`, adding `const { slug } = useTenant();` inside the function body before the `useQuery` call.

- [ ] **Step 3: `useVouchers.ts`** — same pattern

```ts
import { useTenant } from "../context/TenantContext";
```
Replace `queryKey: ["vouchers"]` with `queryKey: ["vouchers", slug]`, adding `const { slug } = useTenant();` inside the function body before the `useQuery` call.

- [ ] **Step 4: Typecheck**

Run: `cd frontend && npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/hooks/useStampCard.ts frontend/src/hooks/useCustomerMenu.ts frontend/src/hooks/useVouchers.ts
git commit -m "fix(fe): scope customer-side query keys (stampCard/customerMenu/vouchers) by tenant slug"
```

---

## Part B — Fix the onboarding hand-off link

### Task B1: Point the hand-off link at the admin login, not the customer app

**Files:**
- Modify: `backend/services/platformService.js` (~line 157)
- Modify: `backend/tests/integration-qa.js` or wherever onboarding is covered (check first)

**Interfaces:** none new — pure value fix.

- [ ] **Step 1: Check whether any existing test asserts the current (wrong) `tenantPath` value**

Run: `grep -rn "tenantPath" backend/tests/`
If a test asserts `tenantPath === \`/${slug}\`` (or similar), note the file — it'll need updating in Step 3 to assert the new value instead.

- [ ] **Step 2: Fix the value**

Replace:
```js
    tenantPath: `/${normalizedSlug}`
```
With:
```js
    tenantPath: `/${normalizedSlug}/admin`
```

- [ ] **Step 3: Update any test found in Step 1 to assert the new path, or add a new assertion if none existed**

If `backend/tests/integration-qa.js` (or another suite) creates a business via `POST /api/platform/businesses` and reads `res.body.tenantPath` or similar, add/update a check: `tenantPath === \`/${slug}/admin\``. If no suite touches this field at all, add one assertion to whichever existing suite already calls this endpoint (don't create a whole new suite for a one-line value).

- [ ] **Step 4: Run the full backend suite**

Run: `cd backend && npm test`
Expected: all suites pass.

- [ ] **Step 5: Commit**

```bash
git add backend/services/platformService.js backend/tests/
git commit -m "fix(be): onboarding hand-off link points at the admin login, not the customer app"
```

---

## Part C — Platform admin can edit a business's details (incl. fixing a wrong admin email)

### Task C1: Backend — extend `updateBusiness` to accept `category` and an admin-email fix

**Files:**
- Modify: `backend/services/platformService.js` (`updateBusiness`, ~line 178)
- Modify: `backend/controllers/platformController.js` (`patchBusiness`)
- Test: `backend/tests/platform-business-edit.js` (new)
- Modify: `backend/package.json` (`test` script)

**Interfaces:**
- Produces: `updateBusiness(id, { name, category, status, adminEmail })` — `adminEmail`, when provided and different from the current business_admin `User`'s email, updates that user's email, forces `emailVerified: false`, and re-sends the verification email to the new address via the existing `sendVerifyEmail(user, organizationId, slug)` from `backend/services/authService.js`. Returns `{ success, business, admin: { email } }` (mirrors `createBusiness`'s response shape).
- Consumes: `sendVerifyEmail` (already exported from `authService.js`), `BUSINESS_CATEGORIES` (already imported in `platformService.js`).

- [ ] **Step 1: Write the failing test**

Create `backend/tests/platform-business-edit.js`:
```js
/**
 * Platform-admin business-edit suite. Self-contained: boots its own server
 * on a dedicated port against the in-memory mock DB.
 *
 * Covers: editing name/category, and the admin-email-fix flow (wrong email
 * entered at onboarding -> platform admin corrects it -> new address gets a
 * fresh, usable verification token; the OLD email's token, if any, no
 * longer verifies this account since the email field itself changed).
 *
 * Run directly: `node tests/platform-business-edit.js`
 */

const { bootServer } = require("./helpers/bootServer");

async function main() {
  const { baseUrl, stop } = await bootServer({ port: 5023 });
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
    const slug = `editme-${runSuffix}`;
    const wrongEmail = `wrong+${runSuffix}@typo.test`;
    const create = await api("/api/platform/businesses", {
      method: "POST",
      token: platformToken,
      body: {
        name: "Edit Me Cafe",
        slug,
        adminName: "Owner",
        adminEmail: wrongEmail,
        adminPassword: "password",
      },
    });
    check("onboard business -> 201", create.status === 201);
    const id = create.body.business.id;

    // 1. Edit name + category, no adminEmail change.
    const editNameCategory = await api(`/api/platform/businesses/${id}`, {
      method: "PATCH",
      token: platformToken,
      body: { name: "Edit Me Cafe (Renamed)", category: "bakery" },
    });
    check(
      "edit name+category -> 200 with new values",
      editNameCategory.status === 200 &&
        editNameCategory.body.business.name === "Edit Me Cafe (Renamed)" &&
        editNameCategory.body.business.category === "bakery",
    );

    // 2. Fix the wrong admin email.
    const correctEmail = `correct+${runSuffix}@real.test`;
    const editEmail = await api(`/api/platform/businesses/${id}`, {
      method: "PATCH",
      token: platformToken,
      body: { adminEmail: correctEmail },
    });
    check(
      "fix admin email -> 200, echoes new email",
      editEmail.status === 200 && editEmail.body.admin?.email === correctEmail,
    );

    // 3. The OLD (wrong) email can no longer log in as this business's admin.
    const loginOld = await api("/api/auth/login", {
      method: "POST",
      headers: undefined,
      body: { email: wrongEmail, password: "password" },
    });
    // (login requires X-Tenant-Slug; add it via a direct fetch since the
    // `api` helper above doesn't set it — reuse fetch directly here)
    const loginOldReal = await fetch(`${baseUrl}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Tenant-Slug": slug },
      body: JSON.stringify({ email: wrongEmail, password: "password" }),
    });
    check("old (wrong) email can no longer log in -> 401", loginOldReal.status === 401);

    // 4. The NEW (corrected) email can log in, and shows emailVerified:false
    //    (a fresh verification was required, exactly solving the "wasted
    //    route" problem).
    const loginNewReal = await fetch(`${baseUrl}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Tenant-Slug": slug },
      body: JSON.stringify({ email: correctEmail, password: "password" }),
    });
    const loginNewBody = await loginNewReal.json();
    check(
      "corrected email logs in, emailVerified:false until they click the new link",
      loginNewReal.status === 200 && loginNewBody.user?.emailVerified === false,
    );

    // 5. A bogus category is rejected.
    const badCategory = await api(`/api/platform/businesses/${id}`, {
      method: "PATCH",
      token: platformToken,
      body: { category: "not-a-real-category" },
    });
    check("bogus category -> 400", badCategory.status === 400);
  } finally {
    stop();
  }

  if (failures > 0) {
    console.error(`\n${failures} check(s) failed.`);
    process.exit(1);
  } else {
    console.log("\nAll platform-business-edit checks passed.");
  }
}

main();
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `cd backend && node tests/platform-business-edit.js`
Expected: several `FAIL` lines (category not accepted, adminEmail not accepted, category validation missing).

- [ ] **Step 3: Implement the service change**

Replace the whole `updateBusiness` function in `backend/services/platformService.js`:
```js
const updateBusiness = async (id, { name, category, status, adminEmail }) => {
  const organization = await Organization.findOne({ _id: id });

  if (!organization) {
    throw createHttpError("Business not found.", 404);
  }

  if (status !== undefined && status !== "active" && status !== "suspended") {
    throw createHttpError("status must be either 'active' or 'suspended'.", 400);
  }

  if (category !== undefined && !BUSINESS_CATEGORIES.includes(category)) {
    throw createHttpError("Not a valid category.", 400);
  }

  const updates = {};

  if (name !== undefined) {
    updates.name = name.trim();
  }

  if (category !== undefined) {
    updates.category = category;
  }

  if (status !== undefined) {
    updates.status = status;
  }

  const updatedOrganization = await Organization.findOneAndUpdate(
    { _id: id },
    { $set: updates },
    { new: true }
  );

  let adminResult = null;

  if (adminEmail !== undefined) {
    const normalizedAdminEmail = normalizeEmail(adminEmail);
    const adminUser = await User.findOne({ organizationId: id, role: "business_admin" });

    if (!adminUser) {
      throw createHttpError("This business has no admin account to update.", 404);
    }

    if (adminUser.email !== normalizedAdminEmail) {
      const collision = await User.findOne({ organizationId: id, email: normalizedAdminEmail });
      if (collision) {
        throw createHttpError("That email is already in use for this business.", 409);
      }

      const updatedAdmin = await User.findOneAndUpdate(
        { _id: adminUser._id },
        { $set: { email: normalizedAdminEmail, emailVerified: false } },
        { new: true }
      );

      await sendVerifyEmail(updatedAdmin, id, updatedOrganization.slug);
      adminResult = { email: updatedAdmin.email };
    } else {
      adminResult = { email: adminUser.email };
    }
  }

  return {
    success: true,
    business: await buildBusinessStats(updatedOrganization),
    ...(adminResult ? { admin: adminResult } : {})
  };
};
```

- [ ] **Step 4: Wire the new fields through the controller**

In `backend/controllers/platformController.js`, replace:
```js
const patchBusiness = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { name, status } = req.body;
    const result = await updateBusiness(id, { name, status });
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};
```
With:
```js
const patchBusiness = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { name, category, status, adminEmail } = req.body;
    const result = await updateBusiness(id, { name, category, status, adminEmail });
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};
```

- [ ] **Step 5: Run the new suite to confirm it passes**

Run: `cd backend && node tests/platform-business-edit.js`
Expected: `All platform-business-edit checks passed.`

- [ ] **Step 6: Add to the test chain**

Modify `backend/package.json`'s `"test"` script: append `&& node tests/platform-business-edit.js` after `node tests/voucher-expiry.js`.

- [ ] **Step 7: Run the full backend suite**

Run: `cd backend && npm test`
Expected: all suites pass.

- [ ] **Step 8: Commit**

```bash
git add backend/services/platformService.js backend/controllers/platformController.js backend/tests/platform-business-edit.js backend/package.json
git commit -m "feat(be): platform admin can edit business category + fix a wrong admin email

Fixing the admin email updates that business_admin's User row, resets
emailVerified to false, and resends the verification email to the new
address — solves the 'route is wasted, no way to verify' problem when
an admin email was mistyped at onboarding."
```

---

### Task C2: Frontend — real edit form on `BusinessDetail.tsx`

**Files:**
- Modify: `frontend/src/hooks/useAdminSettings.ts` (export `CATEGORY_LABELS` for reuse)
- Modify: `frontend/src/routes/platform/OnboardBusiness.tsx` (use the exported labels instead of its local copy)
- Modify: `frontend/src/routes/platform/BusinessDetail.tsx`

**Interfaces:**
- Produces: `CATEGORY_LABELS: Record<BusinessCategory, string>` exported from `useAdminSettings.ts` (single source of truth instead of `OnboardBusiness.tsx`'s local copy).
- Consumes: `PATCH /api/platform/businesses/:id` with `{ name?, category?, adminEmail? }` from Task C1.

- [ ] **Step 1: Move `CATEGORY_LABELS` into `useAdminSettings.ts` and export it**

Add, right after the existing `BusinessCategory` type export in `useAdminSettings.ts`:
```ts
export const CATEGORY_LABELS: Record<BusinessCategory, string> = {
  cafe: "Cafe",
  restaurant: "Restaurant",
  bakery: "Bakery",
  salon: "Salon",
  gym: "Gym",
  retail: "Retail",
  other: "Other",
};
```

- [ ] **Step 2: `OnboardBusiness.tsx` — drop its local copy, import the shared one**

Replace:
```tsx
import { BUSINESS_CATEGORIES, type BusinessCategory } from "../../hooks/useAdminSettings";

const CATEGORY_LABELS: Record<BusinessCategory, string> = {
  cafe: "Cafe",
  restaurant: "Restaurant",
  bakery: "Bakery",
  salon: "Salon",
  gym: "Gym",
  retail: "Retail",
  other: "Other",
};
```
With:
```tsx
import { BUSINESS_CATEGORIES, CATEGORY_LABELS, type BusinessCategory } from "../../hooks/useAdminSettings";
```

- [ ] **Step 3: `BusinessDetail.tsx` — add editable fields + save action**

Add imports:
```tsx
import { useEffect, useState } from "react";
import { CATEGORY_LABELS, BUSINESS_CATEGORIES, type BusinessCategory } from "../../hooks/useAdminSettings";
```
(the existing `import { useState } from "react";` becomes `import { useEffect, useState } from "react";`)

Add, inside the component, right after the existing `const [confirmOpen, setConfirmOpen] = useState(false);`:
```tsx
  const [form, setForm] = useState<{ name: string; category: BusinessCategory; adminEmail: string } | null>(null);

  useEffect(() => {
    if (business && !form) {
      setForm({ name: business.name, category: business.category, adminEmail: "" });
    }
  }, [business, form]);

  const update = useMutation({
    mutationFn: (patch: { name?: string; category?: BusinessCategory; adminEmail?: string }) =>
      apiRequest<{ success: boolean; admin?: { email: string } }>(`/api/platform/businesses/${id}`, {
        method: "PATCH",
        role: "platform",
        body: patch,
      }),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ["platformBusiness", id] });
      qc.invalidateQueries({ queryKey: ["platformBusinesses"] });
      toast.success(res.admin ? "Saved — a fresh verification email was sent." : "Saved!");
      setForm((f) => (f ? { ...f, adminEmail: "" } : f));
    },
    onError: (e) => toast.error((e as Error).message || "Couldn't save that — try again."),
  });

  const saveDetails = () => {
    if (!form) return;
    const patch: { name?: string; category?: BusinessCategory; adminEmail?: string } = {};
    if (business && form.name !== business.name) patch.name = form.name;
    if (business && form.category !== business.category) patch.category = form.category;
    if (form.adminEmail.trim()) patch.adminEmail = form.adminEmail.trim();
    if (Object.keys(patch).length === 0) return;
    update.mutate(patch);
  };
```

Note: `business.category` must exist on the `Business` type imported from `./Businesses` — check that file; if `category` isn't already on the `Business` interface there, add it (`category: BusinessCategory`) since `buildBusinessStats` on the backend already returns it.

Add the edit card in the JSX, right after the existing stats grid (`</div>` closing the `stats.map` grid) and before the `{suspended && (...)}` block:
```tsx
      {form && (
        <div className="mt-5 shadow-ambient rounded-3xl bg-[var(--surface)] p-6">
          <h3 className="mb-4 font-display text-lg font-bold text-[var(--ink)]">Edit details</h3>
          <div className="flex flex-col gap-4">
            <div>
              <label className="mb-1.5 block text-sm font-bold">Business name</label>
              <input
                value={form.name}
                onChange={(e) => setForm((f) => (f ? { ...f, name: e.target.value } : f))}
                className="w-full rounded-[11px] border border-[var(--line)] bg-[var(--bg)] px-4 py-3 text-sm focus:border-[var(--plat)] focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-bold">Category</label>
              <select
                value={form.category}
                onChange={(e) => setForm((f) => (f ? { ...f, category: e.target.value as BusinessCategory } : f))}
                className="w-full rounded-[11px] border border-[var(--line)] bg-[var(--bg)] px-4 py-3 text-sm focus:border-[var(--plat)] focus:outline-none"
              >
                {BUSINESS_CATEGORIES.map((c) => (
                  <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>
                ))}
              </select>
            </div>
            <div className="border-t border-[var(--line)] pt-4">
              <label className="mb-1.5 block text-sm font-bold">Fix admin email</label>
              <p className="mb-2 text-[13px] text-[var(--muted)]">
                Only fill this in if the admin's email was entered wrong — this resets their
                verification and resends a fresh link to the new address.
              </p>
              <input
                value={form.adminEmail}
                onChange={(e) => setForm((f) => (f ? { ...f, adminEmail: e.target.value } : f))}
                placeholder="leave blank to keep the current email"
                className="w-full rounded-[11px] border border-[var(--line)] bg-[var(--bg)] px-4 py-3 text-sm focus:border-[var(--plat)] focus:outline-none"
              />
            </div>
            <button
              onClick={saveDetails}
              disabled={update.isPending}
              className="stamp-interactive rounded-[13px] py-3 text-sm font-bold text-white disabled:opacity-50"
              style={{ background: "var(--plat)" }}
            >
              {update.isPending ? "Saving…" : "Save changes"}
            </button>
          </div>
        </div>
      )}
```

- [ ] **Step 4: Typecheck**

Run: `cd frontend && npx tsc --noEmit`
Expected: no errors. If `Business` (from `./Businesses`) doesn't have `category`, add it there first (check `frontend/src/routes/platform/Businesses.tsx`'s `Business` interface) and re-run.

- [ ] **Step 5: Browser check**

Onboard a test business, open its `BusinessDetail` page, confirm the new "Edit details" card renders with the current name/category prefilled, save a name change, then save a corrected admin email and confirm the toast says a fresh verification was sent.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/hooks/useAdminSettings.ts frontend/src/routes/platform/OnboardBusiness.tsx frontend/src/routes/platform/BusinessDetail.tsx frontend/src/routes/platform/Businesses.tsx
git commit -m "feat(fe): platform admin can edit a business's name/category and fix its admin email"
```

---

## Part D — Suspended-business UX (no more silent logout / generic 404)

### Task D1: Backend — give suspension a distinguishable error `code`

**Files:**
- Modify: `backend/middleware/authMiddleware.js` (~line 55-57)
- Modify: `backend/middleware/tenantMiddleware.js` (~line 53-56)
- Modify: `backend/server.js` (error handler, ~line 111-117)
- Test: extend `backend/tests/multi-tenant-isolation.js` (or add to whichever suite already exercises suspension — check first)

**Interfaces:**
- Produces: any error response caused by a suspended tenant now includes `code: "TENANT_SUSPENDED"` in its JSON body, alongside the existing `message`.

- [ ] **Step 1: Check which existing suite already exercises a suspended business**

Run: `grep -rln "suspended" backend/tests/`
Read whichever file(s) match to know where to add the new assertion in Step 5.

- [ ] **Step 2: Tag the authenticated-route check**

In `backend/middleware/authMiddleware.js`, find:
```js
      if (!organization || organization.status === "suspended") {
        const error = new Error("This business is suspended.");
        error.statusCode = 401;
```
Add a `code` line right after:
```js
      if (!organization || organization.status === "suspended") {
        const error = new Error("This business is suspended.");
        error.statusCode = 401;
        error.code = "TENANT_SUSPENDED";
```

- [ ] **Step 3: Tag the public-route check**

In `backend/middleware/tenantMiddleware.js`, find:
```js
    if (organization.status === "suspended") {
      const error = new Error("This business is currently unavailable.");
      error.statusCode = 403;
      throw error;
    }
```
Replace with:
```js
    if (organization.status === "suspended") {
      const error = new Error("This business is currently unavailable.");
      error.statusCode = 403;
      error.code = "TENANT_SUSPENDED";
      throw error;
    }
```

- [ ] **Step 4: Propagate `code` in the error handler**

In `backend/server.js`, find:
```js
app.use((error, _req, res, _next) => {
  const statusCode = error.statusCode || 500;
  res.status(statusCode).json({
    success: false,
    message: error.message || "Internal Server Error"
  });
});
```
Replace with:
```js
app.use((error, _req, res, _next) => {
  const statusCode = error.statusCode || 500;
  res.status(statusCode).json({
    success: false,
    message: error.message || "Internal Server Error",
    ...(error.code ? { code: error.code } : {})
  });
});
```

- [ ] **Step 5: Add assertions to the suite found in Step 1**

Add checks (in whichever file already suspends a business for its test) that both the authenticated-route error (e.g. hitting `/api/admin/settings` with a suspended tenant's admin token) and the public-route error (e.g. `GET /api/tenant` against a suspended slug) include `body.code === "TENANT_SUSPENDED"`.

- [ ] **Step 6: Run the full backend suite**

Run: `cd backend && npm test`
Expected: all suites pass.

- [ ] **Step 7: Commit**

```bash
git add backend/middleware/authMiddleware.js backend/middleware/tenantMiddleware.js backend/server.js backend/tests/
git commit -m "feat(be): tag suspended-tenant errors with code TENANT_SUSPENDED

Lets the frontend distinguish 'this business is suspended' from any
other auth/lookup failure without pattern-matching on English error
copy."
```

---

### Task D2: Frontend — expose `code`/`status` on thrown API errors

**Files:**
- Modify: `frontend/src/lib/api.ts`

**Interfaces:**
- Produces: every `Error` thrown by `apiRequest` now carries `.status: number` and `.code?: string` properties (in addition to the existing `.message`).

- [ ] **Step 1: Attach the fields**

Replace:
```ts
  if (!response.ok) {
    let errorMsg = "Something went wrong";
    try {
      const errJson = await response.json();
      errorMsg = errJson.message || errorMsg;
    } catch (_) {
      // ignore
    }
    throw new Error(errorMsg);
  }
```
With:
```ts
  if (!response.ok) {
    let errorMsg = "Something went wrong";
    let errCode: string | undefined;
    try {
      const errJson = await response.json();
      errorMsg = errJson.message || errorMsg;
      errCode = errJson.code;
    } catch (_) {
      // ignore
    }
    const error = new Error(errorMsg) as Error & { status?: number; code?: string };
    error.status = response.status;
    error.code = errCode;
    throw error;
  }
```

- [ ] **Step 2: Typecheck**

Run: `cd frontend && npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/lib/api.ts
git commit -m "feat(fe): apiRequest attaches status/code onto thrown errors"
```

---

### Task D3: Frontend — admin console shows a blurred, non-interactive overlay instead of logging out

**Files:**
- Create: `frontend/src/components/admin/SuspendedOverlay.tsx`
- Modify: `frontend/src/components/admin/AdminGuard.tsx`

**Interfaces:**
- Consumes: `error?.code` from `useAdminSettings()` (Task D2's typed error).
- Produces: `SuspendedOverlay` — a presentational component, no props needed beyond an optional `onLogout: () => void`.

- [ ] **Step 1: Create the overlay component**

```tsx
interface SuspendedOverlayProps {
  onLogout: () => void;
}

export function SuspendedOverlay({ onLogout }: SuspendedOverlayProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="mx-4 max-w-sm rounded-3xl bg-[var(--surface)] p-6 text-center shadow-xl">
        <h2 className="font-display text-xl font-bold text-[var(--ink)]">This business is suspended</h2>
        <p className="mt-2 text-sm text-[var(--muted)]">
          Contact the platform admin to find out why or to request reactivation. You won't be able
          to use the console until then.
        </p>
        <button
          onClick={onLogout}
          className="stamp-interactive mt-5 rounded-full border border-[var(--line)] bg-white px-5 py-2.5 text-sm font-bold"
        >
          Log out
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Wire it into `AdminGuard.tsx`**

Replace:
```tsx
import { useAdminAuth } from "../../context/AdminAuthContext";
import { useAdminSettings } from "../../hooks/useAdminSettings";
import { VerifyEmailGate } from "./VerifyEmailGate";

export function AdminGuard({ children }: { children: React.ReactNode }) {
  const { user, isLoading, logout } = useAdminAuth();
  const navigate = useNavigate();
  const { slug } = useParams();
  const { data: settings, isLoading: settingsLoading, isError: settingsError } = useAdminSettings();

  useEffect(() => {
    if (!isLoading && (!user || user.role !== "business_admin")) {
      navigate(slug ? `/${slug}/admin/login` : "/");
    }
  }, [user, isLoading, navigate, slug]);

  // A cached token can outlive the session it names (backend data reset,
  // token expiry). Without this, a stale token stuck the guard in a
  // permanent "Verifying credentials" loop — the settings fetch kept
  // 401ing while the guard kept trusting the stale localStorage user.
  useEffect(() => {
    if (settingsError && user) {
      logout();
      navigate(slug ? `/${slug}/admin/login` : "/");
    }
  }, [settingsError, user, logout, navigate, slug]);
```
With:
```tsx
import { useAdminAuth } from "../../context/AdminAuthContext";
import { useAdminSettings } from "../../hooks/useAdminSettings";
import { VerifyEmailGate } from "./VerifyEmailGate";
import { SuspendedOverlay } from "./SuspendedOverlay";

export function AdminGuard({ children }: { children: React.ReactNode }) {
  const { user, isLoading, logout } = useAdminAuth();
  const navigate = useNavigate();
  const { slug } = useParams();
  const { data: settings, isLoading: settingsLoading, isError: settingsError, error: settingsErrorObj } = useAdminSettings();
  const suspended = (settingsErrorObj as (Error & { code?: string }) | null)?.code === "TENANT_SUSPENDED";

  useEffect(() => {
    if (!isLoading && (!user || user.role !== "business_admin")) {
      navigate(slug ? `/${slug}/admin/login` : "/");
    }
  }, [user, isLoading, navigate, slug]);

  // A cached token can outlive the session it names (backend data reset,
  // token expiry). Without this, a stale token stuck the guard in a
  // permanent "Verifying credentials" loop — the settings fetch kept
  // 401ing while the guard kept trusting the stale localStorage user.
  // A SUSPENDED tenant is deliberately excluded here — that case shows the
  // blur overlay below instead of logging the admin out.
  useEffect(() => {
    if (settingsError && user && !suspended) {
      logout();
      navigate(slug ? `/${slug}/admin/login` : "/");
    }
  }, [settingsError, user, suspended, logout, navigate, slug]);
```

Then, replace the final render section:
```tsx
  if (settings && !settings.adminEmailVerified) {
    return <VerifyEmailGate />;
  }

  return <>{children}</>;
}
```
With:
```tsx
  if (suspended) {
    return (
      <div className="relative min-h-screen">
        <div className="pointer-events-none select-none blur-sm">{children}</div>
        <SuspendedOverlay onLogout={() => { logout(); navigate(slug ? `/${slug}/admin/login` : "/"); }} />
      </div>
    );
  }

  if (settings && !settings.adminEmailVerified) {
    return <VerifyEmailGate />;
  }

  return <>{children}</>;
}
```

Note: when `suspended` is true, `settingsLoading` is `false` (the query already settled into an error state) but `user` is still truthy from the cached login — so the loading-spinner branch above (`isLoading || (user && ... && settingsLoading)`) won't intercept this; the suspended branch is reached correctly. Verify this in Step 4.

- [ ] **Step 3: Typecheck**

Run: `cd frontend && npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Browser check**

As platform admin, suspend a business that has an already-logged-in admin session open in another tab/window (or the same tab, navigated to the admin dashboard first, then suspended, then reloaded). Confirm: the dashboard renders visually (blurred, non-interactive) underneath a centered "This business is suspended" card, with no redirect to login and no interaction possible on the blurred content. Reactivate the business and confirm the overlay disappears on next refetch/reload.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/admin/SuspendedOverlay.tsx frontend/src/components/admin/AdminGuard.tsx
git commit -m "feat(fe): suspended business shows a blurred non-interactive overlay instead of logging the admin out"
```

---

### Task D4: Frontend — customer-facing tenant pages tell the truth about suspension

**Files:**
- Modify: `frontend/src/context/TenantContext.tsx`

**Interfaces:**
- Produces: `TenantContextValue` gains `suspended: boolean` alongside the existing `notFound`.

- [ ] **Step 1: Extend the context value and distinguish the error**

Replace:
```tsx
interface TenantContextValue {
  slug: string;
  tenant: Tenant | null;
  isLoading: boolean;
  notFound: boolean;
}
```
With:
```tsx
interface TenantContextValue {
  slug: string;
  tenant: Tenant | null;
  isLoading: boolean;
  notFound: boolean;
  suspended: boolean;
}
```

Replace:
```tsx
  const {
    data: tenant,
    isLoading,
    isError,
  } = useQuery<Tenant>({
    queryKey: ["tenant", slug],
    queryFn: async () => {
      const res = await apiRequest<{ success: boolean; tenant: Tenant }>("/api/tenant");
      return res.tenant;
    },
    enabled: Boolean(slug),
  });

  const notFound = isError;
```
With:
```tsx
  const {
    data: tenant,
    isLoading,
    isError,
    error,
  } = useQuery<Tenant>({
    queryKey: ["tenant", slug],
    queryFn: async () => {
      const res = await apiRequest<{ success: boolean; tenant: Tenant }>("/api/tenant");
      return res.tenant;
    },
    enabled: Boolean(slug),
  });

  const suspended = (error as (Error & { code?: string }) | null)?.code === "TENANT_SUSPENDED";
  const notFound = isError && !suspended;
```

- [ ] **Step 2: Render an honest message for the suspended case**

Replace:
```tsx
  if (notFound || !tenant) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-[var(--bg)] px-6 text-center">
        <div className="font-display text-[90px] font-extrabold leading-none text-[var(--plat-soft)]">
          404
        </div>
        <h2 className="mt-2 font-display text-2xl font-bold text-[var(--ink)]">
          Business not found
        </h2>
        <p className="mt-2 max-w-sm text-sm text-[var(--muted)]">
          We couldn’t find a business at <span className="font-mono">/{slug}</span>. Check the link
          and try again.
        </p>
      </div>
    );
  }
```
With:
```tsx
  if (suspended) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-[var(--bg)] px-6 text-center">
        <h2 className="font-display text-2xl font-bold text-[var(--ink)]">
          Temporarily unavailable
        </h2>
        <p className="mt-2 max-w-sm text-sm text-[var(--muted)]">
          <span className="font-mono">/{slug}</span> isn't accepting visitors right now. Please
          check back later.
        </p>
      </div>
    );
  }

  if (notFound || !tenant) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-[var(--bg)] px-6 text-center">
        <div className="font-display text-[90px] font-extrabold leading-none text-[var(--plat-soft)]">
          404
        </div>
        <h2 className="mt-2 font-display text-2xl font-bold text-[var(--ink)]">
          Business not found
        </h2>
        <p className="mt-2 max-w-sm text-sm text-[var(--muted)]">
          We couldn’t find a business at <span className="font-mono">/{slug}</span>. Check the link
          and try again.
        </p>
      </div>
    );
  }
```

- [ ] **Step 3: Update the Provider's context value**

Replace:
```tsx
    <TenantContext.Provider value={{ slug, tenant, isLoading, notFound }}>
```
With:
```tsx
    <TenantContext.Provider value={{ slug, tenant, isLoading, notFound, suspended }}>
```

- [ ] **Step 4: Typecheck**

Run: `cd frontend && npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 5: Browser check**

Suspend a business, visit its customer-facing `/:slug` root as a logged-out visitor. Confirm the page shows "Temporarily unavailable" (not a 404 numeral, not the generic "Business not found" copy). Reactivate and confirm the tenant loads normally again.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/context/TenantContext.tsx
git commit -m "feat(fe): customer-facing pages show an honest 'temporarily unavailable' message for a suspended tenant, distinct from 404"
```

---

## Part E — Ship it

### Task E1: Full verification pass

- [ ] **Step 1: Backend** — `cd backend && npm test` — expect all suites pass, including the 2 new ones.
- [ ] **Step 2: Frontend** — `cd frontend && npx tsc --noEmit` — expect no errors.
- [ ] **Step 3: Browser walk** — repeat every "Browser check" step above in one live pass against a running mock-DB backend: (a) create Business B right after viewing Business A's admin console in the same tab, confirm B's console shows zero customers/default settings, not A's; (b) onboard a business, confirm the hand-off link opens the admin login, not the customer app; (c) edit a business's name/category/admin-email from `BusinessDetail.tsx`, confirm the email-fix path resends verification and the old email stops working; (d) suspend a business with an admin session open, confirm the blur overlay (not logout); (e) visit a suspended business's customer-facing root, confirm the honest "temporarily unavailable" message.
- [ ] **Step 4: Fix anything the walk surfaces as its own small commit, re-verify, then proceed.**

### Task E2: Merge to `main` and push

Same process as prior rounds this session: branch off `main`, work through Parts A-D, verify, then `git checkout main && git merge --no-edit <branch> && git push origin main` — per the user's standing authorization to merge/push without an additional approval gate once tests pass and the browser walk confirms things work.
