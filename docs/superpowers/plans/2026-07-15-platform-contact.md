# Epic E2: Platform Contact Info Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give the Stampd platform (the SaaS itself, not a tenant) its own contact info — phone, email, address, hours, about-us, socials — editable by the platform admin and shown on the public platform landing page.

**Architecture:** A new singleton Mongo document (`PlatformConfig`, one document total, looked up by a fixed `singleton: true` key) holds the contact sub-object, exposed via one public read endpoint and an admin-only read/write pair, edited through a new platform-console page, and rendered on `PlatformLanding.tsx`.

**Tech Stack:** Node/Express/Mongoose (mock DB in dev), React 19/Vite/TS, TanStack Query, Tailwind v4, lucide-react icons.

## Global Constraints

- Backend layering: `routes/ → controllers/ (thin) → services/ (logic) → models/`. No business logic in controllers.
- `req.user.id` (not `req.user.userId`) is the field set by `verifyToken` — irrelevant here since these endpoints don't touch `req.user.id`, but never assume otherwise if touching auth code.
- Contact field shape: `{ phone, email, address, hours, aboutUs, socials: { instagram, facebook, x } }` — no latitude/longitude (unlike tenant `Organization.contact`).
- Contact merge on PATCH is a **shallow merge** (`{ ...current, ...patch }`), matching the exact pattern already used in `tenantController.updateMySettings` for `Organization.contact` — not a deep/nested merge. The frontend form always sends the full contact object, so this is sufficient.
- Validation regexes for phone/email fields in the frontend form: reuse the exact patterns already defined in `AdminContact.tsx` — `EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/`, `PHONE_RE = /^\+?[0-9\s\-()]{7,20}$/`.
- Platform accent color is `var(--plat)` (maroon, `#8B2635`), not `var(--brand)` (tenant colour) — the new page belongs in the platform console, not a tenant's.
- Test suites are plain Node scripts under `backend/tests/`, each booting the real server via `backend/tests/helpers/bootServer.js` on its own dedicated port, driving it over real HTTP only (no framework, no supertest).
- Seeded platform admin credentials for tests: `admin@stampd.co` / `password` (see `backend/tests/business-contact.js` for the exact login call — `POST /api/platform/login` with no `X-Tenant-Slug` header needed).

---

### Task 1: Backend — PlatformConfig model, service, controller, routes, tests

**Files:**
- Create: `backend/models/PlatformConfig.js`
- Create: `backend/services/platformConfigService.js`
- Modify: `backend/controllers/platformController.js`
- Modify: `backend/routes/platformRoutes.js`
- Create: `backend/tests/platform-contact.js`
- Modify: `backend/package.json:7` (test script)

**Interfaces:**
- Consumes: `authMiddleware.js`'s `verifyToken`, `isPlatformAdmin` (already imported in `platformRoutes.js`).
- Produces: `getContact(): Promise<Contact>`, `updateContact(patch: Partial<Contact>): Promise<Contact>` in `platformConfigService.js`, where `Contact = { phone: string, email: string, address: string, hours: string, aboutUs: string, socials: { instagram: string, facebook: string, x: string } }`. Controller functions `getPublicPlatformContact`, `getPlatformContactAdmin`, `patchPlatformContact` in `platformController.js`. Routes `GET /api/platform/public-contact`, `GET /api/platform/contact`, `PATCH /api/platform/contact`. These are what Task 2's frontend hook calls.

- [ ] **Step 1: Create the `PlatformConfig` model**

Create `backend/models/PlatformConfig.js`:

