# Epic B1 — Minimum Bill Amount Gate for Stamp QR Generation

**Date:** 2026-07-14
**Status:** Approved design, ready for implementation plan
**Scope:** Decomposed from the original "Epic B" (min-bill gate + stamp-claimed animation). This spec covers only the minimum bill amount gate. The stamp-claimed animation is a separate, independent spec (B2) — pure customer-facing frontend polish with no schema/backend overlap with this one.

## Context

Multi-tenant loyalty SaaS ("Stampd"). A business admin's barista generates a short-lived, single-use QR (`POST /api/admin/generate-qr`) that a customer scans to earn one stamp. Today generation is unconditional — the barista clicks "Generate new code" and a token is issued immediately, no other input required.

The ask: a tenant should be able to configure a minimum bill amount. Below that amount, the barista cannot generate a stamp QR for that customer — the barista enters the customer's bill amount, and generation is blocked if it's too low.

## Decisions locked during brainstorming

1. **Backend hard-rejects** (400, no token created) when the entered amount is below the configured minimum. This is the real enforcement boundary — matches how `stampsRequired`/`cooldownHours` are already enforced server-side, not just in the UI.
2. **`minBillAmount` defaults to 0** on both new and existing tenants, meaning "gate disabled." A single numeric field, not a separate boolean toggle.
3. **Plain number, no currency formatting.** Both the configured minimum and the barista's entered amount are stored/compared as plain `Number`s (e.g. `500`), not currency-formatted strings like `MenuItem.price` (`"₹120"`). Currency symbol is a UI label only, never part of the stored/compared value.
4. **Check-and-discard.** The entered bill amount is used only to decide pass/fail at generation time. It is not persisted anywhere (not on `DynamicQRToken`, not on `StampClaimEvent`). No new collection, no schema addition beyond the one `Organization.program` field.
5. **Bill-amount field is always visible** in Generate QR, regardless of `minBillAmount`:
   - **`minBillAmount = 0`:** field is optional. Auto-generate-on-mount still fires immediately (today's exact behavior); the barista may fill the field or leave it blank; nothing is validated or required.
   - **`minBillAmount > 0`:** field becomes required. No auto-generate on mount; the barista must enter an amount before a code is generated.
6. **Client-side immediate feedback when the field is required** (`minBillAmount > 0`): the Generate button is disabled while the entered amount is empty or below the minimum, with an inline hint (e.g. "Minimum bill is 500"). The backend's hard-reject remains the authoritative check (defense in depth) — the client-side disable is a UX nicety, not the security boundary.

## Data Model

### `Organization.program` — one new field (`backend/models/Organization.js`)

| Field | Type | Rule |
|-------|------|------|
| `minBillAmount` | Number | `min: 0`, default `0`. `0` = gate disabled. |

Mirrored in `backend/config/platform.js` `DEFAULT_PROGRAM.minBillAmount = 0`, so brand-new tenants start disabled (decision 2).

No other schema changes. `DynamicQRToken`, `StampClaimEvent`, and every other model are untouched (decision 4).

## Backend

### `services/stampService.js`

`generateQRToken(adminUserId, organizationId, billAmount)` — signature gains a third parameter.

- Loads the org (as it already does elsewhere in this file, for the voucher prefix) to read `program.minBillAmount`.
- If `minBillAmount > 0`:
  - `billAmount` must be present and be a valid, non-negative number; otherwise `createHttpError("Bill amount is required to generate a code.", 400)`.
  - If `billAmount < minBillAmount`, `createHttpError(\`Bill amount must be at least ${minBillAmount}.\`, 400)`.
  - On either rejection, **no `DynamicQRToken` is created.**
- If `minBillAmount === 0` (gate disabled): `billAmount` is not required and not validated at all — any value, including `undefined`, passes through with zero behavior change from today.

### `controllers/stampController.js`

`generateAdminQRToken` passes `req.body.billAmount` through to the service call:
```js
const result = await generateQRToken(req.user.id, req.user.organizationId, req.body.billAmount);
```

### Routes

`routes/adminRoutes.js` unchanged — still `POST /generate-qr`, same middleware (`verifyToken`, `isBusinessAdmin`).

## Frontend

### Admin config — `routes/admin/StampProgram.tsx`

One new field in the existing settings card, alongside `stampsRequired`/`rewardTitle`/`rewardDescription`/`cooldownHours`:

- Label: "Minimum bill amount"
- Helper text: "0 = no minimum — any bill amount can generate a code."
- Numeric input, `min={0}`, same styling as the existing `cooldownHours` input.
- Uses the existing save path (`useUpdateAdminSettings`, `program: form`) — no new hook, no new endpoint.

`hooks/useAdminSettings.ts` — `AdminProgram` type gains `minBillAmount: number`.

### Generate QR — `routes/admin/GenerateQr.tsx`

Fetches `useAdminSettings()` (already exists, used by `StampProgram`/`Branding`) to read `program.minBillAmount`.

- **Field is always rendered** (a numeric "Bill amount" input above the QR area), regardless of `minBillAmount`.
- **`minBillAmount === 0`:**
  - The existing `useEffect(() => { generate(); }, [generate])` auto-generate-on-mount stays exactly as-is.
  - The bill-amount field is present but optional — no validation, no button-disable logic tied to it. If filled, its value is still sent as `billAmount` in the request body (harmless — the backend ignores it when the gate is disabled), but no error state exists for it.
- **`minBillAmount > 0`:**
  - Auto-generate-on-mount is suppressed (the effect only calls `generate()` once the barista has entered a valid amount and clicked the button — not automatically).
  - "Generate code" button is `disabled` while the entered amount is empty, non-numeric, or `< minBillAmount`.
  - Inline hint text near the field: `Minimum bill is {minBillAmount}` (shown only when the current entry is below it, or the field is empty).
  - On a valid amount + click, `generate()` sends `{ billAmount: <number> }` in the `POST /generate-qr` body. If the backend still rejects (race — e.g. admin lowered/raised the minimum between page load and click), the existing `toast.error` path in `generate()`'s catch block surfaces the backend's message unchanged.

## Testing / Verification

1. **Backend**, extending the existing voucher/stamp test coverage (self-contained via `tests/helpers/bootServer.js`, following the pattern in `tests/run-voucher-test.js` / `tests/auth-email-flow.js`):
   - Tenant with `minBillAmount: 0` — `generate-qr` succeeds with no `billAmount` in the body at all (regression: today's behavior is unaffected).
   - Set `minBillAmount: 500` via `PATCH /api/admin/settings` — `generate-qr` with `billAmount: 300` → 400, no token created (confirm via a subsequent claim attempt with the token from the response, or by asserting the response has no `data.token`). `generate-qr` with `billAmount: 500` → 201/200, token created and claimable normally. `generate-qr` with `billAmount` missing entirely → 400.
   - Tenant isolation: setting `minBillAmount` on one tenant does not affect another's `generate-qr` behavior (mirrors the existing per-tenant program isolation already covered in `multi-tenant-isolation.js`).
2. **Frontend:** `npx tsc --noEmit` clean.
3. **Browser**, tenant `coffesarowar`:
   - Default state (`minBillAmount: 0`): Generate QR loads and auto-generates exactly as before; bill-amount field visible but optional; entering a value doesn't block anything.
   - Set a minimum (e.g. 500) in Stamp Program settings, save, return to Generate QR: no auto-generate; button disabled until a valid amount is entered; inline hint shows below the minimum; entering ≥ 500 enables the button and generates a code.
   - Reset `minBillAmount` back to 0 and confirm Generate QR returns to the original auto-generate behavior.

## Out of scope

B2 (stamp-claimed animation) and all later epics (C–E) are unaffected and unrelated to this change. Persisting bill amounts for reporting (e.g. average ticket size) is explicitly deferred — not part of this spec (decision 4).
