# Epic A — Auth Overhaul: Email Verification + Required Phone + Google Sign-In

**Date:** 2026-07-14
**Status:** Approved design, ready for implementation plan
**Scope:** First of five epics decomposed from the 14-feature batch. Covers original items 1 (Google OAuth), 2 (contact number at signup), 3 (verification — repurposed from phone-OTP to email verification), and the schema additions (phone required, address optional).

## Context

Multi-tenant loyalty SaaS ("Stampd"). Customers register scoped to a tenant (`{organizationId, email}` unique). Current customer auth = email + password (`services/authService.js`), plus an already-working `authenticateWithGoogle` (verifies a Google idToken via `google-auth-library`). No email verification, no phone field, no forgot-password.

### Decisions locked during brainstorming

1. **No SMS / no phone-OTP.** SMS costs money; dropped entirely. Verification moves to **email** (free tiers exist).
2. **Email stays the customer login identifier.** The earlier "phone becomes primary identifier" idea is reverted — simpler, and the `{organizationId, email}` index is untouched (nothing to migrate).
3. **Phone = required stored field** on customers (collected at signup, **not** verified). **Address = optional** (all roles).
4. **Email verification + forgot-password**, both by email link. Email sending is **dev-stubbed now** (console-logs the link, zero infra) behind a provider abstraction; a real provider plugs in for prod later.
5. **Google sign-in = one-tap, auto-verified** (Google already verifies the email). A new Google customer still has no phone, so a **post-Google phone-collection step** completes the profile (no OTP).
6. **Soft verification gate:** an unverified customer can log in but lands on a "verify your email" state; **scan/claim (stamping) is blocked** until verified. Google + admin/platform accounts are verified and unaffected.

## Data Model

### `User` schema additions (`backend/models/User.js`)

| Field | Type | Rule |
|-------|------|------|
| `phone` | String | Required when `role === "customer"` (enforced in service layer AND a conditional Mongoose validator). Store E.164, e.g. `+9779812345678`. |
| `address` | String | Optional, all roles, default `""`. |
| `emailVerified` | Boolean | Default `false`. Set `true` for Google customers, and for seeded admin/platform/demo accounts. |

Unique indexes unchanged: `{organizationId, email}` unique; `{organizationId, googleId}` unique sparse. Phone is **not** unique (two family members may share a number).

### New collection `VerificationToken` (`backend/models/VerificationToken.js`)

Tenant-scoped; looked up by top-level equality only, so the mock DB handles it.

| Field | Type | Notes |
|-------|------|-------|
| `organizationId` | ObjectId | tenant scope |
| `userId` | ObjectId | owner |
| `type` | enum `["email_verify","password_reset"]` | |
| `tokenHash` | String | random 32-byte token, SHA-256 hashed; raw token only ever appears in the emailed link |
| `expiresAt` | Date | email_verify = 24h, password_reset = 1h |
| `usedAt` | Date \| null | single-use; set on consume |

Lookup pattern: `findOne({ tokenHash, type, usedAt: null })`, then check `expiresAt > now` in code (mock supports equality; `$lte`/`$gte` also supported but we guard in JS to be safe).

## Backend

Layering respected: thin controllers → `authService` (logic) + new `emailService` (delivery). All writes stay `organizationId`-scoped.

### Endpoints (all under `/api/auth`, `resolveTenant` middleware)

| Method + path | Body | Behavior |
|---------------|------|----------|
| `POST /register` | `name, email, password, phone, address?` | Validate phone present. Create user `emailVerified:false, role:customer`. Ensure stamp card. Issue `email_verify` token, `sendEmail` verify link. Return `{success, message}` (no auto-login; user must verify or log in to the soft-gated state). |
| `GET /verify-email?token=` | — | Hash token, find unused non-expired `email_verify`, set user `emailVerified:true`, mark token used. Idempotent-ish: already-used/expired → clear error. |
| `POST /resend-verification` | `email` | If an unverified user exists, void prior email_verify tokens, issue + send a new one. Always `200` (no enumeration). |
| `POST /forgot-password` | `email` | If user exists, issue `password_reset` token + send link. Always `200` (no enumeration). |
| `POST /reset-password` | `token, password` | Hash token, find unused non-expired `password_reset`, update password hash, mark token used. |
| `POST /google` | `idToken` | Existing verify. New user → create `emailVerified:true`. Response adds `needsPhone: true` when the (new or existing) user has no `phone`; still returns the auth token so the client can call complete-profile. |
| `POST /complete-profile` | `phone, address?` (JWT auth) | Sets `phone` (+ `address`) on the authenticated customer. Used right after Google when `needsPhone`. |

