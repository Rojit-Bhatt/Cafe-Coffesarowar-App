import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { TrendingUp, TrendingDown, Download } from "lucide-react";
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip } from "recharts";
import { apiRequest, apiUrl } from "../../lib/api";
import { Skeleton } from "../../components/ui/skeleton";

interface DashboardMetric {
  value: number;
  trend: number | null;
}

interface PlatformAnalyticsData {
  companiesTotal: number;
  outletsTotal: number;
  outletsActive: number;
  customersTotal: number;
  newCustomers: DashboardMetric;
  pointsIssued: DashboardMetric;
  revenue: DashboardMetric;
  redemptions: DashboardMetric;
  pointsVelocity: { date: string; points: number }[];
}

function defaultRange() {
  const end = new Date();
  const start = new Date(end.getTime() - 30 * 24 * 60 * 60 * 1000);
  return { start: start.toISOString().slice(0, 10), end: end.toISOString().slice(0, 10) };
}

const shortDate = (iso: string) => new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });

function TrendBadge({ trend }: { trend: number | null }) {
  if (trend === null) return null;
  const up = trend >= 0;
  return (
    <span className="ml-2 inline-flex items-center gap-0.5 text-[12px] font-bold" style={{ color: up ? "var(--ok)" : "var(--err)" }}>
      {up ? <TrendingUp className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />}
      {Math.abs(trend)}%
    </span>
  );
}

export default function PlatformAnalytics() {
  const initial = defaultRange();
  const [startDate, setStartDate] = useState(initial.start);
  const [endDate, setEndDate] = useState(initial.end);

  const { data: stats, isLoading } = useQuery<PlatformAnalyticsData>({
    queryKey: ["platformAnalytics"],
    queryFn: async () => {
      const res = await apiRequest<{ success: boolean } & PlatformAnalyticsData>(
        "/api/platform/analytics",
        { role: "platform" },
      );
      return res;
    },
  });

  // Point-in-time totals, not flows — no trend badge (see the backend's own
  // comment on why: they're snapshots, week-over-week doesn't mean anything
  // for a running total).
  const totalTiles = stats
    ? [
        { label: "Companies", val: stats.companiesTotal },
        { label: "Outlets", val: `${stats.outletsActive}/${stats.outletsTotal}` },
        { label: "Customers", val: stats.customersTotal },
      ]
    : [];

  const trendTiles = stats
    ? [
        { label: "New customers (7d)", val: stats.newCustomers.value, trend: stats.newCustomers.trend },
        { label: "Points issued (7d)", val: stats.pointsIssued.value, trend: stats.pointsIssued.trend },
        { label: "Revenue (7d)", val: stats.revenue.value, trend: stats.revenue.trend },
        { label: "Redemptions (7d)", val: stats.redemptions.value, trend: stats.redemptions.trend },
      ]
    : [];

  const downloadCompaniesReport = async () => {
    const token = localStorage.getItem("platform_auth_token");
    const res = await fetch(
      apiUrl(`/api/platform/analytics/companies-report/download?startDate=${startDate}&endDate=${endDate}`),
      { headers: { Authorization: `Bearer ${token}` } },
    );
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "companies-report.xlsx";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div>
      <h1 className="font-display text-[30px] font-extrabold text-[var(--ink)]">Analytics</h1>
      <p className="mb-6 text-[var(--muted)]">Rolled up across every business on the platform.</p>

      <div className="mb-6 grid grid-cols-3 gap-4">
        {isLoading
          ? Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="shadow-ambient rounded-3xl bg-[var(--surface)] p-5">
                <Skeleton className="mb-1.5 h-3.5 w-20" />
                <Skeleton className="h-6 w-10" />
              </div>
            ))
          : totalTiles.map((t) => (
              <div key={t.label} className="shadow-ambient rounded-3xl bg-[var(--surface)] p-5">
                <div className="mb-1.5 text-[13px] text-[var(--muted)]">{t.label}</div>
                <div className="font-display text-[26px] font-bold">{t.val}</div>
              </div>
            ))}
      </div>

      <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-4">
        {isLoading
          ? Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="shadow-ambient rounded-3xl bg-[var(--surface)] p-5">
                <Skeleton className="mb-1.5 h-3.5 w-20" />
                <Skeleton className="h-6 w-10" />
              </div>
            ))
          : trendTiles.map((t) => (
              <div key={t.label} className="shadow-ambient rounded-3xl bg-[var(--surface)] p-5">
                <div className="mb-1.5 text-[13px] text-[var(--muted)]">{t.label}</div>
                <div className="font-display text-[26px] font-bold">
                  {t.val}
                  <TrendBadge trend={t.trend} />
                </div>
              </div>
            ))}
      </div>

      <div className="shadow-ambient mb-6 rounded-3xl bg-[var(--surface)] p-6">
        <h3 className="mb-1 font-display text-lg font-bold text-[var(--ink)]">Company report</h3>
        <p className="mb-4 text-[13px] text-[var(--muted)]">
          One row per company for the selected range — new customers, points issued/redeemed, revenue, redemptions.
        </p>
        <div className="flex flex-wrap items-end gap-4">
          <label className="block">
            <span className="mb-1.5 block text-sm font-bold">Start date</span>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="rounded-[11px] border border-[var(--line)] bg-[var(--bg)] px-4 py-2.5 text-sm focus:border-[var(--plat)] focus:outline-none"
            />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-sm font-bold">End date</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="rounded-[11px] border border-[var(--line)] bg-[var(--bg)] px-4 py-2.5 text-sm focus:border-[var(--plat)] focus:outline-none"
            />
          </label>
          <button
            onClick={downloadCompaniesReport}
            className="inline-flex items-center gap-1.5 rounded-[12px] px-5 py-2.5 text-sm font-bold text-white"
            style={{ background: "var(--plat)" }}
          >
            <Download className="h-4 w-4" /> Download Excel
          </button>
        </div>
      </div>

      <div className="shadow-ambient rounded-3xl bg-[var(--surface)] p-6">
        <h3 className="mb-1 font-display text-lg font-bold text-[var(--ink)]">Points velocity</h3>
        <p className="mb-4 text-[13px] text-[var(--muted)]">Points issued per day across every business, last 14 days.</p>
        {isLoading || !stats ? (
          <Skeleton className="h-[220px] w-full rounded-xl" />
        ) : (
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={stats.pointsVelocity.map((d) => ({ ...d, label: shortDate(d.date) }))}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--line)" />
              <XAxis dataKey="label" tick={{ fontSize: 12 }} stroke="var(--soft)" />
              <YAxis tick={{ fontSize: 12 }} stroke="var(--soft)" />
              <Tooltip />
              <Line type="monotone" dataKey="points" stroke="var(--plat)" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
