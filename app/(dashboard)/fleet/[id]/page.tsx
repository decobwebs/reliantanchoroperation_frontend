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
  XCircle,
  AlertTriangle,
  Clock,
  ChevronRight,
  Loader2,
  Fuel,
  Gauge,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Navigation,
  CalendarDays,
  Truck as TruckIcon,
  Hash,
  Droplets,
  Thermometer,
  BarChart3,
} from "lucide-react";
import { api } from "@/lib/api";
import { Header } from "@/components/layout/Header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatNumber } from "@/lib/utils";
import type { ApiResponse, TruckProfile } from "@/types";

const STATUS_COLOR: Record<string, { pill: string; bg: string; dot: string }> = {
  available:      { pill: "bg-emerald-100 text-emerald-700 border-emerald-200", bg: "from-emerald-600 to-emerald-700", dot: "bg-emerald-400" },
  assigned:       { pill: "bg-blue-100 text-blue-700 border-blue-200",         bg: "from-blue-600 to-blue-700",       dot: "bg-blue-400" },
  in_transit:     { pill: "bg-amber-100 text-amber-700 border-amber-200",      bg: "from-amber-500 to-amber-600",     dot: "bg-amber-400" },
  discharging:    { pill: "bg-purple-100 text-purple-700 border-purple-200",   bg: "from-purple-600 to-purple-700",   dot: "bg-purple-400" },
  maintenance:    { pill: "bg-orange-100 text-orange-700 border-orange-200",   bg: "from-orange-500 to-orange-600",   dot: "bg-orange-400" },
  out_of_service: { pill: "bg-red-100 text-red-700 border-red-200",            bg: "from-red-600 to-red-700",         dot: "bg-red-400" },
};

const OP_STATUS_COLOR: Record<string, string> = {
  completed:  "bg-emerald-100 text-emerald-700",
  cancelled:  "bg-red-100 text-red-700",
  in_transit: "bg-amber-100 text-amber-700",
  discharging:"bg-purple-100 text-purple-700",
  assigned:   "bg-blue-100 text-blue-700",
  loading:    "bg-cyan-100 text-cyan-700",
};

const ROLE_LABEL: Record<string, string> = {
  logistics_officer: "LO",
  bunker_manager:    "BM",
  ops_supervisor:    "Supervisor",
};

