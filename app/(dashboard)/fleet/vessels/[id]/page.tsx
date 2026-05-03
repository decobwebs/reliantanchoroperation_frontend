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
  Loader2,
  AlertTriangle,
  FileText,
  Droplets,
  Anchor,
  ChevronRight,
  ChevronDown,
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
import { Header } from "@/components/layout/Header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatNumber } from "@/lib/utils";
import type { ApiResponse, Vessel, VesselBDNs } from "@/types";

// ── Config maps ────────────────────────────────────────────────────────────────

const VESSEL_STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  available:      { label: "Available",      color: "bg-emerald-100 text-emerald-700 border-emerald-200" },
  in_operation:   { label: "In Operation",   color: "bg-blue-100 text-blue-700 border-blue-200" },
  maintenance:    { label: "Maintenance",    color: "bg-amber-100 text-amber-700 border-amber-200" },
  out_of_service: { label: "Out of Service", color: "bg-red-100 text-red-700 border-red-200" },
};

const BDN_STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  draft:    { label: "Draft",    color: "bg-gray-100 text-gray-600" },
  pending:  { label: "Pending",  color: "bg-amber-100 text-amber-700" },
  approved: { label: "Approved", color: "bg-emerald-100 text-emerald-700" },
  rejected: { label: "Rejected", color: "bg-red-100 text-red-700" },
};

const ROLE_LABEL: Record<string, string> = {
  bunker_manager:  "Bunker Manager",
  ops_supervisor:  "Ops Supervisor",
  marine_manager:  "Marine Manager",
};

const ENTRY_TYPE_CONFIG: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
  discharge:      { label: "Discharge",      icon: <TrendingDown className="w-3.5 h-3.5" />, color: "text-red-500 bg-red-50 border-red-100" },
  replenishment:  { label: "Replenishment",  icon: <TrendingUp   className="w-3.5 h-3.5" />, color: "text-emerald-600 bg-emerald-50 border-emerald-100" },
  initial:        { label: "Initial Load",   icon: <Package       className="w-3.5 h-3.5" />, color: "text-blue-600 bg-blue-50 border-blue-100" },
  adjustment:     { label: "Adjustment",     icon: <RotateCcw     className="w-3.5 h-3.5" />, color: "text-amber-600 bg-amber-50 border-amber-100" },
  correction:     { label: "Correction",     icon: <RotateCcw     className="w-3.5 h-3.5" />, color: "text-purple-600 bg-purple-50 border-purple-100" },
};

