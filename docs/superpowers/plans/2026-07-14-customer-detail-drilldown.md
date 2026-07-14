# Epic D1 — Customer Detail Drill-in Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Clicking a customer row in the admin Customers screen opens a drawer with full detail — phone, address, stamps, lifetime vouchers, total spent, recent visits.

**Architecture:** A small precursor persists `billAmount` (entered at QR-generation time, previously discarded per Epic B1) through `DynamicQRToken` onto `StampClaimEvent`, so a lifetime "total spent" sum becomes possible. `getCustomersList` is extended with the new fields. The frontend adds a click-to-open drawer component.

**Tech Stack:** Node/Express, Mongoose (+ in-memory mock in dev), React 19 + Vite + TS, TanStack Query.

## Global Constraints

- Every user/loyalty query includes `organizationId` — tenant isolation is the core invariant.
- Backend layering: `routes/ → controllers/ (thin) → services/ (logic) → models/`.
- `billAmount` persistence is **going-forward only** — no backfill for existing `StampClaimEvent` docs; they have `billAmount: null` and contribute 0 to any sum.
- `lifetimeVoucherCount` counts **every** `Voucher` for a customer (no `isValid` filter) — distinct from the existing `validVoucherCount`, which stays unchanged.
- The min-bill-amount **gate logic** in `generateQRToken` (hard-reject below `minBillAmount`) is unchanged by this plan — only persistence of the already-validated value is added.
- Use `Model.countDocuments(query)` for counts — confirmed supported by the in-memory mock (`backend/utils/mockMongoose.js:430`), matching real Mongoose semantics exactly.
- Commit with explicit file paths (`git add <path>`) — never `git add -A`.

---

### Task 1: Backend — billAmount persistence + customer detail fields

**Files:**
- Modify: `backend/models/DynamicQRToken.js`
- Modify: `backend/models/StampClaimEvent.js`
- Modify: `backend/services/stampService.js`
- Modify: `backend/controllers/stampController.js`
- Create: `backend/tests/customer-detail.js`
- Modify: `backend/package.json`

**Interfaces:**
- Produces: `GET /api/admin/customers` response items gain `phone: string`, `address: string`, `lifetimeVoucherCount: number`, `totalSpent: number` (in addition to the existing `id, name, email, customerNo, stampsEarned, lastStampedAt, validVoucherCount, scanHistory`).

- [ ] **Step 1: Add the schema fields**

In `backend/models/DynamicQRToken.js`, add `billAmount` alongside the existing fields:

```js
const DynamicQRTokenSchema = new mongoose.Schema({
  organizationId: { type: mongoose.Schema.Types.ObjectId, ref: "Organization", required: true },
  token: { type: String, required: true, unique: true },
  generatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  isUsed: { type: Boolean, default: false },
  // Bill amount entered by the barista at generation time, if any. Carried
  // through to the StampClaimEvent when a customer consumes this token —
  // see stampService.claimStamp. Null when the min-bill gate is disabled
  // and nothing was entered.
  billAmount: { type: Number, default: null },
  createdAt: { type: Date, default: Date.now }
});
```

In `backend/models/StampClaimEvent.js`, add `billAmount` the same way:

```js
const StampClaimEventSchema = new mongoose.Schema({
  organizationId: { type: mongoose.Schema.Types.ObjectId, ref: "Organization", required: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  token: { type: String, required: true },
  // Copied from the consumed DynamicQRToken.billAmount at claim time. Null
  // for claims made before this field existed, or where nothing was entered.
  billAmount: { type: Number, default: null },
  createdAt: { type: Date, default: Date.now }
});
```

- [ ] **Step 2: Write the failing test**

Create `backend/tests/customer-detail.js`:

```js
/**
 * Customer detail drill-in suite (Epic D1).
 *
 * Self-contained: boots its own server on a dedicated port against the
 * in-memory mock DB. Drives generate-qr with a bill amount through to a
 * claim, and confirms getCustomersList surfaces the new fields correctly.
 *
 * Run directly: `node tests/customer-detail.js`
 */

const { bootServer } = require("./helpers/bootServer");

const SLUG = "coffesarowar";

async function main() {
  const { baseUrl, stop } = await bootServer({ port: 5016 });
  let failures = 0;
  const check = (name, cond) => {
    if (cond) console.log(`PASS ${name}`);
    else { console.error(`FAIL ${name}`); failures++; }
  };
  const api = (path, { method = "GET", token, slug = SLUG, body } = {}) => {
    const headers = { "Content-Type": "application/json" };
    if (slug) headers["X-Tenant-Slug"] = slug;
    if (token) headers.Authorization = `Bearer ${token}`;
    return fetch(`${baseUrl}${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    }).then(async (r) => ({ status: r.status, body: await r.json().catch(() => null) }));
  };

  try {
    const adminLogin = await api("/api/auth/login", {
      method: "POST",
      body: { email: "barista@mansarowar.cafe", password: "password" },
    });
    const adminToken = adminLogin.body.token;

    // Fresh customer for this run so counts start from zero.
    const email = `d1_${Date.now()}@test.co`;
    await api("/api/auth/register", {
      method: "POST",
      body: { name: "D1 Tester", email, password: "password", phone: "+9779811112222", address: "123 Test Lane" },
    });
    const mint = await api("/__test__/mint-token", { method: "POST", body: { email, type: "email_verify" } });
    await fetch(`${baseUrl}/api/auth/verify-email?token=${mint.body.token}`, { headers: { "X-Tenant-Slug": SLUG } });
    const customerLogin = await api("/api/auth/login", { method: "POST", body: { email, password: "password" } });
    const customerToken = customerLogin.body.token;

    // Claim 1: bill amount 500.
    const gen1 = await api("/api/admin/generate-qr", { method: "POST", token: adminToken, body: { billAmount: 500 } });
    const claim1 = await api("/api/stamps/claim", { method: "POST", token: customerToken, body: { token: gen1.body.data.token } });
    check("first claim succeeds", claim1.status === 200);

    // Claim 2: no bill amount at all (gate disabled by default on this tenant).
    const gen2 = await api("/api/admin/generate-qr", { method: "POST", token: adminToken });
    const claim2 = await api("/api/stamps/claim", { method: "POST", token: customerToken, body: { token: gen2.body.data.token } });
    check("second claim succeeds", claim2.status === 200);

    // Claim 3: bill amount 300.
    const gen3 = await api("/api/admin/generate-qr", { method: "POST", token: adminToken, body: { billAmount: 300 } });
    const claim3 = await api("/api/stamps/claim", { method: "POST", token: customerToken, body: { token: gen3.body.data.token } });
    check("third claim succeeds", claim3.status === 200);

    const list = await api("/api/admin/customers", { token: adminToken });
    const me = (list.body?.data || []).find((c) => c.email === email);
    check("customer found in list", Boolean(me));
    check("phone surfaced", me?.phone === "+9779811112222");
    check("address surfaced", me?.address === "123 Test Lane");
    check("totalSpent sums entered amounts, ignores the no-amount claim", me?.totalSpent === 800);
    check("lifetimeVoucherCount is 0 (no milestone reached yet)", me?.lifetimeVoucherCount === 0);
    check("scanHistory has 3 entries", Array.isArray(me?.scanHistory) && me.scanHistory.length === 3);

    // Tenant isolation: a 2nd tenant's customer list doesn't see this activity.
    const platformLogin = await api("/api/platform/login", {
      method: "POST",
      slug: undefined,
      body: { email: "admin@stampd.co", password: "password" },
    });
    const platformToken = platformLogin.body.token;
    const runSuffix = Date.now();
    const secondSlug = `brewhaven-${runSuffix}`;
    const secondAdminEmail = `boss+${runSuffix}@brewhaven.test`;
    await api("/api/platform/businesses", {
      method: "POST",
      slug: undefined,
      token: platformToken,
      body: {
        name: "Brew Haven",
        slug: secondSlug,
        adminName: "Haven Boss",
        adminEmail: secondAdminEmail,
        adminPassword: "password",
      },
    });
    const secondLogin = await api("/api/auth/login", { method: "POST", slug: secondSlug, body: { email: secondAdminEmail, password: "password" } });
    const secondList = await api("/api/admin/customers", { slug: secondSlug, token: secondLogin.body.token });
    check(
      "second tenant's customer list has no coffesarowar customers",
      Array.isArray(secondList.body?.data) && secondList.body.data.every((c) => c.email !== email),
    );
  } finally {
    stop();
  }

  if (failures) { console.error(`customer-detail: ${failures} FAILED`); process.exitCode = 1; }
  else console.log("customer-detail: all PASS");
}

