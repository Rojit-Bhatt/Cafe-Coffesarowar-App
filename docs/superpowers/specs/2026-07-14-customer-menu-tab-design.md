# Epic C2 — Customer Menu Tab

**Date:** 2026-07-14
**Status:** Approved design, ready for implementation plan
**Scope:** Second of two specs decomposed from the original "Epic C" (Excel menu import + customer menu tab). C1 (Excel import) is merged. This spec covers only the customer-facing menu tab — pure frontend, consumes the already-existing public `GET /api/menu` endpoint, no backend changes.

## Context

Multi-tenant loyalty SaaS ("Stampd"). The authenticated customer app (`CustomerLayout`) currently has two tabs — Card (stamp card, `/dashboard`) and Wallet (vouchers, `/wallet`) — plus a center scan button. Business admins can now (as of Epic C1) build a display-only menu manually or via Excel import, and toggle it visible/hidden (`Organization.menuEnabled`). Customers currently have no way to see that menu. The ask: add a Menu tab.

**Explicitly deferred:** visual/UI redesign. This spec covers functional wiring only — the new screen matches the existing customer-app styling conventions already in `CustomerDashboard.tsx`/`CustomerWallet.tsx` (cards, `--brand` theming, phone-shell layout). Full frontend design work happens in a later pass (per user direction).

## Decisions locked during brainstorming

1. **Nav placement: Card → Menu → [Scan FAB] → Wallet.** Menu sits next to Card on the left side of the center scan button; Wallet stays alone on the right. The scan FAB stays visually centered exactly as today.
2. **Two distinct empty-state messages**, not one generic one:
   - `menuEnabled: false` → "This business hasn't added a menu yet."
   - `menuEnabled: true` but zero items → "Menu coming soon."
3. **Items grouped by category**, matching the grouping pattern already used in the admin's `MenuManagement.tsx` screen. Categories set via manual add or Excel import (C1) are actually surfaced to customers, not just to the admin.
4. **Behind the existing customer auth gate.** The Menu tab lives inside `CustomerLayout` alongside Card/Wallet — same authenticated-customer requirement, same phone-shell wrapper. Not a public screen.

## Data Flow

**No backend changes.** The screen consumes the existing public `GET /api/menu` (`backend/routes/menuRoutes.js` → `getPublicMenu` in `menuController.js`), which is tenant-scoped via the `X-Tenant-Slug` header (already sent on every request once `TenantProvider` sets it) and already:
- Returns `{ success: true, menuEnabled: false, items: [] }` immediately when the tenant's `menuEnabled` is `false` — no `MenuItem` query even runs.
- Otherwise returns `{ success: true, menuEnabled: true, items: [...] }` with only `isAvailable !== false` items (sold-out items already filtered server-side).

`TenantContext`'s `tenant.menuEnabled` is a fast, already-loaded signal but not the source of truth used here — the screen calls `GET /api/menu` directly and treats its response as authoritative, so there's exactly one place that can drift (there isn't a second copy of "is the menu on" logic to keep in sync).

## Frontend

### `frontend/src/hooks/useCustomerMenu.ts` (new)

```ts
export interface CustomerMenuItem {
  id: string;
  name: string;
  description: string;
  price: string;
  category: string;
}

export function useCustomerMenu() {
  return useQuery<{ menuEnabled: boolean; items: CustomerMenuItem[] }>({
    queryKey: ["customerMenu"],
    queryFn: async () => {
      const res = await apiRequest<{ success: boolean; menuEnabled: boolean; items: CustomerMenuItem[] }>(
        "/api/menu",
      );
      return { menuEnabled: res.menuEnabled, items: res.items || [] };
    },
  });
}
```

Distinct from the admin-side `useMenu()` already in `MenuManagement.tsx` (different endpoint, different auth — public vs. `role: "admin"` — and no mutations needed here, read-only).

### `frontend/src/routes/CustomerMenu.tsx` (new)

Rendered inside `CustomerLayout`'s `<Outlet />`, same pattern as `CustomerDashboard`/`CustomerWallet` (content-only component, no its own shell — the layout provides the phone frame + bottom nav).

- Loading: a simple centered spinner/skeleton line, matching the loading treatment already used elsewhere in the customer app (e.g. `CustomerLayout`'s own auth-loading spinner).
- `menuEnabled === false` → empty-state block: "This business hasn't added a menu yet."
- `menuEnabled === true && items.length === 0` → empty-state block: "Menu coming soon."
- Otherwise: group `items` by `category` (`Array.from(new Set(items.map(i => i.category || "General")))`, then filter per group — same approach as `MenuManagement.tsx`), render each category as a header followed by its items (name, description, price), read-only — no add-to-cart, no interaction, matching `MenuItem`'s documented "display-only" purpose.

### `frontend/src/components/customer/BottomNav.tsx`

- `BottomNavProps.activeTab` type widens from `"dashboard" | "wallet" | "none"` to `"dashboard" | "wallet" | "menu" | "none"`.
- New link to `/${slug}/menu` using the `UtensilsCrossed` icon from `lucide-react`, positioned between the existing Card link and the center scan button (decision 1) — same active/inactive styling pattern (`text-[var(--brand)]` when active, `text-[var(--soft)]` otherwise) as the existing Card/Wallet links.

### `frontend/src/components/customer/CustomerLayout.tsx`

`activeTab` derivation (`location.pathname.endsWith(...)`) gains a `/menu` branch alongside the existing `/wallet`/`/dashboard` checks.

### `frontend/src/App.tsx`

New lazy route inside the existing `<Route element={<CustomerLayout />}>` block (alongside `dashboard`/`wallet`):
```tsx
<Route path="menu" element={<CustomerMenu />} />
```

## Testing / Verification

No backend changes — nothing to add to the backend test suite for this spec.

1. **Frontend:** `npx tsc --noEmit` clean.
2. **Browser**, tenant `coffesarowar`, logged in as the seeded customer:
   - With `menuEnabled: false` (the tenant's post-C1 default state) — Menu tab shows "This business hasn't added a menu yet."
   - Toggle `menuEnabled: true` via the admin console with zero items — Menu tab shows "Menu coming soon."
   - Add/import a few items across at least two categories (reusing the Excel import from C1) — Menu tab shows them grouped by category, correct name/description/price per item, no sold-out items visible.
   - Confirm nav order visually matches Card → Menu → [Scan] → Wallet and the active-tab highlight works when navigating to `/menu`.

## Out of scope

Backend changes (none needed). Visual/UI redesign of the menu screen or bottom nav is explicitly deferred to a later pass. Cart/ordering/checkout functionality is out of scope — this remains a display-only menu per the existing `MenuItem` model's documented intent.