const OP_STATUS_COLOR: Record<string, string> = {
  draft:              "bg-gray-100 text-gray-600",
  tasks_assigned:     "bg-blue-50 text-blue-700",
  awaiting_feedback:  "bg-amber-50 text-amber-700",
  feedback_submitted: "bg-amber-50 text-amber-700",
  feedback_approved:  "bg-emerald-50 text-emerald-700",
  feedback_rejected:  "bg-red-50 text-red-700",
  pfi_linked:         "bg-blue-50 text-blue-700",
  payment_processing: "bg-amber-50 text-amber-700",
  payment_confirmed:  "bg-emerald-50 text-emerald-700",
  vessel_operations:  "bg-blue-50 text-blue-700",
  bdn_pending:        "bg-amber-50 text-amber-700",
  bdn_approved:       "bg-emerald-50 text-emerald-700",
  invoiced:           "bg-purple-50 text-purple-700",
  completed:          "bg-emerald-100 text-emerald-700",
  cancelled:          "bg-red-100 text-red-600",
  archived:           "bg-gray-100 text-gray-500",
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

function StatPill({
  label,
  value,
  sub,
  color = "blue",
}: {
  label: string;
  value: string | number;
  sub?: string;
  color?: "blue" | "emerald" | "red" | "amber";
}) {
  const colors = {
    blue:    "bg-blue-50 border-blue-100 text-blue-700",
    emerald: "bg-emerald-50 border-emerald-100 text-emerald-700",
    red:     "bg-red-50 border-red-100 text-red-700",
    amber:   "bg-amber-50 border-amber-100 text-amber-700",
  };
  return (
    <div className={`rounded-xl border p-4 ${colors[color]}`}>
      <p className="text-xs font-medium opacity-70 mb-1">{label}</p>
      <p className="text-2xl font-bold tabular-nums">{value}</p>
      {sub && <p className="text-[11px] opacity-60 mt-0.5">{sub}</p>}
    </div>
  );
}

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

  const fillColor = belowThreshold
    ? "#ef4444"
    : pct > 50
    ? "#10b981"
    : "#f59e0b";

  const chartData = [{ name: "ROB", value: pct, fill: fillColor }];

  return (
    <div className="flex flex-col items-center">
      <div className="relative w-40 h-20 overflow-hidden">
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
              background={{ fill: "#f1f5f9" }}
              dataKey="value"
              cornerRadius={6}
            />
            <Tooltip
              formatter={(v) => [`${Number(v ?? 0).toFixed(1)}%`, "ROB Level"]}
            />
          </RadialBarChart>
        </ResponsiveContainer>
        <div className="absolute inset-0 flex flex-col items-center justify-end pb-1 pointer-events-none">
          <span className={`text-xl font-bold tabular-nums ${belowThreshold ? "text-red-500" : "text-foreground"}`}>
            {pct.toFixed(0)}%
          </span>
        </div>
      </div>
      <div className="text-center mt-1">
        <p className={`text-sm font-semibold tabular-nums ${belowThreshold ? "text-red-500" : "text-foreground"}`}>
          {formatNumber(currentRob)} MT
        </p>
        <p className="text-[11px] text-muted-foreground">
          of {formatNumber(capacity)} MT capacity
        </p>
        {belowThreshold && (
          <Badge variant="destructive" className="mt-1 text-[10px]">
            Below Threshold ({formatNumber(threshold)} MT)
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
    icon: <Activity className="w-3.5 h-3.5" />,
    color: "text-gray-600 bg-gray-50 border-gray-100",
  };
  const qty = parseFloat(entry.quantity_mt);
  const isNeg = qty < 0;

  return (
    <div className="border-b last:border-0">
      {/* Main row — click to expand */}
      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full text-left px-5 py-4 hover:bg-muted/30 transition-colors"
      >
        <div className="flex items-start gap-3">
          {/* Entry type badge */}
          <span className={`inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded border shrink-0 mt-0.5 ${typeCfg.color}`}>
            {typeCfg.icon}
            {typeCfg.label}
          </span>

          <div className="flex-1 min-w-0">
            {/* Quantity + ROB flow */}
            <div className="flex items-baseline gap-2 flex-wrap">
              <span className={`text-sm font-bold tabular-nums ${isNeg ? "text-red-500" : "text-emerald-600"}`}>
                {isNeg ? "" : "+"}{formatNumber(Math.abs(qty))} MT
              </span>
              <span className="text-xs text-muted-foreground">
                ROB: {formatNumber(parseFloat(entry.rob_before_mt))} → {formatNumber(parseFloat(entry.rob_after_mt))} MT
              </span>
              {entry.operation && (
                <span className="text-xs font-mono text-primary">
                  {entry.operation.operation_number}
                </span>
              )}
            </div>
            {/* Meta row */}
            <div className="flex flex-wrap items-center gap-3 mt-1 text-[11px] text-muted-foreground">
              <span className="flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {new Date(entry.created_at).toLocaleString("en-GB", {
                  day: "2-digit", month: "short", year: "numeric",
                  hour: "2-digit", minute: "2-digit",
                })}
              </span>
              <span>
                By <span className="font-medium text-foreground">{entry.recorded_by_name}</span>
                {" "}({ROLE_LABEL[entry.recorded_by_role] ?? entry.recorded_by_role})
              </span>
              {entry.source_description && (
                <span className="truncate max-w-[200px]">{entry.source_description}</span>
              )}
            </div>
          </div>

          {entry.operation && (
            <ChevronDown className={`w-4 h-4 text-muted-foreground shrink-0 transition-transform mt-1 ${expanded ? "rotate-180" : ""}`} />
          )}
        </div>
      </button>

      {/* Expanded operation context */}
      {expanded && entry.operation && (
        <div className="px-5 pb-4 bg-muted/20 border-t border-border/50">
          <OperationContext op={entry.operation} />
        </div>
      )}
    </div>
  );
}