main().catch((e) => { console.error(e); process.exitCode = 1; });
```

Run: `cd backend && node tests/customer-detail.js`
Expected: FAIL — `billAmount` isn't persisted yet, `phone`/`address`/`lifetimeVoucherCount`/`totalSpent` aren't in the response yet.

- [ ] **Step 3: Persist billAmount through generate → claim**

In `backend/services/stampService.js`, change `generateQRToken`'s `DynamicQRToken.create({...})` call:

```js
  const token = uuidv4();

  await DynamicQRToken.create({
    token,
    generatedBy: adminUserId,
    organizationId
  });
```

to:

```js
  const token = uuidv4();
  const storedBillAmount =
    billAmount !== undefined && billAmount !== null && billAmount !== "" && !Number.isNaN(Number(billAmount))
      ? Number(billAmount)
      : null;

  await DynamicQRToken.create({
    token,
    generatedBy: adminUserId,
    organizationId,
    billAmount: storedBillAmount
  });
```

In `claimStamp`, right after the existing-token lookup (`const existingToken = await DynamicQRToken.findOne({ token }).session(session);` and its not-found/tenant/expiry checks — insert this line right after those checks, before the atomic consume step):

```js
      const claimedBillAmount = existingToken.billAmount ?? null;
```

Then update **both** `StampClaimEvent.create([...])` call sites to include it. The brand-new-card branch:

```js
          await StampClaimEvent.create(
            [
              {
                userId,
                organizationId,
                token,
                billAmount: claimedBillAmount,
                createdAt: now
              }
            ],
            { session }
          );
```

And the existing-card branch (the "Log scan event" one):

```js
      await StampClaimEvent.create(
        [
          {
            userId,
            organizationId,
            token,
            billAmount: claimedBillAmount,
            createdAt: now
          }
        ],
        { session }
      );
```

- [ ] **Step 4: Extend getCustomersList**

In `backend/controllers/stampController.js`, `getCustomersList`'s per-customer mapping currently reads:

```js
    const data = await Promise.all(
      customers.map(async (customer) => {
        const stampCard = await StampCard.findOne({ userId: customer._id, organizationId });
        const stampsEarned = stampCard ? stampCard.stampsEarned : 0;
        const lastStampedAt = stampCard ? stampCard.lastStampedAt : null;

        const validVoucherCount = (
          await Voucher.find({
            userId: customer._id,
            organizationId,
            isValid: true,
          })
        ).length;

        const events = await StampClaimEvent.find({ userId: customer._id, organizationId })
          .sort({ createdAt: -1 })
          .limit(10);

        const scanHistory = events.map((event) => ({
          id: event._id.toString(),
          timestamp: event.createdAt,
        }));

        const idStr = customer._id.toString();
        const suffix = idStr.substring(Math.max(0, idStr.length - 5)).toUpperCase();
        const formattedId = `NO. ${suffix.padStart(5, '0')}`;

        return {
          id: idStr,
          name: customer.name,
          email: customer.email,
          customerNo: formattedId,
          stampsEarned,
          lastStampedAt,
          validVoucherCount,
          scanHistory,
        };
      })
    );
