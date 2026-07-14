# Epic D5 — Upcoming Events Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Admins can create, edit, and delete events; customers see up to 3 upcoming ones (soonest first) in a card on their dashboard.

**Architecture:** A brand-new `Event` model, tenant-scoped exactly like `MenuItem`. Full admin CRUD (including in-place edit, a new UI pattern for this codebase) via new `/api/admin/events` routes. No new customer-facing route — `getPublicTenant` gains an `upcomingEvents` field computed server-side, reusing the `GET /api/tenant` fetch the customer app already makes on every page load.

**Tech Stack:** Node/Express, Mongoose (+ in-memory mock in dev), React 19 + Vite + TS, TanStack Query, lucide-react icons.

## Global Constraints

- Every user/loyalty query includes `organizationId` — tenant isolation is the core invariant.
- Backend layering: `routes/ → controllers/ (thin) → services/ (logic) → models/`. No business logic in controllers.
- "Upcoming" means `date >= start of today` — past events are never returned to customers (they remain visible to the admin for cleanup via delete).
- The customer-facing card shows **at most 3** upcoming events, soonest first, and has **no on/off toggle** — it renders automatically based on whether any upcoming events exist.
- `time` is a free-text display string (e.g. "7:00 PM") — no timezone logic, no `Date`-based time storage.
- Commit with explicit file paths (`git add <path>`) — never `git add -A`.

---

### Task 1: Backend — Event model, service, controller, routes, public exposure, tests

**Files:**
- Create: `backend/models/Event.js`
- Create: `backend/services/eventService.js`
- Create: `backend/controllers/eventController.js`
- Modify: `backend/routes/adminRoutes.js`
- Modify: `backend/controllers/tenantController.js`
- Create: `backend/tests/upcoming-events.js`
- Modify: `backend/package.json`

**Interfaces:**
- Produces: `Event` model fields `{ organizationId, title, date, time, location, description, imageUrl, createdAt }`.
- Produces: `eventService.listForOrg(organizationId): Promise<Event[]>` (all events, sorted by `date` ascending).
- Produces: `eventService.createEvent(organizationId, { title, date, time, location, description, imageUrl }): Promise<Event>`.
- Produces: `eventService.updateEvent(organizationId, eventId, updates): Promise<Event>` (all six fields mutable).
- Produces: `eventService.deleteEvent(organizationId, eventId): Promise<{ success: true }>`.
- Produces: `eventService.getUpcomingForOrg(organizationId, limit = 3): Promise<Event[]>`.
- Produces routes: `GET/POST /api/admin/events`, `PATCH/DELETE /api/admin/events/:id` (all `verifyToken, isBusinessAdmin`).
- Produces: `GET /api/tenant` response gains `tenant.upcomingEvents`.

- [ ] **Step 1: Create the Event model**

Create `backend/models/Event.js`:

```js
const mongoose = require("mongoose");

// A tenant's upcoming/past event listing. Display-only, same tenant-scoped
// pattern as MenuItem — no RSVP/ticketing, just a display for customers.
const EventSchema = new mongoose.Schema({
  organizationId: { type: mongoose.Schema.Types.ObjectId, ref: "Organization", required: true },
  title: { type: String, required: true, trim: true },
  date: { type: Date, required: true },
  // Display string only (e.g. "7:00 PM") — no timezone logic.
  time: { type: String, default: "", trim: true },
  location: { type: String, default: "", trim: true },
  description: { type: String, default: "", trim: true },
  imageUrl: { type: String, default: "", trim: true },
  createdAt: { type: Date, default: Date.now }
});

EventSchema.index({ organizationId: 1, date: 1 });

module.exports = mongoose.model("Event", EventSchema);
```

- [ ] **Step 2: Write the failing test**

Create `backend/tests/upcoming-events.js`:

```js
/**
 * Upcoming events suite (Epic D5).
 *
 * Self-contained: boots its own server on a dedicated port against the
 * in-memory mock DB. Confirms admin CRUD on events, that the public tenant
 * endpoint exposes only upcoming (date >= today) events capped at 3 sorted
 * soonest-first, and tenant isolation.
 *
 * Run directly: `node tests/upcoming-events.js`
 */

const { bootServer } = require("./helpers/bootServer");

const SLUG = "coffesarowar";
const DAY_MS = 24 * 60 * 60 * 1000;

function isoDate(d) {
  return d.toISOString();
}

async function main() {
  const { baseUrl, stop } = await bootServer({ port: 5020 });
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

    const now = new Date();
    const tomorrow = isoDate(new Date(now.getTime() + 1 * DAY_MS));
    const yesterday = isoDate(new Date(now.getTime() - 1 * DAY_MS));
    const in10Days = isoDate(new Date(now.getTime() + 10 * DAY_MS));

    const created1 = await api("/api/admin/events", {
      method: "POST",
      token: adminToken,
      body: { title: "Live Jazz Night", date: tomorrow, time: "7:00 PM", location: "Main hall", description: "Local jazz trio." },
    });
    check("create tomorrow event -> 201", created1.status === 201);

    const created2 = await api("/api/admin/events", {
      method: "POST",
      token: adminToken,
      body: { title: "Past Trivia Night", date: yesterday, time: "6:00 PM" },
    });
    check("create yesterday event -> 201", created2.status === 201);
    const pastEventId = created2.body.event.id || created2.body.event._id;

    const created3 = await api("/api/admin/events", {
      method: "POST",
      token: adminToken,
      body: { title: "Anniversary Sale", date: in10Days, time: "All day" },
    });
    check("create +10-day event -> 201", created3.status === 201);

    const adminList = await api("/api/admin/events", { token: adminToken });
    check("admin list -> 200", adminList.status === 200);
    check("admin list has all 3 events", adminList.body.events.length === 3);

    const publicTenant = await api("/api/tenant");
    check("public tenant -> 200", publicTenant.status === 200);
    const upcoming = publicTenant.body.tenant.upcomingEvents;
    check("upcoming events excludes the past one", Array.isArray(upcoming) && upcoming.every((e) => e.title !== "Past Trivia Night"));
    check("upcoming events includes tomorrow's event", upcoming.some((e) => e.title === "Live Jazz Night"));
    check("upcoming events includes the +10-day event", upcoming.some((e) => e.title === "Anniversary Sale"));
    check("upcoming events sorted soonest first", new Date(upcoming[0].date) <= new Date(upcoming[1].date));

    // Cap at 3: add a 4th upcoming event, confirm only 3 come back.
    const in2Days = isoDate(new Date(now.getTime() + 2 * DAY_MS));
    await api("/api/admin/events", {
      method: "POST",
      token: adminToken,
      body: { title: "Extra Upcoming Event", date: in2Days },
    });
    const publicTenant2 = await api("/api/tenant");
    check("upcoming events capped at 3", publicTenant2.body.tenant.upcomingEvents.length === 3);

    // Update.
    const jazzId = created1.body.event.id || created1.body.event._id;
    const patched = await api(`/api/admin/events/${jazzId}`, {
      method: "PATCH",
      token: adminToken,
      body: { time: "8:30 PM" },
    });
    check("update event -> 200", patched.status === 200);
    check("update response reflects new time", patched.body.event.time === "8:30 PM");

    // Delete.
    const deleted = await api(`/api/admin/events/${pastEventId}`, { method: "DELETE", token: adminToken });
    check("delete event -> 200", deleted.status === 200);
    const listAfterDelete = await api("/api/admin/events", { token: adminToken });
    check("deleted event no longer in admin list", listAfterDelete.body.events.every((e) => (e.id || e._id) !== pastEventId));

    // Tenant isolation.
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
    const secondPublicTenant = await api("/api/tenant", { slug: secondSlug });
    check("second tenant's upcomingEvents is empty", Array.isArray(secondPublicTenant.body.tenant.upcomingEvents) && secondPublicTenant.body.tenant.upcomingEvents.length === 0);
  } finally {
    stop();
  }

  if (failures) { console.error(`upcoming-events: ${failures} FAILED`); process.exitCode = 1; }
  else console.log("upcoming-events: all PASS");
}

main().catch((e) => { console.error(e); process.exitCode = 1; });
```