### Soft gate enforcement

`stampService.claimStamp` (and any scan/claim path) rejects with a clear error when `req.user` resolves to a customer whose `emailVerified === false`. Login itself is **not** blocked — the client renders the verify interstitial based on the `emailVerified` flag returned in the auth payload (add `emailVerified` to `formatAuthPayload`'s `user` object).

### `services/emailService.js`

Single interface: `sendEmail({ to, subject, html })`. Provider selected by env at call time:

- **Dev / no provider configured** (no `SMTP_HOST` and no provider key): **console-stub** — logs `to`, `subject`, and the full link; returns `{ ok: true, stubbed: true }`. Entire flow testable in mock-DB dev with zero cost.
- **Prod:** `nodemailer` SMTP transport behind the same interface.

Helper `buildAuthLink(type, rawToken, slug)` composes `${APP_BASE_URL}/${slug}/verify-email?token=...` (and the reset equivalent).

## Frontend

### Modified

- **`routes/CustomerRegister.tsx`** — add **phone** (fixed `+977` prefix chip + 10-digit local numeric input, assembled to E.164 on submit) required, **address** optional. Success → "Check your email to verify {email}" panel with **Resend** button (`/resend-verification`).
- **`routes/CustomerLogin.tsx`** — add **Google button** + **"Forgot password?"** link. On login response, store `emailVerified` in customer auth context.
- **`context/CustomerAuthContext.tsx`** — `User` gains `emailVerified: boolean`; expose it for gating.

### New screens (tenant-scoped, under `/:slug`)

- `verify-email` — reads `?token=`, calls `GET /verify-email`, shows success / expired-or-used, CTA to login.
- `forgot-password` — email input → `POST /forgot-password` → "If that email exists, a reset link was sent."
- `reset-password` — reads `?token=`, new password + confirm → `POST /reset-password` → success → login.
- **Post-Google phone step** — modal/route triggered when `/google` returns `needsPhone:true`: phone(req) + address(opt) → `POST /complete-profile` → dashboard.

### Verify interstitial

When an authenticated customer has `emailVerified:false`, the dashboard shows a persistent "Verify your email" banner; scan/claim UI is disabled with a prompt + **Resend** action. Clears once verified.

### Google button

`@react-oauth/google`: wrap the customer subtree in `<GoogleOAuthProvider clientId={VITE_GOOGLE_CLIENT_ID}>`; `<GoogleLogin>` on login + register; on credential → `POST /api/auth/google` (role `customer`). If `VITE_GOOGLE_CLIENT_ID` is unset, hide the button (feature-detect) so dev without a client id still works.

## New dependencies (approved)

- Backend: **`nodemailer`** (prod SMTP path; the dev stub needs no dep).
- Frontend: **`@react-oauth/google`** (Google button).
- Already present: `google-auth-library` (backend Google verify).

## Environment

| Var | Where | Purpose |
|-----|-------|---------|
| `GOOGLE_CLIENT_ID` | backend | verify Google idToken (exists) |
| `VITE_GOOGLE_CLIENT_ID` | frontend | render Google button; unset ⇒ button hidden |
| `APP_BASE_URL` | backend | build verify/reset links (default `http://localhost:3000` in dev) |
| `SMTP_HOST/PORT/USER/PASS/FROM` | backend | real email in prod; unset ⇒ console-stub |

## Testing / Verification

1. **Backend** `tests/auth-email-flow.js` (self-contained via `tests/helpers/bootServer.js`):
   - register → user `emailVerified:false` + a verify token exists → consume token → `emailVerified:true`.
   - claim-stamp blocked while unverified, allowed after verify.
   - forgot-password → reset-password → login with the new password succeeds; old password fails.
   - Google new-user → `needsPhone:true` → complete-profile sets phone.
   - **Tenant isolation:** a verify/reset token minted for tenant A cannot verify/reset a tenant B user.
   - Register missing phone → 400.
2. **Regression:** `cd backend && npm test` (integration + voucher + isolation) stays green.
3. **Browser** (`npm run dev`, tenant `coffesarowar`): register with phone+address → read console-logged verify link → open it → verified → login → dashboard (no banner); unverified path shows banner + blocks scan; forgot-password flow; Google button only if `VITE_GOOGLE_CLIENT_ID` set.
4. `npm run lint` (frontend `tsc --noEmit`) clean.

## Out of scope (later epics)

B (stamp flow / min-bill), C (menu import), D (customer detail / reports / contact config), E (profile menus / landing contact / skeletons / toast restyle). Real SMS/phone-OTP is dropped, not deferred.
