# Toast Restyle v2 + Platform Logo + Voucher Expiry — Design

## Context

Three independent changes, executed autonomously per explicit user authorization (locked decisions from `AskUserQuestion`, no further approval gates before merge/push to `main`).

## 1. Toast restyle v2

Supersedes the toast-styling half of `2026-07-15-toast-dialog-restyle-design.md` (position/color only — that spec's confirm-dialog work is untouched and stays as-is).

Locked decisions:
- Single `<Toaster>` in `App.tsx` moves from `position="bottom-center"` to `position="bottom-right"`.
- Drop the `success.iconTheme`/`error.iconTheme` use of `var(--ok)`/`var(--err)` (green/red — too vivid per user). Both variants share one neutral card style (`--surface` bg, `--ink` text, `--line` border, same shadow). Success gets a small check icon in `--ink` (or `--brand`, whichever reads cleaner at that size — decide during implementation, not user-visible enough to matter); error gets a small dot/exclamation icon, same neutral tone. No colored fill/background swap between the two — distinguishable only by icon shape and message wording, not color.
- Card gets slightly tighter/smaller padding than the current styling to read as "minimal" (not a functional change, just tightening the existing `style` block).
- Copy rewrite, app-wide, every `toast.success`/`toast.error`/`toast.loading` call site (~25 files) — light, chill tone, not overboard. Keep messages short. Preserve any dynamic interpolation (e.g. `` `"${name}" removed` ``) and any `{ id: toastId }` loading→success/error swap patterns as-is; only the string literals change. Examples of the tone shift:
  - `"Welcome back!"` → stays close to this, maybe `"Good to see you again!"`
  - `"Invalid credentials"` → `"That combo didn't match — try again."`
  - Generic save-failure toasts (`"Failed to save."` etc.) → something like `"Couldn't save that — give it another go."`
  - Keep it short; don't turn every message into a joke. A plain, warm rewrite is enough.

## 2. Platform logo

Source: `Logo/Gemini_Generated_Image_2n4t6u2n4t6u2n4t.png` — a 2×2 grid icon (3 outline circles + 1 filled terracotta stamp, ink-colored grid lines) with a "Stampd" wordmark below, on a cream rounded-square tile.

Hand-built as a new SVG (not a raster trace) since the source shapes are simple flat geometry:
- `frontend/src/components/shared/StampdLogo.tsx` — a reusable component rendering the icon-only mark (no baked-in wordmark, since `{PLATFORM_NAME}` is already rendered as live text everywhere and must stay dynamic per `config/platform.js`/`lib/platform.ts`). Props: `size` (px, default matches current letter-badge dimensions per call site), `className`.
- Simplify the source's jagged/scalloped stamp edge to a plain filled circle — the scallop reads as noise at 20–36px render sizes; a clean filled dot preserves "the 4th cell is stamped" at any size.
- Colors are fixed (not tenant-themed): `--ink` (#1F1B18) for the grid lines/circle outlines, a fixed terracotta (~`#C15D2C`, sampled from the source art) for the filled stamp circle. This is the platform's own mark, distinct from `--brand`/`--plat` (which theme per-tenant UI) — CLAUDE.md already establishes tenant branding and platform identity as separate concerns.
- Optional cream rounded-square tile background variant for icon-on-its-own contexts (favicon, `apple-touch-icon`); transparent-background variant for inline use next to text.

Call sites (replace the `PLATFORM_NAME.charAt(0)` letter-badge or bare text with the icon before/beside it):
- `components/platform/PlatformLayout.tsx` (sidebar brand mark, currently a plain colored initial-letter box)
- `components/customer/CustomerLayout.tsx`, `components/customer/GlobalCustomerLayout.tsx` (header, currently bare `{PLATFORM_NAME}` text)
- `routes/platform/PlatformLogin.tsx`, `routes/GlobalCustomerLogin.tsx`, `routes/GlobalCustomerRegister.tsx` (currently letter-badges)
- `routes/platform/PlatformLanding.tsx` (header + footer, currently bare text)
- `frontend/index.html` — replace the ☕ emoji data-URI favicon with the new mark (inlined SVG data-URI, tile variant), and fix the stale `<title>Mansarowar Cafe Loyalty</title>` to read `Stampd` (matching the dynamic `document.title` pattern other routes already use via `PLATFORM_NAME`).

`Logo/` folder (source PNG) deleted once the SVG conversion is committed, per user instruction — it's a one-time input, not a tracked asset the app depends on.

## 3. Voucher expiry

- `config/platform.js` `DEFAULT_PROGRAM` gains `voucherExpiryDays: 0` (0 = never expires — matches today's actual behavior, so existing tenants get no behavior change on deploy).
- `Organization.js` schema: `program.voucherExpiryDays` (Number, default 0). No controller change needed — `tenantController.js`'s `updateMySettings` already shallow-merges the whole `program` object from the request body.
- `Voucher.js` schema: new `expiresAt` (Date, default null).
- `stampService.js`'s `Voucher.create(...)` (around line 228): compute `expiresAt = org.program.voucherExpiryDays > 0 ? new Date(now.getTime() + voucherExpiryDays * 86400000) : null`.
- `voucherService.js`'s `redeemVoucher`: after the existing `findOneAndUpdate` that flips `isValid: false`, if the matched voucher's `expiresAt` is in the past, undo — don't dispense; instead mark it consumed-but-not-redeemed (`isValid: false`, `redeemedAt: null` stays null) and throw `"This voucher's expired."` (400). This is the lazy-expiry point: no cron/background job exists (or is needed) since expiry is only checked at the moment of use, matching the project's mock-DB-has-no-scheduler constraint.
- `voucherService.js`'s `getMyWallet`: include `expiresAt` in the projection so the client can show an "Expired" badge on a voucher whose `expiresAt` has passed but hasn't been touched by a redeem attempt yet (still `isValid: true` in the DB at that point — display-only, no write).
- `reportService.js`'s active-vouchers KPI query (`Voucher.countDocuments({ organizationId, isValid: true })`): add an `$or` for `expiresAt: null` / `expiresAt: { $gte: now }` so the count doesn't include vouchers that are functionally dead but haven't been touched yet. Mock DB supports top-level `$or`/`$gte`, confirmed in `CLAUDE.md`.
- `StampProgram.tsx`: new number input next to `minBillAmount`, same "0 = never" convention (`"0 = vouchers never expire"` helper text), wired through the existing `AdminProgram` type / `useAdminSettings` hook (no new endpoint).
- `CustomerWallet.tsx` / `VoucherTicket`: expired-but-unredeemed vouchers get an "Expired" badge (muted/neutral tone, not red) instead of being treated as fully active; they're excluded from the "N active vouchers" count shown at the top of the wallet.

## Out of scope

- No background job/cron to proactively invalidate expired vouchers — lazy-expiry-on-touch (redeem attempt) is sufficient given the mock DB has no scheduler and production is a single Atlas-backed app, not a queue-driven system.
- No per-voucher custom expiry override — the setting is per-tenant-program, applied uniformly to every voucher earned after the setting is saved (existing already-earned vouchers keep `expiresAt: null` since the field didn't exist when they were created — no backfill needed, `null` is a safe default that already means "never expires").
- Confirm-dialog work from the prior toast spec is untouched.
