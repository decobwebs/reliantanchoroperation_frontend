"use client";

import { use } from "react";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import {
  ArrowLeft,
  MapPin,
  Phone,
  User,
  Package,
  TrendingUp,
  TrendingDown,
  Activity,
  CheckCircle2,
  AlertTriangle,
  Clock,
  ChevronRight,
  Fuel,
  Gauge,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Navigation,
  CalendarDays,
  Truck as TruckIcon,
  Droplets,
  Thermometer,
  BarChart3,
  Wrench,
} from "lucide-react";
import { api } from "@/lib/api";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { PanelCard } from "@/components/dashboard/PanelCard";
import { TruckIssuesPanel } from "@/components/shared/TruckIssuesPanel";
import { MetaChip } from "@/components/operations/DetailHeader";
import { StatTile, StatTileRow } from "@/components/operations/StatTile";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { cn, formatDate, formatNumber } from "@/lib/utils";
import type { ApiResponse, TruckProfile } from "@/types";

// Same vocabulary/colours as the Fleet list page's STATUS_COLOR — kept in
// sync manually since it's only these two consumers.
const STATUS_COLOR: Record<string, string> = {
  available:      "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300",
  assigned:       "bg-brand-100 text-brand-700 dark:bg-brand-500/15 dark:text-brand-300",
  in_transit:     "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300",
  discharging:    "bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300",
  maintenance:    "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300",
  out_of_service: "bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300",
};

const OP_STATUS_COLOR: Record<string, string> = {
  completed:   "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300",
  cancelled:   "bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300",
  in_transit:  "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300",
  discharging: "bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300",
  assigned:    "bg-brand-100 text-brand-700 dark:bg-brand-500/15 dark:text-brand-300",
  loading:     "bg-brand-100 text-brand-800 dark:bg-brand-500/20 dark:text-brand-200",
};

const ROLE_LABEL: Record<string, string> = {
  logistics_officer: "LO",
  bunker_manager:    "BM",
  ops_supervisor:    "Supervisor",
};

