"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import {
  Activity,
  AlertCircle,
  Anchor,
  BarChart3,
  CheckCircle2,
  ChevronRight,
  ClipboardList,
  DollarSign,
  FileBadge2,
  FileText,
  Layers,
  Plus,
  Ship,
  Sparkles,
  TrendingUp,
  Truck,
  Upload,
  Zap,
} from "lucide-react";
import { api } from "@/lib/api";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { AlertPanel, AlertRow } from "@/components/dashboard/AlertPanel";
import { KpiCard } from "@/components/dashboard/KpiCard";
import { PanelCard } from "@/components/dashboard/PanelCard";
import { QuickActionTile } from "@/components/dashboard/QuickActionTile";
import { FleetSnapshot } from "@/components/dashboard/FleetSnapshot";
import {
  OperationsStatusChart,
  type StatusDatum,
} from "@/components/dashboard/OperationsStatusChart";
import { RecentOperationsTable } from "@/components/dashboard/RecentOperationsTable";
import { useAuth } from "@/hooks/useAuth";
import { ROLE_LABELS } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  cn,
  formatCurrency,
  formatDate,
  toUtcDate,
  OP_TYPE_LABELS,
  STATUS_LABELS,
} from "@/lib/utils";
import type {
  AnalyticsDashboard,
  ApiResponse,
  NavalClearance,
  Operation,
  OperationStatus,
  PaginatedData,
  Vessel,
} from "@/types";

// The chart/table work off one recent window of operations rather than a
// request per filter combination. 100 is the API's per_page ceiling.
const OPS_WINDOW = 100;

const RANGE_OPTIONS = [
  { value: "7", label: "Last 7 Days" },
  { value: "30", label: "Last 30 Days" },
  { value: "90", label: "Last 90 Days" },
  { value: "all", label: "All Time" },
];

const TYPE_OPTIONS = [
  { value: "all", label: "All Operations" },
  { value: "full_operation", label: "Full Operation" },
  { value: "vessel_only", label: "Vessel Only" },
  { value: "truck_only", label: "Truck Only" },
];

const QUICK_ACTIONS = [
  {
    href: "/operations",
    label: "Create New Operation",
    description: "Start a new bunkering operation",
    icon: Plus,
    tone: "blue" as const,
  },
  {
    href: "/analytics",
    label: "Generate Report",
    description: "Export operational data",
    icon: FileText,
    tone: "emerald" as const,
  },
  {
    href: "/fleet/vessels",
    label: "Add New Vessel",
    description: "Register vessel information",
    icon: Ship,
    tone: "violet" as const,
  },
  {
    href: "/documents",
    label: "Upload Document",
    description: "BFL, PFI, Waivers & more",
    icon: Upload,
    tone: "amber" as const,
  },
];

const DAY_MS = 86_400_000;

/** Whole-number percentage of `part` in `total`, safe when total is 0. */
function pctOf(part: number, total: number): number {
  return total > 0 ? Math.round((part / total) * 100) : 0;
}