Run: `cd backend && node tests/upcoming-events.js`
Expected: FAIL — `/api/admin/events` routes don't exist yet (404s), and `getPublicTenant` doesn't return `upcomingEvents` yet.

- [ ] **Step 3: Implement eventService**

Create `backend/services/eventService.js`:

```js
const Event = require("../models/Event");

const createHttpError = (message, statusCode) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

const listForOrg = async (organizationId) => {
  return Event.find({ organizationId }).sort({ date: 1 });
};

const createEvent = async (
  organizationId,
  { title, date, time, location, description, imageUrl }
) => {
  if (!title) {
    throw createHttpError("Event title is required.", 400);
  }
  if (!date) {
    throw createHttpError("Event date is required.", 400);
  }

  const event = await Event.create({
    organizationId,
    title: title.trim(),
    date: new Date(date),
    time: time !== undefined ? time : "",
    location: location !== undefined ? location : "",
    description: description !== undefined ? description : "",
    imageUrl: imageUrl !== undefined ? imageUrl : ""
  });

  return event;
};

// Only these fields may be changed via the API — never organizationId or
// _id, so an admin can't move an event into (or out of) another tenant.
const MUTABLE_EVENT_FIELDS = ["title", "date", "time", "location", "description", "imageUrl"];

const updateEvent = async (organizationId, eventId, updates) => {
  const safeUpdates = {};
  for (const field of MUTABLE_EVENT_FIELDS) {
    if (updates[field] !== undefined) {
      safeUpdates[field] = field === "date" ? new Date(updates[field]) : updates[field];
    }
  }

  const updatedEvent = await Event.findOneAndUpdate(
    { _id: eventId, organizationId },
    { $set: safeUpdates },
    { new: true }
  );

  if (!updatedEvent) {
    throw createHttpError("Event not found.", 404);
  }

  return updatedEvent;
};

const deleteEvent = async (organizationId, eventId) => {
  const result = await Event.deleteOne({ _id: eventId, organizationId });

  const deletedCount =
    result && typeof result.deletedCount === "number" ? result.deletedCount : 0;

  if (!deletedCount) {
    throw createHttpError("Event not found.", 404);
  }

  return { success: true };
};

const getUpcomingForOrg = async (organizationId, limit = 3) => {
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  return Event.find({ organizationId, date: { $gte: startOfToday } })
    .sort({ date: 1 })
    .limit(limit);
};

module.exports = {
  listForOrg,
  createEvent,
  updateEvent,
  deleteEvent,
  getUpcomingForOrg
};
```

- [ ] **Step 4: Implement the controller**

Create `backend/controllers/eventController.js`:

```js
const { listForOrg, createEvent, updateEvent, deleteEvent } = require("../services/eventService");

const listEvents = async (req, res, next) => {
  try {
    const events = await listForOrg(req.user.organizationId);
    res.status(200).json({ success: true, events });
  } catch (error) {
    next(error);
  }
};

const createEventController = async (req, res, next) => {
  try {
    const { title, date, time, location, description, imageUrl } = req.body;
    const event = await createEvent(req.user.organizationId, {
      title,
      date,
      time,
      location,
      description,
      imageUrl
    });
    res.status(201).json({ success: true, event });
  } catch (error) {
    next(error);
  }
};

const updateEventController = async (req, res, next) => {
  try {
    const { id } = req.params;
    const event = await updateEvent(req.user.organizationId, id, req.body);
    res.status(200).json({ success: true, event });
  } catch (error) {
    next(error);
  }
};

const deleteEventController = async (req, res, next) => {
  try {
    const { id } = req.params;
    const result = await deleteEvent(req.user.organizationId, id);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};

module.exports = {
  listEvents,
  createEventController,
  updateEventController,
  deleteEventController
};
```