```

Replace with:

```js
    const data = await Promise.all(
      customers.map(async (customer) => {
        const stampCard = await StampCard.findOne({ userId: customer._id, organizationId });
        const stampsEarned = stampCard ? stampCard.stampsEarned : 0;
        const lastStampedAt = stampCard ? stampCard.lastStampedAt : null;

        const validVoucherCount = (
          await Voucher.find({
            userId: customer._id,
            organizationId,
            isValid: true,
          })
        ).length;

        const lifetimeVoucherCount = await Voucher.countDocuments({
          userId: customer._id,
          organizationId,
        });

        const allEvents = await StampClaimEvent.find({ userId: customer._id, organizationId })
          .sort({ createdAt: -1 });

        const scanHistory = allEvents.slice(0, 10).map((event) => ({
          id: event._id.toString(),
          timestamp: event.createdAt,
        }));

        const totalSpent = allEvents.reduce((sum, event) => sum + (event.billAmount || 0), 0);

        const idStr = customer._id.toString();
        const suffix = idStr.substring(Math.max(0, idStr.length - 5)).toUpperCase();
        const formattedId = `NO. ${suffix.padStart(5, '0')}`;

        return {
          id: idStr,
          name: customer.name,
          email: customer.email,
          phone: customer.phone || "",
          address: customer.address || "",
          customerNo: formattedId,
          stampsEarned,
          lastStampedAt,
          validVoucherCount,
          lifetimeVoucherCount,
          totalSpent,
          scanHistory,
        };
      })
    );
```

(`allEvents` replaces the previously-capped `events` query — one uncapped fetch now serves both the 10-item visit list and the full-history spend sum, avoiding a second query per customer.)

- [ ] **Step 5: Run the test to verify it passes**

Run: `cd backend && node tests/customer-detail.js`
Expected: `customer-detail: all PASS`.

- [ ] **Step 6: Add to the test suite**

In `backend/package.json`, append to the `test` script:

```
"test": "node tests/integration-qa.js && node tests/run-voucher-test.js && node tests/multi-tenant-isolation.js && node tests/auth-email-flow.js && node tests/min-bill-amount.js && node tests/menu-import.js && node tests/customer-detail.js",
```

Run: `cd backend && npm test`
Expected: all seven suites pass, exit 0.

- [ ] **Step 7: Commit**

```bash
git add backend/models/DynamicQRToken.js backend/models/StampClaimEvent.js backend/services/stampService.js backend/controllers/stampController.js backend/tests/customer-detail.js backend/package.json
git commit -m "feat(customers): persist billAmount through claims, surface lifetime detail fields"
```

---

### Task 2: Frontend — customer detail drawer

**Files:**
- Modify: `frontend/src/routes/admin/AdminCustomers.tsx`
- Create: `frontend/src/components/admin/CustomerDetailDrawer.tsx`

**Interfaces:**
- Consumes: `GET /api/admin/customers` items now including `phone, address, lifetimeVoucherCount, totalSpent, scanHistory` (Task 1).
- Produces: `CustomerDetailDrawer` — a component taking `{ customer: AdminCustomer | null; requiredStamps: number; onClose: () => void }`, rendering nothing when `customer` is `null`.

- [ ] **Step 1: Create the drawer component**

Create `frontend/src/components/admin/CustomerDetailDrawer.tsx`:

```tsx
import { X } from "lucide-react";

export interface DetailCustomer {
  id: string;
  name: string;
  email: string;
  customerNo: string;
  phone: string;
  address: string;
  stampsEarned: number;
  lifetimeVoucherCount: number;
  totalSpent: number;
  scanHistory: { id: string; timestamp: string }[];
}