```js
const mongoose = require("mongoose");

// Singleton config for the platform itself (the SaaS, not a tenant) — there
// is exactly one document, always looked up by the fixed `singleton: true`
// key via findOneAndUpdate(..., { upsert: true }). Distinct from a tenant's
// own Organization.contact (D3): this is the platform's own contact info,
// shown on the public platform landing page, not any business's.
const PlatformConfigSchema = new mongoose.Schema({
  singleton: { type: Boolean, default: true, unique: true },

  contact: {
    phone: { type: String, default: "" },
    email: { type: String, default: "" },
    address: { type: String, default: "" },
    hours: { type: String, default: "" },
    aboutUs: { type: String, default: "" },
    socials: {
      instagram: { type: String, default: "" },
      facebook: { type: String, default: "" },
      x: { type: String, default: "" }
    }
  }
});

module.exports = mongoose.model("PlatformConfig", PlatformConfigSchema);
```

- [ ] **Step 2: Create the service**

Create `backend/services/platformConfigService.js`:

```js
const PlatformConfig = require("../models/PlatformConfig");

// findOneAndUpdate with upsert:true and an empty update means "create with
// schema defaults if the singleton doesn't exist yet, otherwise return it
// as-is" — one call handles both "never configured" and "already configured".
const getConfig = () =>
  PlatformConfig.findOneAndUpdate(
    { singleton: true },
    {},
    { upsert: true, new: true }
  );

const getContact = async () => {
  const config = await getConfig();
  return config.contact;
};

const updateContact = async (patch) => {
  const config = await getConfig();
  const updatedContact = {
    ...config.contact,
    ...patch
  };

  const updated = await PlatformConfig.findOneAndUpdate(
    { singleton: true },
    { $set: { contact: updatedContact } },
    { upsert: true, new: true }
  );

  return updated.contact;
};

module.exports = {
  getContact,
  updateContact
};
```

- [ ] **Step 3: Add controller functions**

In `backend/controllers/platformController.js`, add the import and three new functions, and export them:

```js
const {
  loginPlatformAdmin,
  listBusinesses,
  createBusiness,
  getBusiness,
  updateBusiness
} = require("../services/platformService");
const {
  getContact,
  updateContact
} = require("../services/platformConfigService");
```

Add these functions before the final `module.exports`:

```js
const getPublicPlatformContact = async (req, res, next) => {
  try {
    const contact = await getContact();
    res.status(200).json({ success: true, contact });
  } catch (error) {
    next(error);
  }
};

const getPlatformContactAdmin = async (req, res, next) => {
  try {
    const contact = await getContact();
    res.status(200).json({ success: true, contact });
  } catch (error) {
    next(error);
  }
};

const patchPlatformContact = async (req, res, next) => {
  try {
    const contact = await updateContact(req.body || {});
    res.status(200).json({ success: true, contact });
  } catch (error) {
    next(error);
  }
};
```

Update `module.exports` at the bottom of the file to:

```js
module.exports = {
  platformLogin,
  getBusinesses,
  postBusiness,
  getBusinessById,
  patchBusiness,
  getPublicPlatformContact,
  getPlatformContactAdmin,
  patchPlatformContact
};
```

- [ ] **Step 4: Wire routes**

Replace the full contents of `backend/routes/platformRoutes.js` with:

```js
const express = require("express");
const {
  platformLogin,
  getBusinesses,
  postBusiness,
  getBusinessById,
  patchBusiness,
  getPublicPlatformContact,
  getPlatformContactAdmin,
  patchPlatformContact
} = require("../controllers/platformController");
const { verifyToken, isPlatformAdmin } = require("../middleware/authMiddleware");

const router = express.Router();

router.post("/login", platformLogin);
router.get("/businesses", verifyToken, isPlatformAdmin, getBusinesses);
router.post("/businesses", verifyToken, isPlatformAdmin, postBusiness);
router.get("/businesses/:id", verifyToken, isPlatformAdmin, getBusinessById);
router.patch("/businesses/:id", verifyToken, isPlatformAdmin, patchBusiness);
router.get("/public-contact", getPublicPlatformContact);
router.get("/contact", verifyToken, isPlatformAdmin, getPlatformContactAdmin);
router.patch("/contact", verifyToken, isPlatformAdmin, patchPlatformContact);

module.exports = router;
```

