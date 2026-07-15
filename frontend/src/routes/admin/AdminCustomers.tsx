import { useQuery } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";
import { apiRequest } from "../../lib/api";
import { useAdminSettings } from "../../hooks/useAdminSettings";
import { Skeleton } from "../../components/ui/skeleton";

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

function lastVisit(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export default function AdminCustomers() {
  const { slug } = useParams();
  const { data: settings } = useAdminSettings();
  const required = settings?.program?.stampsRequired ?? 5;

  const { data: customers = [], isLoading } = useQuery<AdminCustomer[]>({
    queryKey: ["adminCustomers"],
    queryFn: async () => {
      const res = await apiRequest<{ success: boolean; data: AdminCustomer[] }>(
        "/api/admin/customers",
        { role: "admin" },
      );
      return res.data || [];
    },
  });

  return (
    <div>
      <h1 className="font-display text-[28px] font-bold text-[var(--ink)]">Customers</h1>
      <p className="mb-6 text-[var(--muted)]">
        {isLoading ? <Skeleton className="inline-block h-4 w-40 align-middle" /> : `${customers.length} member${customers.length === 1 ? "" : "s"} of ${settings?.name ?? "your business"}`}
      </p>

      <div className="shadow-ambient overflow-hidden rounded-3xl bg-[var(--surface)]">
        <div className="grid grid-cols-[2fr_1fr_1fr_1fr_1fr] border-b border-[var(--line)] px-5 py-3 text-[11px] font-bold uppercase tracking-wider text-[var(--soft)]">
          <span>Customer</span>
          <span>No.</span>
          <span>Stamps</span>
          <span>Vouchers</span>
          <span>Last visit</span>
        </div>

        {isLoading ? (
          Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="grid grid-cols-[2fr_1fr_1fr_1fr_1fr] items-center border-b border-[var(--line)] px-5 py-3.5 last:border-b-0">
              <span className="flex items-center gap-3">
                <Skeleton className="h-9 w-9 flex-shrink-0 rounded-full" />
                <span className="flex-1">
                  <Skeleton className="mb-1.5 h-3.5 w-24" />
                  <Skeleton className="h-3 w-32" />
                </span>
              </span>
              <Skeleton className="h-3.5 w-14" />
              <Skeleton className="h-3.5 w-10" />
              <Skeleton className="h-3.5 w-8" />
              <Skeleton className="h-3.5 w-16" />
            </div>
          ))
        ) : customers.length === 0 ? (
          <div className="px-5 py-10 text-center text-sm text-[var(--muted)]">No customers yet.</div>
        ) : (
          customers.map((c) => (
            <Link
              key={c.id}
              to={`/${slug}/admin/customers/${c.id}`}
              className="grid w-full grid-cols-[2fr_1fr_1fr_1fr_1fr] items-center border-b border-[var(--line)] px-5 py-3.5 text-left last:border-b-0 hover:bg-[var(--surface-container)]"
            >
              <span className="flex items-center gap-3 min-w-0">
                <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full border border-[var(--line)] bg-[var(--bg)] text-xs font-bold text-[var(--muted)]">
                  {c.name.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase()}
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-sm font-bold text-[var(--ink)]">{c.name}</span>
                  <span className="block truncate text-xs text-[var(--soft)]">{c.email}</span>
                </span>
              </span>
              <span className="font-mono text-[13px] text-[var(--muted)]">{c.customerNo}</span>
              <span className="text-sm font-semibold">
                {c.stampsEarned}/{required}
              </span>
              <span className="text-sm font-semibold">{c.validVoucherCount}</span>
              <span className="text-[13px] text-[var(--muted)]">{lastVisit(c.lastStampedAt)}</span>
            </Link>
          ))
        )}
      </div>
    </div>
  );
}