// Same emerald/amber/rose values already used for meaning elsewhere (see
// KpiCard's spark colours) — reused here rather than introducing new hex.
function EfficiencyRing({ pct }: { pct: number }) {
  const r = 36;
  const circ = 2 * Math.PI * r;
  const dash = (Math.min(pct, 100) / 100) * circ;
  const color = pct >= 95 ? "rgb(16 185 129)" : pct >= 80 ? "rgb(245 158 11)" : "rgb(244 63 94)";
  return (
    <div className="relative h-24 w-24 shrink-0">
      <svg className="h-full w-full -rotate-90" viewBox="0 0 88 88">
        <circle cx="44" cy="44" r={r} className="stroke-border" strokeWidth="8" fill="none" />
        <circle
          cx="44" cy="44" r={r}
          stroke={color} strokeWidth="8" fill="none"
          strokeDasharray={`${dash} ${circ}`}
          strokeLinecap="round"
          style={{ transition: "stroke-dasharray 0.6s ease" }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-lg font-bold tabular-nums" style={{ color }}>{pct.toFixed(0)}%</span>
        <span className="text-[9px] text-muted-foreground">efficiency</span>
      </div>
    </div>
  );
}

function durationLabel(start?: string, end?: string): string {
  if (!start || !end) return "—";
  const ms = new Date(end).getTime() - new Date(start).getTime();
  const mins = Math.round(ms / 60000);
  if (mins < 60) return `${mins}m`;
  return `${Math.floor(mins / 60)}h ${mins % 60}m`;
}

/** dt/dd row, matching the Overview tab's definition-list convention. */
function InfoRow({ label, value, mono, capitalize }: { label: string; value: React.ReactNode; mono?: boolean; capitalize?: boolean }) {
  return (
    <div className="flex items-center justify-between border-b border-border/60 py-2 last:border-0">
      <span className="text-[12px] text-muted-foreground">{label}</span>
      <span className={cn("text-[12.5px] font-semibold text-foreground", mono && "font-mono", capitalize && "capitalize")}>
        {value}
      </span>
    </div>
  );
}

export default function TruckProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);

  const { data, isLoading, isError } = useQuery({
    queryKey: ["truck-profile", id],
    queryFn: async () => {
      const res = await api.get<ApiResponse<TruckProfile>>(`/trucks/${id}/profile`);
      return res.data.data;
    },
  });

  if (isLoading) {
    return (
      <DashboardShell bare>
        <div className="space-y-4">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-9 w-64" />
          <Skeleton className="h-32 w-full rounded-2xl" />
          <Skeleton className="h-64 w-full rounded-2xl" />
        </div>
      </DashboardShell>
    );
  }

  if (isError || !data) {
    return (
      <DashboardShell bare>
        <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 text-center">
          <AlertTriangle className="h-10 w-10 text-muted-foreground/30" strokeWidth={1.5} />
          <p className="text-sm text-muted-foreground">Truck not found or failed to load.</p>
          <Link href="/fleet" className="rounded text-[13px] font-semibold text-brand-600 underline underline-offset-2 hover:text-brand-700">
            Back to Fleet
          </Link>
        </div>
      </DashboardShell>
    );
  }

  const { truck, stats, history } = data;
  const issues   = data.issues ?? [];
  const openIssues = issues.filter((i) => i.status === "open").length;
  const effPct   = stats.efficiency_pct ?? null;
  const varNum   = parseFloat(stats.total_variance_mt);
  const variancePositive = varNum >= 0;

  const passedAudits  = history.filter((h) => h.events?.some((e) => e.event_type === "AUDIT_PASS")).length;
  const failedAudits  = history.filter((h) => h.events?.some((e) => e.event_type === "AUDIT_FAIL")).length;

  return (
    <DashboardShell bare>
      <header className="animate-rise">
        <Link
          href="/fleet"
          className="inline-flex items-center gap-1.5 rounded text-[13px] font-medium text-brand-600 transition-colors hover:text-brand-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
          <ArrowLeft className="h-3.5 w-3.5" strokeWidth={2.5} />
          Back to Fleet
        </Link>

        <div className="mt-3 flex flex-wrap items-center gap-3">
          {truck.photo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={truck.photo_url}
              alt={truck.truck_number}
              className="h-11 w-11 shrink-0 rounded-xl border border-navy-100 object-cover dark:border-border"
            />
          ) : (
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand-50 dark:bg-brand-500/15">
              <TruckIcon className="h-5 w-5 text-brand-600 dark:text-brand-300" strokeWidth={2} />
            </span>
          )}
          <h1 className="font-mono text-[26px] font-extrabold leading-none tracking-tight text-foreground lg:text-[30px]">
            {truck.truck_number}
          </h1>
          <span className={cn("inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-[12px] font-semibold capitalize", STATUS_COLOR[truck.status] ?? "bg-muted text-muted-foreground")}>
            {truck.status.replace(/_/g, " ")}
          </span>
          {!truck.is_active && (
            <Badge variant="destructive" className="rounded-lg">Inactive</Badge>
          )}
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <MetaChip icon={Package}>{formatNumber(parseFloat(truck.capacity_mt))} L capacity</MetaChip>
          {truck.driver_name && <MetaChip icon={User}>{truck.driver_name}</MetaChip>}
          {truck.driver_phone && <MetaChip icon={Phone}>{truck.driver_phone}</MetaChip>}
          {truck.current_location && <MetaChip icon={MapPin}>{truck.current_location}</MetaChip>}
          <MetaChip icon={CalendarDays}>Registered {formatDate(truck.created_at)}</MetaChip>
          <MetaChip icon={BarChart3}>{stats.total_operations} operations</MetaChip>
        </div>

        {truck.notes && (
          <p className="mt-3 rounded-xl border border-navy-100 bg-muted/30 px-3.5 py-2.5 text-[12.5px] italic text-muted-foreground dark:border-border">
            {truck.notes}
          </p>
        )}
      </header>

      <div className="flex flex-col gap-4 lg:flex-row">
        {effPct != null && (
          <PanelCard icon={Gauge} tone="blue" title="Efficiency" className="animate-rise lg:w-56 lg:shrink-0" bodyClassName="flex flex-col items-center justify-center gap-2 py-2">
            <EfficiencyRing pct={effPct} />
            <p className="text-center text-[11px] text-muted-foreground">
              {effPct >= 95 ? "Excellent" : effPct >= 80 ? "Good" : "Needs Attention"}
            </p>
          </PanelCard>
        )}

        <div className="flex-1">
          <StatTileRow className="animate-rise overflow-hidden rounded-2xl border border-navy-100 bg-card shadow-[0_1px_2px_rgb(16_36_71/0.04)] dark:border-border">
            <StatTile icon={TrendingUp} tone="emerald" label="Total Loaded" value={`${formatNumber(parseFloat(stats.total_loaded_mt))} L`} />
            <StatTile icon={TrendingDown} tone="blue" label="Total Discharged" value={`${formatNumber(parseFloat(stats.total_discharged_mt))} L`} />
            <StatTile
              icon={Activity}
              tone={variancePositive ? "emerald" : "amber"}
              label="Volume Variance"
              value={`${variancePositive ? "+" : ""}${formatNumber(varNum)} L`}
            />
            <StatTile
              icon={Droplets}
              tone={parseFloat(stats.total_spillage_mt) > 0 ? "amber" : "slate"}
              label="Total Spillage"
              value={`${formatNumber(parseFloat(stats.total_spillage_mt))} L`}
            />
            <StatTile icon={ShieldCheck} tone="emerald" label="Passed Audits" value={passedAudits || "—"} />
            <StatTile
              icon={ShieldAlert}
              tone={failedAudits > 0 ? "amber" : "slate"}
              label="Failed/Waived Audits"
              value={failedAudits || "—"}
            />
            <StatTile
              icon={Wrench}
              tone={openIssues > 0 ? "amber" : "slate"}
              label="Open Issues"
              value={openIssues || "—"}
            />
          </StatTileRow>
        </div>
      </div>

      <Tabs defaultValue="history" className="animate-rise">
        <TabsList variant="underline">
          <TabsTrigger value="history">
            Operation History
            <span className="ml-1 rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">{history.length}</span>
          </TabsTrigger>
          <TabsTrigger value="issues">
            Issues
            {openIssues > 0 ? (
              <span className="ml-1 rounded bg-amber-100 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-amber-700 dark:bg-amber-500/20 dark:text-amber-300">
                {openIssues}
              </span>
            ) : (
              <span className="ml-1 rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
                {issues.length}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="info">Truck Details</TabsTrigger>
        </TabsList>

        <TabsContent value="history" className="mt-4">
          <PanelCard icon={Clock} tone="blue" title="Operation History" flush>
            {history.length === 0 ? (
              <div className="flex flex-col items-center gap-3 py-16 text-center">
                <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-muted">
                  <TruckIcon className="h-7 w-7 text-muted-foreground/40" />
                </span>
                <p className="text-sm font-medium text-foreground">No operations recorded yet</p>
                <p className="text-xs text-muted-foreground">Operations will appear here once assigned.</p>
              </div>
            ) : (
              <div className="divide-y divide-border/70">
                {history.map((op, idx) => {
                  const opStatusCls = OP_STATUS_COLOR[op.status] ?? "bg-muted text-muted-foreground";
                  const loaded      = op.quantity_loaded_mt    ? parseFloat(op.quantity_loaded_mt)    : null;
                  const discharged  = op.quantity_discharged_mt? parseFloat(op.quantity_discharged_mt): null;
                  const remaining   = op.quantity_remaining_mt ? parseFloat(op.quantity_remaining_mt) : null;
                  const spillage    = op.spillage_mt           ? parseFloat(op.spillage_mt)           : null;
                  const tempC       = op.temperature_celsius   ? parseFloat(op.temperature_celsius)   : null;
                  const variance    = op.variance_mt           ? parseFloat(op.variance_mt)           : null;
                  const transitDur  = durationLabel(op.transit_start_at,  op.transit_end_at);
                  const dischDur    = durationLabel(op.discharge_start_at, op.discharge_end_at);

                  const hasAuditPass  = op.events?.some((e) => e.event_type === "AUDIT_PASS");
                  const hasAuditFail  = op.events?.some((e) => e.event_type === "AUDIT_FAIL");
                  const hasWaivers    = op.events?.some((e) => e.event_type === "WAIVE_AUDIT_ITEM");

                  return (
                    <div key={op.id} className="px-4 py-5 transition-colors hover:bg-muted/30 lg:px-5">
                      <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
                        <div className="flex min-w-0 items-center gap-3">
                          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-muted text-[10px] font-bold text-muted-foreground">
                            {idx + 1}
                          </span>
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <Link
                                href={`/operations/${op.operation_id}`}
                                className="font-mono text-[13px] font-bold text-brand-600 hover:underline"
                              >
                                {op.operation_number}
                              </Link>
                              <span className="text-[11.5px] capitalize text-muted-foreground">
                                {op.operation_type.replace(/_/g, " ")}
                              </span>
                            </div>
                            <p className="text-[10.5px] text-muted-foreground">{formatDate(op.created_at)}</p>
                          </div>
                        </div>
                        <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
                          {hasAuditPass && !hasAuditFail && (
                            <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/15 dark:text-emerald-300">
                              <ShieldCheck className="h-3 w-3" />
                              Audit Pass
                            </span>
                          )}
                          {hasAuditFail && !hasWaivers && (
                            <span className="inline-flex items-center gap-1 rounded-full border border-rose-200 bg-rose-50 px-2 py-0.5 text-[10px] font-semibold text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/15 dark:text-rose-300">
                              <ShieldAlert className="h-3 w-3" />
                              Audit Fail
                            </span>
                          )}
                          {hasWaivers && (
                            <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/15 dark:text-amber-300">
                              <AlertTriangle className="h-3 w-3" />
                              Waived Issues
                            </span>
                          )}
                          <span className={cn("rounded-full px-2.5 py-0.5 text-[11px] font-semibold capitalize", opStatusCls)}>
                            {op.status.replace(/_/g, " ")}
                          </span>
                        </div>
                      </div>

                      {(op.loading_location || op.discharge_location) && (
                        <div className="mb-3 flex items-center gap-1.5 rounded-lg bg-muted/40 px-3 py-2 text-[12px] text-muted-foreground">
                          <Navigation className="h-3 w-3 shrink-0 text-brand-600/60" />
                          <span className="truncate font-medium text-foreground">{op.loading_location ?? "—"}</span>
                          <ChevronRight className="h-3 w-3 shrink-0 text-muted-foreground/50" />
                          <span className="truncate font-medium text-foreground">{op.discharge_location ?? "—"}</span>
                          {op.destination_vessel_name && (
                            <>
                              <ChevronRight className="h-3 w-3 shrink-0 text-muted-foreground/50" />
                              <span className="truncate font-semibold text-brand-600">{op.destination_vessel_name}</span>
                            </>
                          )}
                        </div>
                      )}

                      <div className="mb-3 grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-5">
                        {loaded != null && (
                          <div className="rounded-lg bg-emerald-50 px-3 py-2 text-center dark:bg-emerald-500/10">
                            <p className="mb-0.5 text-[9px] font-medium uppercase tracking-wide text-emerald-600 dark:text-emerald-400">Loaded</p>
                            <p className="text-[13px] font-bold tabular-nums text-emerald-700 dark:text-emerald-300">{formatNumber(loaded)} L</p>
                          </div>
                        )}
                        {discharged != null && (
                          <div className="rounded-lg bg-brand-50 px-3 py-2 text-center dark:bg-brand-500/10">
                            <p className="mb-0.5 text-[9px] font-medium uppercase tracking-wide text-brand-600 dark:text-brand-300">Discharged</p>
                            <p className="text-[13px] font-bold tabular-nums text-brand-700 dark:text-brand-200">{formatNumber(discharged)} L</p>
                          </div>
                        )}
                        {remaining != null && (
                          <div className="rounded-lg bg-muted/60 px-3 py-2 text-center">
                            <p className="mb-0.5 text-[9px] font-medium uppercase tracking-wide text-muted-foreground">Remaining</p>
                            <p className="text-[13px] font-bold tabular-nums text-foreground">{formatNumber(remaining)} L</p>
                          </div>
                        )}
                        {variance != null && (
                          <div className={cn("rounded-lg px-3 py-2 text-center", variance >= 0 ? "bg-emerald-50 dark:bg-emerald-500/10" : "bg-rose-50 dark:bg-rose-500/10")}>
                            <p className={cn("mb-0.5 text-[9px] font-medium uppercase tracking-wide", variance >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400")}>Variance</p>
                            <p className={cn("text-[13px] font-bold tabular-nums", variance >= 0 ? "text-emerald-700 dark:text-emerald-300" : "text-rose-700 dark:text-rose-300")}>
                              {variance >= 0 ? "+" : ""}{formatNumber(variance)} L
                            </p>
                          </div>
                        )}
                        {spillage != null && spillage > 0 && (
                          <div className="rounded-lg bg-rose-50 px-3 py-2 text-center dark:bg-rose-500/10">
                            <p className="mb-0.5 text-[9px] font-medium uppercase tracking-wide text-rose-600 dark:text-rose-400">Spillage</p>
                            <p className="text-[13px] font-bold tabular-nums text-rose-700 dark:text-rose-300">{formatNumber(spillage)} L</p>
                          </div>
                        )}
                      </div>

                      <div className="mb-2 flex flex-wrap gap-x-5 gap-y-1 text-[11px] text-muted-foreground">
                        {transitDur !== "—" && (
                          <span className="flex items-center gap-1">
                            <Navigation className="h-3 w-3" />
                            Transit: <span className="ml-0.5 font-semibold text-foreground">{transitDur}</span>
                          </span>
                        )}
                        {dischDur !== "—" && (
                          <span className="flex items-center gap-1">
                            <Fuel className="h-3 w-3" />
                            Discharge: <span className="ml-0.5 font-semibold text-foreground">{dischDur}</span>
                          </span>
                        )}
                        {tempC != null && (
                          <span className="flex items-center gap-1">
                            <Thermometer className="h-3 w-3" />
                            Temp: <span className="ml-0.5 font-semibold text-foreground">{tempC}°C</span>
                          </span>
                        )}
                        {op.product_type && (
                          <span className="flex items-center gap-1">
                            <Package className="h-3 w-3" />
                            <span className="font-semibold text-foreground">{op.product_type}</span>
                          </span>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
                        {op.supervisor_name && (
                          <span className="flex items-center gap-1">
                            <Shield className="h-3 w-3" />
                            Supervised by <span className="ml-0.5 font-semibold text-foreground">{op.supervisor_name}</span>
                          </span>
                        )}
                        <span className="ml-auto flex items-center gap-1">
                          <CheckCircle2 className="h-3 w-3 text-muted-foreground/60" />
                          <span className="font-semibold text-foreground">{op.logged_by_name}</span>
                          <span className="opacity-50">·</span>
                          <span>{ROLE_LABEL[op.logged_by_role] ?? op.logged_by_role}</span>
                        </span>
                      </div>

                      {op.notes && (
                        <p className="mt-2 rounded bg-muted/40 px-2.5 py-1.5 text-[11px] italic text-muted-foreground">
                          {op.notes}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </PanelCard>
        </TabsContent>

        <TabsContent value="issues" className="mt-4">
          <TruckIssuesPanel
            truckId={truck.id}
            truckNumber={truck.truck_number}
            issues={issues}
          />
        </TabsContent>

        <TabsContent value="info" className="mt-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <PanelCard icon={TruckIcon} tone="blue" title="Vehicle Information">
              <InfoRow label="Registration / Number" value={truck.truck_number} mono />
              <InfoRow label="Capacity" value={`${formatNumber(parseFloat(truck.capacity_mt))} L`} />
              <InfoRow label="Status" value={truck.status.replace(/_/g, " ")} capitalize />
              <InfoRow label="Active" value={truck.is_active ? "Yes" : "No"} />
              <InfoRow label="Registered" value={formatDate(truck.created_at)} />
              <InfoRow label="Last Updated" value={formatDate(truck.updated_at)} />
            </PanelCard>

            <PanelCard icon={User} tone="blue" title="Driver &amp; Location">
              <InfoRow label="Driver Name" value={truck.driver_name ?? "Not assigned"} />
              <InfoRow label="Driver Phone" value={truck.driver_phone ?? "—"} />
              <InfoRow label="Current Location" value={truck.current_location ?? "Unknown"} />
              <InfoRow label="GPS Latitude" value={truck.gps_lat ?? "—"} />
              <InfoRow label="GPS Longitude" value={truck.gps_lng ?? "—"} />
            </PanelCard>

            <PanelCard icon={Gauge} tone="blue" title="Lifetime Performance Summary" className="md:col-span-2">
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
                {[
                  { label: "Total Operations",  value: stats.total_operations, unit: "" },
                  { label: "Total Loaded",      value: formatNumber(parseFloat(stats.total_loaded_mt)),       unit: "L" },
                  { label: "Total Discharged",  value: formatNumber(parseFloat(stats.total_discharged_mt)),   unit: "L" },
                  { label: "Total Variance",    value: `${variancePositive ? "+" : ""}${formatNumber(varNum)}`, unit: "L" },
                  { label: "Total Spillage",    value: formatNumber(parseFloat(stats.total_spillage_mt)),     unit: "L" },
                  { label: "Efficiency",        value: effPct != null ? effPct.toFixed(1) : "—",              unit: effPct != null ? "%" : "" },
                ].map(({ label, value, unit }) => (
                  <div key={label} className="rounded-xl bg-muted/40 p-3 text-center">
                    <p className="mb-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
                    <p className="text-xl font-bold tabular-nums text-foreground">
                      {value}
                      {unit && <span className="ml-0.5 text-sm font-normal text-muted-foreground">{unit}</span>}
                    </p>
                  </div>
                ))}
              </div>
            </PanelCard>
          </div>
        </TabsContent>
      </Tabs>
    </DashboardShell>
  );
}