- [ ] **Step 5: Write the test suite**

Create `backend/tests/platform-contact.js`:

```js
/**
 * Platform contact info suite (Epic E2).
 *
 * Self-contained: boots its own server on a dedicated port against the
 * in-memory mock DB. Confirms the public endpoint works before any config
 * exists, that the platform admin can save contact info, that the public
 * endpoint reflects it afterward, and that the admin-only endpoints reject
 * unauthenticated/non-platform callers.
 *
 * Run directly: `node tests/platform-contact.js`
 */

const { bootServer } = require("./helpers/bootServer");

async function main() {
  const { baseUrl, stop } = await bootServer({ port: 5019 });
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
    const beforeConfig = await api("/api/platform/public-contact");
    check("GET public-contact before config -> 200", beforeConfig.status === 200);
    check("public-contact starts with empty phone", beforeConfig.body.contact?.phone === "");
    check("public-contact starts with empty email", beforeConfig.body.contact?.email === "");

    const patchNoToken = await api("/api/platform/contact", {
      method: "PATCH",
      body: { phone: "555-0100" },
    });
    check("PATCH contact without token -> 401", patchNoToken.status === 401);

    const platformLogin = await api("/api/platform/login", {
      method: "POST",
      body: { email: "admin@stampd.co", password: "password" },
    });
    const platformToken = platformLogin.body.token;
    check("platform login -> token issued", Boolean(platformToken));

    const adminLogin = await api("/api/auth/login", {
      method: "POST",
      body: { email: "barista@mansarowar.cafe", password: "password" },
    });
    const adminToken = adminLogin.body.token;

    const patchWrongRole = await api("/api/platform/contact", {
      method: "PATCH",
      token: adminToken,
      body: { phone: "555-0100" },
    });
    check("PATCH contact with business_admin token -> 403", patchWrongRole.status === 403);

    const contactPayload = {
      phone: "+1 555 0100",
      email: "hello@stampd.co",
      address: "500 Market St, San Francisco",
      hours: "Mon-Fri: 9am-5pm",
      aboutUs: "Digital loyalty for local business.",
      socials: {
        instagram: "https://instagram.com/stampd",
        facebook: "https://facebook.com/stampd",
        x: "https://x.com/stampd",
      },
    };

    const patched = await api("/api/platform/contact", {
      method: "PATCH",
      token: platformToken,
      body: contactPayload,
    });
    check("PATCH contact as platform admin -> 200", patched.status === 200);
    check("PATCH response echoes phone", patched.body.contact?.phone === contactPayload.phone);
    check("PATCH response echoes instagram", patched.body.contact?.socials?.instagram === contactPayload.socials.instagram);

    const afterAdminGet = await api("/api/platform/contact", { token: platformToken });
    check("GET contact (admin) -> 200", afterAdminGet.status === 200);
    check("GET contact (admin) persists address", afterAdminGet.body.contact?.address === contactPayload.address);

    const afterPublicGet = await api("/api/platform/public-contact");
    check("GET public-contact after update -> 200", afterPublicGet.status === 200);
    check("public-contact reflects update", afterPublicGet.body.contact?.email === contactPayload.email);
    check("public-contact reflects hours", afterPublicGet.body.contact?.hours === contactPayload.hours);
  } finally {
    stop();
  }

  if (failures) { console.error(`platform-contact: ${failures} FAILED`); process.exitCode = 1; }
  else console.log("platform-contact: all PASS");
}

main().catch((e) => { console.error(e); process.exitCode = 1; });
```

- [ ] **Step 6: Run the test suite, expect failures before nothing is wired — then confirm it passes**

Run: `node backend/tests/platform-contact.js`
Expected: `platform-contact: all PASS` (the model/service/controller/routes were all written in Steps 1-4 before this run, so this confirms the whole vertical slice — no separate red/green cycle needed since this is a single self-contained suite, not a unit test with a mock to fill in later).