export function BunkerManagerDashboard() {
  const { user, effectiveRole } = useAuth();
  const [range, setRange] = useState("30");
  const [opType, setOpType] = useState("all");

  const { data: analytics, isLoading: loadingAnalytics } = useQuery({
    queryKey: ["analytics-dashboard"],
    queryFn: async () => {
      const res = await api.get<ApiResponse<AnalyticsDashboard>>("/analytics/dashboard");
      return res.data.data;
    },
  });

  const { data: pendingFeedback } = useQuery({
    queryKey: ["ops-feedback-submitted"],
    queryFn: async () => {
      const res = await api.get<ApiResponse<PaginatedData<Operation>>>(
        "/operations?status=feedback_submitted&per_page=10"
      );
      return res.data.data.items;
    },
  });

  // One recent window powers both the status chart and the recent-ops table.
  // `fetchedAt` doubles as "now" for the date-range maths — reading the clock
  // during render would make the derived buckets unstable across re-renders.
  const {
    data: windowOps,
    isLoading: loadingOps,
    dataUpdatedAt: fetchedAt,
  } = useQuery({
    queryKey: ["operations-window", OPS_WINDOW],
    queryFn: async () => {
      const res = await api.get<ApiResponse<PaginatedData<Operation>>>(
        `/operations?per_page=${OPS_WINDOW}`
      );
      return res.data.data.items;
    },
  });

  const { data: vessels } = useQuery({
    queryKey: ["vessels-lookup"],
    queryFn: async () => {
      const res = await api.get<ApiResponse<Vessel[]>>("/vessels");
      return res.data.data;
    },
  });

  const { data: clearances } = useQuery({
    queryKey: ["naval-clearances-summary"],
    retry: false,
    queryFn: async () => {
      const res = await api.get<ApiResponse<NavalClearance[]>>("/naval-clearances");
      return res.data.data;
    },
  });

  // Real 12-month series — the only genuine time series the API exposes, and
  // the only card that draws a trend line.
  const { data: monthly } = useQuery({
    queryKey: ["analytics-monthly", new Date().getFullYear()],
    retry: false,
    queryFn: async () => {
      const res = await api.get<
        ApiResponse<{ year: number; months: { month: number; total: number }[] }>
      >(`/analytics/operations/monthly?year=${new Date().getFullYear()}`);
      const series = Array<number>(12).fill(0);
      for (const m of res.data.data.months ?? []) {
        if (m.month >= 1 && m.month <= 12) series[m.month - 1] = m.total;
      }
      return series;
    },
  });

  const ops = analytics?.operations;
  const trucks = analytics?.trucks;
  const vesselStats = analytics?.vessels;
  const revenue = analytics?.revenue ?? [];

  const totalOps = ops?.total_operations ?? 0;
  const allOps = useMemo(() => windowOps ?? [], [windowOps]);

  const vesselNames = useMemo(
    () => Object.fromEntries((vessels ?? []).map((v) => [v.id, v.vessel_name])),
    [vessels]
  );

  // ── Chart data: filtered client-side over the fetched window ───────────────
  const filteredOps = useMemo(() => {
    const cutoff = range === "all" ? null : fetchedAt - Number(range) * DAY_MS;
    return allOps.filter((op) => {
      if (opType !== "all" && op.type !== opType) return false;
      if (cutoff && toUtcDate(op.created_at).getTime() < cutoff) return false;
      return true;
    });
  }, [allOps, range, opType, fetchedAt]);

  const statusData: StatusDatum[] = useMemo(() => {
    const counts = new Map<string, number>();
    for (const op of filteredOps) {
      counts.set(op.status, (counts.get(op.status) ?? 0) + 1);
    }
    // STATUS_LABELS is declared in workflow order — reuse it as the bar order.
    return Object.keys(STATUS_LABELS)
      .filter((s) => (counts.get(s) ?? 0) > 0)
      .map((s) => ({
        label: STATUS_LABELS[s as OperationStatus],
        count: counts.get(s) ?? 0,
      }));
  }, [filteredOps]);

  // Week-over-week movement, computed from real creation timestamps.
  const weekStats = useMemo(() => {
    let thisWeek = 0;
    let lastWeek = 0;
    for (const op of allOps) {
      const age = fetchedAt - toUtcDate(op.created_at).getTime();
      if (age < 7 * DAY_MS) thisWeek++;
      else if (age < 14 * DAY_MS) lastWeek++;
    }
    const delta =
      lastWeek > 0 ? Math.round(((thisWeek - lastWeek) / lastWeek) * 100) : null;
    return { thisWeek, lastWeek, delta };
  }, [allOps, fetchedAt]);

  // Month-over-month movement for the hero card.
  const monthDelta = useMemo(() => {
    if (!monthly) return null;
    const m = new Date().getMonth();
    if (m === 0) return null;
    const prev = monthly[m - 1];
    if (!prev) return null;
    return Math.round(((monthly[m] - prev) / prev) * 100);
  }, [monthly]);

  const validClearances = clearances?.filter((c) => c.is_valid).length;
  const firstName = user?.full_name?.split(" ")[0] ?? "there";

  return (
    <DashboardShell
      eyebrow={
        <>
          Welcome back, {firstName} <span aria-hidden="true">👋</span>
        </>
      }
      title="Command Center"
      subtitle={`Full operational overview — ${ROLE_LABELS[effectiveRole ?? ""] ?? effectiveRole ?? ""}`}
      actions={
        <Button
          asChild
          className="h-10.5 rounded-xl px-4 text-[13px] font-semibold shadow-[0_12px_26px_-14px_rgba(23,52,99,0.9)]"
        >
          <Link href="/operations">
            <Plus className="h-4 w-4" strokeWidth={2.5} />
            New Operation
          </Link>
        </Button>
      }
    >
      {/* ── Pending feedback — BM's urgent action queue ───────────────── */}
      {(pendingFeedback?.length ?? 0) > 0 && (
        <AlertPanel
          icon={AlertCircle}
          tone="amber"
          title={`Pending Feedback Review (${pendingFeedback!.length})`}
        >
          {pendingFeedback!.map((op) => (
            <AlertRow
              key={op.id}
              mono
              primary={op.operation_number}
              secondary={`${OP_TYPE_LABELS[op.type]} · Created ${formatDate(op.created_at)}`}
              trailing={
                <Button
                  asChild
                  size="sm"
                  variant="outline"
                  className="h-8 rounded-lg border-amber-300 bg-white/70 text-xs text-amber-800 hover:bg-amber-100 hover:text-amber-900"
                >
                  <Link href={`/operations/${op.id}`}>
                    Review
                    <ChevronRight className="h-3.5 w-3.5" />
                  </Link>
                </Button>
              }
            />
          ))}
        </AlertPanel>
      )}

      {/* ── Primary KPIs ─────────────────────────────────────────────── */}
      {loadingAnalytics ? (
        <KpiSkeletonRow count={5} />
      ) : (
        <section
          className="animate-rise grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-5"
          aria-label="Key metrics"
        >
          <KpiCard
            tone="navy"
            icon={Layers}
            title="Total Operations"
            value={totalOps}
            caption="All time"
            series={monthly}
            note={
              monthDelta !== null
                ? `${monthDelta >= 0 ? "+" : ""}${monthDelta}% vs last month`
                : `${ops?.active_operations ?? 0} active right now`
            }
            noteTrend={monthDelta !== null && monthDelta > 0 ? "up" : "flat"}
          />
          <KpiCard
            tone="emerald"
            icon={Activity}
            title="Active Operations"
            value={ops?.active_operations ?? 0}
            caption="In progress"
            note={`${pctOf(ops?.active_operations ?? 0, totalOps)}% of all operations`}
            noteTrend="flat"
          />
          <KpiCard
            tone="amber"
            icon={CheckCircle2}
            title="Completed This Month"
            value={ops?.completed_this_month ?? 0}
            caption="Successfully delivered"
            note={`${pctOf(ops?.completed_this_month ?? 0, totalOps)}% of all operations`}
            noteTrend="flat"
          />
          <KpiCard
            tone="violet"
            icon={Truck}
            title="Available Trucks"
            value={`${trucks?.available ?? 0} / ${trucks?.total_trucks ?? 0}`}
            caption={`${trucks?.in_transit ?? 0} in transit`}
            note={`${pctOf(trucks?.available ?? 0, trucks?.total_trucks ?? 0)}% fleet ready`}
          />
          {/* `total_pfis` counts every PFI on file, not PFIs attached to an
              operation — so neither "Linked" nor a percentage of the operation
              count means anything here. It read "48 · 960% of all operations"
              before this. */}
          <KpiCard
            tone="sky"
            icon={TrendingUp}
            title="Pro-forma Invoices"
            value={ops?.total_pfis ?? 0}
            caption="On file, all clients"
            note="Raised independently of operations"
            noteTrend="flat"
          />
        </section>
      )}

      {/* ── Secondary KPIs ───────────────────────────────────────────── */}
      {loadingAnalytics ? (
        <KpiSkeletonRow count={4} />
      ) : (
        <section
          className="animate-rise grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4"
          aria-label="Compliance and fleet metrics"
        >
          <KpiCard
            variant="plain"
            tone="blue"
            icon={FileBadge2}
            title="BDNs Approved"
            value={ops?.total_bdns_approved ?? 0}
            caption="Delivery notes"
            note={`${pctOf(ops?.total_bdns_approved ?? 0, totalOps)}% of all operations`}
            noteTrend="flat"
          />
          <KpiCard
            variant="plain"
            tone="sky"
            icon={Ship}
            title="Vessels Registered"
            value={vesselStats?.total_vessels ?? 0}
            caption="Total vessels"
            note={`${vesselStats?.total_rob_entries ?? 0} ROB entries logged`}
            noteTrend="flat"
          />
          <KpiCard
            variant="plain"
            tone="amber"
            icon={ClipboardList}
            title="ROB Entries"
            value={vesselStats?.total_rob_entries ?? 0}
            caption="Recorded"
            note={`${vesselStats?.current_rob_mt ?? 0} MT currently on board`}
            noteTrend="flat"
          />
          <KpiCard
            variant="plain"
            tone="violet"
            icon={Anchor}
            title="Naval Clearances"
            value={validClearances ?? "—"}
            caption="Active clearances"
            note={
              clearances
                ? `${clearances.length} on file`
                : "Awaiting clearance data"
            }
            noteTrend="flat"
          />
          {revenue.map((r) => (
            <KpiCard
              key={r.currency}
              variant="plain"
              tone="emerald"
              icon={DollarSign}
              title={`Revenue (${r.currency})`}
              value={formatCurrency(r.total_amount, r.currency)}
              caption="Confirmed payments"
              note={`${r.payment_count} payment${r.payment_count === 1 ? "" : "s"}`}
              noteTrend="flat"
            />
          ))}
        </section>
      )}

      {/* ── Main grid ────────────────────────────────────────────────── */}
      <div className="animate-rise grid grid-cols-1 gap-4 xl:grid-cols-3">
        <div className="flex flex-col gap-4 xl:col-span-2">
          <PanelCard
            icon={BarChart3}
            tone="blue"
            title="Operations by Status"
            subtitle="Track performance across key operational stages"
            action={
              <>
                <FilterSelect
                  value={range}
                  onChange={setRange}
                  options={RANGE_OPTIONS}
                  label="Date range"
                />
                <FilterSelect
                  value={opType}
                  onChange={setOpType}
                  options={TYPE_OPTIONS}
                  label="Operation type"
                />
              </>
            }
          >
            <div className="relative">
              {/* Below sm the callout stacks above the chart instead of
                  floating over it. */}
              <WeekCallout {...weekStats} className="mb-3 sm:hidden" />
              <WeekCallout
                {...weekStats}
                className="pointer-events-none absolute right-1 top-0 z-10 hidden w-47 sm:block"
              />
              {loadingOps ? (
                <Skeleton className="h-65 w-full rounded-xl" />
              ) : (
                <OperationsStatusChart data={statusData} />
              )}
            </div>
          </PanelCard>

          <PanelCard
            icon={ClipboardList}
            tone="violet"
            title="Recent Operations"
            subtitle="Latest activities across your operations"
            flush
            action={
              <Button
                asChild
                variant="outline"
                size="sm"
                className="h-8 rounded-lg text-xs font-semibold"
              >
                <Link href="/operations">
                  View all
                  <ChevronRight className="h-3.5 w-3.5" />
                </Link>
              </Button>
            }
          >
            {loadingOps ? (
              <div className="space-y-2 px-5 pb-5">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} className="h-10 w-full rounded-lg" />
                ))}
              </div>
            ) : (
              <RecentOperationsTable
                operations={allOps.slice(0, 5)}
                vesselNames={vesselNames}
              />
            )}
          </PanelCard>
        </div>

        <div className="flex flex-col gap-4">
          <FleetSnapshot trucks={trucks} vessels={vesselStats} />

          <PanelCard
            icon={Zap}
            tone="amber"
            title="Quick Actions"
            subtitle="Common tasks, one click away"
          >
            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
              {QUICK_ACTIONS.map((a) => (
                <QuickActionTile key={a.href} {...a} />
              ))}
            </div>
          </PanelCard>
        </div>
      </div>
    </DashboardShell>
  );
}