- [ ] **Step 5: Wire the admin routes**

In `backend/routes/adminRoutes.js`, add the import after the `reportController` import:

```js
const { listEvents, createEventController, updateEventController, deleteEventController } = require("../controllers/eventController");
```

Add the four routes after the existing `/reports/*` routes, before `module.exports`:

```js
router.get("/events", verifyToken, isBusinessAdmin, listEvents);
router.post("/events", verifyToken, isBusinessAdmin, createEventController);
router.patch("/events/:id", verifyToken, isBusinessAdmin, updateEventController);
router.delete("/events/:id", verifyToken, isBusinessAdmin, deleteEventController);
```

- [ ] **Step 6: Expose upcoming events on the public tenant endpoint**

In `backend/controllers/tenantController.js`, add the import at the top:

```js
const { getUpcomingForOrg } = require("../services/eventService");
```

In `getPublicTenant`, add `upcomingEvents` to the response (fetched before building the response object):

```js
const getPublicTenant = async (req, res, next) => {
  try {
    const { organization } = req;
    const upcomingEvents = await getUpcomingForOrg(organization._id);

    res.status(200).json({
      success: true,
      tenant: {
        name: organization.name,
        slug: organization.slug,
        branding: organization.branding,
        contact: organization.contact,
        upcomingEvents,
        menuEnabled: organization.menuEnabled,
        program: {
          stampsRequired: organization.program.stampsRequired,
          rewardTitle: organization.program.rewardTitle,
          rewardDescription: organization.program.rewardDescription
        }
      }
    });
  } catch (error) {
    next(error);
  }
};
```

- [ ] **Step 7: Run the test to verify it passes**

Run: `cd backend && node tests/upcoming-events.js`
Expected: `upcoming-events: all PASS`.

- [ ] **Step 8: Add to the test suite**

In `backend/package.json`, append to the `test` script:

```
"test": "node tests/integration-qa.js && node tests/run-voucher-test.js && node tests/multi-tenant-isolation.js && node tests/auth-email-flow.js && node tests/min-bill-amount.js && node tests/menu-import.js && node tests/customer-detail.js && node tests/business-reports.js && node tests/business-contact.js && node tests/menu-featured.js && node tests/upcoming-events.js",
```

Run: `cd backend && npm test`
Expected: all eleven suites pass, exit 0.

- [ ] **Step 9: Commit**

```bash
git add backend/models/Event.js backend/services/eventService.js backend/controllers/eventController.js backend/routes/adminRoutes.js backend/controllers/tenantController.js backend/tests/upcoming-events.js backend/package.json
git commit -m "feat(events): Event model, admin CRUD, public upcoming-events exposure"
```

---

### Task 2: Frontend — admin Events screen (with edit-in-place)

**Files:**
- Modify: `frontend/src/components/admin/AdminLayout.tsx`
- Create: `frontend/src/routes/admin/AdminEvents.tsx`
- Modify: `frontend/src/App.tsx`

**Interfaces:**
- Consumes: `GET/POST /api/admin/events`, `PATCH/DELETE /api/admin/events/:id` (Task 1).

- [ ] **Step 1: Add the nav entry**

In `frontend/src/components/admin/AdminLayout.tsx`, add `Calendar` to the lucide-react import:

```tsx
import {
  LayoutDashboard,
  QrCode,
  TicketCheck,
  Users,
  Stamp,
  Palette,
  UtensilsCrossed,
  FileSpreadsheet,
  Phone,
  Calendar,
  LogOut,
} from "lucide-react";
```