If any check fails, re-read the failing assertion, fix the corresponding Step 1-4 file, and re-run.

- [ ] **Step 7: Add the suite to the root test script**

In `backend/package.json`, change the `test` script (line 7) from:

```json
"test": "node tests/integration-qa.js && node tests/run-voucher-test.js && node tests/multi-tenant-isolation.js && node tests/auth-email-flow.js && node tests/min-bill-amount.js && node tests/menu-import.js && node tests/customer-detail.js && node tests/business-reports.js && node tests/business-contact.js && node tests/menu-featured.js && node tests/upcoming-events.js && node tests/account-settings.js",
```

to (append `&& node tests/platform-contact.js`):

```json
"test": "node tests/integration-qa.js && node tests/run-voucher-test.js && node tests/multi-tenant-isolation.js && node tests/auth-email-flow.js && node tests/min-bill-amount.js && node tests/menu-import.js && node tests/customer-detail.js && node tests/business-reports.js && node tests/business-contact.js && node tests/menu-featured.js && node tests/upcoming-events.js && node tests/account-settings.js && node tests/platform-contact.js",
```

- [ ] **Step 8: Run the full backend suite**

Run: `cd backend && npm test`
Expected: all suites print `all PASS` (or equivalent success line), process exits 0.

- [ ] **Step 9: Commit**

```bash
git add backend/models/PlatformConfig.js backend/services/platformConfigService.js backend/controllers/platformController.js backend/routes/platformRoutes.js backend/tests/platform-contact.js backend/package.json
git commit -m "feat(platform): platform contact info API + tests"
```

---

### Task 2: Frontend — hook + PlatformContact console page + nav

**Files:**
- Create: `frontend/src/hooks/usePlatformContact.ts`
- Create: `frontend/src/routes/platform/PlatformContact.tsx`
- Modify: `frontend/src/components/platform/PlatformLayout.tsx`
- Modify: `frontend/src/App.tsx`

**Interfaces:**
- Consumes: `GET /api/platform/public-contact`, `GET /api/platform/contact`, `PATCH /api/platform/contact` (Task 1). `apiRequest<T>(path, options)` from `frontend/src/lib/api.ts` (options: `{ method?, role?, body? }`).
- Produces: `usePlatformContact(): UseQueryResult<PlatformContact>` (public, no role needed — no admin token required to read), `usePlatformContactAdmin(): UseQueryResult<PlatformContact>` (authed), `useUpdatePlatformContact(): UseMutationResult<PlatformContact, Error, Partial<PlatformContact>>` in `usePlatformContact.ts`, where `PlatformContact = { phone: string; email: string; address: string; hours: string; aboutUs: string; socials: { instagram: string; facebook: string; x: string } }`. Task 3 imports `usePlatformContact` from this same file.

- [ ] **Step 1: Create the hook file**

Create `frontend/src/hooks/usePlatformContact.ts`:

```ts
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "../lib/api";

export interface PlatformContact {
  phone: string;
  email: string;
  address: string;
  hours: string;
  aboutUs: string;
  socials: {
    instagram: string;
    facebook: string;
    x: string;
  };
}

// Public read — used by the platform landing page. No auth required, no
// role needed (the request just carries no Authorization header at all
// since the route ignores it).
export function usePlatformContact() {
  return useQuery<PlatformContact>({
    queryKey: ["platformContact", "public"],
    queryFn: async () => {
      const res = await apiRequest<{ success: boolean; contact: PlatformContact }>(
        "/api/platform/public-contact",
      );
      return res.contact;
    },
    staleTime: 1000 * 60,
  });
}

// Authenticated read — used by the platform console's Contact page.
export function usePlatformContactAdmin() {
  return useQuery<PlatformContact>({
    queryKey: ["platformContact", "admin"],
    queryFn: async () => {
      const res = await apiRequest<{ success: boolean; contact: PlatformContact }>(
        "/api/platform/contact",
        { role: "platform" },
      );
      return res.contact;
    },
  });
}

export function useUpdatePlatformContact() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (patch: Partial<PlatformContact>) => {
      const res = await apiRequest<{ success: boolean; contact: PlatformContact }>(
        "/api/platform/contact",
        { method: "PATCH", role: "platform", body: patch },
      );
      return res.contact;
    },
    onSuccess: (contact) => {
      qc.setQueryData(["platformContact", "admin"], contact);
      qc.setQueryData(["platformContact", "public"], contact);
    },
  });
}
```