function EfficiencyRing({ pct }: { pct: number }) {
  const r = 36;
  const circ = 2 * Math.PI * r;
  const dash = (Math.min(pct, 100) / 100) * circ;
  const color = pct >= 95 ? "#10b981" : pct >= 80 ? "#f59e0b" : "#ef4444";
  return (
    <div className="relative w-24 h-24 shrink-0">
      <svg className="w-full h-full -rotate-90" viewBox="0 0 88 88">
        <circle cx="44" cy="44" r={r} stroke="#e5e7eb" strokeWidth="8" fill="none" />
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

function MetricCard({
  icon: Icon,
  label,
  value,
  sub,
  accent,
}: {
  icon: React.ElementType;
  label: string;
  value: string | number;
  sub?: string;
  accent: string;
}) {
  return (
    <div className="bg-white rounded-2xl border border-border/60 p-4 shadow-sm flex items-start gap-3">
      <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${accent}`}>
        <Icon className="w-4 h-4" />
      </div>
      <div className="min-w-0">
        <p className="text-[11px] text-muted-foreground font-medium mb-0.5">{label}</p>
        <p className="text-lg font-bold tabular-nums leading-tight">{value}</p>
        {sub && <p className="text-[10px] text-muted-foreground mt-0.5">{sub}</p>}
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

function formatDate(iso?: string): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "2-digit", month: "short", year: "numeric",
  });
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
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-muted-foreground gap-3">
        <AlertTriangle className="w-10 h-10 opacity-30" />
        <p className="text-sm">Truck not found or failed to load.</p>
        <Link href="/fleet" className="text-xs text-primary underline">Back to Fleet</Link>
      </div>
    );
  }

  const { truck, stats, history } = data;
  const statusDef = STATUS_COLOR[truck.status] ?? {
    pill: "bg-gray-100 text-gray-700 border-gray-200",
    bg:   "from-gray-600 to-gray-700",
    dot:  "bg-gray-400",
  };
  const effPct   = stats.efficiency_pct ?? null;
  const varNum   = parseFloat(stats.total_variance_mt);
  const variancePositive = varNum >= 0;

  const passedAudits  = history.filter((h) => h.events?.some((e) => e.event_type === "AUDIT_PASS")).length;
  const failedAudits  = history.filter((h) => h.events?.some((e) => e.event_type === "AUDIT_FAIL")).length;

  return (
    <div>
      <Header
        title={truck.truck_number}
        subtitle="Truck Profile"
        actions={
          <Link href="/fleet">
            <button className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
              <ArrowLeft className="w-4 h-4" />
              Back to Fleet
            </button>
          </Link>
        }
      />

      <div className="p-4 md:p-6 space-y-6 max-w-6xl">

        {/* ── HERO ── */}
        <div className={`rounded-2xl overflow-hidden shadow-md bg-linear-to-br ${statusDef.bg}`}>
          <div className="relative p-6 pb-0">
            {/* Decorative circles */}
            <div className="absolute top-0 right-0 w-64 h-64 rounded-full bg-white/5 -translate-y-1/2 translate-x-1/4 pointer-events-none" />
            <div className="absolute bottom-0 left-1/3 w-40 h-40 rounded-full bg-white/5 translate-y-1/2 pointer-events-none" />

            <div className="relative flex flex-col sm:flex-row gap-5">
              {/* Photo / Avatar */}
              <div className="shrink-0">
                {truck.photo_url ? (
                  <img
                    src={truck.photo_url}
                    alt={truck.truck_number}
                    className="w-32 h-32 rounded-2xl object-cover border-4 border-white/30 shadow-lg"
                  />
                ) : (
                  <div className="w-32 h-32 rounded-2xl border-4 border-white/20 bg-white/10 backdrop-blur-sm flex flex-col items-center justify-center shadow-lg">
                    <TruckIcon className="w-14 h-14 text-white/70" />
                  </div>
                )}
              </div>

              {/* Identity */}
              <div className="flex-1 min-w-0 text-white">
                {/* Registration plate */}
                <div className="inline-flex items-center gap-2 bg-black/30 backdrop-blur-sm border border-white/20 rounded-xl px-4 py-2 mb-3 shadow">
                  <Hash className="w-4 h-4 text-yellow-300 shrink-0" />
                  <span className="font-mono font-black text-2xl tracking-widest text-yellow-300 drop-shadow">
                    {truck.truck_number}
                  </span>
                </div>

                <div className="flex flex-wrap gap-2 mb-4">
                  {/* Live status */}
                  <span className="inline-flex items-center gap-1.5 bg-white/15 backdrop-blur-sm text-white text-xs font-medium px-3 py-1.5 rounded-full border border-white/20 capitalize">
                    <span className={`w-2 h-2 rounded-full ${statusDef.dot} ${truck.status === "in_transit" ? "animate-pulse" : ""}`} />
                    {truck.status.replace(/_/g, " ")}
                  </span>
                  {!truck.is_active && (
                    <span className="inline-flex items-center bg-red-900/60 text-red-200 text-xs font-medium px-3 py-1.5 rounded-full border border-red-400/30">
                      Inactive
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm text-white/80">
                  <div className="flex items-center gap-2">
                    <Package className="w-3.5 h-3.5 text-white/50 shrink-0" />
                    <span>Capacity: <span className="font-bold text-white">{formatNumber(parseFloat(truck.capacity_mt))} MT</span></span>
                  </div>
                  {truck.driver_name && (
                    <div className="flex items-center gap-2">
                      <User className="w-3.5 h-3.5 text-white/50 shrink-0" />
                      <span>Driver: <span className="font-bold text-white">{truck.driver_name}</span></span>
                    </div>
                  )}
                  {truck.driver_phone && (
                    <div className="flex items-center gap-2">
                      <Phone className="w-3.5 h-3.5 text-white/50 shrink-0" />
                      <span className="font-medium text-white">{truck.driver_phone}</span>
                    </div>
                  )}
                  {truck.current_location && (
                    <div className="flex items-center gap-2">
                      <MapPin className="w-3.5 h-3.5 text-white/50 shrink-0" />
                      <span className="truncate font-medium text-white">{truck.current_location}</span>
                    </div>
                  )}
                  <div className="flex items-center gap-2">
                    <CalendarDays className="w-3.5 h-3.5 text-white/50 shrink-0" />
                    <span>Registered: <span className="font-bold text-white">{formatDate(truck.created_at)}</span></span>
                  </div>
                  <div className="flex items-center gap-2">
                    <BarChart3 className="w-3.5 h-3.5 text-white/50 shrink-0" />
                    <span>Ops: <span className="font-bold text-white">{stats.total_operations}</span></span>
                  </div>
                </div>

                {truck.notes && (
                  <p className="mt-3 text-xs text-white/60 bg-black/20 rounded-lg px-3 py-2 italic">
                    {truck.notes}
                  </p>
                )}
              </div>
            </div>

            {/* Bottom wave */}
            <div className="relative mt-6 h-6 overflow-hidden">
              <svg viewBox="0 0 400 24" preserveAspectRatio="none" className="w-full h-full">
                <path d="M0,0 C100,24 300,24 400,0 L400,24 L0,24 Z" fill="white" className="dark:fill-background" />
              </svg>
            </div>
          </div>
        </div>

        {/* ── STATS + EFFICIENCY ── */}
        <div className="flex flex-col lg:flex-row gap-4">
          {/* Efficiency ring */}
          {effPct != null && (
            <Card className="border-0 shadow-sm lg:w-48 shrink-0">
              <CardContent className="p-5 flex flex-col items-center justify-center h-full gap-2">
                <EfficiencyRing pct={effPct} />
                <p className="text-xs text-muted-foreground font-medium text-center">Discharge Efficiency</p>
                <p className="text-[10px] text-muted-foreground text-center">
                  {effPct >= 95 ? "Excellent" : effPct >= 80 ? "Good" : "Needs Attention"}
                </p>
              </CardContent>
            </Card>
          )}

          {/* Metrics grid */}
          <div className="flex-1 grid grid-cols-2 md:grid-cols-3 gap-3">
            <MetricCard
              icon={TrendingUp}
              label="Total Loaded"
              value={`${formatNumber(parseFloat(stats.total_loaded_mt))} MT`}
              accent="bg-emerald-50 text-emerald-600"
            />
            <MetricCard
              icon={TrendingDown}
              label="Total Discharged"
              value={`${formatNumber(parseFloat(stats.total_discharged_mt))} MT`}
              accent="bg-blue-50 text-blue-600"
            />
            <MetricCard
              icon={Activity}
              label="Volume Variance"
              value={`${variancePositive ? "+" : ""}${formatNumber(varNum)} MT`}
              accent={variancePositive ? "bg-emerald-50 text-emerald-600" : "bg-red-50 text-red-600"}
            />
            <MetricCard
              icon={Droplets}
              label="Total Spillage"
              value={`${formatNumber(parseFloat(stats.total_spillage_mt))} MT`}
              accent={parseFloat(stats.total_spillage_mt) > 0 ? "bg-red-50 text-red-600" : "bg-gray-50 text-gray-500"}
            />
            <MetricCard
              icon={ShieldCheck}
              label="Passed Audits"
              value={passedAudits || "—"}
              accent="bg-emerald-50 text-emerald-600"
            />
            <MetricCard
              icon={ShieldAlert}
              label="Failed/Waived Audits"
              value={failedAudits || "—"}
              accent={failedAudits > 0 ? "bg-amber-50 text-amber-600" : "bg-gray-50 text-gray-500"}
            />
          </div>
        </div>

        {/* ── TABS ── */}
        <Tabs defaultValue="history">
          <TabsList className="h-9 bg-muted/60">
            <TabsTrigger value="history" className="text-xs gap-1.5">
              <Clock className="w-3.5 h-3.5" />
              Operation History
              <span className="ml-1 bg-muted text-muted-foreground rounded px-1.5 py-0.5 text-[10px] font-mono">{history.length}</span>
            </TabsTrigger>
            <TabsTrigger value="info" className="text-xs gap-1.5">
              <TruckIcon className="w-3.5 h-3.5" />
              Truck Details
            </TabsTrigger>
          </TabsList>

          {/* ── History tab ── */}
          <TabsContent value="history" className="mt-4">
            <Card className="border-0 shadow-sm">
              <CardContent className="p-0">
                {history.length === 0 ? (
                  <div className="flex flex-col items-center py-16 text-muted-foreground gap-3">
                    <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center">
                      <TruckIcon className="w-7 h-7 opacity-40" />
                    </div>
                    <p className="text-sm font-medium">No operations recorded yet</p>
                    <p className="text-xs opacity-60">Operations will appear here once assigned.</p>
                  </div>
                ) : (
                  <div className="divide-y">
                    {history.map((op, idx) => {
                      const opStatusCls = OP_STATUS_COLOR[op.status] ?? "bg-gray-100 text-gray-600";
                      const loaded      = op.quantity_loaded_mt    ? parseFloat(op.quantity_loaded_mt)    : null;
                      const discharged  = op.quantity_discharged_mt? parseFloat(op.quantity_discharged_mt): null;
                      const remaining   = op.quantity_remaining_mt ? parseFloat(op.quantity_remaining_mt) : null;
                      const spillage    = op.spillage_mt           ? parseFloat(op.spillage_mt)           : null;
                      const tempC       = op.temperature_celsius   ? parseFloat(op.temperature_celsius)   : null;
                      const variance    = op.variance_mt           ? parseFloat(op.variance_mt)           : null;
                      const transitDur  = durationLabel(op.transit_start_at,  op.transit_end_at);
                      const dischDur    = durationLabel(op.discharge_start_at, op.discharge_end_at);

                      // Derive audit status from events
                      const hasAuditPass  = op.events?.some((e) => e.event_type === "AUDIT_PASS");
                      const hasAuditFail  = op.events?.some((e) => e.event_type === "AUDIT_FAIL");
                      const hasWaivers    = op.events?.some((e) => e.event_type === "WAIVE_AUDIT_ITEM");

                      return (
                        <div key={op.id} className="px-5 py-5 hover:bg-muted/20 transition-colors">
                          {/* Row number + header */}
                          <div className="flex items-start justify-between gap-3 mb-3">
                            <div className="flex items-center gap-3 min-w-0">
                              <span className="w-6 h-6 rounded-full bg-muted text-muted-foreground text-[10px] font-bold flex items-center justify-center shrink-0">
                                {idx + 1}
                              </span>
                              <div className="min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <Link
                                    href={`/operations/${op.operation_id}`}
                                    className="text-sm font-bold font-mono text-primary hover:underline"
                                  >
                                    {op.operation_number}
                                  </Link>
                                  <span className="text-xs text-muted-foreground capitalize">
                                    {op.operation_type.replace(/_/g, " ")}
                                  </span>
                                </div>
                                <p className="text-[10px] text-muted-foreground">{formatDate(op.created_at)}</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2 shrink-0 flex-wrap justify-end">
                              {/* Audit badge */}
                              {hasAuditPass && !hasAuditFail && (
                                <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                                  <ShieldCheck className="w-3 h-3" />
                                  Audit Pass
                                </span>
                              )}
                              {hasAuditFail && !hasWaivers && (
                                <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-red-50 text-red-700 border border-red-200">
                                  <ShieldAlert className="w-3 h-3" />
                                  Audit Fail
                                </span>
                              )}
                              {hasWaivers && (
                                <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
                                  <AlertTriangle className="w-3 h-3" />
                                  Waived Issues
                                </span>
                              )}
                              <span className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-full capitalize ${opStatusCls}`}>
                                {op.status.replace(/_/g, " ")}
                              </span>
                            </div>
                          </div>

                          {/* Route flow */}
                          {(op.loading_location || op.discharge_location) && (
                            <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-3 bg-muted/40 rounded-lg px-3 py-2">
                              <Navigation className="w-3 h-3 text-primary/60 shrink-0" />
                              <span className="font-medium text-foreground truncate">{op.loading_location ?? "—"}</span>
                              <ChevronRight className="w-3 h-3 shrink-0 text-muted-foreground/50" />
                              <span className="font-medium text-foreground truncate">{op.discharge_location ?? "—"}</span>
                              {op.destination_vessel_name && (
                                <>
                                  <ChevronRight className="w-3 h-3 shrink-0 text-muted-foreground/50" />
                                  <span className="font-semibold text-primary truncate">{op.destination_vessel_name}</span>
                                </>
                              )}
                            </div>
                          )}

                          {/* Quantities grid */}
                          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2 mb-3">
                            {loaded != null && (
                              <div className="bg-emerald-50 rounded-lg px-3 py-2 text-center">
                                <p className="text-[9px] font-medium text-emerald-600 uppercase tracking-wide mb-0.5">Loaded</p>
                                <p className="text-sm font-bold text-emerald-700 tabular-nums">{formatNumber(loaded)} MT</p>
                              </div>
                            )}
                            {discharged != null && (
                              <div className="bg-blue-50 rounded-lg px-3 py-2 text-center">
                                <p className="text-[9px] font-medium text-blue-600 uppercase tracking-wide mb-0.5">Discharged</p>
                                <p className="text-sm font-bold text-blue-700 tabular-nums">{formatNumber(discharged)} MT</p>
                              </div>
                            )}
                            {remaining != null && (
                              <div className="bg-gray-50 rounded-lg px-3 py-2 text-center">
                                <p className="text-[9px] font-medium text-gray-500 uppercase tracking-wide mb-0.5">Remaining</p>
                                <p className="text-sm font-bold text-gray-700 tabular-nums">{formatNumber(remaining)} MT</p>
                              </div>
                            )}
                            {variance != null && (
                              <div className={`rounded-lg px-3 py-2 text-center ${variance >= 0 ? "bg-emerald-50" : "bg-red-50"}`}>
                                <p className={`text-[9px] font-medium uppercase tracking-wide mb-0.5 ${variance >= 0 ? "text-emerald-600" : "text-red-600"}`}>Variance</p>
                                <p className={`text-sm font-bold tabular-nums ${variance >= 0 ? "text-emerald-700" : "text-red-700"}`}>
                                  {variance >= 0 ? "+" : ""}{formatNumber(variance)} MT
                                </p>
                              </div>
                            )}
                            {spillage != null && spillage > 0 && (
                              <div className="bg-red-50 rounded-lg px-3 py-2 text-center">
                                <p className="text-[9px] font-medium text-red-600 uppercase tracking-wide mb-0.5">Spillage</p>
                                <p className="text-sm font-bold text-red-700 tabular-nums">{formatNumber(spillage)} MT</p>
                              </div>
                            )}
                          </div>

                          {/* Phase durations + extras */}
                          <div className="flex flex-wrap gap-x-5 gap-y-1 text-[11px] text-muted-foreground mb-2">
                            {transitDur !== "—" && (
                              <span className="flex items-center gap-1">
                                <Navigation className="w-3 h-3" />
                                Transit: <span className="font-semibold text-foreground ml-0.5">{transitDur}</span>
                              </span>
                            )}
                            {dischDur !== "—" && (
                              <span className="flex items-center gap-1">
                                <Fuel className="w-3 h-3" />
                                Discharge: <span className="font-semibold text-foreground ml-0.5">{dischDur}</span>
                              </span>
                            )}
                            {tempC != null && (
                              <span className="flex items-center gap-1">
                                <Thermometer className="w-3 h-3" />
                                Temp: <span className="font-semibold text-foreground ml-0.5">{tempC}°C</span>
                              </span>
                            )}
                            {op.product_type && (
                              <span className="flex items-center gap-1">
                                <Package className="w-3 h-3" />
                                <span className="font-semibold text-foreground">{op.product_type}</span>
                              </span>
                            )}
                          </div>

                          {/* Supervisor + logger */}
                          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
                            {op.supervisor_name && (
                              <span className="flex items-center gap-1">
                                <Shield className="w-3 h-3" />
                                Supervised by <span className="font-semibold text-foreground ml-0.5">{op.supervisor_name}</span>
                              </span>
                            )}
                            <span className="flex items-center gap-1 ml-auto">
                              <CheckCircle2 className="w-3 h-3 text-muted-foreground/60" />
                              <span className="font-semibold text-foreground">{op.logged_by_name}</span>
                              <span className="opacity-50">·</span>
                              <span>{ROLE_LABEL[op.logged_by_role] ?? op.logged_by_role}</span>
                            </span>
                          </div>

                          {op.notes && (
                            <p className="mt-2 text-[11px] text-muted-foreground bg-muted/40 rounded px-2.5 py-1.5 italic">
                              {op.notes}
                            </p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── Details tab ── */}
          <TabsContent value="info" className="mt-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card className="border-0 shadow-sm">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <TruckIcon className="w-4 h-4 text-primary" />
                    Vehicle Information
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {[
                    { label: "Registration / Number", value: truck.truck_number, mono: true },
                    { label: "Capacity", value: `${formatNumber(parseFloat(truck.capacity_mt))} MT` },
                    { label: "Status", value: truck.status.replace(/_/g, " "), capitalize: true },
                    { label: "Active", value: truck.is_active ? "Yes" : "No" },
                    { label: "Registered", value: formatDate(truck.created_at) },
                    { label: "Last Updated", value: formatDate(truck.updated_at) },
                  ].map(({ label, value, mono, capitalize }) => (
                    <div key={label} className="flex justify-between items-center py-1.5 border-b border-border/40 last:border-0">
                      <span className="text-xs text-muted-foreground">{label}</span>
                      <span className={`text-xs font-semibold ${mono ? "font-mono" : ""} ${capitalize ? "capitalize" : ""}`}>
                        {value}
                      </span>
                    </div>
                  ))}
                </CardContent>
              </Card>

              <Card className="border-0 shadow-sm">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <User className="w-4 h-4 text-primary" />
                    Driver & Location
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {[
                    { label: "Driver Name",    value: truck.driver_name     ?? "Not assigned" },
                    { label: "Driver Phone",   value: truck.driver_phone    ?? "—" },
                    { label: "Current Location", value: truck.current_location ?? "Unknown" },
                    { label: "GPS Latitude",   value: truck.gps_lat         ?? "—" },
                    { label: "GPS Longitude",  value: truck.gps_lng         ?? "—" },
                  ].map(({ label, value }) => (
                    <div key={label} className="flex justify-between items-center py-1.5 border-b border-border/40 last:border-0">
                      <span className="text-xs text-muted-foreground">{label}</span>
                      <span className="text-xs font-semibold">{value}</span>
                    </div>
                  ))}
                </CardContent>
              </Card>

              {/* Performance summary */}
              <Card className="border-0 shadow-sm md:col-span-2">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Gauge className="w-4 h-4 text-primary" />
                    Lifetime Performance Summary
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                    {[
                      { label: "Total Operations",  value: stats.total_operations, unit: "" },
                      { label: "Total Loaded",      value: formatNumber(parseFloat(stats.total_loaded_mt)),       unit: "MT" },
                      { label: "Total Discharged",  value: formatNumber(parseFloat(stats.total_discharged_mt)),   unit: "MT" },
                      { label: "Total Variance",    value: `${variancePositive ? "+" : ""}${formatNumber(varNum)}`, unit: "MT" },
                      { label: "Total Spillage",    value: formatNumber(parseFloat(stats.total_spillage_mt)),     unit: "MT" },
                      { label: "Efficiency",        value: effPct != null ? effPct.toFixed(1) : "—",              unit: effPct != null ? "%" : "" },
                    ].map(({ label, value, unit }) => (
                      <div key={label} className="text-center p-3 rounded-xl bg-muted/30">
                        <p className="text-[10px] font-medium text-muted-foreground mb-1 uppercase tracking-wide">{label}</p>
                        <p className="text-xl font-bold tabular-nums">
                          {value}
                          {unit && <span className="text-sm font-normal text-muted-foreground ml-0.5">{unit}</span>}
                        </p>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