Add the entry to `NAV`, after `menu`:

```tsx
const NAV = [
  { to: "", end: true, label: "Overview", Icon: LayoutDashboard },
  { to: "generate", label: "Generate stamp", Icon: QrCode },
  { to: "redeem", label: "Redeem voucher", Icon: TicketCheck },
  { to: "customers", label: "Customers", Icon: Users },
  { to: "program", label: "Stamp program", Icon: Stamp },
  { to: "branding", label: "Branding", Icon: Palette },
  { to: "contact", label: "Contact", Icon: Phone },
  { to: "menu", label: "Menu", Icon: UtensilsCrossed },
  { to: "events", label: "Events", Icon: Calendar },
  { to: "reports/summary", label: "Summary report", Icon: FileSpreadsheet },
  { to: "reports/customers", label: "Customer report", Icon: FileSpreadsheet },
];
```

- [ ] **Step 2: Create the admin Events screen**

Create `frontend/src/routes/admin/AdminEvents.tsx`:

```tsx
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Trash2, Plus, Pencil, X, Check } from "lucide-react";
import toast from "react-hot-toast";
import { apiRequest } from "../../lib/api";

interface EventItem {
  id?: string;
  _id?: string;
  title: string;
  date: string;
  time: string;
  location: string;
  description: string;
  imageUrl: string;
}

const eventId = (e: EventItem) => e.id || (e._id as string);

const EMPTY_DRAFT = { title: "", date: "", time: "", location: "", description: "", imageUrl: "" };

function useEvents() {
  return useQuery<EventItem[]>({
    queryKey: ["adminEvents"],
    queryFn: async () => {
      const res = await apiRequest<{ success: boolean; events: EventItem[] }>("/api/admin/events", {
        role: "admin",
      });
      return res.events || [];
    },
  });
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function EventFields({
  draft,
  onChange,
}: {
  draft: typeof EMPTY_DRAFT;
  onChange: (next: typeof EMPTY_DRAFT) => void;
}) {
  return (
    <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
      <input
        value={draft.title}
        onChange={(e) => onChange({ ...draft, title: e.target.value })}
        placeholder="Title"
        className="rounded-[11px] border border-[var(--line)] bg-[var(--bg)] px-3.5 py-2.5 text-sm focus:border-[var(--brand)] focus:outline-none"
      />
      <input
        type="date"
        value={draft.date}
        onChange={(e) => onChange({ ...draft, date: e.target.value })}
        className="rounded-[11px] border border-[var(--line)] bg-[var(--bg)] px-3.5 py-2.5 text-sm focus:border-[var(--brand)] focus:outline-none"
      />
      <input
        value={draft.time}
        onChange={(e) => onChange({ ...draft, time: e.target.value })}
        placeholder="Time (e.g. 7:00 PM)"
        className="rounded-[11px] border border-[var(--line)] bg-[var(--bg)] px-3.5 py-2.5 text-sm focus:border-[var(--brand)] focus:outline-none"
      />
      <input
        value={draft.location}
        onChange={(e) => onChange({ ...draft, location: e.target.value })}
        placeholder="Location"
        className="rounded-[11px] border border-[var(--line)] bg-[var(--bg)] px-3.5 py-2.5 text-sm focus:border-[var(--brand)] focus:outline-none"
      />
      <input
        value={draft.description}
        onChange={(e) => onChange({ ...draft, description: e.target.value })}
        placeholder="Description"
        className="rounded-[11px] border border-[var(--line)] bg-[var(--bg)] px-3.5 py-2.5 text-sm focus:border-[var(--brand)] focus:outline-none sm:col-span-2"
      />
      <input
        value={draft.imageUrl}
        onChange={(e) => onChange({ ...draft, imageUrl: e.target.value })}
        placeholder="Image URL"
        className="rounded-[11px] border border-[var(--line)] bg-[var(--bg)] px-3.5 py-2.5 text-sm focus:border-[var(--brand)] focus:outline-none sm:col-span-2"
      />
    </div>
  );
}

export default function AdminEvents() {
  const qc = useQueryClient();
  const { data: events = [], isLoading } = useEvents();

  const [draft, setDraft] = useState(EMPTY_DRAFT);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState(EMPTY_DRAFT);

  const invalidate = () => qc.invalidateQueries({ queryKey: ["adminEvents"] });

  const createEvent = useMutation({
    mutationFn: (body: typeof draft) =>
      apiRequest("/api/admin/events", { method: "POST", role: "admin", body }),
    onSuccess: () => {
      invalidate();
      setDraft(EMPTY_DRAFT);
      toast.success("Event added");
    },
    onError: (e) => toast.error((e as Error).message || "Failed to add."),
  });

  const patchEvent = useMutation({
    mutationFn: ({ id, body }: { id: string; body: typeof draft }) =>
      apiRequest(`/api/admin/events/${id}`, { method: "PATCH", role: "admin", body }),
    onSuccess: () => {
      invalidate();
      setEditingId(null);
      toast.success("Event updated");
    },
    onError: (e) => toast.error((e as Error).message || "Failed to update."),
  });

  const deleteEvent = useMutation({
    mutationFn: (id: string) => apiRequest(`/api/admin/events/${id}`, { method: "DELETE", role: "admin" }),
    onSuccess: () => {
      invalidate();
      toast.success("Event removed");
    },
  });

  const startEdit = (e: EventItem) => {
    setEditingId(eventId(e));
    setEditDraft({
      title: e.title,
      date: e.date.slice(0, 10),
      time: e.time,
      location: e.location,
      description: e.description,
      imageUrl: e.imageUrl,
    });
  };

  return (
    <div className="max-w-[720px]">
      <h1 className="font-display text-[28px] font-extrabold text-[var(--ink)]">Events</h1>
      <p className="mb-5 text-[var(--muted)]">Announce upcoming events to your customers.</p>

      {/* Add event */}
      <div className="mb-6 rounded-[18px] border border-[var(--line)] bg-[var(--surface)] p-5">
        <div className="mb-3 text-sm font-bold">Add an event</div>
        <EventFields draft={draft} onChange={setDraft} />
        <button
          onClick={() => draft.title.trim() && draft.date && createEvent.mutate(draft)}
          disabled={createEvent.isPending || !draft.title.trim() || !draft.date}
          className="mt-3 inline-flex items-center gap-1.5 rounded-[11px] px-4 py-2.5 text-sm font-bold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
          style={{ background: "var(--brand)" }}
        >
          <Plus className="h-4 w-4" /> Add event
        </button>
      </div>

      {/* List */}
      <div className="overflow-hidden rounded-[16px] border border-[var(--line)] bg-[var(--surface)]">
        {isLoading ? (
          <div className="p-5 text-sm text-[var(--muted)]">Loading…</div>
        ) : events.length === 0 ? (
          <div className="p-8 text-center text-sm text-[var(--muted)]">No events yet. Add your first above.</div>
        ) : (
          events.map((e) => {
            const id = eventId(e);
            if (editingId === id) {
              return (
                <div key={id} className="border-b border-[var(--line)] p-4 last:border-b-0">
                  <EventFields draft={editDraft} onChange={setEditDraft} />
                  <div className="mt-3 flex gap-2">
                    <button
                      onClick={() => patchEvent.mutate({ id, body: editDraft })}
                      disabled={patchEvent.isPending}
                      className="inline-flex items-center gap-1.5 rounded-[11px] px-3.5 py-2 text-sm font-bold text-white disabled:opacity-50"
                      style={{ background: "var(--brand)" }}
                    >
                      <Check className="h-4 w-4" /> Save
                    </button>
                    <button
                      onClick={() => setEditingId(null)}
                      className="inline-flex items-center gap-1.5 rounded-[11px] border border-[var(--line)] bg-[var(--bg)] px-3.5 py-2 text-sm font-bold"
                    >
                      <X className="h-4 w-4" /> Cancel
                    </button>
                  </div>
                </div>
              );
            }

            return (
              <div key={id} className="flex items-center gap-3 border-b border-[var(--line)] px-4 py-3.5 last:border-b-0">
                {e.imageUrl && (
                  <img src={e.imageUrl} alt="" className="h-12 w-12 flex-shrink-0 rounded-[10px] object-cover" />
                )}
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-semibold">{e.title}</div>
                  <div className="truncate text-[13px] text-[var(--muted)]">
                    {formatDate(e.date)}
                    {e.time ? ` · ${e.time}` : ""}
                    {e.location ? ` · ${e.location}` : ""}
                  </div>
                </div>
                <button
                  onClick={() => startEdit(e)}
                  className="flex h-8 w-8 items-center justify-center rounded-[9px] bg-[var(--bg)] text-[var(--muted)] hover:text-[var(--ink)]"
                  aria-label={`Edit ${e.title}`}
                >
                  <Pencil className="h-4 w-4" />
                </button>
                <button
                  onClick={() => deleteEvent.mutate(id)}
                  className="flex h-8 w-8 items-center justify-center rounded-[9px] bg-[var(--bg)] text-[var(--muted)] hover:text-[var(--err)]"
                  aria-label={`Delete ${e.title}`}
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Wire the route**

In `frontend/src/App.tsx`, add the lazy import alongside `MenuManagement`:

```tsx
const AdminEvents = lazy(() => import('./routes/admin/AdminEvents'));
```

Add the route inside the admin `<Route>` block, after `menu`:

```tsx
<Route path="events" element={<AdminEvents />} />
```

- [ ] **Step 4: Typecheck**

Run: `cd frontend && npx tsc --noEmit`
Expected: clean.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/admin/AdminLayout.tsx frontend/src/routes/admin/AdminEvents.tsx frontend/src/App.tsx
git commit -m "feat(admin-fe): Events screen with create, edit-in-place, and delete"
```