- [ ] **Step 2: Create the PlatformContact page**

Create `frontend/src/routes/platform/PlatformContact.tsx`:

```tsx
import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import {
  usePlatformContactAdmin,
  useUpdatePlatformContact,
  type PlatformContact as PlatformContactData,
} from "../../hooks/usePlatformContact";

const EMPTY_CONTACT: PlatformContactData = {
  phone: "",
  email: "",
  address: "",
  hours: "",
  aboutUs: "",
  socials: { instagram: "", facebook: "", x: "" },
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_RE = /^\+?[0-9\s\-()]{7,20}$/;

export default function PlatformContact() {
  const { data: settings, isLoading } = usePlatformContactAdmin();
  const update = useUpdatePlatformContact();
  const [contact, setContact] = useState<PlatformContactData | null>(null);

  useEffect(() => {
    if (settings && !contact) {
      setContact(settings ?? EMPTY_CONTACT);
    }
  }, [settings, contact]);

  if (isLoading || !contact) {
    return <div className="text-sm text-[var(--muted)]">Loading…</div>;
  }

  const set = <K extends keyof PlatformContactData>(k: K, v: PlatformContactData[K]) =>
    setContact((c) => (c ? { ...c, [k]: v } : c));

  const setSocial = (k: keyof PlatformContactData["socials"], v: string) =>
    setContact((c) => (c ? { ...c, socials: { ...c.socials, [k]: v } } : c));

  const phoneError = contact.phone && !PHONE_RE.test(contact.phone) ? "Enter a valid phone number." : "";
  const emailError = contact.email && !EMAIL_RE.test(contact.email) ? "Enter a valid email address." : "";
  const hasErrors = Boolean(phoneError || emailError);

  const save = async () => {
    if (hasErrors) return;
    try {
      await update.mutateAsync(contact);
      toast.success("Contact info saved");
    } catch (err) {
      toast.error((err as Error).message || "Failed to save.");
    }
  };

  return (
    <div>
      <h1 className="font-display text-[28px] font-extrabold text-[var(--ink)]">Contact</h1>
      <p className="mb-6 text-[var(--muted)]">
        Shown to visitors on the public {"Stampd"} landing page.
      </p>

      <div className="flex max-w-[560px] flex-col gap-5 rounded-[20px] border border-[var(--line)] bg-[var(--surface)] p-6">
        <Field label="Phone" error={phoneError}>
          <input
            value={contact.phone}
            onChange={(e) => set("phone", e.target.value)}
            className={`w-full rounded-[11px] border bg-[var(--bg)] px-4 py-3 text-sm focus:outline-none ${
              phoneError ? "border-[var(--err)]" : "border-[var(--line)] focus:border-[var(--plat)]"
            }`}
          />
        </Field>
        <Field label="Email" error={emailError}>
          <input
            value={contact.email}
            onChange={(e) => set("email", e.target.value)}
            className={`w-full rounded-[11px] border bg-[var(--bg)] px-4 py-3 text-sm focus:outline-none ${
              emailError ? "border-[var(--err)]" : "border-[var(--line)] focus:border-[var(--plat)]"
            }`}
          />
        </Field>
        <Field label="Address">
          <input
            value={contact.address}
            onChange={(e) => set("address", e.target.value)}
            className="w-full rounded-[11px] border border-[var(--line)] bg-[var(--bg)] px-4 py-3 text-sm focus:border-[var(--plat)] focus:outline-none"
          />
        </Field>
        <Field label="Hours">
          <textarea
            value={contact.hours}
            onChange={(e) => set("hours", e.target.value)}
            rows={2}
            placeholder="Mon–Fri: 9am–5pm"
            className="w-full rounded-[11px] border border-[var(--line)] bg-[var(--bg)] px-4 py-3 text-sm focus:border-[var(--plat)] focus:outline-none"
          />
        </Field>
        <Field label="About us">
          <textarea
            value={contact.aboutUs}
            onChange={(e) => set("aboutUs", e.target.value)}
            rows={3}
            className="w-full rounded-[11px] border border-[var(--line)] bg-[var(--bg)] px-4 py-3 text-sm focus:border-[var(--plat)] focus:outline-none"
          />
        </Field>
        <Field label="Instagram URL">
          <input
            value={contact.socials.instagram}
            onChange={(e) => setSocial("instagram", e.target.value)}
            placeholder="https://instagram.com/…"
            className="w-full rounded-[11px] border border-[var(--line)] bg-[var(--bg)] px-4 py-3 text-sm focus:border-[var(--plat)] focus:outline-none"
          />
        </Field>
        <Field label="Facebook URL">
          <input
            value={contact.socials.facebook}
            onChange={(e) => setSocial("facebook", e.target.value)}
            placeholder="https://facebook.com/…"
            className="w-full rounded-[11px] border border-[var(--line)] bg-[var(--bg)] px-4 py-3 text-sm focus:border-[var(--plat)] focus:outline-none"
          />
        </Field>
        <Field label="X (Twitter) URL">
          <input
            value={contact.socials.x}
            onChange={(e) => setSocial("x", e.target.value)}
            placeholder="https://x.com/…"
            className="w-full rounded-[11px] border border-[var(--line)] bg-[var(--bg)] px-4 py-3 text-sm focus:border-[var(--plat)] focus:outline-none"
          />
        </Field>

        <button
          onClick={save}
          disabled={update.isPending || hasErrors}
          className="rounded-[13px] py-3.5 text-[15px] font-bold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
          style={{ background: "var(--plat)" }}
        >
          {update.isPending ? "Saving…" : "Save contact info"}
        </button>
      </div>
    </div>
  );
}

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1.5 block text-sm font-bold">{label}</label>
      {children}
      {error && <p className="mt-1 text-xs font-semibold text-[var(--err)]">{error}</p>}
    </div>
  );
}
```