interface CustomerDetailDrawerProps {
  customer: DetailCustomer | null;
  requiredStamps: number;
  onClose: () => void;
}

function formatVisit(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function CustomerDetailDrawer({ customer, requiredStamps, onClose }: CustomerDetailDrawerProps) {
  if (!customer) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/40" onClick={onClose}>
      <div
        className="flex h-full w-full max-w-[420px] flex-col overflow-y-auto bg-[var(--surface)] p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-5 flex items-start justify-between">
          <div>
            <h2 className="font-display text-xl font-extrabold text-[var(--ink)]">{customer.name}</h2>
            <p className="text-sm text-[var(--muted)]">{customer.email}</p>
          </div>
          <button
            onClick={onClose}
            className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-[10px] bg-[var(--bg)] text-[var(--muted)] hover:text-[var(--ink)]"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mb-5 grid grid-cols-2 gap-3">
          <Field label="Customer #" value={customer.customerNo} />
          <Field label="Phone" value={customer.phone || "—"} />
          <Field label="Address" value={customer.address || "—"} span2 />
        </div>

        <div className="mb-5 grid grid-cols-3 gap-3">
          <Stat label="Stamps" value={`${customer.stampsEarned}/${requiredStamps}`} />
          <Stat label="Lifetime vouchers" value={String(customer.lifetimeVoucherCount)} />
          <Stat label="Total spent" value={String(customer.totalSpent)} />
        </div>

        <div>
          <div className="mb-2 text-xs font-bold uppercase tracking-wider text-[var(--soft)]">Recent visits</div>
          {customer.scanHistory.length === 0 ? (
            <p className="text-sm text-[var(--muted)]">No visits yet.</p>
          ) : (
            <div className="flex flex-col gap-1.5">
              {customer.scanHistory.map((visit) => (
                <div key={visit.id} className="text-sm text-[var(--ink)]">
                  {formatVisit(visit.timestamp)}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Field({ label, value, span2 = false }: { label: string; value: string; span2?: boolean }) {
  return (
    <div className={span2 ? "col-span-2" : ""}>
      <div className="text-[11px] font-bold uppercase tracking-wider text-[var(--soft)]">{label}</div>
      <div className="truncate text-sm font-semibold text-[var(--ink)]">{value}</div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[14px] border border-[var(--line)] bg-[var(--bg)] p-3 text-center">
      <div className="font-display text-lg font-extrabold text-[var(--ink)]">{value}</div>
      <div className="text-[11px] text-[var(--muted)]">{label}</div>
    </div>
  );
}

export default CustomerDetailDrawer;
```

- [ ] **Step 2: Wire it into AdminCustomers**

In `frontend/src/routes/admin/AdminCustomers.tsx`, add the import:

```tsx
import { useState } from "react";
import { CustomerDetailDrawer } from "../../components/admin/CustomerDetailDrawer";
```

Widen the `AdminCustomer` interface:

```tsx
interface AdminCustomer {
  id: string;
  name: string;
  email: string;
  customerNo: string;
  phone: string;
  address: string;
  stampsEarned: number;
  lastStampedAt: string | null;
  validVoucherCount: number;
  lifetimeVoucherCount: number;
  totalSpent: number;
  scanHistory: { id: string; timestamp: string }[];
}
```

Inside the `AdminCustomers` component, add state right after the existing `useQuery` call:

```tsx
  const [selected, setSelected] = useState<AdminCustomer | null>(null);
```

Change the per-row `<div>` (the one with `key={c.id}` and the row's grid layout) into a clickable `<button>` wrapping the same content — i.e. change:

```tsx
            <div
              key={c.id}
              className="grid grid-cols-[2fr_1fr_1fr_1fr_1fr] items-center border-b border-[var(--line)] px-5 py-3.5 last:border-b-0"
            >
```

to:

```tsx
            <button
              key={c.id}
              onClick={() => setSelected(c)}
              className="grid w-full grid-cols-[2fr_1fr_1fr_1fr_1fr] items-center border-b border-[var(--line)] px-5 py-3.5 text-left last:border-b-0 hover:bg-[var(--bg)]"
            >
```

and its closing `</div>` (the one matching this row) to `</button>`.

Add the drawer at the end of the component's returned JSX, as a sibling of the outermost `<div>` (i.e. just before that `<div>`'s closing tag):

```tsx
      <CustomerDetailDrawer
        customer={selected}
        requiredStamps={required}
        onClose={() => setSelected(null)}
      />
```

- [ ] **Step 3: Typecheck**

Run: `cd frontend && npx tsc --noEmit`
Expected: clean.

- [ ] **Step 4: Verify in the browser**

Start the backend (`cd backend && MONGODB_URI= node server.js`) and the frontend (`cd frontend && npm run dev`). Log in to `/coffesarowar/admin/login` as `barista@mansarowar.cafe` / `password`, go to Customers:
- Click the seeded demo customer's row — drawer opens with name/email/customer #/phone/address/stamps/lifetime vouchers/total spent/recent visits.
- Click the X — drawer closes.
- Click a row again, then click the dimmed backdrop — drawer closes.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/routes/admin/AdminCustomers.tsx frontend/src/components/admin/CustomerDetailDrawer.tsx
git commit -m "feat(admin-fe): customer detail drawer on row click"
```

---

### Task 3: Full verification pass

**Files:** none (verification only)

- [ ] **Step 1: Backend suite green**

Run: `cd backend && npm test`
Expected: all seven suites PASS, exit 0.

- [ ] **Step 2: Frontend typecheck**

Run: `cd frontend && npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: End-to-end browser walkthrough**

With `npm run dev` running, on tenant `coffesarowar`: as a customer, scan two QR codes generated with different bill amounts (use Stamp Program to set a minimum first if you want the bill field required, or leave it optional and enter values anyway), then as the admin, open that customer's detail drawer and confirm `Total spent` equals the sum of the amounts entered, `Lifetime vouchers` and `Recent visits` reflect the activity, and phone/address match what the customer registered with.

- [ ] **Step 4: Commit any final fixes, then finish**

```bash
git add -A
git commit -m "chore(customer-detail): verification pass fixes" || echo "nothing to commit"
```

---

## Self-Review Notes

- **Spec coverage:** slide-over drawer (Task 2), all 9 requested fields (Task 2's `CustomerDetailDrawer`), phone/address surfaced from existing `User` fields (Task 1 Step 4), lifetime vs. valid voucher count distinction preserved (Task 1 Step 4 keeps `validVoucherCount` untouched, adds `lifetimeVoucherCount` alongside), billAmount persistence going-forward-only with the gate logic untouched (Task 1 Steps 1 & 3 — `generateQRToken`'s existing validation block is not modified, only the `DynamicQRToken.create` call gains a field), recent visits reusing existing data (Task 1 Step 4's `allEvents.slice(0, 10)`), tenant isolation tested (Task 1's test case). No gaps against the spec.
- **Type consistency:** `totalSpent`, `lifetimeVoucherCount`, `phone`, `address`, `scanHistory` all named identically from the backend response (Task 1) through the frontend's `AdminCustomer` interface (Task 2) through `CustomerDetailDrawer`'s `DetailCustomer` props (Task 2).
- **Mock-DB safety:** `Voucher.countDocuments(query)` confirmed supported by `backend/utils/mockMongoose.js:430`, matching real Mongoose semantics — no `insertMany`-style landmine here.
- **Resolved the spec's one deferred implementation detail:** `totalSpent` and `scanHistory` now share a single uncapped `StampClaimEvent.find(...)` query per customer (Task 1 Step 4), rather than the two-query approach the spec left open — avoids adding a second per-customer query on top of the existing N+1 pattern.