---

### Task 3: Frontend — customer dashboard upcoming events card

**Files:**
- Modify: `frontend/src/context/TenantContext.tsx`
- Modify: `frontend/src/routes/CustomerDashboard.tsx`

**Interfaces:**
- Consumes: `GET /api/tenant` (Task 1) — now carries `tenant.upcomingEvents`.

- [ ] **Step 1: Add the event type to TenantContext**

In `frontend/src/context/TenantContext.tsx`, add after `TenantContact`:

```ts
export interface TenantEvent {
  id: string;
  title: string;
  date: string;
  time: string;
  location: string;
  description: string;
  imageUrl: string;
}
```

Update `Tenant`:

```ts
export interface Tenant {
  slug: string;
  name: string;
  branding: TenantBranding;
  contact: TenantContact;
  upcomingEvents: TenantEvent[];
  program: TenantProgram;
  menuEnabled: boolean;
}
```

- [ ] **Step 2: Add the Upcoming events card to the dashboard**

In `frontend/src/routes/CustomerDashboard.tsx`, add the import:

```tsx
import { Calendar } from "lucide-react";
```

(Add `Calendar` to the existing `lucide-react` import line rather than a separate line.)

Add this helper function near `osmEmbedUrl`:

```tsx
function formatEventDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}
```