- [ ] **Step 3: Add the sidebar nav entry**

In `frontend/src/components/platform/PlatformLayout.tsx`, change the icon import (line 3) from:

```tsx
import { Building2, PlusCircle } from "lucide-react";
```

to:

```tsx
import { Building2, PlusCircle, Phone } from "lucide-react";
```

And change the `NAV` array (lines 9-12) from:

```tsx
const NAV = [
  { to: "", end: true, label: "Businesses", Icon: Building2 },
  { to: "onboard", label: "Onboard new", Icon: PlusCircle },
];
```

to:

```tsx
const NAV = [
  { to: "", end: true, label: "Businesses", Icon: Building2 },
  { to: "onboard", label: "Onboard new", Icon: PlusCircle },
  { to: "contact", label: "Contact", Icon: Phone },
];
```

No other change needed in this file — the existing `NAV.map(...)` render logic already handles any entry in the array.

- [ ] **Step 4: Wire the route**

In `frontend/src/App.tsx`, add a lazy import next to the other platform lazy imports (after the `PlatformSettings` line, ~line 33):

```tsx
const PlatformContact = lazy(() => import('./routes/platform/PlatformContact'));
```

Then add a route inside the existing `<Route path="/platform" element={<PlatformLayout />}>` block (sibling of the `settings` route at ~line 89):

