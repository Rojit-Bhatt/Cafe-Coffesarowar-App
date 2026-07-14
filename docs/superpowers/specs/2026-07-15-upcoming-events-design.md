# Epic D5 — Upcoming Events

**Date:** 2026-07-15
**Status:** Approved design, ready for implementation plan
**Scope:** Fifth and final spec decomposed from the original "Epic D" (customer drill-in [D1, merged], Excel reports [D2, merged], contact/maps config [D3, merged], featured menu items [D4, merged], upcoming events [this spec]). This is a brand-new subsystem — no `Event` model exists anywhere in the codebase today.

## Context

The business admin has no way to announce upcoming events (live music nights, discount days, seasonal launches) to customers. This is a genuinely new concept, unlike D4 (which reused the existing `MenuItem` model) — it needs its own model, its own admin CRUD screen, and its own customer-facing display.

## Decisions locked during brainstorming

1. **Event fields:** title, date, time (display string, e.g. "7:00 PM" — no timezone logic), location, description, and an image URL (pasted, same "paste a URL" pattern as logo/banner — no upload infra).
2. **Customer display:** an "Upcoming events" card on `CustomerDashboard.tsx`, visually matching D3's "Visit us" and D4's "Featured picks" cards — not a dedicated events screen/route (the bottom nav is already at 4 items + a center scan FAB).
3. **No business-wide on/off toggle.** Unlike the Menu's "Show menu to customers" switch, the events card just shows automatically whenever at least one upcoming event exists, and hides otherwise — matching how the Visit-us and Featured-picks cards already auto-hide when empty.
4. **Cap: up to 3 upcoming events, soonest first** — same cap as D4's Featured picks, for visual consistency. "Upcoming" means `date >= start of today`; past events are automatically excluded, never shown to customers.
5. **Full edit-in-place on the admin screen.** Unlike the Menu screen (which only has toggles + delete, no full edit), admins can click Edit on an event row to open an inline form with all fields, and Save/Cancel — a new UI pattern for this codebase, chosen deliberately because event date/time typos are more consequential to fix than a menu item's price.

## Data Model

New `Event` model (`backend/models/Event.js`), same "display-only, tenant-scoped" pattern as `MenuItem`:

```js
{
  organizationId: ObjectId (ref: "Organization", required),
  title: String (required, trim),
  date: Date (required),
  time: String (default ""),        // display string only, e.g. "7:00 PM"
  location: String (default "", trim),
  description: String (default "", trim),
  imageUrl: String (default "", trim),
  createdAt: Date (default: Date.now)
}
```

Indexed on `{ organizationId: 1, date: 1 }` to support the sorted "upcoming" query.

## Backend

### `backend/services/eventService.js` (new)

- `listForOrg(organizationId)`: all events for the tenant, sorted by `date` ascending — used by the admin screen (shows past and future events alike, so admins can see history and clean up old entries via delete).
- `createEvent(organizationId, { title, date, time, location, description, imageUrl })`: validates `title` and `date` are present.
- `updateEvent(organizationId, eventId, updates)`: full-field update (all six fields mutable), tenant-scoped `findOneAndUpdate` so an admin can never touch another tenant's event.
- `deleteEvent(organizationId, eventId)`.
- `getUpcomingForOrg(organizationId, limit = 3)`: `Event.find({ organizationId, date: { $gte: startOfToday } }).sort({ date: 1 }).limit(limit)` — the exact query the public tenant endpoint uses.

### `backend/controllers/eventController.js` (new)

- `listEvents`, `createEventController`, `updateEventController`, `deleteEventController` — thin wrappers, all read `req.user.organizationId` from the JWT (never the URL), matching every other admin controller in this codebase.

### Routes (`backend/routes/adminRoutes.js`, modified)

- `GET /api/admin/events`, `POST /api/admin/events`, `PATCH /api/admin/events/:id`, `DELETE /api/admin/events/:id` — all `verifyToken, isBusinessAdmin`, same gate as the existing `/menu` routes.

### Public exposure — no new route

`getPublicTenant` (`backend/controllers/tenantController.js`) gains one new field in its response: `upcomingEvents: await getUpcomingForOrg(organization._id)`. Customers already fetch `GET /api/tenant` on every page load via `TenantContext` — reusing that existing fetch avoids adding a second customer-facing network call just for this feature.

## Frontend

### Admin: `frontend/src/routes/admin/AdminEvents.tsx` (new)

- New nav entry in `AdminLayout.tsx`'s `NAV` array: `{ to: "events", label: "Events", Icon: Calendar }`, placed after `menu`.
- "Add an event" form (title, date, time, location, description, image URL) — same visual pattern as Menu's "Add an item" form.
- Event list, sorted soonest-first (from `listForOrg`, so past events remain visible for admin cleanup), each row showing title/date/time/location/description snippet/thumbnail (if `imageUrl` set) plus **Edit** and **Delete** buttons.
- Clicking Edit swaps that row into an inline form (same six fields, pre-filled) with Save/Cancel — Cancel reverts to view mode without saving, Save calls `PATCH /api/admin/events/:id` and reverts to view mode on success.

### Customer: `frontend/src/routes/CustomerDashboard.tsx` (modified)

- `frontend/src/context/TenantContext.tsx`: `Tenant` interface gains `upcomingEvents: TenantEvent[]`, new `TenantEvent` interface mirroring the six fields (with `id: string` instead of `_id`).
- New "Upcoming events" card, placed alongside the existing Featured-picks/Visit-us cards, rendered only when `tenant.upcomingEvents.length > 0`. Each event shows title, formatted date, time, location, description, and the image (if `imageUrl` set) as a small banner.

## Testing / Verification

1. **Backend**, self-contained via `tests/helpers/bootServer.js` (`backend/tests/upcoming-events.js`):
   - Create an event dated tomorrow, one dated yesterday, and one dated 10 days from now → `GET /api/admin/events` (admin) returns all three, `GET /api/tenant` (public) returns `upcomingEvents` containing only the tomorrow and +10-day events (not the past one), sorted soonest-first.
   - Create 4 upcoming events → public `upcomingEvents` is capped at 3, the 3 soonest.
   - `PATCH /api/admin/events/:id` updates a field (e.g. `time`) → change persists on next `GET /api/admin/events`.
   - `DELETE /api/admin/events/:id` → event no longer appears in either admin or public listings.
   - Tenant isolation: a second tenant's `GET /api/tenant` shows an empty `upcomingEvents`, unaffected by the first tenant's events.
2. **Frontend:** `npx tsc --noEmit` clean.
3. **Browser**, tenant `coffesarowar`: create 4 events (mixed past/future dates) in the new admin Events screen, confirm the list shows all 4 sorted correctly; edit one event's time and confirm it saves; delete one; confirm the customer dashboard's "Upcoming events" card shows the 3 soonest upcoming (never the past one), confirm it disappears when all events are deleted.

## Out of scope

No RSVP/ticketing, no recurring events, no per-event visibility toggle (deleting is the only way to remove one), no dedicated customer-facing events screen/route (per decision 2), no image upload (pasted URL only, per decision 1).