Inside the component, after the `featuredItems` computation, add:

```tsx
  const upcomingEvents = tenant?.upcomingEvents ?? [];
```

In the JSX, insert the new card right after the Featured-picks block and before the Visit-us block:

```tsx
      {upcomingEvents.length > 0 && (
        <div className="mt-4 rounded-[20px] border border-[var(--line)] bg-[var(--surface)] p-5">
          <div className="mb-3 text-xs font-bold uppercase tracking-wider text-[var(--soft)]">
            Upcoming events
          </div>
          <div className="flex flex-col gap-3">
            {upcomingEvents.map((event) => (
              <div key={event.id} className="flex gap-3">
                {event.imageUrl && (
                  <img src={event.imageUrl} alt="" className="h-14 w-14 flex-shrink-0 rounded-[12px] object-cover" />
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 text-[11px] font-bold" style={{ color: "var(--brand)" }}>
                    <Calendar className="h-3.5 w-3.5" />
                    {formatEventDate(event.date)}
                    {event.time ? ` · ${event.time}` : ""}
                  </div>
                  <div className="truncate text-sm font-semibold text-[var(--ink)]">{event.title}</div>
                  {event.location && (
                    <div className="truncate text-[13px] text-[var(--muted)]">{event.location}</div>
                  )}
                  {event.description && (
                    <div className="truncate text-[13px] text-[var(--muted)]">{event.description}</div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
```