```tsx
<Route path="contact" element={<PlatformContact />} />
```

- [ ] **Step 5: Manual verification**

Run: `npm run dev` (repo root)

In a browser: log in to `/platform/login` as `admin@stampd.co` / `password`, click "Contact" in the sidebar, fill in phone/email/address/hours/about-us/socials, click "Save contact info", reload the page, confirm the values persisted. Try an invalid phone (e.g. `"abc"`) and invalid email (e.g. `"not-an-email"`) — confirm red border + inline error text appear and the Save button disables.

- [ ] **Step 6: Typecheck**

Run: `npm run lint` (repo root — this runs `tsc --noEmit` on the frontend)
Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add frontend/src/hooks/usePlatformContact.ts frontend/src/routes/platform/PlatformContact.tsx frontend/src/components/platform/PlatformLayout.tsx frontend/src/App.tsx
git commit -m "feat(platform-fe): platform Contact console page + nav"
```

---

### Task 3: Frontend — Contact us section on the platform landing page

**Files:**
- Modify: `frontend/src/routes/platform/PlatformLanding.tsx`

**Interfaces:**
- Consumes: `usePlatformContact()` from `frontend/src/hooks/usePlatformContact.ts` (Task 2), returning `PlatformContact | undefined`.
- Produces: nothing new consumed by later tasks — this is the last frontend task.

- [ ] **Step 1: Add the import and hook call**

In `frontend/src/routes/platform/PlatformLanding.tsx`, add to the top imports (after line 3, the `PLATFORM_NAME` import):

```tsx
import { Phone, Mail, MapPin, Clock, Instagram, Facebook, Twitter } from "lucide-react";
import { usePlatformContact } from "../../hooks/usePlatformContact";
```

Inside the `PlatformLanding` component, after the `useEffect` block (~line 25), add:

```tsx
const { data: contact } = usePlatformContact();
const hasContact = Boolean(
  contact &&
    (contact.phone ||
      contact.email ||
      contact.address ||
      contact.hours ||
      contact.aboutUs ||
      contact.socials.instagram ||
      contact.socials.facebook ||
      contact.socials.x)
);
```

- [ ] **Step 2: Add the Contact us section**

In the same file, insert this new `<section>` immediately before the closing `<footer>` element (~line 170, right after the FAQ `</section>` and before `<footer className="mt-6 border-t border-[var(--line)]">`):

```tsx
{hasContact && contact && (
  <section className="mx-auto max-w-[760px] px-6 py-10">
    <h2 className="mb-6 text-center font-display text-[30px] font-extrabold">Contact us</h2>
    <div className="rounded-[20px] border border-[var(--line)] bg-[var(--surface)] p-6">
      {contact.address && (
        <div className="mb-2 flex items-start gap-2 text-sm text-[var(--ink)]">
          <MapPin className="mt-0.5 h-4 w-4 flex-shrink-0 text-[var(--muted)]" />
          {contact.address}
        </div>
      )}
      {contact.phone && (
        <a href={`tel:${contact.phone}`} className="mb-2 flex items-center gap-2 text-sm text-[var(--ink)]">
          <Phone className="h-4 w-4 flex-shrink-0 text-[var(--muted)]" />
          {contact.phone}
        </a>
      )}
      {contact.email && (
        <a href={`mailto:${contact.email}`} className="mb-2 flex items-center gap-2 text-sm text-[var(--ink)]">
          <Mail className="h-4 w-4 flex-shrink-0 text-[var(--muted)]" />
          {contact.email}
        </a>
      )}
      {contact.hours && (
        <div className="mb-2 flex items-start gap-2 whitespace-pre-line text-sm text-[var(--ink)]">
          <Clock className="mt-0.5 h-4 w-4 flex-shrink-0 text-[var(--muted)]" />
          {contact.hours}
        </div>
      )}
      {contact.aboutUs && <p className="mb-3 text-sm text-[var(--muted)]">{contact.aboutUs}</p>}
      {(contact.socials.instagram || contact.socials.facebook || contact.socials.x) && (
        <div className="flex gap-2">
          {contact.socials.instagram && (
            <a
              href={contact.socials.instagram}
              target="_blank"
              rel="noreferrer"
              className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--bg)] text-[var(--muted)] hover:text-[var(--plat)]"
              aria-label="Instagram"
            >
              <Instagram className="h-4 w-4" />
            </a>
          )}
          {contact.socials.facebook && (
            <a
              href={contact.socials.facebook}
              target="_blank"
              rel="noreferrer"
              className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--bg)] text-[var(--muted)] hover:text-[var(--plat)]"
              aria-label="Facebook"
            >
              <Facebook className="h-4 w-4" />
            </a>
          )}
          {contact.socials.x && (
            <a
              href={contact.socials.x}
              target="_blank"
              rel="noreferrer"
              className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--bg)] text-[var(--muted)] hover:text-[var(--plat)]"
              aria-label="X (Twitter)"
            >
              <Twitter className="h-4 w-4" />
            </a>
          )}
        </div>
      )}
    </div>
  </section>
)}
```

- [ ] **Step 3: Manual verification**

Run: `npm run dev`, visit `/` in a browser.

Before any contact info is saved (fresh mock DB): confirm no "Contact us" section renders (all fields empty). Log in to `/platform/contact` (Task 2), save some fields, revisit `/` — confirm the "Contact us" section now renders with only the fields that were filled in.

- [ ] **Step 4: Typecheck**

Run: `npm run lint`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/routes/platform/PlatformLanding.tsx
git commit -m "feat(platform-fe): Contact us section on platform landing page"
```

