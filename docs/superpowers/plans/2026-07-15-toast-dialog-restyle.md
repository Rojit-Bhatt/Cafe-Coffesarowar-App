# Epic E4: Toast Restyle + Confirm Dialogs Implementation Plan

> **For agentic workers:** Executed inline, autonomously, per explicit user authorization — no per-task approval checkpoints. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Brand `react-hot-toast` to match Stampd, and add a shared confirm dialog wired to the app's three destructive actions (delete event, delete menu item, suspend/reactivate business) that currently fire with no confirmation.

**Architecture:** One `toastOptions` prop on the app's single `<Toaster>` (global, no per-call-site changes). One new `ConfirmDialog` component wrapping the existing unused `components/ui/alert-dialog.tsx` primitives, restyled with Stampd tokens, dropped into 3 screens with local open/pending state.

**Tech Stack:** React 19/TS, `react-hot-toast`, Radix `@radix-ui/react-alert-dialog` (already a dependency via the shadcn `alert-dialog.tsx` file).

## Global Constraints

- Toast colors: `background: var(--surface)`, `color: var(--ink)`, `border: 1px solid var(--line)`; success icon `var(--ok)`; error icon `var(--err)`.
- `ConfirmDialog` footer uses plain styled `<button>`s, not the shadcn `AlertDialogAction`/`AlertDialogCancel` (their `buttonVariants()` classes would visually conflict with Stampd's inline-style color pattern).
- Exactly 3 call sites get the dialog: `AdminEvents.tsx` (delete event), `MenuManagement.tsx` (delete item), `BusinessDetail.tsx` (suspend/reactivate). Grep-confirmed no other destructive action exists anywhere else in the frontend.
- No test framework for the frontend; verification is `tsc --noEmit` + browser walkthrough.

---

### Task 1: Toast restyle

**Files:**
- Modify: `frontend/src/App.tsx`

**Interfaces:** none (global config only).

- [ ] **Step 1: Add `toastOptions` to the `<Toaster>`**

Find (around line 140):
```tsx
            <Toaster position="bottom-center" />
```
Replace with:
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

- [ ] **Step 2: Typecheck**

Run: `npm run lint` (repo root)
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/App.tsx
git commit -m "feat(fe): brand react-hot-toast to Stampd palette"
```

---

### Task 2: Shared ConfirmDialog component

**Files:**
- Create: `frontend/src/components/shared/ConfirmDialog.tsx`

**Interfaces:**
- Consumes: `AlertDialog`, `AlertDialogContent`, `AlertDialogHeader`, `AlertDialogTitle`, `AlertDialogDescription`, `AlertDialogFooter` from `../ui/alert-dialog`.
- Produces: `<ConfirmDialog open confirmColor? title description confirmLabel? cancelLabel? onOpenChange onConfirm />` — used by Tasks 3-5.

- [ ] **Step 1: Create the component**

```tsx
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogFooter,
  AlertDialogTitle,
  AlertDialogDescription,
} from "../ui/alert-dialog";

interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  confirmColor?: string;
  onConfirm: () => void;
}

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  confirmColor = "var(--err)",
  onConfirm,
}: ConfirmDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-w-[420px] rounded-[20px] border border-[var(--line)] bg-[var(--surface)] p-6 shadow-xl">
        <AlertDialogHeader className="gap-1.5">
          <AlertDialogTitle className="font-display text-lg font-extrabold text-[var(--ink)]">
            {title}
          </AlertDialogTitle>
          <AlertDialogDescription className="text-sm text-[var(--muted)]">
            {description}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="mt-2 flex flex-row justify-end gap-2">
          <button
            onClick={() => onOpenChange(false)}
            className="rounded-[12px] border border-[var(--line)] bg-[var(--bg)] px-4 py-2.5 text-sm font-bold text-[var(--ink)] hover:bg-[var(--line)]"
          >
            {cancelLabel}
          </button>
          <button
            onClick={() => {
              onConfirm();
              onOpenChange(false);
            }}
            className="rounded-[12px] px-4 py-2.5 text-sm font-bold text-white transition-opacity hover:opacity-90"
            style={{ background: confirmColor }}
          >
            {confirmLabel}
          </button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `npm run lint`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/shared/ConfirmDialog.tsx