- [ ] **Step 3: Typecheck**

Run: `cd frontend && npx tsc --noEmit`
Expected: clean.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/context/TenantContext.tsx frontend/src/routes/CustomerDashboard.tsx
git commit -m "feat(customer-fe): upcoming events card on dashboard"
```

---

### Task 4: Full verification pass

**Files:** none (verification only)

- [ ] **Step 1: Backend suite green**

Run: `cd backend && npm test`
Expected: all eleven suites PASS, exit 0.

- [ ] **Step 2: Frontend typecheck**

Run: `cd frontend && npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: End-to-end browser walkthrough**

With the dev servers running, on tenant `coffesarowar`:
- Admin: on the new Events screen, create 4 events with mixed past/future dates (including one with an image URL). Confirm the list shows all 4. Click Edit on one, change its time, Save, confirm the change persists on reload. Delete one event, confirm it disappears from the list.
- Customer: on the dashboard, confirm the "Upcoming events" card shows only the upcoming (non-past) events, capped at 3, soonest first, with correct date/time/location/description and the image thumbnail where set.
- Delete all remaining events (or confirm via a fresh tenant with none) and confirm the card disappears entirely.

- [ ] **Step 4: Commit any final fixes, then finish**

```bash
git add -A
git commit -m "chore(events): verification pass fixes" || echo "nothing to commit"
```

---

## Self-Review Notes

- **Spec coverage:** all six fields (title, date, time, location, description, imageUrl) present in the model (Task 1 Step 1), admin create/edit form (Task 2 Step 2), and customer display (Task 3 Step 2). Dashboard-card-only display, no dedicated route (Task 3, decision 2). No on/off toggle — card auto-hides via `upcomingEvents.length > 0` (Task 3 Step 2, decision 3). Cap of 3, soonest-first via `getUpcomingForOrg`'s `.sort({ date: 1 }).limit(limit)` (Task 1 Step 3, decision 4). Full edit-in-place on the admin screen via `editingId` state swap (Task 2 Step 2, decision 5). No gaps against the spec.
- **No new customer-facing route:** confirmed the plan touches only `getPublicTenant` (already fetched by `TenantContext` on every page) to expose events — matches the spec's explicit "no new route" architecture, avoiding a redundant network call.
- **Type consistency:** `EventItem` (admin, Task 2) and `TenantEvent` (customer, Task 3) both carry the same six display fields, mirroring the existing `AdminContact`/`TenantContact` and `MenuItem`/`CustomerMenuItem` split pattern used in D3 and D4.
- **Test-design note:** Task 1's test creates a past-dated, a near-future, a far-future, and (for the cap check) a fourth upcoming event via real HTTP calls with explicit ISO date strings — proving inclusion/exclusion/cap/sort order without needing to fabricate timestamps outside the HTTP-only flow, consistent with every prior epic's date-range test approach (D2, D3).
