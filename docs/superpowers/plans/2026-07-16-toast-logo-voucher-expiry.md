# Toast Restyle v2, Platform Logo, Voucher Expiry Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restyle app-wide toasts (position + neutral color + chill copy), add a real Stampd logo mark everywhere the platform brand appears, and let a business admin set vouchers to expire after N days.

**Architecture:** Three independent slices sharing one repo. Toasts: one `App.tsx` config change plus mechanical copy edits across ~24 files and 3 backend services. Logo: one new `StampdLogo.tsx` SVG component wired into 8 existing brand-mark call sites plus the favicon/title. Voucher expiry: a new `Organization.program.voucherExpiryDays` setting flows through `stampService.js` (set `expiresAt` at voucher creation) and `voucherService.js` (reject redemption of an expired voucher, lazy-checked at redeem time — no cron job), surfaced in the admin `StampProgram.tsx` settings form and the customer `CustomerWallet.tsx`.

**Tech Stack:** React 19 + TS + Tailwind v4 (frontend), Express + Mongoose-shaped mock DB (backend), `react-hot-toast`, plain `node tests/*.js` backend test scripts (no framework).

## Global Constraints

- No green (`--ok` `#1A844B`) or red (`--err` `#BA1A1A`) anywhere in the toast UI — success/error distinguished by icon shape only, both on the same neutral `--surface`/`--ink` card.
- Toast copy: light/chill tone, not overboard — short, plain rewrites, not a joke on every string.
- Toast position: `bottom-right`.
- Logo: hand-built SVG (not a raster trace of `Logo/Gemini_Generated_Image_2n4t6u2n4t6u2n4t.png`), fixed colors `#1F1B18` (ink) / `#C15D2C` (terracotta stamp) — not tenant-themed (`--brand`/`--plat` stay untouched).
- `Logo/` source folder is deleted once the SVG lands, per user instruction.
- Voucher expiry default is `0` (never expires) — zero behavior change for existing tenants until an admin opts in.
- No cron/background job for expiry — lazy-checked at redeem time only (mock DB has no scheduler; matches project's existing constraints per `CLAUDE.md`).
- Every new/changed backend behavior needs a passing suite in `backend/tests/`, added to `backend/package.json`'s `test` chain. Frontend changes are verified via `npm run lint` (root, `tsc --noEmit`) — no frontend test framework exists in this repo.

---

## Part A — Toast restyle (style only)

### Task A1: Restyle the global `Toaster`

**Files:**
- Modify: `frontend/src/App.tsx:184-203`

**Interfaces:**
- Produces: no new exports — this only changes the `<Toaster>` JSX already rendered once at the app root.

- [ ] **Step 1: Read the current block to confirm line numbers haven't drifted**

Run: `sed -n '184,203p' frontend/src/App.tsx`
Expected: the `<Toaster position="bottom-center" ...>` block matching what's below.

- [ ] **Step 2: Replace the block**

Replace:
```tsx
              <Toaster
                position="bottom-center"
                toastOptions={{
                  style: {
                    background: "var(--surface)",
                    color: "var(--ink)",
                    border: "1px solid var(--line)",
                    borderRadius: "13px",
                    padding: "12px 16px",
                    fontSize: "14px",
                    boxShadow: "0 12px 28px -12px rgba(36,30,27,0.18)",
                  },
                  success: {
                    iconTheme: { primary: "var(--ok)", secondary: "#fff" },
                  },
                  error: {
                    iconTheme: { primary: "var(--err)", secondary: "#fff" },
                  },
                }}
              />
```

With:
```tsx
              <Toaster
                position="bottom-right"
                toastOptions={{
                  style: {
                    background: "var(--surface)",
                    color: "var(--ink)",
                    border: "1px solid var(--line)",
                    borderRadius: "12px",
                    padding: "10px 14px",
                    fontSize: "13px",
                    boxShadow: "0 12px 28px -12px rgba(36,30,27,0.18)",
                  },
                  success: {
                    iconTheme: { primary: "var(--ink)", secondary: "var(--surface)" },
                  },
                  error: {
                    iconTheme: { primary: "var(--muted)", secondary: "var(--surface)" },
                  },
                }}
              />
```

- [ ] **Step 3: Verify no leftover `--ok`/`--err` toast reference**

Run: `grep -n '"var(--ok)"\|"var(--err)"' frontend/src/App.tsx`
Expected: no output (empty).

- [ ] **Step 4: Typecheck**

Run: `cd frontend && npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/App.tsx
git commit -m "style: move toasts to bottom-right, drop green/red for a neutral minimal look"
```

---

### Task A2: Rewrite backend "invalid credentials" copy (shared string, 3 files)

**Files:**
- Modify: `backend/services/authService.js:130,134,140`
- Modify: `backend/services/platformService.js:71,77`
- Modify: `backend/services/customerAccountService.js:165,170`

**Interfaces:**
- Consumes: nothing new.
- Produces: the literal string `"That email or password didn't match — try again."` replaces `"Invalid email or password."` everywhere it's thrown. Frontend call sites already surface `err.message` from these 401s with no code change needed (verified no frontend file or test hardcodes the old string).

- [ ] **Step 1: Confirm all 7 occurrences and that nothing else depends on the exact string**

Run: `grep -rn "Invalid email or password" backend/ frontend/ --include="*.js" --include="*.ts" --include="*.tsx"`
Expected: exactly 7 matches, all in the 3 service files above (3 in `authService.js`, 2 in `platformService.js`, 2 in `customerAccountService.js`). No test file matches.

- [ ] **Step 2: Replace all 7 occurrences**

In each of the 3 files, replace every instance of:
```js
throw createHttpError("Invalid email or password.", 401);
```
with:
```js
throw createHttpError("That email or password didn't match — try again.", 401);
```

- [ ] **Step 3: Verify**

Run: `grep -rn "Invalid email or password" backend/` (expect empty) and `grep -rln "That email or password didn't match" backend/services/` (expect the 3 files).

- [ ] **Step 4: Run the full backend suite (no test asserts on this exact string, but confirm nothing else broke)**

Run: `cd backend && npm test`
Expected: all suites pass (same pass count as before this change).

- [ ] **Step 5: Commit**

```bash
git add backend/services/authService.js backend/services/platformService.js backend/services/customerAccountService.js
git commit -m "feat(be): friendlier wrong-password message across all 3 login paths"
```

---

### Task A3: Rewrite toast copy — auth & login flows (11 files)

**Files:**
- Modify: `frontend/src/components/shared/AccountSettingsForm.tsx:57,59,67,71,79,81`
- Modify: `frontend/src/components/admin/VerifyEmailGate.tsx:20,22`
- Modify: `frontend/src/components/customer/AuthView.tsx:65,69,72,80,84,87,101,121,123,246`
- Modify: `frontend/src/components/customer/PhoneStepModal.tsx:16,24`
- Modify: `frontend/src/routes/GlobalCustomerLogin.tsx:42,45,48,61,133`
- Modify: `frontend/src/routes/GlobalCustomerRegister.tsx:38,42,45,66,68`
- Modify: `frontend/src/routes/CustomerDashboard.tsx:91,93`
- Modify: `frontend/src/routes/ClaimLanding.tsx:145,157`
- Modify: `frontend/src/routes/ResetPassword.tsx:17,21,28,31`
- Modify: `frontend/src/routes/admin/AdminLogin.tsx:44,47,50`
- Modify: `frontend/src/routes/platform/PlatformLogin.tsx:36,39,42`

**Interfaces:**
- Consumes: nothing new — every edit is a string-literal swap inside existing `toast.success(...)`/`toast.error(...)`/`toast.loading(...)` calls. Dynamic interpolation and `{ id: toastId }` / `{ id }` second-argument objects are preserved exactly as-is.
- Produces: nothing new exported.

- [ ] **Step 1: Apply the string replacements**

`AccountSettingsForm.tsx`:
- `"Name updated"` → `"Name updated!"`
- `"Failed to update name."` → `"Couldn't update your name — try again."`
- `"Password updated"` → `"Password updated!"`
- `"Failed to update password."` → `"Couldn't update your password — try again."`
- `"Verification email resent."` → `"Verification email sent — check your inbox."`
- `"Could not resend. Try again."` → `"Couldn't resend that — try again in a bit."`

`VerifyEmailGate.tsx`:
- `"Verification email resent."` → `"Verification email sent — check your inbox."`
- `"Could not resend. Try again."` → `"Couldn't resend that — try again in a bit."`

`AuthView.tsx`:
- `"Signing in…"` → `"Signing you in…"`
- `"Welcome back!"` → `"Good to see you again!"`
- `"Failed to sign in."` → `"Couldn't sign you in — try again."`
- `"Creating your account…"` → `"Setting up your account…"`
- `"Account created! Check your email."` → `"You're in! Check your email to verify."`
- `"Failed to register."` → `"Couldn't create your account — try again."`
- `"Google sign-in failed."` (both the `catch` block at line 101 and the inline `onError` at line 246) → `"Google sign-in didn't work — try again."`
- `"Verification email resent."` → `"Verification email sent — check your inbox."`
- `"Could not resend. Try again."` → `"Couldn't resend that — try again in a bit."`

`PhoneStepModal.tsx`:
- `"Enter a valid phone number."` → `"That phone number doesn't look right."`
- `"Could not save."` → `"Couldn't save that — try again."`

`GlobalCustomerLogin.tsx`:
- `"Signing in…"` → `"Signing you in…"`
- `"Welcome back!"` → `"Good to see you again!"`
- `"Failed to sign in."` → `"Couldn't sign you in — try again."`
- `"Google sign-in failed."` (both line 61 `catch` and line 133 inline `onError`) → `"Google sign-in didn't work — try again."`

`GlobalCustomerRegister.tsx`:
- `"Creating your account…"` → `"Setting up your account…"`
- `"Account created! Check your email."` → `"You're in! Check your email to verify."`
- `"Failed to register."` → `"Couldn't create your account — try again."`
- `"Verification email resent."` → `"Verification email sent — check your inbox."`
- `"Could not resend. Try again."` → `"Couldn't resend that — try again in a bit."`

`CustomerDashboard.tsx`:
- `"Verification email resent."` → `"Verification email sent — check your inbox."`
- `"Could not resend. Try again."` → `"Couldn't resend that — try again in a bit."`

`ClaimLanding.tsx`:
- `"Failed to sign in."` → `"Couldn't sign you in — try again."`
- `"Failed to register."` → `"Couldn't create your account — try again."`

`ResetPassword.tsx`:
- `"Password must be at least 6 characters."` → `"Needs to be at least 6 characters."`
- `"Passwords do not match."` → `"Those passwords don't match."`
- `"Password updated. Please sign in."` → `"Password updated! Go ahead and sign in."`
- `"Reset failed."` → `"Couldn't reset that — try again."`

`AdminLogin.tsx`:
- `"Signing in…"` → `"Signing you in…"`
- `"Welcome to your console!"` → `"Welcome back to the console!"`
- `"Failed to sign in."` → `"Couldn't sign you in — try again."`

`PlatformLogin.tsx`:
- `"Signing in…"` → `"Signing you in…"`
- `"Welcome back!"` → `"Good to see you again!"`
- `"Failed to sign in."` → `"Couldn't sign you in — try again."`

- [ ] **Step 2: Verify no stale strings remain**

Run:
```bash
grep -rn '"Signing in…"\|"Welcome back!"\|"Failed to sign in\."\|"Failed to register\."\|"Google sign-in failed\."\|"Creating your account…"\|"Account created! Check your email\."\|"Verification email resent\."\|"Could not resend\. Try again\."\|"Enter a valid phone number\."\|"Could not save\."\|"Password must be at least 6 characters\."\|"Passwords do not match\."\|"Password updated\. Please sign in\."\|"Reset failed\."\|"Welcome to your console!"\|"Name updated"\|"Failed to update name\."\|"Password updated"\|"Failed to update password\."' frontend/src
```
Expected: no output.

- [ ] **Step 3: Typecheck**

Run: `cd frontend && npx tsc --noEmit`
Expected: no new errors (pure string literal changes, should be a no-op for the type checker).

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/shared/AccountSettingsForm.tsx frontend/src/components/admin/VerifyEmailGate.tsx frontend/src/components/customer/AuthView.tsx frontend/src/components/customer/PhoneStepModal.tsx frontend/src/routes/GlobalCustomerLogin.tsx frontend/src/routes/GlobalCustomerRegister.tsx frontend/src/routes/CustomerDashboard.tsx frontend/src/routes/ClaimLanding.tsx frontend/src/routes/ResetPassword.tsx frontend/src/routes/admin/AdminLogin.tsx frontend/src/routes/platform/PlatformLogin.tsx
git commit -m "style(copy): lighten auth/account toast copy across login, register, reset flows"
```

---

### Task A4: Rewrite toast copy — customer-facing actions (2 files)

**Files:**
- Modify: `frontend/src/components/customer/ScannerModal.tsx:137,162,220`
- Modify: `frontend/src/routes/CustomerWallet.tsx:81`

**Interfaces:** none new.

- [ ] **Step 1: Apply replacements**

`ScannerModal.tsx`:
- `"Claiming your loyalty stamp..."` → `"Stamping your card…"`
- `"Failed to claim stamp."` → `"Couldn't add that stamp — try again."`
- `"Voucher code copied!"` → `"Copied! Show that at the counter."`

`CustomerWallet.tsx`:
- `"Voucher code copied!"` → `"Copied! Show that at the counter."`

- [ ] **Step 2: Verify**

Run: `grep -rn '"Claiming your loyalty stamp\.\.\."\|"Failed to claim stamp\."\|"Voucher code copied!"' frontend/src`
Expected: no output.

- [ ] **Step 3: Typecheck**

Run: `cd frontend && npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/customer/ScannerModal.tsx frontend/src/routes/CustomerWallet.tsx
git commit -m "style(copy): lighten scanner/wallet toast copy"
```

---

### Task A5: Rewrite toast copy — admin console (7 files)

**Files:**
- Modify: `frontend/src/routes/admin/Branding.tsx:94,96`
- Modify: `frontend/src/routes/admin/StampProgram.tsx:49,51`
- Modify: `frontend/src/routes/admin/AdminContact.tsx:78,80`
- Modify: `frontend/src/routes/admin/AdminEvents.tsx:106,108,117,119,126`
- Modify: `frontend/src/routes/admin/GenerateQr.tsx:39`
- Modify: `frontend/src/routes/admin/MenuManagement.tsx:89,105,110,126,128,141`
- Modify: `frontend/src/routes/admin/RedeemVoucher.tsx:26`

**Interfaces:** none new.

- [ ] **Step 1: Apply replacements**

`Branding.tsx`:
- `"Branding saved"` → `"Branding saved!"`
- `"Failed to save."` → `"Couldn't save that — try again."`

`StampProgram.tsx`:
- `"Program saved"` → `"Program saved!"`
- `"Failed to save."` → `"Couldn't save that — try again."`

`AdminContact.tsx`:
- `"Contact info saved"` → `"Contact info saved!"`
- `"Failed to save."` → `"Couldn't save that — try again."`

`AdminEvents.tsx`:
- `"Event added"` → `"Event added!"`
- `"Failed to add."` → `"Couldn't add that — try again."`
- `"Event updated"` → `"Event updated!"`
- `"Failed to update."` → `"Couldn't update that — try again."`
- `"Event removed"` → `"Event removed."`

`GenerateQr.tsx`:
- `"Failed to generate code."` → `"Couldn't generate a code — try again."`

`MenuManagement.tsx`:
- `"Couldn't read that file."` → `"Couldn't read that file — check the format."`
- `` `Added ${res.created}, updated ${res.updated} item(s).` `` → `` `${res.created} added, ${res.updated} updated.` ``
- `"Import failed."` → `"Couldn't import that — try again."`
- `"Item added"` → `"Item added!"`
- `"Failed to add."` → `"Couldn't add that — try again."`
- `"Item removed"` → `"Item removed."`

`RedeemVoucher.tsx`:
- `"Voucher redeemed 🎉"` → `"Voucher redeemed!"`

- [ ] **Step 2: Verify**

Run: `grep -rn '"Branding saved"\|"Program saved"\|"Contact info saved"\|"Event added"\|"Event updated"\|"Event removed"\|"Failed to save\."\|"Failed to add\."\|"Failed to update\."\|"Failed to generate code\."\|"Couldn.t read that file\."\|"Import failed\."\|"Item added"\|"Item removed"\|"Voucher redeemed 🎉"' frontend/src/routes/admin`
Expected: no output (note: `AdminContact.tsx` and `Branding.tsx` both had `"Failed to save."` — both must be gone).

- [ ] **Step 3: Typecheck**

Run: `cd frontend && npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/routes/admin/Branding.tsx frontend/src/routes/admin/StampProgram.tsx frontend/src/routes/admin/AdminContact.tsx frontend/src/routes/admin/AdminEvents.tsx frontend/src/routes/admin/GenerateQr.tsx frontend/src/routes/admin/MenuManagement.tsx frontend/src/routes/admin/RedeemVoucher.tsx
git commit -m "style(copy): lighten admin console toast copy"
```

---

### Task A6: Rewrite toast copy — platform console (3 files)

**Files:**
- Modify: `frontend/src/routes/platform/PlatformContact.tsx:65,67`
- Modify: `frontend/src/routes/platform/OnboardBusiness.tsx:51,64`
- Modify: `frontend/src/routes/platform/BusinessDetail.tsx:32,34`

**Interfaces:** none new.

- [ ] **Step 1: Apply replacements**

`PlatformContact.tsx`:
- `"Contact info saved"` → `"Contact info saved!"`
- `"Failed to save."` → `"Couldn't save that — try again."`

`OnboardBusiness.tsx`:
- `"Fill in every field."` → `"A few fields still need filling in."`
- `"Failed to onboard."` → `"Couldn't onboard that business — try again."`
- (line 62, `` `${res.business.name} is live!` `` stays unchanged — already on-tone.)

`BusinessDetail.tsx`:
- `"Status updated"` → `"Status updated!"`
- `"Failed to update."` → `"Couldn't update that — try again."`

- [ ] **Step 2: Verify**

Run: `grep -rn '"Contact info saved"\|"Fill in every field\."\|"Failed to onboard\."\|"Status updated"\|"Failed to update\."\|"Failed to save\."' frontend/src/routes/platform`
Expected: no output.

- [ ] **Step 3: Typecheck**

Run: `cd frontend && npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/routes/platform/PlatformContact.tsx frontend/src/routes/platform/OnboardBusiness.tsx frontend/src/routes/platform/BusinessDetail.tsx
git commit -m "style(copy): lighten platform console toast copy"
```

---

## Part B — Platform logo

### Task B1: Build the `StampdLogo` component

**Files:**
- Create: `frontend/src/components/shared/StampdLogo.tsx`

**Interfaces:**
- Produces: `export function StampdLogo({ size = 24, tile = false, className = "" }: { size?: number; tile?: boolean; className?: string }): JSX.Element` — icon-only (no wordmark). `tile=false` (default) renders a transparent-background icon at `size`×`size`px, for placing next to live `{PLATFORM_NAME}` text. `tile=true` renders the icon inset in a cream (`#F3ECE2`) rounded-square of `size`×`size`px, for standalone brand-mark contexts (replacing a colored letter-badge).

- [ ] **Step 1: Create the component**

```tsx
interface StampdLogoProps {
  size?: number;
  tile?: boolean;
  className?: string;
}

// Hand-built recreation of the Stampd mark (2x2 stamp-card grid: three
// outline circles + one filled "stamped" circle). Colors are fixed, not
// tenant-themed — this is the platform's own identity, distinct from
// --brand/--plat which theme per-tenant UI.
export function StampdLogo({ size = 24, tile = false, className = "" }: StampdLogoProps) {
  const iconSize = tile ? Math.round(size * 0.64) : size;

  const mark = (
    <svg
      viewBox="0 0 100 100"
      width={iconSize}
      height={iconSize}
      className={tile ? "" : className}
      aria-hidden="true"
    >
      <g stroke="#1F1B18" strokeWidth="6" fill="none" strokeLinecap="round">
        <circle cx="27" cy="27" r="15" />
        <circle cx="73" cy="27" r="15" />
        <circle cx="27" cy="73" r="15" />
        <line x1="50" y1="6" x2="50" y2="94" />
        <line x1="6" y1="50" x2="94" y2="50" />
      </g>
      <circle cx="73" cy="73" r="15" fill="#C15D2C" />
    </svg>
  );

  if (!tile) return mark;

  return (
    <div
      className={`flex flex-shrink-0 items-center justify-center rounded-[22%] ${className}`}
      style={{ width: size, height: size, background: "#F3ECE2" }}
    >
      {mark}
    </div>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `cd frontend && npx tsc --noEmit`
Expected: no errors (new file, no consumers yet).

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/shared/StampdLogo.tsx
git commit -m "feat(fe): add StampdLogo icon component"
```

---

### Task B2: Wire the logo into every platform brand-mark call site

**Files:**
- Modify: `frontend/src/components/platform/PlatformLayout.tsx:39-47`
- Modify: `frontend/src/components/customer/CustomerLayout.tsx:57-60`
- Modify: `frontend/src/components/customer/GlobalCustomerLayout.tsx:71-74`
- Modify: `frontend/src/routes/GlobalCustomerLogin.tsx:68-73`
- Modify: `frontend/src/routes/GlobalCustomerRegister.tsx:159-164`
- Modify: `frontend/src/routes/platform/PlatformLogin.tsx:51-57`
- Modify: `frontend/src/routes/platform/PlatformLanding.tsx:67-69,341-343`

**Interfaces:**
- Consumes: `StampdLogo` from Task B1 (`import { StampdLogo } from "../../components/shared/StampdLogo"` or the correct relative path per file's depth).

- [ ] **Step 1: `PlatformLayout.tsx` — replace the letter-badge**

Add the import (near the existing `PLATFORM_NAME` import):
```tsx
import { StampdLogo } from "../shared/StampdLogo";
```

Replace:
```tsx
          <div
            className="flex h-9 w-9 items-center justify-center rounded-xl font-display text-sm font-bold text-white"
            style={{ background: "var(--plat)" }}
          >
            {PLATFORM_NAME.charAt(0)}
          </div>
```
With:
```tsx
          <StampdLogo size={36} tile />
```

- [ ] **Step 2: `CustomerLayout.tsx` — icon before the header text**

Add the import:
```tsx
import { StampdLogo } from "../shared/StampdLogo";
```

Replace:
```tsx
          <span className="font-display text-xl font-bold" style={{ color: "var(--brand)" }}>
            {PLATFORM_NAME}
          </span>
```
With:
```tsx
          <div className="flex items-center gap-2">
            <StampdLogo size={22} />
            <span className="font-display text-xl font-bold" style={{ color: "var(--brand)" }}>
              {PLATFORM_NAME}
            </span>
          </div>
```

- [ ] **Step 3: `GlobalCustomerLayout.tsx` — same pattern as Step 2**

Add the same import (correct relative path — this file is also in `components/customer/`, so `../shared/StampdLogo`), and apply the identical wrap-in-a-flex-row change to its `{PLATFORM_NAME}` span.

- [ ] **Step 4: `GlobalCustomerLogin.tsx` — replace the letter-badge**

Add the import:
```tsx
import { StampdLogo } from "../components/shared/StampdLogo";
```

Replace:
```tsx
        <div
          className="mb-4 flex h-14 w-14 items-center justify-center rounded-[17px] font-display text-[22px] font-extrabold text-white"
          style={{ background: "var(--brand)" }}
        >
          {PLATFORM_NAME.charAt(0)}
        </div>
```
With:
```tsx
        <StampdLogo size={56} tile className="mb-4" />
```

- [ ] **Step 5: `GlobalCustomerRegister.tsx` — same pattern as Step 4**

Add the same import (`../components/shared/StampdLogo`), and apply the identical replacement to its `Shell` component's letter-badge (`h-14 w-14` box).

- [ ] **Step 6: `PlatformLogin.tsx` — replace the letter-badge**

Add the import:
```tsx
import { StampdLogo } from "../../components/shared/StampdLogo";
```

Replace:
```tsx
          <div
            className="mx-auto mb-3.5 flex h-11 w-11 items-center justify-center rounded-[13px] font-display text-xl font-extrabold text-white"
            style={{ background: "var(--plat)" }}
          >
            {PLATFORM_NAME.charAt(0)}
          </div>
```
With:
```tsx
          <StampdLogo size={44} tile className="mx-auto mb-3.5" />
```

- [ ] **Step 7: `PlatformLanding.tsx` — icon before the header + footer text**

Add the import:
```tsx
import { StampdLogo } from "../../components/shared/StampdLogo";
```

Replace (header, ~line 67):
```tsx
          <span className="font-display text-xl font-bold tracking-tight" style={{ color: "var(--plat)" }}>
            {PLATFORM_NAME}
          </span>
```
With:
```tsx
          <span className="flex items-center gap-2 font-display text-xl font-bold tracking-tight" style={{ color: "var(--plat)" }}>
            <StampdLogo size={22} />
            {PLATFORM_NAME}
          </span>
```

Replace (footer, ~line 341):
```tsx
              <div className="mb-3 font-display text-xl font-bold" style={{ color: "var(--plat)" }}>
                {PLATFORM_NAME}
              </div>
```
With:
```tsx
              <div className="mb-3 flex items-center gap-2 font-display text-xl font-bold" style={{ color: "var(--plat)" }}>
                <StampdLogo size={22} />
                {PLATFORM_NAME}
              </div>
```

- [ ] **Step 8: Typecheck**

Run: `cd frontend && npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 9: Browser smoke check**

Start the dev server (`preview_start` with the project's `dev` launch config, or `npm run dev` from repo root), then visit `/platform/login`, `/customer-login`, `/customer-register`, and a `/:slug/dashboard` page. Confirm the icon renders next to/instead of the old letter badge on each, with no layout shift or console errors.

- [ ] **Step 10: Commit**

```bash
git add frontend/src/components/platform/PlatformLayout.tsx frontend/src/components/customer/CustomerLayout.tsx frontend/src/components/customer/GlobalCustomerLayout.tsx frontend/src/routes/GlobalCustomerLogin.tsx frontend/src/routes/GlobalCustomerRegister.tsx frontend/src/routes/platform/PlatformLogin.tsx frontend/src/routes/platform/PlatformLanding.tsx
git commit -m "feat(fe): show the Stampd logo mark everywhere the platform brand appears"
```

---

### Task B3: Favicon + page title, delete the source PNG

**Files:**
- Modify: `frontend/index.html`
- Delete: `Logo/Gemini_Generated_Image_2n4t6u2n4t6u2n4t.png`
- Delete: `Logo/` (now-empty directory)

**Interfaces:** none new.

- [ ] **Step 1: Replace the favicon and fix the stale title**

Replace:
```html
    <link rel="icon" type="image/svg+xml" href="data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text y=%22.9em%22 font-size=%2290%22>☕</text></svg>" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Mansarowar Cafe Loyalty</title>
```
With:
```html
    <link rel="icon" type="image/svg+xml" href="data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><rect width=%22100%22 height=%22100%22 rx=%2222%22 fill=%22%23F3ECE2%22/><g stroke=%22%231F1B18%22 stroke-width=%226%22 fill=%22none%22 stroke-linecap=%22round%22><circle cx=%2227%22 cy=%2227%22 r=%2215%22/><circle cx=%2273%22 cy=%2227%22 r=%2215%22/><circle cx=%2227%22 cy=%2273%22 r=%2215%22/><line x1=%2250%22 y1=%226%22 x2=%2250%22 y2=%2294%22/><line x1=%226%22 y1=%2250%22 x2=%2294%22 y2=%2250%22/></g><circle cx=%2273%22 cy=%2273%22 r=%2215%22 fill=%22%23C15D2C%22/></svg>" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Stampd</title>
```

- [ ] **Step 2: Delete the source PNG and its now-empty folder**

Run:
```bash
git rm "Logo/Gemini_Generated_Image_2n4t6u2n4t6u2n4t.png"
rmdir Logo
```
Expected: `rmdir` succeeds silently (folder was only holding the one file).

- [ ] **Step 3: Browser check the favicon**

Load the dev server root URL and confirm the browser tab icon is the new stamp-grid mark, not the old ☕ emoji.

- [ ] **Step 4: Commit**

```bash
git add frontend/index.html
git commit -m "feat(fe): favicon + title use the real Stampd mark; drop the source logo asset"
```

---

## Part C — Voucher expiry (backend)

### Task C1: Add `voucherExpiryDays` to the program config + schemas

**Files:**
- Modify: `backend/config/platform.js`
- Modify: `backend/models/Organization.js:24-32`
- Modify: `backend/models/Voucher.js`

**Interfaces:**
- Produces: `DEFAULT_PROGRAM.voucherExpiryDays: 0`. `Organization.program.voucherExpiryDays: Number` (default 0). `Voucher.expiresAt: Date | null` (default null).

- [ ] **Step 1: `config/platform.js` — add the default**

Replace:
```js
const DEFAULT_PROGRAM = {
  stampsRequired: 5,
  rewardTitle: "Free Coffee",
  rewardDescription: "Collect stamps on every visit and unlock a free coffee.",
  cooldownHours: 18,
  minBillAmount: 0
};
```
With:
```js
const DEFAULT_PROGRAM = {
  stampsRequired: 5,
  rewardTitle: "Free Coffee",
  rewardDescription: "Collect stamps on every visit and unlock a free coffee.",
  cooldownHours: 18,
  minBillAmount: 0,
  // 0 = vouchers never expire. When set above 0, a voucher earned under
  // this program gets an expiresAt of (earnedAt + this many days).
  voucherExpiryDays: 0
};
```

- [ ] **Step 2: `models/Organization.js` — add the schema field**

Replace:
```js
  program: {
    stampsRequired: { type: Number, min: 1, default: DEFAULT_PROGRAM.stampsRequired },
    rewardTitle: { type: String, default: DEFAULT_PROGRAM.rewardTitle },
    rewardDescription: { type: String, default: DEFAULT_PROGRAM.rewardDescription },
    cooldownHours: { type: Number, min: 0, default: DEFAULT_PROGRAM.cooldownHours },
    // 0 = disabled. Barista must enter a bill amount >= this to generate a
    // stamp QR when it's set above 0. Plain number, never currency-formatted.
    minBillAmount: { type: Number, min: 0, default: DEFAULT_PROGRAM.minBillAmount }
  },
```
With:
```js
  program: {
    stampsRequired: { type: Number, min: 1, default: DEFAULT_PROGRAM.stampsRequired },
    rewardTitle: { type: String, default: DEFAULT_PROGRAM.rewardTitle },
    rewardDescription: { type: String, default: DEFAULT_PROGRAM.rewardDescription },
    cooldownHours: { type: Number, min: 0, default: DEFAULT_PROGRAM.cooldownHours },
    // 0 = disabled. Barista must enter a bill amount >= this to generate a
    // stamp QR when it's set above 0. Plain number, never currency-formatted.
    minBillAmount: { type: Number, min: 0, default: DEFAULT_PROGRAM.minBillAmount },
    // 0 = vouchers never expire (default, no behavior change for existing
    // tenants). Above 0, a newly-earned voucher's expiresAt is set this
    // many days after earnedAt.
    voucherExpiryDays: { type: Number, min: 0, default: DEFAULT_PROGRAM.voucherExpiryDays }
  },
```

- [ ] **Step 3: `models/Voucher.js` — add `expiresAt`**

Replace:
```js
const VoucherSchema = new mongoose.Schema({
  organizationId: { type: mongoose.Schema.Types.ObjectId, ref: "Organization", required: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  voucherCode: { type: String, required: true, unique: true },
  isValid: { type: Boolean, default: true },
  earnedAt: { type: Date, default: Date.now },
  redeemedAt: { type: Date, default: null }
});
```
With:
```js
const VoucherSchema = new mongoose.Schema({
  organizationId: { type: mongoose.Schema.Types.ObjectId, ref: "Organization", required: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  voucherCode: { type: String, required: true, unique: true },
  isValid: { type: Boolean, default: true },
  earnedAt: { type: Date, default: Date.now },
  redeemedAt: { type: Date, default: null },
  // null = never expires. Set at creation time from the earning tenant's
  // program.voucherExpiryDays; never recomputed after the voucher exists.
  expiresAt: { type: Date, default: null }
});
```

- [ ] **Step 4: No test yet (schema-only change) — confirm nothing broke**

Run: `cd backend && npm test`
Expected: all existing suites still pass (schema additions are backward compatible — `updateMySettings`'s shallow-merge of `program` already handles the new field with zero controller changes).

- [ ] **Step 5: Commit**

```bash
git add backend/config/platform.js backend/models/Organization.js backend/models/Voucher.js
git commit -m "feat(be): add voucherExpiryDays program setting + Voucher.expiresAt field"
```

---

### Task C2: Set `expiresAt` when a voucher is earned

**Files:**
- Modify: `backend/services/stampService.js:225-244`

**Interfaces:**
- Consumes: `org.program.voucherExpiryDays` (Task C1), `org` and `now` already in scope as parameters of `awardStampInTransaction`.
- Produces: every `Voucher.create(...)` call in this function now includes `expiresAt`.

- [ ] **Step 1: Replace the voucher-creation block**

Replace:
```js
  if (updatedCard.stampsEarned >= stampsRequired) {
    const voucherCode = await generateVoucherCode(session, voucherPrefix);

    await Voucher.create(
      [
        {
          userId,
          organizationId,
          voucherCode
        }
      ],
      { session }
    );
```
With:
```js
  if (updatedCard.stampsEarned >= stampsRequired) {
    const voucherCode = await generateVoucherCode(session, voucherPrefix);
    const voucherExpiryDays = org.program.voucherExpiryDays || 0;
    const expiresAt = voucherExpiryDays > 0
      ? new Date(now.getTime() + voucherExpiryDays * 24 * 60 * 60 * 1000)
      : null;

    await Voucher.create(
      [
        {
          userId,
          organizationId,
          voucherCode,
          expiresAt
        }
      ],
      { session }
    );
```

- [ ] **Step 2: Run the full backend suite**

Run: `cd backend && npm test`
Expected: all suites pass (existing voucher-creation tests don't assert on `expiresAt` being absent, so `null` is a compatible addition).

- [ ] **Step 3: Commit**

```bash
git add backend/services/stampService.js
git commit -m "feat(be): set voucher expiresAt from the tenant's voucherExpiryDays at earn time"
```

---

### Task C3: Add a mock-DB-only test hook to force-expire a voucher

**Files:**
- Modify: `backend/routes/testHookRoutes.js`

**Interfaces:**
- Produces: `POST /__test__/expire-voucher` (mock-DB-only, mounted only when `MONGODB_URI` is unset per the existing guard in `server.js:103`), body `{ voucherCode }`, sets that voucher's `expiresAt` to one hour in the past. Response `{ success: true }` or 404 if no matching voucher.

This mirrors the existing `/mint-token`/`/mint-global-token` pattern in the same file — a deterministic way for a test to reach an "already expired" state without waiting real days or faking the system clock.

- [ ] **Step 1: Add the import + route**

Add near the top, alongside the other model imports:
```js
const Voucher = require("../models/Voucher");
```

Add at the end of the file, before `module.exports = router;`:
```js
// DEV/TEST ONLY. Force a voucher's expiresAt into the past so a test can
// deterministically exercise the "redeem an expired voucher" path without
// waiting real days or faking the system clock.
router.post("/expire-voucher", async (req, res, next) => {
  try {
    const { voucherCode } = req.body;
    const normalizedCode = String(voucherCode || "").trim().toUpperCase();

    const voucher = await Voucher.findOneAndUpdate(
      { voucherCode: normalizedCode },
      { $set: { expiresAt: new Date(Date.now() - 3600 * 1000) } },
      { new: true }
    );

    if (!voucher) return res.status(404).json({ success: false });

    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});
```

- [ ] **Step 2: Verify the route file still loads cleanly**

Run: `cd backend && node -e "require('./routes/testHookRoutes.js'); console.log('OK')"`
Expected: `OK` printed, no errors.

- [ ] **Step 3: Commit**

```bash
git add backend/routes/testHookRoutes.js
git commit -m "test(be): add mock-DB-only test hook to force-expire a voucher"
```

---

### Task C4: Reject redemption of an expired voucher; include `expiresAt` in the wallet

**Files:**
- Modify: `backend/services/voucherService.js`

**Interfaces:**
- Produces: `redeemVoucher` now throws `createHttpError("This voucher's expired.", 400)` for a voucher whose `expiresAt` has passed, and flips it to `isValid: false` (consumed, not redeemed — `redeemedAt` stays `null`) so it can't be retried. `getMyWallet`'s projection now includes `expiresAt`.

- [ ] **Step 1: Write the failing test**

Create `backend/tests/voucher-expiry.js`:
```js
/**
 * Voucher expiry suite. Self-contained: boots its own server on a dedicated
 * port against the in-memory mock DB.
 *
 * Covers: default (voucherExpiryDays: 0) vouchers never expire; setting a
 * positive voucherExpiryDays stamps a future expiresAt on newly-earned
 * vouchers; the dashboard-stats "active vouchers" KPI excludes an expired
 * (but not-yet-touched) voucher; redeeming an expired voucher is rejected
 * and the voucher can't then be redeemed on a retry.
 *
 * Run directly: `node tests/voucher-expiry.js`
 */

const { bootServer } = require("./helpers/bootServer");

const SLUG = "coffesarowar";
const DAY_MS = 24 * 60 * 60 * 1000;

async function main() {
  const { baseUrl, stop } = await bootServer({ port: 5022 });
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

    const customerLogin = await api("/api/auth/login", {
      method: "POST",
      body: { email: "customer@mansarowar.cafe", password: "password" },
    });
    const customerToken = customerLogin.body.token;

    const claimStamp = async () => {
      const gen = await api("/api/admin/generate-qr", { method: "POST", token: adminToken });
      return api("/api/stamps/claim", {
        method: "POST",
        token: customerToken,
        body: { token: gen.body?.data?.token },
      });
    };

    // 1. Default program: stampsRequired 1, cooldown 0, voucherExpiryDays 0
    //    (never expires).
    const setDefault = await api("/api/admin/settings", {
      method: "PATCH",
      token: adminToken,
      body: { program: { stampsRequired: 1, cooldownHours: 0, voucherExpiryDays: 0 } },
    });
    check("admin sets stampsRequired:1, cooldownHours:0, voucherExpiryDays:0", setDefault.status === 200);

    const claimA = await claimStamp();
    const voucherA = claimA.body?.data?.voucherCode;
    check("claim A triggers a voucher", claimA.status === 200 && Boolean(voucherA));

    const walletAfterA = await api("/api/vouchers/my-wallet", { token: customerToken });
    const entryA = walletAfterA.body?.vouchers?.find((v) => v.voucherCode === voucherA);
    check("voucher A has expiresAt null (never expires)", entryA && entryA.expiresAt === null);

    const redeemA = await api("/api/admin/redeem-voucher", {
      method: "POST",
      token: adminToken,
      body: { voucherCode: voucherA },
    });
    check("voucher A (never expires) redeems fine", redeemA.status === 200);

    // 2. Switch to voucherExpiryDays: 30, earn a second voucher, expect a
    //    ~30-day-out expiresAt.
    const set30 = await api("/api/admin/settings", {
      method: "PATCH",
      token: adminToken,
      body: { program: { voucherExpiryDays: 30 } },
    });
    check("admin sets voucherExpiryDays:30", set30.status === 200 && set30.body.settings.program.voucherExpiryDays === 30);

    const claimB = await claimStamp();
    const voucherB = claimB.body?.data?.voucherCode;
    check("claim B triggers a second voucher", claimB.status === 200 && Boolean(voucherB));

    const walletAfterB = await api("/api/vouchers/my-wallet", { token: customerToken });
    const entryB = walletAfterB.body?.vouchers?.find((v) => v.voucherCode === voucherB);
    const expiresAtB = entryB ? new Date(entryB.expiresAt).getTime() : null;
    const expectedB = Date.now() + 30 * DAY_MS;
    check(
      "voucher B expiresAt is ~30 days out",
      expiresAtB !== null && Math.abs(expiresAtB - expectedB) < DAY_MS,
    );

    // 3. Dashboard "active vouchers" KPI includes voucher B before expiry.
    const statsBefore = await api("/api/admin/dashboard-stats", { token: adminToken });
    const activeBefore = statsBefore.body?.activeVouchers?.value;
    check("dashboard-stats reachable before expiry", statsBefore.status === 200 && typeof activeBefore === "number");

    // 4. Force voucher B into the past via the mock-DB-only test hook, then
    //    confirm the KPI excludes it even though isValid is still true.
    const expire = await api("/__test__/expire-voucher", {
      method: "POST",
      slug: undefined,
      body: { voucherCode: voucherB },
    });
    check("test hook force-expires voucher B", expire.status === 200);

    const statsAfter = await api("/api/admin/dashboard-stats", { token: adminToken });
    const activeAfter = statsAfter.body?.activeVouchers?.value;
    check(
      "active-vouchers KPI drops by 1 once B is expired (still isValid, excluded by expiresAt)",
      activeAfter === activeBefore - 1,
    );

    // 5. Redeeming the now-expired voucher B is rejected.
    const redeemB = await api("/api/admin/redeem-voucher", {
      method: "POST",
      token: adminToken,
      body: { voucherCode: voucherB },
    });
    check("expired voucher B redemption -> 400", redeemB.status === 400);
    check("expired voucher B redemption message", /expired/i.test(redeemB.body?.message || ""));

    // 6. Retrying redemption on B now fails as "already redeemed or invalid"
    //    (it was flipped to isValid:false by the rejected attempt above).
    const redeemBRetry = await api("/api/admin/redeem-voucher", {
      method: "POST",
      token: adminToken,
      body: { voucherCode: voucherB },
    });
    check("retrying redemption on consumed-but-expired B -> 400", redeemBRetry.status === 400);
  } finally {
    stop();
  }

  if (failures > 0) {
    console.error(`\n${failures} check(s) failed.`);
    process.exit(1);
  } else {
    console.log("\nAll voucher-expiry checks passed.");
  }
}

main();
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `cd backend && node tests/voucher-expiry.js`
Expected: several `FAIL` lines — `entryA.expiresAt` won't exist in the wallet response yet (not projected), and the expired-redemption checks will fail since nothing rejects expired vouchers yet.

- [ ] **Step 3: Implement `voucherService.js`**

Replace the whole file:
```js
const Voucher = require("../models/Voucher");

const createHttpError = (message, statusCode) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

const getMyWallet = async ({ userId, role, organizationId }) => {
  if (!userId) {
    throw createHttpError("Authenticated user context is required.", 401);
  }

  if (role !== "customer") {
    throw createHttpError("Only customers can access voucher wallet.", 403);
  }

  const vouchers = await Voucher.find(
    { userId, organizationId, isValid: true },
    { _id: 0, voucherCode: 1, isValid: 1, earnedAt: 1, expiresAt: 1 }
  ).sort({ earnedAt: -1 });

  return {
    success: true,
    vouchers
  };
};

const redeemVoucher = async ({ voucherCode, organizationId }) => {
  if (!voucherCode) {
    throw createHttpError("Voucher code is required.", 400);
  }

  const normalizedCode = voucherCode.trim().toUpperCase();
  const now = new Date();

  const redeemedVoucher = await Voucher.findOneAndUpdate(
    { voucherCode: normalizedCode, organizationId, isValid: true },
    { $set: { isValid: false, redeemedAt: now } },
    { new: true }
  );

  if (!redeemedVoucher) {
    const voucher = await Voucher.findOne({ voucherCode: normalizedCode, organizationId });

    if (!voucher) {
      throw createHttpError("Voucher code not found.", 404);
    }

    throw createHttpError("Voucher is already redeemed or invalid.", 400);
  }

  // Caught the expiry after the fact: undo the redemption timestamp (this
  // voucher was consumed, not honored) and reject.
  if (redeemedVoucher.expiresAt && redeemedVoucher.expiresAt < now) {
    await Voucher.findOneAndUpdate(
      { voucherCode: normalizedCode, organizationId },
      { $set: { redeemedAt: null } }
    );
    throw createHttpError("This voucher's expired.", 400);
  }

  return {
    success: true,
    message: "Voucher successfully redeemed. Dispense the reward."
  };
};

module.exports = {
  getMyWallet,
  redeemVoucher
};
```

- [ ] **Step 4: Run the new suite to confirm it passes**

Run: `cd backend && node tests/voucher-expiry.js`
Expected: `All voucher-expiry checks passed.` with every line `PASS`.

- [ ] **Step 5: Add the new suite to the `test` chain**

Modify `backend/package.json`'s `"test"` script: append `&& node tests/voucher-expiry.js` to the existing chain (after `node tests/global-directory.js`).

- [ ] **Step 6: Run the full backend suite**

Run: `cd backend && npm test`
Expected: every suite passes, including the new one.

- [ ] **Step 7: Commit**

```bash
git add backend/services/voucherService.js backend/tests/voucher-expiry.js backend/package.json
git commit -m "feat(be): reject redemption of an expired voucher; wallet exposes expiresAt"
```

---

### Task C5: Exclude expired-but-untouched vouchers from the active-vouchers KPI

**Files:**
- Modify: `backend/services/reportService.js:85-108`

**Interfaces:**
- Consumes: nothing new — `now` is already computed at the top of `getDashboardStats`.
- Produces: `activeVouchers` count now matches what Task C4's test (`node tests/voucher-expiry.js`) already asserts.

Note: this task's test coverage already exists and passed in Task C4 (the `activeAfter === activeBefore - 1` check) — this task is the implementation that makes it correct. If Task C4's suite already passes without this change, re-check: it shouldn't, since `Voucher.countDocuments({ organizationId, isValid: true })` has no expiry awareness yet.

- [ ] **Step 1: Confirm Task C4's test currently fails on this specific check without this change**

Temporarily revert Task C4's suite dependency isn't necessary — if you're doing C4 and C5 in order, C4's suite was already green because... actually verify: run `cd backend && node tests/voucher-expiry.js` now (before this task's edit). If the `"active-vouchers KPI drops by 1 once B is expired"` check already shows `PASS`, stop and inspect why (it should currently `FAIL` since the query has no expiry filter yet — if you did Tasks in order this check should be failing right now).

- [ ] **Step 2: Replace the query**

Replace:
```js
    Voucher.countDocuments({ organizationId, isValid: true }),
```
With:
```js
    Voucher.countDocuments({
      organizationId,
      isValid: true,
      $or: [{ expiresAt: null }, { expiresAt: { $gte: now } }]
    }),
```

- [ ] **Step 3: Run the voucher-expiry suite again**

Run: `cd backend && node tests/voucher-expiry.js`
Expected: `All voucher-expiry checks passed.`

- [ ] **Step 4: Run the full backend suite**

Run: `cd backend && npm test`
Expected: all suites pass, including `business-reports.js` (which also exercises `activeVouchers`, but with no expired vouchers in its scenario, so the added `$or` is a no-op there).

- [ ] **Step 5: Commit**

```bash
git add backend/services/reportService.js
git commit -m "fix(be): active-vouchers KPI excludes expired-but-untouched vouchers"
```

---

## Part D — Voucher expiry (frontend)

### Task D1: Admin setting — `voucherExpiryDays` in `StampProgram.tsx`

**Files:**
- Modify: `frontend/src/hooks/useAdminSettings.ts`
- Modify: `frontend/src/routes/admin/StampProgram.tsx`

**Interfaces:**
- Produces: `AdminProgram.voucherExpiryDays: number` (new field on the existing exported interface).

- [ ] **Step 1: Add the field to the type**

In `useAdminSettings.ts`, replace:
```ts
export interface AdminProgram {
  stampsRequired: number;
  rewardTitle: string;
  rewardDescription: string;
  cooldownHours: number;
  minBillAmount: number;
}
```
With:
```ts
export interface AdminProgram {
  stampsRequired: number;
  rewardTitle: string;
  rewardDescription: string;
  cooldownHours: number;
  minBillAmount: number;
  voucherExpiryDays: number;
}
```

- [ ] **Step 2: Add the form field**

In `StampProgram.tsx`, insert a new block right after the existing "Minimum bill amount" block (which ends with its closing `</div>` right before the `<button onClick={save} ...>`):
```tsx
        <div className="border-t border-[var(--line)] pt-5">
          <label className="mb-1.5 block text-sm font-bold">Voucher expiry</label>
          <div className="flex items-center gap-3">
            <input
              type="number"
              min={0}
              value={form.voucherExpiryDays}
              onChange={(e) => set("voucherExpiryDays", Number(e.target.value))}
              className="w-24 rounded-[11px] border border-[var(--line)] bg-[var(--bg)] px-4 py-3 text-sm focus:border-[var(--brand)] focus:outline-none"
            />
            <span className="text-sm text-[var(--muted)]">days — 0 = vouchers never expire</span>
          </div>
        </div>
```

- [ ] **Step 3: Add the loading-skeleton row (matches the existing skeleton pattern for a number-input block)**

In the `isLoading || !form` early-return block, right after the existing skeleton for "Minimum bill amount" (the last `border-t` skeleton block before the final full-width skeleton), insert:
```tsx
          <div className="border-t border-[var(--line)] pt-5">
            <Skeleton className="mb-1.5 h-3.5 w-32" />
            <Skeleton className="h-11 w-24 rounded-[11px]" />
          </div>
```

- [ ] **Step 4: Typecheck**

Run: `cd frontend && npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 5: Browser check**

Load `/:slug/admin/settings/program` (or wherever `StampProgram` is routed — check `routes/admin/` router if unsure), confirm the new "Voucher expiry" field renders, defaults to `0`, and saving a new value (e.g. `14`) persists after a page reload.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/hooks/useAdminSettings.ts frontend/src/routes/admin/StampProgram.tsx
git commit -m "feat(fe): admin can set vouchers to expire after N days"
```

---

### Task D2: Customer wallet — "Expired" badge

**Files:**
- Modify: `frontend/src/hooks/useVouchers.ts`
- Modify: `frontend/src/routes/CustomerWallet.tsx`

**Interfaces:**
- Consumes: `expiresAt` now present on every wallet entry (Task C4).
- Produces: `Voucher.expiresAt: string | null` (new field on the existing exported interface). `VoucherTicket` gains an `expiresAt` prop.

- [ ] **Step 1: Add the field to the type**

In `useVouchers.ts`, replace:
```ts
export interface Voucher {
  voucherCode: string;
  isValid: boolean;
  earnedAt: string;
}
```
With:
```ts
export interface Voucher {
  voucherCode: string;
  isValid: boolean;
  earnedAt: string;
  expiresAt: string | null;
}
```

- [ ] **Step 2: Exclude expired vouchers from the "active" count and pass `expiresAt` through**

In `CustomerWallet.tsx`, replace:
```tsx
  const active = vouchers.filter((v) => v.isValid);
```
With:
```tsx
  const isExpired = (v: { expiresAt: string | null }) => Boolean(v.expiresAt && new Date(v.expiresAt) < new Date());
  const active = vouchers.filter((v) => v.isValid && !isExpired(v));
```

Replace:
```tsx
          {active.map((v) => (
            <VoucherTicket key={v.voucherCode} code={v.voucherCode} reward={reward} earnedAt={v.earnedAt} />
          ))}
```
With:
```tsx
          {vouchers
            .filter((v) => v.isValid)
            .map((v) => (
              <VoucherTicket
                key={v.voucherCode}
                code={v.voucherCode}
                reward={reward}
                earnedAt={v.earnedAt}
                expiresAt={v.expiresAt}
              />
            ))}
```

(Note: the rendered list now maps over every `isValid` voucher, expired or not, so an expired-but-untouched one still shows — with an "Expired" badge instead of "Active" — rather than silently disappearing. Only the header count above excludes it.)

- [ ] **Step 3: Update `VoucherTicket` to show the badge**

Replace the function signature:
```tsx
function VoucherTicket({
  code,
  reward,
  earnedAt,
}: {
  code: string;
  reward: string;
  earnedAt: string;
}) {
```
With:
```tsx
function VoucherTicket({
  code,
  reward,
  earnedAt,
  expiresAt,
}: {
  code: string;
  reward: string;
  earnedAt: string;
  expiresAt: string | null;
}) {
  const expired = Boolean(expiresAt && new Date(expiresAt) < new Date());
```

Replace the "Active" badge:
```tsx
          <span
            className="flex-shrink-0 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider"
            style={{ background: "var(--ok-soft)", color: "var(--ok)" }}
          >
            Active
          </span>
```
With:
```tsx
          <span
            className="flex-shrink-0 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider"
            style={
              expired
                ? { background: "var(--surface-container-high)", color: "var(--soft)" }
                : { background: "var(--ok-soft)", color: "var(--ok)" }
            }
          >
            {expired ? "Expired" : "Active"}
          </span>
```

- [ ] **Step 4: Typecheck**

Run: `cd frontend && npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 5: Browser check**

Using the backend's `/__test__/expire-voucher` hook (mock DB running via `npm run dev`) against a voucher in a test tenant's wallet, confirm it renders with the neutral "Expired" badge instead of the green "Active" one, and is excluded from the "N active vouchers" count at the top.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/hooks/useVouchers.ts frontend/src/routes/CustomerWallet.tsx
git commit -m "feat(fe): wallet shows an Expired badge and excludes expired vouchers from the active count"
```

---

## Part E — Ship it

### Task E1: Full verification pass

- [ ] **Step 1: Backend**

Run: `cd backend && npm test`
Expected: every suite passes, including `voucher-expiry.js`.

- [ ] **Step 2: Frontend**

Run: `cd frontend && npx tsc --noEmit` (or `npm run lint` from repo root)
Expected: no errors.

- [ ] **Step 3: Browser walk (dev server)**

Start the dev server and walk: a toast fires bottom-right with no green/red (e.g. trigger a login and a deliberate wrong-password attempt); the logo appears on `/platform/login`, `/customer-login`, `/customer-register`, a tenant `CustomerLayout`/`GlobalCustomerLayout` header, and the browser tab favicon; the admin `StampProgram` page shows and saves "Voucher expiry"; a wallet voucher forced-expired via the test hook shows the neutral "Expired" badge.

- [ ] **Step 4: Commit any fixups found during the walk, then proceed to merge**

If the browser walk surfaces anything, fix it, re-run the relevant verification step, and commit as its own small fixup commit before moving on — don't fold fixes silently into an earlier commit via amend.

### Task E2: Merge to `main` and push

- [ ] **Step 1: Confirm branch state**

Run: `git status` and `git log --oneline main..HEAD`
Expected: working tree clean, a stack of commits from this plan ahead of `main`.

- [ ] **Step 2: Merge**

Run:
```bash
git checkout main
git merge --no-edit <this-branch-name>
```

- [ ] **Step 3: Push**

Run: `git push origin main`

(Per explicit prior user authorization: merge and push to `main` without an additional approval gate, since backend tests pass, frontend typechecks clean, and the browser walk in Task E1 confirms the three features work end-to-end.)
