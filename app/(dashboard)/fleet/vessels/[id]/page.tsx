"use client";

import { use, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import {
  Ship,
  ArrowLeft,
  MapPin,
  Gauge,
  Package,
  CheckCircle2,
  XCircle,
  Clock,
  AlertTriangle,
  FileText,
  Droplets,
  Anchor,
  ChevronRight,
  Activity,
  TrendingDown,
  TrendingUp,
  RotateCcw,
  Truck,
  Banknote,
  FolderOpen,
} from "lucide-react";
import {
  RadialBarChart,
  RadialBar,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
import { api } from "@/lib/api";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { PanelCard } from "@/components/dashboard/PanelCard";
import { StatCard } from "@/components/shared/StatCard";
import { MetaChip } from "@/components/operations/DetailHeader";
import { AccordionRow } from "@/components/shared/AccordionRow";
import { TONE_TILE_CLASSES, type AccentTone } from "@/components/dashboard/tones";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { cn, formatDate, formatDateTime, formatNumber } from "@/lib/utils";
import type { ApiResponse, Vessel, VesselBDNs } from "@/types";

// ── Config maps ────────────────────────────────────────────────────────────────

const VESSEL_STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  available:      { label: "Available",      color: "bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-300 dark:border-emerald-500/30" },
  in_operation:   { label: "In Operation",   color: "bg-brand-100 text-brand-700 border-brand-200 dark:bg-brand-500/15 dark:text-brand-300 dark:border-brand-500/30" },
  maintenance:    { label: "Maintenance",    color: "bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-500/15 dark:text-amber-300 dark:border-amber-500/30" },
  out_of_service: { label: "Out of Service", color: "bg-rose-100 text-rose-700 border-rose-200 dark:bg-rose-500/15 dark:text-rose-300 dark:border-rose-500/30" },
};

const BDN_STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  draft:    { label: "Draft",    color: "bg-slate-100 text-slate-600 dark:bg-slate-500/15 dark:text-slate-300" },
  pending:  { label: "Pending",  color: "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300" },
  approved: { label: "Approved", color: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300" },
  rejected: { label: "Rejected", color: "bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300" },
};

const ROLE_LABEL: Record<string, string> = {
  bunker_manager:       "Bunker Manager",
  ops_supervisor:       "Ops Supervisor",
  cargo_superintendent: "Cargo Superintendent",
};

// The ledger's five entry types map onto the five shared AccentTones exactly
// — unlike Activity Log/Documents' badge maps (too many categories), this one
// genuinely converges: replenishment=healthy, discharge=neutral outflow (not
// an error — rose stays reserved for that), initial=informational,
// adjustment=needs attention, correction=secondary/audit category.
const ENTRY_TYPE_CONFIG: Record<string, { label: string; icon: React.ReactNode; tone: AccentTone }> = {
  discharge:      { label: "Discharge",     icon: <TrendingDown className="h-3.5 w-3.5" strokeWidth={2} />, tone: "slate" },
  replenishment:  { label: "Replenishment", icon: <TrendingUp className="h-3.5 w-3.5" strokeWidth={2} />,   tone: "emerald" },
  initial:        { label: "Initial Load",  icon: <Package className="h-3.5 w-3.5" strokeWidth={2} />,      tone: "blue" },
  adjustment:     { label: "Adjustment",    icon: <RotateCcw className="h-3.5 w-3.5" strokeWidth={2} />,    tone: "amber" },
  correction:     { label: "Correction",    icon: <RotateCcw className="h-3.5 w-3.5" strokeWidth={2} />,    tone: "violet" },
};

const OP_STATUS_COLOR: Record<string, string> = {
  draft:              "bg-slate-100 text-slate-600 dark:bg-slate-500/15 dark:text-slate-300",
  tasks_assigned:      "bg-brand-50 text-brand-700 dark:bg-brand-500/15 dark:text-brand-300",
  awaiting_feedback:   "bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300",
  feedback_submitted:  "bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300",
  feedback_approved:   "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300",
  feedback_rejected:   "bg-rose-50 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300",
  pfi_linked:          "bg-brand-50 text-brand-700 dark:bg-brand-500/15 dark:text-brand-300",
  payment_processing:  "bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300",
  payment_confirmed:   "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300",
  vessel_operations:   "bg-brand-50 text-brand-700 dark:bg-brand-500/15 dark:text-brand-300",
  bdn_pending:         "bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300",
  bdn_approved:        "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300",
  invoiced:            "bg-violet-50 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300",
  completed:           "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300",
  cancelled:           "bg-rose-100 text-rose-600 dark:bg-rose-500/20 dark:text-rose-300",
  archived:            "bg-slate-100 text-slate-500 dark:bg-slate-500/15 dark:text-slate-400",
};

// ── Types ──────────────────────────────────────────────────────────────────────

interface TruckOpBrief {
  truck_number: string;
  status: string;
  quantity_loaded_mt: string | null;
  quantity_discharged_mt: string | null;
  variance_mt: string | null;
  loading_location: string | null;
  discharge_location: string | null;
}

interface BdnBrief {
  bdn_number: string;
  status: string;
  quantity_delivered_mt: string;
  delivery_date: string | null;
}

interface FinanceBrief {
  pfi_status: string | null;
  pfi_amount: string | null;
  pfi_currency: string | null;
  invoice_status: string | null;
}

interface OperationContext {
  id: string;
  operation_number: string;
  type: string;
  status: string;
  expected_volume_mt: string | null;
  actual_volume_mt: string | null;
  notes: string | null;
  trucks: TruckOpBrief[];
  bdn: BdnBrief | null;
  finance: FinanceBrief;
  document_count: number;
}

interface CargoEntry {
  id: string;
  entry_type: string;
  quantity_mt: string;
  rob_before_mt: string;
  rob_after_mt: string;
  source_description: string | null;
  notes: string | null;
  recorded_by_name: string;
  recorded_by_role: string;
  created_at: string;
  operation: OperationContext | null;
}

interface CargoLedger {
  entries: CargoEntry[];
  total: number;
  summary: {
    total_replenishments_mt: string;
    total_discharges_mt: string;
    current_rob_mt: string;
    capacity_mt: string | null;
  };
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function RobGauge({
  currentRob,
  capacity,
  threshold,
}: {
  currentRob: number;
  capacity: number;
  threshold: number;
}) {
  const pct = capacity > 0 ? Math.min(100, (currentRob / capacity) * 100) : 0;
  const belowThreshold = currentRob <= threshold && threshold > 0;

  // Same emerald/amber/rose values already used for meaning elsewhere (see
  // KpiCard's spark colours) — reused here rather than introducing new hex.
  const fillColor = belowThreshold
    ? "rgb(244 63 94)"
    : pct > 50
    ? "rgb(16 185 129)"
    : "rgb(245 158 11)";

  const chartData = [{ name: "ROB", value: pct, fill: fillColor }];

  return (
    <div className="flex flex-col items-center">
      <div className="relative h-20 w-40 overflow-hidden">
        <ResponsiveContainer width="100%" height={160}>
          <RadialBarChart
            cx="50%"
            cy="50%"
            innerRadius="60%"
            outerRadius="100%"
            startAngle={180}
            endAngle={0}
            data={chartData}
          >
            <RadialBar
              background={{ fill: "var(--muted)" }}
              dataKey="value"
              cornerRadius={6}
            />
            <Tooltip
              formatter={(v) => [`${Number(v ?? 0).toFixed(1)}%`, "ROB Level"]}
            />
          </RadialBarChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-end pb-1">
          <span className={cn("text-xl font-bold tabular-nums", belowThreshold ? "text-rose-500" : "text-foreground")}>
            {pct.toFixed(0)}%
          </span>
        </div>
      </div>
      <div className="mt-1 text-center">
        <p className={cn("text-[13px] font-semibold tabular-nums", belowThreshold ? "text-rose-500" : "text-foreground")}>
          {formatNumber(currentRob)} L
        </p>
        <p className="text-[11px] text-muted-foreground">
          of {formatNumber(capacity)} L capacity
        </p>
        {belowThreshold && (
          <Badge variant="destructive" className="mt-1 rounded-md text-[10px]">
            Below Threshold ({formatNumber(threshold)} L)
          </Badge>
        )}
      </div>
    </div>
  );
}

function CargoEntryRow({ entry }: { entry: CargoEntry }) {
  const [expanded, setExpanded] = useState(false);
  const typeCfg = ENTRY_TYPE_CONFIG[entry.entry_type] ?? {
    label: entry.entry_type,
    icon: <Activity className="h-3.5 w-3.5" strokeWidth={2} />,
    tone: "slate" as AccentTone,
  };
  const qty = parseFloat(entry.quantity_mt);
  const isNeg = qty < 0;

  return (
    <AccordionRow
      open={expanded}
      onToggle={() => setExpanded((v) => !v)}
      summary={
        <>
          <span className={cn("inline-flex shrink-0 items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-medium", TONE_TILE_CLASSES[typeCfg.tone])}>
            {typeCfg.icon}
            {typeCfg.label}
          </span>

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-baseline gap-2">
              <span className={cn("text-[13px] font-bold tabular-nums", isNeg ? "text-rose-500" : "text-emerald-600")}>
                {isNeg ? "" : "+"}{formatNumber(Math.abs(qty))} L
              </span>
              <span className="text-[11.5px] text-muted-foreground">
                ROB: {formatNumber(parseFloat(entry.rob_before_mt))} → {formatNumber(parseFloat(entry.rob_after_mt))} L
              </span>
              {entry.operation && (
                <span className="font-mono text-[11.5px] text-brand-600">
                  {entry.operation.operation_number}
                </span>
              )}
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-3 text-[11px] text-muted-foreground">
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {formatDateTime(entry.created_at)}
              </span>
              <span>
                By <span className="font-medium text-foreground">{entry.recorded_by_name}</span>
                {" "}({ROLE_LABEL[entry.recorded_by_role] ?? entry.recorded_by_role})
              </span>
              {entry.source_description && (
                <span className="max-w-[200px] truncate">{entry.source_description}</span>
              )}
            </div>
          </div>
        </>
      }
    >
      {entry.operation && <OperationContext op={entry.operation} />}
    </AccordionRow>
  );
}

function OperationContext({ op }: { op: OperationContext }) {
  const statusColor = OP_STATUS_COLOR[op.status] ?? "bg-muted text-muted-foreground";

  return (
    <div className="space-y-4 pt-1">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="text-[11.5px] font-semibold text-muted-foreground">Operation</span>
          <Link
            href={`/operations/${op.id}`}
            className="flex items-center gap-1 font-mono text-[13px] font-semibold text-brand-600 hover:underline"
            onClick={(e) => e.stopPropagation()}
          >
            {op.operation_number}
            <ChevronRight className="h-3.5 w-3.5" />
          </Link>
          <span className="text-[11px] capitalize text-muted-foreground">
            {op.type.replace(/_/g, " ")}
          </span>
        </div>
        <span className={cn("rounded-md px-2 py-0.5 text-[11px] font-semibold capitalize", statusColor)}>
          {op.status.replace(/_/g, " ")}
        </span>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="space-y-1.5">
          <p className="flex items-center gap-1 text-[11px] font-semibold text-muted-foreground">
            <Truck className="h-3 w-3" /> Trucks ({op.trucks.length})
          </p>
          {op.trucks.length === 0 ? (
            <p className="text-[11px] text-muted-foreground/60">No trucks assigned</p>
          ) : (
            <div className="space-y-1">
              {op.trucks.map((t, i) => (
                <div key={i} className="rounded-lg border border-navy-100 bg-card px-2 py-1.5 text-[11px] dark:border-border">
                  <p className="font-mono font-semibold text-foreground">{t.truck_number}</p>
                  <p className="capitalize text-muted-foreground">{t.status.replace(/_/g, " ")}</p>
                  {t.quantity_loaded_mt && (
                    <p className="text-muted-foreground">
                      Loaded: <span className="font-medium text-foreground">{formatNumber(parseFloat(t.quantity_loaded_mt))} L</span>
                      {t.quantity_discharged_mt && (
                        <> · Discharged: <span className="font-medium text-foreground">{formatNumber(parseFloat(t.quantity_discharged_mt))} L</span></>
                      )}
                    </p>
                  )}
                  {t.loading_location && (
                    <p className="truncate text-muted-foreground">{t.loading_location} → {t.discharge_location ?? "—"}</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="space-y-1.5">
          <p className="flex items-center gap-1 text-[11px] font-semibold text-muted-foreground">
            <FileText className="h-3 w-3" /> BDN
          </p>
          {op.bdn ? (
            <div className="rounded-lg border border-navy-100 bg-card px-2 py-1.5 text-[11px] dark:border-border">
              <p className="font-mono font-semibold text-foreground">{op.bdn.bdn_number}</p>
              <p className={cn("font-medium capitalize", BDN_STATUS_CONFIG[op.bdn.status]?.color ?? "")}>
                {BDN_STATUS_CONFIG[op.bdn.status]?.label ?? op.bdn.status}
              </p>
              <p className="text-muted-foreground">
                <span className="font-medium text-foreground">{formatNumber(parseFloat(op.bdn.quantity_delivered_mt))} L</span> delivered
              </p>
              {op.bdn.delivery_date && (
                <p className="text-muted-foreground">{formatDate(op.bdn.delivery_date)}</p>
              )}
            </div>
          ) : (
            <p className="text-[11px] text-muted-foreground/60">No BDN yet</p>
          )}
        </div>

        <div className="space-y-1.5">
          <p className="flex items-center gap-1 text-[11px] font-semibold text-muted-foreground">
            <Banknote className="h-3 w-3" /> Finance
          </p>
          <div className="space-y-0.5 rounded-lg border border-navy-100 bg-card px-2 py-1.5 text-[11px] dark:border-border">
            {op.finance.pfi_status ? (
              <>
                <p className="text-muted-foreground">
                  PFI: <span className="font-medium capitalize text-foreground">{op.finance.pfi_status.replace(/_/g, " ")}</span>
                </p>
                {op.finance.pfi_amount && (
                  <p className="text-muted-foreground">
                    Amount: <span className="font-medium text-foreground">{op.finance.pfi_currency} {parseFloat(op.finance.pfi_amount).toLocaleString()}</span>
                  </p>
                )}
              </>
            ) : (
              <p className="text-muted-foreground/60">No PFI linked</p>
            )}
            {op.finance.invoice_status ? (
              <p className="text-muted-foreground">
                Invoice: <span className="font-medium capitalize text-foreground">{op.finance.invoice_status.replace(/_/g, " ")}</span>
              </p>
            ) : (
              <p className="text-muted-foreground/60">No invoice yet</p>
            )}
          </div>

          <p className="mt-2 flex items-center gap-1 text-[11px] font-semibold text-muted-foreground">
            <FolderOpen className="h-3 w-3" /> Documents
          </p>
          <div className="rounded-lg border border-navy-100 bg-card px-2 py-1.5 text-[11px] dark:border-border">
            {op.document_count > 0 ? (
              <Link
                href={`/operations/${op.id}`}
                className="text-brand-600 hover:underline"
                onClick={(e) => e.stopPropagation()}
              >
                {op.document_count} document{op.document_count !== 1 ? "s" : ""} — view in operation
              </Link>
            ) : (
              <p className="text-muted-foreground/60">No documents</p>
            )}
          </div>
        </div>
      </div>

      {op.notes && (
        <p className="border-t border-border/60 pt-2 text-[11px] italic text-muted-foreground">{op.notes}</p>
      )}
    </div>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────────

export default function VesselProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [activeTab, setActiveTab] = useState<"deliveries" | "cargo-ledger">("deliveries");
  const [ledgerPage, setLedgerPage] = useState(1);

  const { data: vessel, isLoading: vesselLoading } = useQuery({
    queryKey: ["vessel", id],
    queryFn: async () => {
      const res = await api.get<ApiResponse<Vessel>>(`/vessels/${id}`);
      return res.data.data;
    },
  });

  const { data: bdnData, isLoading: bdnLoading } = useQuery({
    queryKey: ["vessel-bdns", id],
    queryFn: async () => {
      const res = await api.get<ApiResponse<VesselBDNs>>(`/vessels/${id}/bdns`);
      return res.data.data;
    },
    enabled: !!vessel,
  });

  const { data: ledgerData, isLoading: ledgerLoading } = useQuery({
    queryKey: ["vessel-cargo-ledger", id, ledgerPage],
    queryFn: async () => {
      const res = await api.get<ApiResponse<CargoLedger>>(
        `/vessels/${id}/cargo-ledger?page=${ledgerPage}&per_page=20`
      );
      return res.data.data;
    },
    enabled: !!vessel && activeTab === "cargo-ledger",
  });

  if (vesselLoading) {
    return (
      <DashboardShell bare>
        <div className="space-y-4">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-9 w-64" />
          <Skeleton className="h-40 w-full rounded-2xl" />
          <Skeleton className="h-64 w-full rounded-2xl" />
        </div>
      </DashboardShell>
    );
  }

  if (!vessel) {
    return (
      <DashboardShell bare>
        <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 text-center">
          <AlertTriangle className="h-10 w-10 text-muted-foreground/30" strokeWidth={1.5} />
          <p className="text-sm text-muted-foreground">Vessel not found or failed to load.</p>
          <Link href="/fleet/vessels" className="rounded text-[13px] font-semibold text-brand-600 underline underline-offset-2 hover:text-brand-700">
            Back to Vessels
          </Link>
        </div>
      </DashboardShell>
    );
  }

  const statusCfg = VESSEL_STATUS_CONFIG[vessel.status] ?? {
    label: vessel.status,
    color: "bg-muted text-muted-foreground border-border",
  };

  const currentRob = parseFloat(vessel.current_rob_mt);
  const capacity   = vessel.capacity_mt ? parseFloat(vessel.capacity_mt) : 0;
  const threshold  = vessel.rob_threshold_mt ? parseFloat(vessel.rob_threshold_mt) : 0;
  const belowThreshold = threshold > 0 && currentRob <= threshold;

  const bdns          = bdnData?.bdns ?? [];
  const totalDelivered = bdnData?.total_delivered_mt ?? "0";
  const totalCount     = bdnData?.total_count ?? 0;

  const ledgerEntries = ledgerData?.entries ?? [];
  const ledgerTotal   = ledgerData?.total ?? 0;
  const ledgerSummary = ledgerData?.summary;
  const totalPages    = Math.ceil(ledgerTotal / 20);

  return (
    <DashboardShell bare>
      <header className="animate-rise">
        <Link
          href="/fleet/vessels"
          className="inline-flex items-center gap-1.5 rounded text-[13px] font-medium text-brand-600 transition-colors hover:text-brand-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
          <ArrowLeft className="h-3.5 w-3.5" strokeWidth={2.5} />
          Back to Vessels
        </Link>

        <div className="mt-3 flex flex-wrap items-center gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand-50 dark:bg-brand-500/15">
            <Ship className="h-5 w-5 text-brand-600 dark:text-brand-300" strokeWidth={2} />
          </span>
          <h1 className="text-[26px] font-extrabold leading-none tracking-tight text-foreground lg:text-[30px]">
            {vessel.vessel_name}
          </h1>
          <span className={cn("inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-[12px] font-semibold", statusCfg.color)}>
            {statusCfg.label}
          </span>
          {!vessel.is_active && (
            <Badge variant="destructive" className="rounded-lg">Inactive</Badge>
          )}
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          {vessel.imo_number && <MetaChip>IMO {vessel.imo_number}</MetaChip>}
          {vessel.vessel_type && <MetaChip icon={Anchor}>{vessel.vessel_type}</MetaChip>}
          {vessel.flag_state && <MetaChip>{vessel.flag_state}</MetaChip>}
          {vessel.current_location && <MetaChip icon={MapPin}>{vessel.current_location}</MetaChip>}
          {vessel.capacity_mt && <MetaChip icon={Package}>{formatNumber(parseFloat(vessel.capacity_mt))} L capacity</MetaChip>}
          {vessel.rob_threshold_mt && (
            <MetaChip icon={Gauge} className={belowThreshold ? "border-rose-200 text-rose-700 dark:border-rose-500/30 dark:text-rose-300" : undefined}>
              Alert threshold {formatNumber(parseFloat(vessel.rob_threshold_mt))} L
            </MetaChip>
          )}
        </div>
      </header>

      <div className="flex flex-col gap-4 lg:flex-row">
        {capacity > 0 && (
          <PanelCard icon={Gauge} tone="blue" title="Remaining on Board" className="animate-rise lg:w-64 lg:shrink-0" bodyClassName="flex items-center justify-center py-2">
            <RobGauge currentRob={currentRob} capacity={capacity} threshold={threshold} />
          </PanelCard>
        )}

        <div className="grid flex-1 grid-cols-2 gap-4 sm:grid-cols-3">
          <StatCard title="Total Deliveries" value={totalCount} icon={FileText} color="blue" />
          <StatCard title="Total Delivered" value={`${formatNumber(parseFloat(totalDelivered))} L`} icon={Droplets} color="emerald" />
          <StatCard
            title="Current ROB"
            value={`${formatNumber(currentRob)} L`}
            subtitle={belowThreshold ? "Below alert threshold" : undefined}
            icon={Gauge}
            color={belowThreshold ? "red" : "blue"}
          />
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as typeof activeTab)} className="animate-rise">
        <TabsList variant="underline">
          <TabsTrigger value="deliveries">BDN Deliveries</TabsTrigger>
          <TabsTrigger value="cargo-ledger">Cargo Ledger</TabsTrigger>
        </TabsList>

        <TabsContent value="deliveries" className="mt-4">
          <PanelCard
            icon={FileText}
            tone="blue"
            title="Delivery History (BDNs)"
            subtitle={bdnLoading ? "Loading…" : undefined}
            action={<span className="text-[11px] text-muted-foreground">{totalCount} records</span>}
            flush
          >
            {bdns.length === 0 ? (
              <div className="flex flex-col items-center py-12 text-center">
                <Ship className="h-8 w-8 text-muted-foreground/25" strokeWidth={1.5} />
                <p className="mt-2.5 text-sm font-medium text-foreground">No deliveries recorded yet</p>
              </div>
            ) : (
              <div className="divide-y divide-border/70">
                {bdns.map((bdn) => {
                  const sc = BDN_STATUS_CONFIG[bdn.status] ?? { label: bdn.status, color: "bg-muted text-muted-foreground" };
                  return (
                    <div key={bdn.id} className="px-4 py-4 transition-colors hover:bg-muted/30 lg:px-5">
                      <div className="mb-2 flex items-start justify-between gap-3">
                        <div className="flex min-w-0 items-center gap-2.5">
                          <span className="shrink-0 font-mono text-[13px] font-semibold text-brand-600">{bdn.bdn_number}</span>
                          <Link href={`/operations/${bdn.operation_id}`} className="flex items-center gap-0.5 truncate text-[11.5px] text-muted-foreground hover:text-brand-600 hover:underline">
                            {bdn.operation_number}<ChevronRight className="h-3 w-3" />
                          </Link>
                        </div>
                        <span className={cn("shrink-0 rounded-md px-2 py-0.5 text-[11px] font-semibold capitalize", sc.color)}>{sc.label}</span>
                      </div>
                      <div className="mb-2 flex flex-wrap gap-4 text-[12px]">
                        <div className="flex items-center gap-1.5 text-muted-foreground">
                          <Droplets className="h-3.5 w-3.5 text-brand-400" />
                          <span>Delivered: <span className="font-semibold text-foreground">{formatNumber(parseFloat(bdn.quantity_delivered_mt))} L</span></span>
                        </div>
                        {bdn.product_type && <span className="text-muted-foreground">Product: <span className="font-medium text-foreground">{bdn.product_type}</span></span>}
                        {bdn.fuel_type && <span className="text-muted-foreground">Fuel: <span className="font-medium text-foreground">{bdn.fuel_type}</span></span>}
                        {bdn.density && <span className="text-muted-foreground">Density: <span className="font-medium text-foreground">{bdn.density}</span></span>}
                        {bdn.temperature && <span className="text-muted-foreground">Temp: <span className="font-medium text-foreground">{bdn.temperature}°C</span></span>}
                      </div>
                      <div className="flex flex-wrap items-center gap-3 text-[11px] text-muted-foreground">
                        {bdn.delivery_date && (
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {formatDate(bdn.delivery_date)}
                          </span>
                        )}
                        <span className="flex items-center gap-1">
                          <Activity className="h-3 w-3" />
                          Generated by: <span className="ml-0.5 font-medium text-foreground">{bdn.generated_by_name}</span>
                          <span className="opacity-60">({ROLE_LABEL[bdn.generated_by_role] ?? bdn.generated_by_role})</span>
                        </span>
                        {bdn.reviewed_by_name && (
                          <span className="ml-auto flex items-center gap-1">
                            {bdn.status === "approved" ? <CheckCircle2 className="h-3 w-3 text-emerald-500" /> : bdn.status === "rejected" ? <XCircle className="h-3 w-3 text-rose-500" /> : null}
                            Reviewed by: <span className="ml-0.5 font-medium text-foreground">{bdn.reviewed_by_name}</span>
                          </span>
                        )}
                      </div>
                      {bdn.rejection_reason && (
                        <p className="mt-2 rounded bg-rose-50 px-2.5 py-1.5 text-[11px] text-rose-600 dark:bg-rose-500/10 dark:text-rose-400">Rejection reason: {bdn.rejection_reason}</p>
                      )}
                      {bdn.notes && <p className="mt-1.5 text-[11px] italic text-muted-foreground">{bdn.notes}</p>}
                    </div>
                  );
                })}
              </div>
            )}
          </PanelCard>
        </TabsContent>

        <TabsContent value="cargo-ledger" className="mt-4 space-y-4">
          {ledgerSummary && (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div className="rounded-xl border border-emerald-100 bg-emerald-50 p-3 dark:border-emerald-500/30 dark:bg-emerald-500/10">
                <p className="text-[11px] font-medium text-emerald-700/70 dark:text-emerald-300/80">Total Replenished</p>
                <p className="text-lg font-bold tabular-nums text-emerald-700 dark:text-emerald-300">+{formatNumber(parseFloat(ledgerSummary.total_replenishments_mt))} L</p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-500/30 dark:bg-slate-500/10">
                <p className="text-[11px] font-medium text-slate-600/70 dark:text-slate-300/80">Total Discharged</p>
                <p className="text-lg font-bold tabular-nums text-slate-700 dark:text-slate-300">−{formatNumber(parseFloat(ledgerSummary.total_discharges_mt))} L</p>
              </div>
              <div className="rounded-xl border border-brand-100 bg-brand-50 p-3 dark:border-brand-500/30 dark:bg-brand-500/10">
                <p className="text-[11px] font-medium text-brand-700/70 dark:text-brand-300/80">Current ROB</p>
                <p className="text-lg font-bold tabular-nums text-brand-700 dark:text-brand-300">{formatNumber(parseFloat(ledgerSummary.current_rob_mt))} L</p>
              </div>
              {ledgerSummary.capacity_mt && (
                <div className="rounded-xl border border-navy-100 bg-muted/40 p-3 dark:border-border">
                  <p className="text-[11px] font-medium text-muted-foreground">Capacity</p>
                  <p className="text-lg font-bold tabular-nums text-foreground">{formatNumber(parseFloat(ledgerSummary.capacity_mt))} L</p>
                </div>
              )}
            </div>
          )}

          <PanelCard
            icon={Droplets}
            tone="blue"
            title="Cargo Movement Ledger"
            subtitle={ledgerLoading ? "Loading…" : undefined}
            action={<span className="text-[11px] text-muted-foreground">{ledgerTotal} entries · click any row to expand</span>}
            flush
          >
            {ledgerLoading ? (
              <Skeleton className="m-4 h-48 rounded-lg lg:m-5" />
            ) : ledgerEntries.length === 0 ? (
              <div className="flex flex-col items-center py-12 text-center">
                <Droplets className="h-8 w-8 text-muted-foreground/25" strokeWidth={1.5} />
                <p className="mt-2.5 text-sm font-medium text-foreground">No cargo movements recorded yet</p>
              </div>
            ) : (
              <div className="divide-y divide-border/70">
                {ledgerEntries.map((entry) => (
                  <CargoEntryRow key={entry.id} entry={entry} />
                ))}
              </div>
            )}
          </PanelCard>

          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2">
              <button
                disabled={ledgerPage <= 1}
                onClick={() => setLedgerPage((p) => p - 1)}
                className="rounded-lg border border-navy-100 px-3 py-1.5 text-xs font-medium transition-colors hover:bg-muted disabled:opacity-40 dark:border-border"
              >
                Previous
              </button>
              <span className="text-xs text-muted-foreground">
                Page {ledgerPage} of {totalPages}
              </span>
              <button
                disabled={ledgerPage >= totalPages}
                onClick={() => setLedgerPage((p) => p + 1)}
                className="rounded-lg border border-navy-100 px-3 py-1.5 text-xs font-medium transition-colors hover:bg-muted disabled:opacity-40 dark:border-border"
              >
                Next
              </button>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </DashboardShell>
  );
}