git commit -m "feat(fe): add shared ConfirmDialog component"
```

---

### Task 3: Wire into AdminEvents.tsx (delete event)

**Files:**
- Modify: `frontend/src/routes/admin/AdminEvents.tsx`

**Interfaces:**
- Consumes: `ConfirmDialog` from Task 2.

- [ ] **Step 1: Import and state**

Add import (near the top, with the other imports):
```tsx
import { ConfirmDialog } from "../../components/shared/ConfirmDialog";
```

Add state, right after `const [editDraft, setEditDraft] = useState(EMPTY_DRAFT);`:
```tsx
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
```

- [ ] **Step 2: Change the delete button to open the dialog instead of deleting directly**

Replace:
```tsx
                <button
                  onClick={() => deleteEvent.mutate(id)}
                  className="flex h-8 w-8 items-center justify-center rounded-[9px] bg-[var(--bg)] text-[var(--muted)] hover:text-[var(--err)]"
                  aria-label={`Delete ${e.title}`}
                >
                  <Trash2 className="h-4 w-4" />
                </button>
```
with:
```tsx
                <button
                  onClick={() => setPendingDeleteId(id)}
                  className="flex h-8 w-8 items-center justify-center rounded-[9px] bg-[var(--bg)] text-[var(--muted)] hover:text-[var(--err)]"
                  aria-label={`Delete ${e.title}`}
                >
                  <Trash2 className="h-4 w-4" />
                </button>
```

- [ ] **Step 3: Render the dialog**

Find the component's closing:
```tsx
          })
        )}
      </div>
    </div>
  );
}
```
Replace with (add the dialog right after the closing `</div>` of the list, before the final `</div>`):
```tsx
          })
        )}
      </div>

      <ConfirmDialog
        open={pendingDeleteId !== null}
        onOpenChange={(open) => !open && setPendingDeleteId(null)}
        title="Delete this event?"
        description={
          pendingDeleteId
            ? `"${events.find((e) => eventId(e) === pendingDeleteId)?.title ?? ""}" will be removed and no longer shown to customers.`
            : ""
        }
        confirmLabel="Delete"
        confirmColor="var(--err)"
        onConfirm={() => {
          if (pendingDeleteId) deleteEvent.mutate(pendingDeleteId);
        }}
      />
    </div>
  );
}
```

- [ ] **Step 4: Manual verification**

Run: `npm run dev`. In the Events admin screen, click the trash icon on an event — confirm a dialog appears with the event's title in the description, "Cancel" closes it with no change, "Delete" removes the event and shows the existing "Event removed" toast (now Stampd-styled from Task 1).

- [ ] **Step 5: Typecheck**

Run: `npm run lint`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/routes/admin/AdminEvents.tsx
git commit -m "feat(fe): confirm dialog before deleting an event"
```

---

### Task 4: Wire into MenuManagement.tsx (delete item)

**Files:**
- Modify: `frontend/src/routes/admin/MenuManagement.tsx`

**Interfaces:**
- Consumes: `ConfirmDialog` from Task 2.

- [ ] **Step 1: Import and state**

Add import:
```tsx
import { ConfirmDialog } from "../../components/shared/ConfirmDialog";
```

Add state, right after `const [draft, setDraft] = useState({ name: "", description: "", price: "", category: "General" });`:
```tsx
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
```

- [ ] **Step 2: Change the delete button**

Replace:
```tsx
                      <button
                        onClick={() => deleteItem.mutate(itemId(i))}
                        className="flex h-8 w-8 items-center justify-center rounded-[9px] bg-[var(--bg)] text-[var(--muted)] hover:text-[var(--err)]"
                        aria-label={`Delete ${i.name}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
