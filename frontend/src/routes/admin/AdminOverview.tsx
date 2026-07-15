import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";
import { Stamp, Users, Ticket, Gift, Search, Download } from "lucide-react";
import { apiRequest, getTenantSlug } from "../../lib/api";
import { useAdminSettings } from "../../hooks/useAdminSettings";

interface AdminCustomer {
  id: string;
  name: string;
  email: string;
  customerNo: string;
  stampsEarned: number;
  validVoucherCount: number;
  lastStampedAt: string | null;
}
interface Scan {
  id: string;
  timestamp: string;
  customerName?: string;
}

function timeAgo(iso: string): string {
  const secs = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (secs < 60) return "just now";
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function lastVisit(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

// Purely decorative fill — no real target exists to measure against, so it
// never claims a percentage, just gives each tile a little visual weight.
function decorativeFill(val: number): number {
  return Math.min(100, Math.round((val / (val + 10)) * 100));
}

export default function AdminOverview() {
  const { slug } = useParams();
  const { data: settings } = useAdminSettings();
  const [query, setQuery] = useState("");

  const { data: customers = [] } = useQuery<AdminCustomer[]>({
    queryKey: ["adminCustomers"],
    queryFn: async () => {
      const res = await apiRequest<{ success: boolean; data: AdminCustomer[] }>(
        "/api/admin/customers",
        { role: "admin" },
      );
      return res.data || [];
    },
  });

  const { data: scans = [] } = useQuery<Scan[]>({
    queryKey: ["recentScans"],
    queryFn: async () => {
      const res = await apiRequest<{ success: boolean; data: Scan[] }>("/api/admin/recent-scans", {
        role: "admin",
      });
      return res.data || [];
    },
    refetchInterval: 5000,
  });

  const totalCustomers = customers.length;
  const activeVouchers = customers.reduce((n, c) => n + (c.validVoucherCount || 0), 0);
  const stampsOnCards = customers.reduce((n, c) => n + (c.stampsEarned || 0), 0);
  const required = settings?.program?.stampsRequired ?? 5;

  const stats = [
    { label: "Total customers", val: totalCustomers, Icon: Users },
    { label: "Active vouchers", val: activeVouchers, Icon: Ticket },
    { label: "Stamps on cards", val: stampsOnCards, Icon: Stamp },
    { label: "Stamps per reward", val: required, Icon: Gift },
  ];

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const base = q
      ? customers.filter((c) => c.name.toLowerCase().includes(q) || c.email.toLowerCase().includes(q))
      : customers;
    return base.slice(0, 5);
  }, [customers, query]);

  const downloadExcel = async () => {
    const token = localStorage.getItem("admin_auth_token");
    const tenantSlug = getTenantSlug();
    const res = await fetch("/api/admin/reports/customers/download", {
      headers: { Authorization: `Bearer ${token}`, ...(tenantSlug ? { "X-Tenant-Slug": tenantSlug } : {}) },
    });
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "customers.xlsx";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-[28px] font-extrabold text-[var(--ink)]">Overview</h1>
          <p className="text-[var(--muted)]">Here’s how {settings?.name ?? "your business"} is doing.</p>
        </div>
        <Link
          to={`/${slug}/admin/generate`}
          className="stamp-interactive rounded-full px-5 py-3 text-[15px] font-bold text-white"
          style={{ background: "var(--brand)" }}
        >
          Generate stamp code
        </Link>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-4">
        {stats.map((s) => (
          <div key={s.label} className="shadow-ambient rounded-3xl bg-[var(--surface)] p-5">
            <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-2xl bg-[var(--surface-container)]">
              <s.Icon className="h-5 w-5" style={{ color: "var(--brand)" }} />
            </div>
            <div className="mb-1 text-[13px] uppercase tracking-wide text-[var(--muted)]">{s.label}</div>
            <div className="font-display text-[28px] font-bold leading-none">{s.val}</div>
            <div className="mt-3 h-1 w-full overflow-hidden rounded-full bg-[var(--surface-container)]">
              <div className="h-full rounded-full" style={{ width: `${decorativeFill(Number(s.val) || 0)}%`, background: "var(--brand)" }} />
            </div>
          </div>
        ))}
      </div>

      <div className="shadow-ambient mb-6 rounded-3xl bg-[var(--surface)] p-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="font-display text-lg font-bold text-[var(--ink)]">Customer database</h3>
            <p className="text-sm text-[var(--muted)]">Review activity and track loyalty progress.</p>
          </div>
          <div className="flex items-center gap-2.5">
            <div className="flex items-center gap-2 rounded-full bg-[var(--surface-container)] px-4 py-2">
              <Search className="h-3.5 w-3.5 flex-shrink-0 text-[var(--soft)]" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search…"
                className="w-32 bg-transparent text-sm text-[var(--ink)] placeholder:text-[var(--soft)] focus:outline-none"
              />
            </div>
            <button
              onClick={downloadExcel}
              className="stamp-interactive flex items-center gap-1.5 rounded-full bg-[var(--surface-container)] px-4 py-2 text-sm font-bold text-[var(--ink)]"
            >
              <Download className="h-4 w-4" />
              Export
            </button>
          </div>
        </div>

        {filtered.length === 0 ? (
          <p className="py-6 text-center text-sm text-[var(--muted)]">No customers match your search.</p>
        ) : (
          <div className="flex flex-col">
            {filtered.map((c) => (
              <Link
                key={c.id}
                to={`/${slug}/admin/customers/${c.id}`}
                className="flex items-center gap-3 border-b border-[var(--line)] py-3 last:border-b-0 hover:bg-[var(--surface-container)]"
              >
                <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full border border-[var(--line)] bg-[var(--bg)] text-xs font-bold text-[var(--muted)]">
                  {c.name.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase()}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-bold text-[var(--ink)]">{c.name}</span>
                  <span className="block truncate text-xs text-[var(--soft)]">{c.email}</span>
                </span>
                <span className="text-sm font-semibold text-[var(--ink)]">{c.stampsEarned}/{required}</span>
                <span className="w-20 text-right text-[13px] text-[var(--muted)]">{lastVisit(c.lastStampedAt)}</span>
              </Link>
            ))}
          </div>
        )}

        <Link
          to={`/${slug}/admin/customers`}
          className="mt-4 inline-block text-sm font-bold"
          style={{ color: "var(--brand)" }}
        >
          View all customers →
        </Link>
      </div>

      <div className="shadow-ambient rounded-3xl bg-[var(--surface)] p-6">
        <div className="mb-4 flex items-center gap-2">
          <span className="h-2 w-2 rounded-full" style={{ background: "var(--ok)" }} />
          <h3 className="font-display text-[17px] font-bold">Live activity</h3>
        </div>
        {scans.length === 0 ? (
          <p className="py-6 text-center text-sm text-[var(--muted)]">
            No stamp activity yet. Generated codes appear here as customers scan them.
          </p>
        ) : (
          <div className="flex flex-col">
            {scans.slice(0, 12).map((s) => (
              <div
                key={s.id}
                className="flex items-center gap-3 border-b border-[var(--line)] py-3 last:border-b-0"
              >
                <span
                  className="flex h-9 w-9 items-center justify-center rounded-xl"
                  style={{ background: "var(--surface-container)", color: "var(--brand)" }}
                >
                  <Stamp className="h-4 w-4" />
                </span>
                <span className="flex-1 text-sm">
                  <b>{s.customerName || "A customer"}</b> earned a stamp
                </span>
                <span className="text-xs text-[var(--soft)]">{timeAgo(s.timestamp)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
