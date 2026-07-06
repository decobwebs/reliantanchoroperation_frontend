"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import {
  AlertTriangle,
  Anchor,
  CheckCircle2,
  ChevronRight,
  Gauge,
  Loader2,
  Play,
  Ship,
} from "lucide-react";
import { toast } from "sonner";
import { api, getErrorMessage } from "@/lib/api";
import { Header } from "@/components/layout/Header";
import { StatCard } from "@/components/shared/StatCard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatNumber } from "@/lib/utils";
import type { ApiResponse, VesselActivity, Vessel } from "@/types";

const STATUS_COLOR: Record<string, string> = {
  pending:   "bg-amber-100 text-amber-800",
  active:    "bg-blue-100 text-blue-800",
  completed: "bg-emerald-100 text-emerald-800",
  cancelled: "bg-gray-100 text-gray-500",
};

export function MarineManagerDashboard() {
  const qc = useQueryClient();

  const { data: activities, isLoading: activitiesLoading } = useQuery({
    queryKey: ["my-vessel-activities"],
    queryFn: async () => {
      const res = await api.get<ApiResponse<VesselActivity[]>>("/vessel-activities/my/assigned");
      return res.data.data ?? [];
    },
  });

  const { data: vessels, isLoading: vesselsLoading } = useQuery({
    queryKey: ["vessels"],
    queryFn: async () => {
      const res = await api.get<ApiResponse<Vessel[]>>("/vessels");
      return res.data.data ?? [];
    },
  });

  const startMutation = useMutation({
    mutationFn: async (activityId: string) => {
      await api.post(`/vessel-activities/${activityId}/start`, {});
    },
    onSuccess: () => {
      toast.success("Activity started — begin recording");
      qc.invalidateQueries({ queryKey: ["my-vessel-activities"] });
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  const pending   = activities?.filter((a) => a.status === "pending")   ?? [];
  const active    = activities?.filter((a) => a.status === "active")    ?? [];
  const completed = activities?.filter((a) => a.status === "completed") ?? [];

  const lowRobVessels = vessels?.filter(
    (v) => v.rob_threshold_mt && parseFloat(v.current_rob_mt) <= parseFloat(v.rob_threshold_mt)
  ) ?? [];

  return (
    <div>
      <Header title="Marine Dashboard" subtitle="Vessel bunkering & discharge — Marine Manager" />

      <div className="p-6 space-y-6">

        {/* KPIs */}
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
          <StatCard title="Pending Activities" value={pending.length}   subtitle="Awaiting your start"    icon={Anchor} color="amber"   />
          <StatCard title="Active Activities"  value={active.length}    subtitle="In progress"            icon={Play}   color="blue"    />
          <StatCard title="Completed"          value={completed.length} subtitle="All time"               icon={CheckCircle2} color="emerald" />
          <StatCard
            title="Low ROB Alerts"
            value={lowRobVessels.length}
            subtitle={lowRobVessels.length > 0 ? "Below threshold" : "All vessels OK"}
            icon={AlertTriangle}
            color={lowRobVessels.length > 0 ? "red" : "emerald"}
          />
        </div>

        {/* Low ROB alert banner */}
        {lowRobVessels.length > 0 && (
          <Card className="border-red-200 bg-red-50/40 border shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold flex items-center gap-2 text-red-700">
                <AlertTriangle className="w-4 h-4" />
                Low ROB Alert — {lowRobVessels.length} vessel{lowRobVessels.length > 1 ? "s" : ""} below threshold
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0 pb-2">
              <div className="divide-y divide-red-100">
                {lowRobVessels.map((vessel) => (
                  <div key={vessel.id} className="flex items-center justify-between px-5 py-3">
                    <div>
                      <p className="text-sm font-semibold">{vessel.vessel_name}</p>
                      <p className="text-xs text-muted-foreground font-mono">{vessel.imo_number}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold text-red-700">
                        {formatNumber(parseFloat(vessel.current_rob_mt))} MT
                      </p>
                      <p className="text-[10px] text-muted-foreground">
                        Threshold: {vessel.rob_threshold_mt ? `${formatNumber(parseFloat(vessel.rob_threshold_mt))} MT` : "—"}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

          {/* ── Assigned Activities ─────────────────────────────────────── */}
          <Card className="border-0 shadow-sm lg:col-span-2">
            <CardHeader className="pb-2 flex flex-row items-center justify-between">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Anchor className="w-4 h-4 text-primary" />
                My Vessel Activities
              </CardTitle>
              {(pending.length > 0 || active.length > 0) && (
                <Badge variant="default" className="text-[10px] h-5 px-2">
                  {pending.length + active.length} open
                </Badge>
              )}
            </CardHeader>
            <CardContent className="p-0">
              {activitiesLoading ? (
                <div className="flex justify-center py-10">
                  <Loader2 className="w-5 h-5 animate-spin text-primary" />
                </div>
              ) : activities?.length ? (
                <div className="divide-y">
                  {activities.map((activity) => {
                    const isPending   = activity.status === "pending";
                    const isActive    = activity.status === "active";
                    const isCompleted = activity.status === "completed";

                    return (
                      <div key={activity.id} className="px-5 py-3.5">
                        <div className="flex items-start justify-between gap-3">
                          {/* Left: identity */}
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="text-sm font-mono font-semibold">{activity.activity_number}</p>
                              <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded capitalize ${STATUS_COLOR[activity.status]}`}>
                                {activity.status}
                              </span>
                            </div>
                            <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1.5">
                              <Ship className="w-3 h-3 shrink-0" />
                              {activity.vessel_name ?? activity.vessel_id.slice(0, 8) + "…"}
                            </p>
                          </div>

                          {/* Right: action */}
                          <div className="flex items-center gap-2 shrink-0">
                            {isPending && (
                              <Button
                                size="sm"
                                className="h-7 text-xs"
                                disabled={startMutation.isPending}
                                onClick={() => startMutation.mutate(activity.id)}
                              >
                                {startMutation.isPending
                                  ? <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                                  : <Play className="w-3 h-3 mr-1" />}
                                Start
                              </Button>
                            )}
                            <Link href={`/operations/${activity.operation_id}?tab=marine`}>
                              <Button size="sm" variant={isActive ? "default" : "outline"} className={`h-7 text-xs ${isActive ? "bg-blue-600 hover:bg-blue-700" : ""}`}>
                                <ChevronRight className="w-3 h-3 mr-1" />
                                {isActive ? "Record" : isCompleted ? "View" : "Open"}
                              </Button>
                            </Link>
                          </div>
                        </div>

                        {/* ROB strip — shown once receipt is recorded */}
                        {(activity.previous_rob_mt || activity.vessel_received_mt) && (
                          <div className="mt-2 grid grid-cols-4 gap-1 text-[10px]">
                            {[
                              ["Prev ROB", activity.previous_rob_mt],
                              ["Received", activity.vessel_received_mt],
                              ["New ROB",  activity.new_rob_mt],
                              ["Variance", activity.variance_mt],
                            ].map(([label, val]) => (
                              <div key={String(label)} className="bg-muted/50 rounded px-2 py-1">
                                <p className="text-muted-foreground uppercase tracking-wide mb-0.5">{label}</p>
                                <p className="font-semibold font-mono">
                                  {val
                                    ? `${parseFloat(String(val)) >= 0 && label === "Variance" && parseFloat(String(val)) > 0 ? "+" : ""}${parseFloat(String(val)).toFixed(2)}`
                                    : "—"}
                                </p>
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Final ROB — shown after discharge is recorded */}
                        {activity.final_rob_mt && (
                          <div className="mt-1.5 flex items-center gap-1.5 text-xs text-emerald-700">
                            <CheckCircle2 className="w-3 h-3" />
                            Final ROB: <span className="font-semibold font-mono">{parseFloat(activity.final_rob_mt).toFixed(3)} MT</span>
                          </div>
                        )}

                        {/* Variance warning */}
                        {activity.variance_mt && parseFloat(activity.variance_mt) > 0.5 && (
                          <div className="mt-1.5 flex items-center gap-1.5 text-xs text-amber-700">
                            <Gauge className="w-3 h-3" />
                            High variance: <span className="font-semibold">+{parseFloat(activity.variance_mt).toFixed(3)} MT</span>
                            &nbsp;(truck vs vessel received)
                          </div>
                        )}

                        {/* Bunkering timing summary */}
                        {activity.bunkering_start_at && (
                          <p className="mt-1 text-[10px] text-muted-foreground">
                            Bunkering: {new Date(activity.bunkering_start_at).toLocaleString()}
                            {activity.bunkering_end_at && ` → ${new Date(activity.bunkering_end_at).toLocaleString()}`}
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="flex flex-col items-center py-12 text-muted-foreground">
                  <Anchor className="w-9 h-9 mb-2 opacity-30" />
                  <p className="text-sm">No vessel activities assigned</p>
                  <p className="text-xs mt-1">Activities will appear here when the Bunker Manager assigns you.</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* ── Vessel Registry ────────────────────────────────────────── */}
          <Card className="border-0 shadow-sm lg:col-span-2">
            <CardHeader className="pb-2 flex flex-row items-center justify-between">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Ship className="w-4 h-4 text-primary" />
                Vessel Registry
              </CardTitle>
              <Link href="/fleet/vessels" className="text-xs text-primary hover:underline">View all</Link>
            </CardHeader>
            <CardContent className="p-0">
              {vesselsLoading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="w-5 h-5 animate-spin text-primary" />
                </div>
              ) : vessels?.length ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 divide-y sm:divide-y-0 sm:gap-px">
                  {vessels.slice(0, 6).map((vessel) => {
                    const robPct = vessel.capacity_mt
                      ? Math.min(100, Math.round((parseFloat(vessel.current_rob_mt) / parseFloat(vessel.capacity_mt)) * 100))
                      : 0;
                    const isLow = vessel.rob_threshold_mt &&
                      parseFloat(vessel.current_rob_mt) <= parseFloat(vessel.rob_threshold_mt);

                    return (
                      <Link key={vessel.id} href={`/fleet/vessels/${vessel.id}`}>
                        <div className="px-4 py-3 hover:bg-muted/40 transition-colors cursor-pointer">
                          <div className="flex items-center justify-between mb-1.5">
                            <div>
                              <p className="text-xs font-semibold">{vessel.vessel_name}</p>
                              <p className="text-[10px] text-muted-foreground font-mono">{vessel.imo_number}</p>
                            </div>
                            {isLow && (
                              <Badge variant="destructive" className="text-[10px] h-4 px-1.5">Low ROB</Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                              <div
                                className={`h-full rounded-full ${isLow ? "bg-red-500" : robPct > 50 ? "bg-emerald-500" : "bg-amber-500"}`}
                                style={{ width: `${robPct}%` }}
                              />
                            </div>
                            <span className="text-[10px] text-muted-foreground shrink-0 tabular-nums">
                              {formatNumber(parseFloat(vessel.current_rob_mt))} MT
                            </span>
                          </div>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              ) : (
                <div className="flex flex-col items-center py-8 text-muted-foreground">
                  <Ship className="w-8 h-8 mb-2 opacity-30" />
                  <p className="text-xs">No vessels registered</p>
                </div>
              )}
            </CardContent>
          </Card>

        </div>
      </div>
    </div>
  );
}
