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