---

### Task 4: Full verification pass

**Files:** none (verification only).

**Interfaces:**
- Consumes: everything from Tasks 1-3.
- Produces: nothing — terminal task.

- [ ] **Step 1: Run the full backend suite**

Run: `cd backend && npm test`
Expected: every suite (including `tests/platform-contact.js`) prints a PASS/success line, process exits 0.

- [ ] **Step 2: Run the frontend typecheck**

Run: `npm run lint` (repo root)
Expected: no errors.

- [ ] **Step 3: Browser walkthrough (fresh mock DB)**

Run: `npm run dev` (repo root — backend :5001 + frontend :3000, fresh in-memory DB).

1. Visit `/` — confirm no "Contact us" section (nothing configured yet).
2. Visit `/platform/login`, log in as `admin@stampd.co` / `password`.
3. Click "Contact" in the sidebar — confirm the form loads with all fields empty.
4. Enter a full set of values (phone, email, address, hours, about us, all 3 socials), click "Save contact info" — confirm a success toast and the values remain after a page reload.
5. Clear the phone field and type `"abc"` — confirm red border + "Enter a valid phone number." appears and Save disables. Fix it back to a valid value.
6. Navigate to `/` again — confirm the new "Contact us" section renders all the saved fields, socials render as clickable icons opening the right URLs in a new tab.
7. Confirm the existing "Businesses" and "Onboard new" nav items and their pages still work unaffected.

- [ ] **Step 4: Confirm no regressions in tenant contact (D3) or account settings (E1)**

Quick spot-check only (both suites are already covered by `npm test` in Step 1): visit a tenant's `/coffesarowar/admin/contact` page and confirm it still loads/saves correctly, and confirm `/platform/settings` (E1's account settings page) still works — these share no code with the new platform-contact feature but sit in the same nav/layout file (`PlatformLayout.tsx`), so a quick look confirms the nav edit in Task 2 Step 3 didn't break anything else.

- [ ] **Step 5: Report**

Summarize pass/fail for backend suite, typecheck, and browser walkthrough. If everything passes, this epic is ready for the finishing-a-development-branch flow.