function OperationContext({ op }: { op: OperationContext }) {
  const statusColor = OP_STATUS_COLOR[op.status] ?? "bg-gray-100 text-gray-600";

  return (
    <div className="pt-3 space-y-4">
      {/* Operation header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-muted-foreground">Operation</span>
          <Link
            href={`/operations/${op.id}`}
            className="text-sm font-mono font-semibold text-primary hover:underline flex items-center gap-1"
            onClick={(e) => e.stopPropagation()}
          >
            {op.operation_number}
            <ChevronRight className="w-3.5 h-3.5" />
          </Link>
          <span className="text-[11px] capitalize text-muted-foreground">
            {op.type.replace(/_/g, " ")}
          </span>
        </div>
        <span className={`text-[11px] font-medium px-2 py-0.5 rounded capitalize ${statusColor}`}>
          {op.status.replace(/_/g, " ")}
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {/* Trucks */}
        <div className="space-y-1.5">
          <p className="text-[11px] font-semibold text-muted-foreground flex items-center gap-1">
            <Truck className="w-3 h-3" /> Trucks ({op.trucks.length})
          </p>
          {op.trucks.length === 0 ? (
            <p className="text-[11px] text-muted-foreground/60">No trucks assigned</p>
          ) : (
            <div className="space-y-1">
              {op.trucks.map((t, i) => (
                <div key={i} className="text-[11px] rounded bg-background border border-border/60 px-2 py-1.5">
                  <p className="font-semibold font-mono">{t.truck_number}</p>
                  <p className="text-muted-foreground capitalize">{t.status.replace(/_/g, " ")}</p>
                  {t.quantity_loaded_mt && (
                    <p className="text-muted-foreground">
                      Loaded: <span className="text-foreground font-medium">{formatNumber(parseFloat(t.quantity_loaded_mt))} MT</span>
                      {t.quantity_discharged_mt && (
                        <> · Discharged: <span className="text-foreground font-medium">{formatNumber(parseFloat(t.quantity_discharged_mt))} MT</span></>
                      )}
                    </p>
                  )}
                  {t.loading_location && (
                    <p className="text-muted-foreground truncate">{t.loading_location} → {t.discharge_location ?? "—"}</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* BDN */}
        <div className="space-y-1.5">
          <p className="text-[11px] font-semibold text-muted-foreground flex items-center gap-1">
            <FileText className="w-3 h-3" /> BDN
          </p>
          {op.bdn ? (
            <div className="text-[11px] rounded bg-background border border-border/60 px-2 py-1.5">
              <p className="font-semibold font-mono">{op.bdn.bdn_number}</p>
              <p className={`capitalize font-medium ${BDN_STATUS_CONFIG[op.bdn.status]?.color ?? ""}`}>
                {BDN_STATUS_CONFIG[op.bdn.status]?.label ?? op.bdn.status}
              </p>
              <p className="text-muted-foreground">
                <span className="text-foreground font-medium">{formatNumber(parseFloat(op.bdn.quantity_delivered_mt))} MT</span> delivered
              </p>
              {op.bdn.delivery_date && (
                <p className="text-muted-foreground">
                  {new Date(op.bdn.delivery_date).toLocaleDateString("en-GB", {
                    day: "2-digit", month: "short", year: "numeric",
                  })}
                </p>
              )}
            </div>
          ) : (
            <p className="text-[11px] text-muted-foreground/60">No BDN yet</p>
          )}
        </div>

        {/* Finance + Docs */}
        <div className="space-y-1.5">
          <p className="text-[11px] font-semibold text-muted-foreground flex items-center gap-1">
            <Banknote className="w-3 h-3" /> Finance
          </p>
          <div className="text-[11px] rounded bg-background border border-border/60 px-2 py-1.5 space-y-0.5">
            {op.finance.pfi_status ? (
              <>
                <p className="text-muted-foreground">
                  PFI: <span className="font-medium text-foreground capitalize">{op.finance.pfi_status.replace(/_/g, " ")}</span>
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
                Invoice: <span className="font-medium text-foreground capitalize">{op.finance.invoice_status.replace(/_/g, " ")}</span>
              </p>
            ) : (
              <p className="text-muted-foreground/60">No invoice yet</p>
            )}
          </div>

          <p className="text-[11px] font-semibold text-muted-foreground flex items-center gap-1 mt-2">
            <FolderOpen className="w-3 h-3" /> Documents
          </p>
          <div className="text-[11px] rounded bg-background border border-border/60 px-2 py-1.5">
            {op.document_count > 0 ? (
              <Link
                href={`/operations/${op.id}`}
                className="text-primary hover:underline"
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
        <p className="text-[11px] text-muted-foreground italic border-t border-border/50 pt-2">{op.notes}</p>
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
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!vessel) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-muted-foreground gap-3">
        <AlertTriangle className="w-10 h-10 opacity-30" />
        <p className="text-sm">Vessel not found or failed to load.</p>
        <Link href="/fleet/vessels" className="text-xs text-primary underline">Back to Vessels</Link>
      </div>
    );
  }

  const statusCfg = VESSEL_STATUS_CONFIG[vessel.status] ?? {
    label: vessel.status,
    color: "bg-gray-100 text-gray-700 border-gray-200",
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
    <div>
      <Header
        title={vessel.vessel_name}
        subtitle="Vessel Profile"
        actions={
          <Link href="/fleet/vessels">
            <button className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
              <ArrowLeft className="w-4 h-4" />
              Back to Vessels
            </button>
          </Link>
        }
      />

      <div className="p-6 space-y-6 max-w-6xl">

        {/* ── Hero card ── */}
        <Card className="border-0 shadow-sm overflow-hidden">
          <div className="bg-linear-to-br from-primary/8 via-primary/4 to-transparent p-6">
            <div className="flex flex-col md:flex-row gap-6">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2.5 mb-1">
                  <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                    <Ship className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold">{vessel.vessel_name}</h2>
                    {vessel.imo_number && (
                      <p className="text-xs text-muted-foreground font-mono">IMO {vessel.imo_number}</p>
                    )}
                  </div>
                  <span className={`ml-2 inline-flex items-center text-xs font-medium px-2.5 py-1 rounded-full border ${statusCfg.color}`}>
                    {statusCfg.label}
                  </span>
                  {!vessel.is_active && (
                    <Badge variant="destructive" className="text-[10px]">Inactive</Badge>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-x-6 gap-y-2 mt-4">
                  {vessel.vessel_type && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Anchor className="w-3.5 h-3.5 shrink-0" />
                      <span>{vessel.vessel_type}</span>
                    </div>
                  )}
                  {vessel.flag_state && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <span className="w-3 h-3 rounded-full bg-muted-foreground/30 shrink-0" />
                      <span>{vessel.flag_state}</span>
                    </div>
                  )}
                  {vessel.current_location && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <MapPin className="w-3.5 h-3.5 shrink-0" />
                      <span>{vessel.current_location}</span>
                    </div>
                  )}
                  {vessel.capacity_mt && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Package className="w-3.5 h-3.5 shrink-0" />
                      <span>Capacity: <span className="font-semibold text-foreground">{formatNumber(parseFloat(vessel.capacity_mt))} MT</span></span>
                    </div>
                  )}
                  {vessel.rob_threshold_mt && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Gauge className="w-3.5 h-3.5 shrink-0" />
                      <span>Alert threshold: <span className={`font-semibold ${belowThreshold ? "text-red-500" : "text-foreground"}`}>{formatNumber(parseFloat(vessel.rob_threshold_mt))} MT</span></span>
                    </div>
                  )}
                </div>
              </div>

              {capacity > 0 && (
                <div className="flex flex-col items-center justify-center shrink-0">
                  <p className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1">
                    <Gauge className="w-3.5 h-3.5" />
                    Remaining on Board
                  </p>
                  <RobGauge currentRob={currentRob} capacity={capacity} threshold={threshold} />
                </div>
              )}
            </div>
          </div>
        </Card>

        {/* ── Stats strip ── */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          <StatPill label="Total Deliveries" value={totalCount} color="blue" />
          <StatPill
            label="Total Delivered"
            value={`${formatNumber(parseFloat(totalDelivered))} MT`}
            color="emerald"
          />
          <StatPill
            label="Current ROB"
            value={`${formatNumber(currentRob)} MT`}
            color={belowThreshold ? "red" : "blue"}
            sub={belowThreshold ? "Below alert threshold" : undefined}
          />
        </div>

        {/* ── Tabs ── */}
        <div className="flex gap-1 border-b border-border">
          <button
            onClick={() => setActiveTab("deliveries")}
            className={`px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px ${
              activeTab === "deliveries"
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <span className="flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5" />
              BDN Deliveries
            </span>
          </button>
          <button
            onClick={() => setActiveTab("cargo-ledger")}
            className={`px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px ${
              activeTab === "cargo-ledger"
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <span className="flex items-center gap-1.5">
              <Droplets className="w-3.5 h-3.5" />
              Cargo Ledger
            </span>
          </button>
        </div>

        {/* ── BDN Deliveries tab ── */}
        {activeTab === "deliveries" && (
          <Card className="border-0 shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <FileText className="w-4 h-4 text-muted-foreground" />
                Delivery History (BDNs)
                {bdnLoading && <Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground" />}
                <span className="ml-auto text-xs font-normal text-muted-foreground">{totalCount} records</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {bdns.length === 0 ? (
                <div className="flex flex-col items-center py-12 text-muted-foreground">
                  <Ship className="w-8 h-8 opacity-25 mb-2" />
                  <p className="text-sm">No deliveries recorded yet</p>
                </div>
              ) : (
                <div className="divide-y">
                  {bdns.map((bdn) => {
                    const sc = BDN_STATUS_CONFIG[bdn.status] ?? { label: bdn.status, color: "bg-gray-100 text-gray-600" };
                    return (
                      <div key={bdn.id} className="px-5 py-4 hover:bg-muted/30 transition-colors">
                        <div className="flex items-start justify-between gap-3 mb-2">
                          <div className="flex items-center gap-2.5 min-w-0">
                            <span className="text-sm font-semibold font-mono text-primary shrink-0">{bdn.bdn_number}</span>
                            <Link href={`/operations/${bdn.operation_id}`} className="text-xs text-muted-foreground hover:text-primary hover:underline truncate">
                              {bdn.operation_number}<ChevronRight className="w-3 h-3 inline" />
                            </Link>
                          </div>
                          <span className={`text-[11px] font-medium px-2 py-0.5 rounded capitalize shrink-0 ${sc.color}`}>{sc.label}</span>
                        </div>
                        <div className="flex flex-wrap gap-4 text-xs mb-2">
                          <div className="flex items-center gap-1.5 text-muted-foreground">
                            <Droplets className="w-3.5 h-3.5 text-blue-400" />
                            <span>Delivered: <span className="font-semibold text-foreground">{formatNumber(parseFloat(bdn.quantity_delivered_mt))} MT</span></span>
                          </div>
                          {bdn.product_type && <span className="text-muted-foreground">Product: <span className="font-medium text-foreground">{bdn.product_type}</span></span>}
                          {bdn.fuel_type && <span className="text-muted-foreground">Fuel: <span className="font-medium text-foreground">{bdn.fuel_type}</span></span>}
                          {bdn.density && <span className="text-muted-foreground">Density: <span className="font-medium text-foreground">{bdn.density}</span></span>}
                          {bdn.temperature && <span className="text-muted-foreground">Temp: <span className="font-medium text-foreground">{bdn.temperature}°C</span></span>}
                        </div>
                        <div className="flex flex-wrap items-center gap-3 text-[11px] text-muted-foreground">
                          {bdn.delivery_date && (
                            <span className="flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              {new Date(bdn.delivery_date).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}
                            </span>
                          )}
                          <span className="flex items-center gap-1">
                            <Activity className="w-3 h-3" />
                            Generated by: <span className="font-medium text-foreground ml-0.5">{bdn.generated_by_name}</span>
                            <span className="opacity-60">({ROLE_LABEL[bdn.generated_by_role] ?? bdn.generated_by_role})</span>
                          </span>
                          {bdn.reviewed_by_name && (
                            <span className="flex items-center gap-1 ml-auto">
                              {bdn.status === "approved" ? <CheckCircle2 className="w-3 h-3 text-emerald-500" /> : bdn.status === "rejected" ? <XCircle className="w-3 h-3 text-red-500" /> : null}
                              Reviewed by: <span className="font-medium text-foreground ml-0.5">{bdn.reviewed_by_name}</span>
                            </span>
                          )}
                        </div>
                        {bdn.rejection_reason && (
                          <p className="mt-2 text-[11px] text-red-500 bg-red-50 rounded px-2.5 py-1.5">Rejection reason: {bdn.rejection_reason}</p>
                        )}
                        {bdn.notes && <p className="mt-1.5 text-[11px] text-muted-foreground italic">{bdn.notes}</p>}
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* ── Cargo Ledger tab ── */}
        {activeTab === "cargo-ledger" && (
          <div className="space-y-4">
            {/* Summary strip */}
            {ledgerSummary && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="rounded-xl border bg-emerald-50 border-emerald-100 p-3">
                  <p className="text-[11px] font-medium text-emerald-700/70">Total Replenished</p>
                  <p className="text-lg font-bold tabular-nums text-emerald-700">+{formatNumber(parseFloat(ledgerSummary.total_replenishments_mt))} MT</p>
                </div>
                <div className="rounded-xl border bg-red-50 border-red-100 p-3">
                  <p className="text-[11px] font-medium text-red-700/70">Total Discharged</p>
                  <p className="text-lg font-bold tabular-nums text-red-700">−{formatNumber(parseFloat(ledgerSummary.total_discharges_mt))} MT</p>
                </div>
                <div className="rounded-xl border bg-blue-50 border-blue-100 p-3">
                  <p className="text-[11px] font-medium text-blue-700/70">Current ROB</p>
                  <p className="text-lg font-bold tabular-nums text-blue-700">{formatNumber(parseFloat(ledgerSummary.current_rob_mt))} MT</p>
                </div>
                {ledgerSummary.capacity_mt && (
                  <div className="rounded-xl border bg-gray-50 border-gray-100 p-3">
                    <p className="text-[11px] font-medium text-gray-600/70">Capacity</p>
                    <p className="text-lg font-bold tabular-nums text-gray-700">{formatNumber(parseFloat(ledgerSummary.capacity_mt))} MT</p>
                  </div>
                )}
              </div>
            )}

            <Card className="border-0 shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Droplets className="w-4 h-4 text-muted-foreground" />
                  Cargo Movement Ledger
                  {ledgerLoading && <Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground" />}
                  <span className="ml-auto text-xs font-normal text-muted-foreground">{ledgerTotal} entries · click any row to expand</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {ledgerLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="w-7 h-7 animate-spin text-primary" />
                  </div>
                ) : ledgerEntries.length === 0 ? (
                  <div className="flex flex-col items-center py-12 text-muted-foreground">
                    <Droplets className="w-8 h-8 opacity-25 mb-2" />
                    <p className="text-sm">No cargo movements recorded yet</p>
                  </div>
                ) : (
                  <div>
                    {ledgerEntries.map((entry) => (
                      <CargoEntryRow key={entry.id} entry={entry} />
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-2">
                <button
                  disabled={ledgerPage <= 1}
                  onClick={() => setLedgerPage((p) => p - 1)}
                  className="px-3 py-1.5 text-xs border rounded-lg disabled:opacity-40 hover:bg-muted transition-colors"
                >
                  Previous
                </button>
                <span className="text-xs text-muted-foreground">
                  Page {ledgerPage} of {totalPages}
                </span>
                <button
                  disabled={ledgerPage >= totalPages}
                  onClick={() => setLedgerPage((p) => p + 1)}
                  className="px-3 py-1.5 text-xs border rounded-lg disabled:opacity-40 hover:bg-muted transition-colors"
                >
                  Next
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