```
with:
```tsx
                      <button
                        onClick={() => setPendingDeleteId(itemId(i))}
                        className="flex h-8 w-8 items-center justify-center rounded-[9px] bg-[var(--bg)] text-[var(--muted)] hover:text-[var(--err)]"
                        aria-label={`Delete ${i.name}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
```

- [ ] **Step 3: Render the dialog**

Find the component's closing (the outer wrapper's final `</div>` before `);` `}`) and add the dialog as a sibling right before it — same pattern as Task 3. The exact anchor is the closing of the outermost `<div>` that wraps the whole page (check indentation matches the component's top-level return element), e.g.:
```tsx
      </div>

      <ConfirmDialog
        open={pendingDeleteId !== null}
        onOpenChange={(open) => !open && setPendingDeleteId(null)}
        title="Delete this item?"
        description={
          pendingDeleteId
            ? `"${items.find((i) => itemId(i) === pendingDeleteId)?.name ?? ""}" will be removed from your menu.`
            : ""
        }
        confirmLabel="Delete"
        confirmColor="var(--err)"
        onConfirm={() => {
          if (pendingDeleteId) deleteItem.mutate(pendingDeleteId);
        }}
      />
    </div>
  );
}
```

- [ ] **Step 4: Manual verification**

Run: `npm run dev`. In Menu management, click the trash icon on an item — confirm dialog shows the item's name, Cancel/Delete behave correctly, existing toast still fires.

- [ ] **Step 5: Typecheck**

Run: `npm run lint`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/routes/admin/MenuManagement.tsx
git commit -m "feat(fe): confirm dialog before deleting a menu item"
```

---

### Task 5: Wire into BusinessDetail.tsx (suspend/reactivate)

**Files:**
- Modify: `frontend/src/routes/platform/BusinessDetail.tsx`

**Interfaces:**
- Consumes: `ConfirmDialog` from Task 2.

- [ ] **Step 1: Import and state**

Add import:
```tsx
import { ConfirmDialog } from "../../components/shared/ConfirmDialog";
```

Add state, after the `const setStatus = useMutation({...});` block (right before the `if (isLoading || !business) {` guard):
```tsx
  const [confirmOpen, setConfirmOpen] = useState(false);
```
Add `useState` to the existing React import: change
```tsx
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
```
— no change needed here (React import isn't shown separately since this file has no existing `useState`; add a fresh import line):
```tsx
import { useState } from "react";
```
at the very top, before the `@tanstack/react-query` import.

- [ ] **Step 2: Change the Suspend/Reactivate button**

Replace:
```tsx
          <button
            onClick={() => setStatus.mutate(suspended ? "active" : "suspended")}
            disabled={setStatus.isPending}
            className="rounded-[12px] border bg-white px-4 py-2.5 font-bold disabled:opacity-50"
            style={{
              borderColor: suspended ? "var(--ok-soft)" : "var(--warn-soft)",
              color: suspended ? "var(--ok)" : "var(--warn)",
            }}
          >
            {suspended ? "Reactivate" : "Suspend"}
          </button>
```
with:
```tsx
          <button
            onClick={() => setConfirmOpen(true)}
            disabled={setStatus.isPending}
            className="rounded-[12px] border bg-white px-4 py-2.5 font-bold disabled:opacity-50"
            style={{
              borderColor: suspended ? "var(--ok-soft)" : "var(--warn-soft)",
              color: suspended ? "var(--ok)" : "var(--warn)",
            }}
          >
            {suspended ? "Reactivate" : "Suspend"}
          </button>
```

- [ ] **Step 3: Render the dialog**

Find the component's closing:
```tsx
      {suspended && (
        <div className="mt-5 rounded-[16px] border border-[var(--warn-soft)] bg-[var(--warn-soft)] px-5 py-4 text-sm" style={{ color: "var(--warn)" }}>
          This business is suspended. Its storefront and logins are disabled until reactivated.
        </div>
      )}
    </div>
  );
}
```
Replace with:
```tsx
      {suspended && (
        <div className="mt-5 rounded-[16px] border border-[var(--warn-soft)] bg-[var(--warn-soft)] px-5 py-4 text-sm" style={{ color: "var(--warn)" }}>
          This business is suspended. Its storefront and logins are disabled until reactivated.
        </div>
      )}

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title={suspended ? "Reactivate this business?" : "Suspend this business?"}
        description={
          suspended
            ? "Customers and the admin login will work again immediately."
            : "Customers and the admin login will be disabled until reactivated."
        }
        confirmLabel={suspended ? "Reactivate" : "Suspend"}
        confirmColor={suspended ? "var(--ok)" : "var(--warn)"}
        onConfirm={() => setStatus.mutate(suspended ? "active" : "suspended")}
      />
    </div>
  );
}
```

- [ ] **Step 4: Manual verification**

Run: `npm run dev`. Open a business detail page as platform admin, click Suspend — confirm the dialog appears with warn-colored confirm button and correct copy; confirm; page updates to suspended state with the existing "Status updated" toast (Stampd-styled). Click Reactivate — confirm the dialog now shows ok-colored confirm button and the reactivate copy.

- [ ] **Step 5: Typecheck**

Run: `npm run lint`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/routes/platform/BusinessDetail.tsx
git commit -m "feat(fe): confirm dialog before suspending/reactivating a business"
```

---

### Task 6: Full verification pass

**Files:** none (verification only).

- [ ] **Step 1: Typecheck**

Run: `npm run lint`
Expected: no errors.

- [ ] **Step 2: Backend suite (safety check — this epic is frontend-only, but confirm nothing else regressed)**

Run: `cd backend && npm test`
Expected: all suites pass.

- [ ] **Step 3: Browser walkthrough**

Confirm all 3 dialogs (event delete, menu-item delete, business suspend/reactivate) render correctly, Cancel/Escape/overlay-click all close without side effects, Confirm performs the action and shows a Stampd-styled toast. Confirm a plain `toast.success`/`toast.error` elsewhere in the app (e.g. saving Contact info) now renders with the cream/ink styling instead of react-hot-toast's default white/black look.

- [ ] **Step 4: Report**

Summarize pass/fail. If everything passes, this epic (and all of Epic E) is ready for the finishing-a-development-branch flow.