/* ── Local building blocks ──────────────────────────────────────────────── */

function KpiSkeletonRow({ count }: { count: number }) {
  return (
    <div
      className={cn(
        "grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4",
        count === 5 && "xl:grid-cols-3 2xl:grid-cols-5"
      )}
    >
      {Array.from({ length: count }).map((_, i) => (
        <Skeleton key={i} className="h-38 rounded-2xl" />
      ))}
    </div>
  );
}

function FilterSelect({
  value,
  onChange,
  options,
  label,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  label: string;
}) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger
        aria-label={label}
        className="h-9 w-auto min-w-33 gap-2 rounded-lg border-slate-200/80 bg-card text-xs font-semibold dark:border-border"
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {options.map((o) => (
          <SelectItem key={o.value} value={o.value} className="text-xs">
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

/** Week-over-week callout — both numbers come from real creation timestamps. */
function WeekCallout({
  thisWeek,
  delta,
  className,
}: {
  thisWeek: number;
  lastWeek: number;
  delta: number | null;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "rounded-xl border border-sky-100 bg-sky-50/80 px-3 py-2.5",
        "dark:border-sky-500/20 dark:bg-sky-500/10",
        className
      )}
    >
      <p className="text-[10px] font-semibold uppercase tracking-wide text-sky-900/60 dark:text-sky-200/70">
        Total This Week
      </p>
      <p className="mt-0.5 text-[15px] font-bold tabular-nums text-foreground">
        {thisWeek} Operation{thisWeek === 1 ? "" : "s"}
      </p>
      <p
        className={cn(
          "mt-1 flex items-center gap-1 text-[11px] font-semibold",
          delta === null
            ? "text-muted-foreground"
            : delta >= 0
              ? "text-emerald-600"
              : "text-rose-600"
        )}
      >
        {delta === null ? (
          <>
            <Sparkles className="h-3 w-3" strokeWidth={2.5} />
            No prior week to compare
          </>
        ) : (
          <>
            <TrendingUp
              className={cn("h-3 w-3", delta < 0 && "rotate-180")}
              strokeWidth={2.5}
            />
            {delta >= 0 ? "+" : ""}
            {delta}% vs previous week
          </>
        )}
      </p>
    </div>
  );
}
