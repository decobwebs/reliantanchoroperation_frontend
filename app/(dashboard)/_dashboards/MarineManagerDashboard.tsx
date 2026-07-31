"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import {
  AlertTriangle,
  Anchor,
  CheckCircle2,
  ChevronRight,
  Gauge,
  Play,
  Ship,
} from "lucide-react";
import { Spinner } from "@/components/ui/spinner";
import { toast } from "sonner";
import { api, getErrorMessage } from "@/lib/api";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { AlertPanel, AlertRow } from "@/components/dashboard/AlertPanel";
import { KpiCard } from "@/components/dashboard/KpiCard";
import { PanelCard } from "@/components/dashboard/PanelCard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/hooks/useAuth";
import { cn, formatNumber } from "@/lib/utils";
import type { ApiResponse, VesselActivity, Vessel } from "@/types";

const ACTIVITY_STATUS_CLASSES: Record<string, string> = {
  pending: "bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300",
  active: "bg-blue-50 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300",
  completed: "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300",
  cancelled: "bg-slate-100 text-slate-500 dark:bg-slate-500/15 dark:text-slate-300",
};

export function MarineManagerDashboard() {
  const qc = useQueryClient();
  const { user } = useAuth();

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
  const totalActivities = activities?.length ?? 0;

  const lowRobVessels =
    vessels?.filter(
      (v) => v.rob_threshold_mt && parseFloat(v.current_rob_mt) <= parseFloat(v.rob_threshold_mt)
    ) ?? [];

  const share = (n: number) =>
    totalActivities > 0
      ? `${Math.round((n / totalActivities) * 100)}% of your activities`
      : "Nothing assigned";

  return (
    <DashboardShell
      eyebrow={
        <>
          Welcome back, {user?.full_name?.split(" ")[0] ?? "there"}{" "}
          <span aria-hidden="true">👋</span>
        </>
      }
      title="Marine Dashboard"
      subtitle="Vessel bunkering & discharge — your assigned activities"
      actions={
        <Button
          asChild
          className="h-10.5 rounded-xl px-4 text-[13px] font-semibold shadow-[0_12px_26px_-14px_rgba(23,52,99,0.9)]"
        >
          <Link href="/fleet/vessels">
            <Ship className="h-4 w-4" strokeWidth={2.5} />
            Vessel Registry
          </Link>
        </Button>
      }
    >
      <section
        className="animate-rise grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4"
        aria-label="Activity metrics"
      >
        <KpiCard
          tone="navy"
          icon={Anchor}
          title="Pending Activities"
          value={pending.length}
          caption="Awaiting your start"
          note={share(pending.length)}
          noteTrend="flat"
        />
        <KpiCard
          tone="sky"
          icon={Play}
          title="Active Activities"
          value={active.length}
          caption="In progress"
          note={share(active.length)}
          noteTrend="flat"
        />
        <KpiCard
          tone="emerald"
          icon={CheckCircle2}
          title="Completed"
          value={completed.length}
          caption="All time"
          note={share(completed.length)}
          noteTrend="flat"
        />
        <KpiCard
          tone={lowRobVessels.length > 0 ? "rose" : "emerald"}
          icon={AlertTriangle}
          title="Low ROB Alerts"
          value={lowRobVessels.length}
          caption={lowRobVessels.length > 0 ? "Below threshold" : "All vessels OK"}
          note={`${vessels?.length ?? 0} vessel${vessels?.length === 1 ? "" : "s"} monitored`}
          noteTrend="flat"
        />
      </section>

      {lowRobVessels.length > 0 && (
        <AlertPanel
          icon={AlertTriangle}
          tone="red"
          title={`Low ROB Alert — ${lowRobVessels.length} vessel${
            lowRobVessels.length > 1 ? "s" : ""
          } below threshold`}
        >
          {lowRobVessels.map((vessel) => (
            <AlertRow
              key={vessel.id}
              primary={vessel.vessel_name}
              secondary={<span className="font-mono">{vessel.imo_number}</span>}
              trailing={
                <>
                  <p className="text-[13px] font-bold tabular-nums text-red-700 dark:text-red-300">
                    {formatNumber(parseFloat(vessel.current_rob_mt))} L
                  </p>
                  <p className="text-[10px] text-muted-foreground">
                    Threshold:{" "}
                    {vessel.rob_threshold_mt
                      ? `${formatNumber(parseFloat(vessel.rob_threshold_mt))} L`
                      : "—"}
                  </p>
                </>
              }
            />
          ))}
        </AlertPanel>
      )}

      <PanelCard
        icon={Anchor}
        tone="blue"
        title="My Vessel Activities"
        subtitle="Bunkering and discharge assigned to you"
        className="animate-rise"
        flush
        action={
          pending.length + active.length > 0 ? (
            <Badge className="h-6 rounded-full px-2.5 text-[11px]">
              {pending.length + active.length} open
            </Badge>
          ) : undefined
        }
      >
        {activitiesLoading ? (
          <div className="space-y-2 px-5 pb-5">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-20 w-full rounded-xl" />
            ))}
          </div>
        ) : activities?.length ? (
          <div className="divide-y divide-border/70">
            {activities.map((activity) => {
              const isPending = activity.status === "pending";
              const isActive = activity.status === "active";
              const isCompleted = activity.status === "completed";

              return (
                <div key={activity.id} className="px-4 py-3.5 lg:px-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-mono text-[13px] font-semibold text-foreground">
                          {activity.activity_number}
                        </p>
                        <span
                          className={cn(
                            "rounded-md px-1.5 py-0.5 text-[10px] font-semibold capitalize",
                            ACTIVITY_STATUS_CLASSES[activity.status]
                          )}
                        >
                          {activity.status}
                        </span>
                      </div>
                      <p className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                        <Ship className="h-3 w-3 shrink-0" />
                        {activity.vessel_name ?? `${activity.vessel_id.slice(0, 8)}…`}
                      </p>
                    </div>

                    <div className="flex shrink-0 items-center gap-2">
                      {isPending && (
                        <Button
                          size="sm"
                          className="h-7 rounded-lg text-xs"
                          disabled={startMutation.isPending}
                          onClick={() => startMutation.mutate(activity.id)}
                        >
                          {startMutation.isPending ? (
                            <Spinner size={12} />
                          ) : (
                            <Play className="h-3 w-3" />
                          )}
                          Start
                        </Button>
                      )}
                      <Button
                        asChild
                        size="sm"
                        variant={isActive ? "default" : "outline"}
                        className={cn(
                          "h-7 rounded-lg text-xs",
                          isActive && "bg-blue-600 hover:bg-blue-700"
                        )}
                      >
                        <Link href={`/operations/${activity.operation_id}?tab=marine`}>
                          <ChevronRight className="h-3 w-3" />
                          {isActive ? "Record" : isCompleted ? "View" : "Open"}
                        </Link>
                      </Button>
                    </div>
                  </div>

                  {/* ROB strip — shown once receipt is recorded */}
                  {(activity.previous_rob_mt || activity.vessel_received_mt) && (
                    <div className="mt-2.5 grid grid-cols-2 gap-1.5 md:grid-cols-4">
                      {(
                        [
                          ["Prev ROB", activity.previous_rob_mt],
                          ["Received", activity.vessel_received_mt],
                          ["New ROB", activity.new_rob_mt],
                          ["Variance", activity.variance_mt],
                        ] as const
                      ).map(([label, val]) => (
                        <div key={label} className="rounded-lg bg-muted/60 px-2.5 py-1.5">
                          <p className="text-[9px] font-semibold uppercase tracking-wide text-muted-foreground">
                            {label}
                          </p>
                          <p className="mt-0.5 font-mono text-[12px] font-semibold tabular-nums text-foreground">
                            {val
                              ? `${
                                  label === "Variance" && parseFloat(String(val)) > 0 ? "+" : ""
                                }${parseFloat(String(val)).toFixed(2)}`
                              : "—"}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}

                  {activity.final_rob_mt && (
                    <p className="mt-2 flex items-center gap-1.5 text-xs text-emerald-700 dark:text-emerald-400">
                      <CheckCircle2 className="h-3 w-3" />
                      Final ROB:{" "}
                      <span className="font-mono font-semibold">
                        {parseFloat(activity.final_rob_mt).toFixed(3)} L
                      </span>
                    </p>
                  )}

                  {activity.variance_mt && parseFloat(activity.variance_mt) > 0.5 && (
                    <p className="mt-1.5 flex items-center gap-1.5 text-xs text-amber-700 dark:text-amber-400">
                      <Gauge className="h-3 w-3" />
                      High variance:{" "}
                      <span className="font-semibold">
                        +{parseFloat(activity.variance_mt).toFixed(3)} L
                      </span>{" "}
                      (truck vs vessel received)
                    </p>
                  )}

                  {activity.bunkering_start_at && (
                    <p className="mt-1.5 text-[10px] text-muted-foreground">
                      Bunkering: {new Date(activity.bunkering_start_at).toLocaleString()}
                      {activity.bunkering_end_at &&
                        ` → ${new Date(activity.bunkering_end_at).toLocaleString()}`}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="flex flex-col items-center gap-1 py-12 text-muted-foreground">
            <Anchor className="mb-1 h-9 w-9 opacity-25" />
            <p className="text-sm font-medium text-foreground">No vessel activities assigned</p>
            <p className="text-xs">
              Activities appear here when the Bunker Manager assigns you.
            </p>
          </div>
        )}
      </PanelCard>

      <PanelCard
        icon={Ship}
        tone="sky"
        title="Vessel Registry"
        subtitle="Remaining on board across the fleet"
        className="animate-rise"
        action={
          <Button
            asChild
            variant="outline"
            size="sm"
            className="h-8 rounded-lg text-xs font-semibold"
          >
            <Link href="/fleet/vessels">
              View all
              <ChevronRight className="h-3.5 w-3.5" />
            </Link>
          </Button>
        }
      >
        {vesselsLoading ? (
          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-20 rounded-xl" />
            ))}
          </div>
        ) : vessels?.length ? (
          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 xl:grid-cols-3">
            {vessels.slice(0, 6).map((vessel) => {
              const capacity = parseFloat(vessel.capacity_mt);
              const robPct =
                capacity > 0
                  ? Math.min(100, Math.round((parseFloat(vessel.current_rob_mt) / capacity) * 100))
                  : 0;
              const isLow =
                !!vessel.rob_threshold_mt &&
                parseFloat(vessel.current_rob_mt) <= parseFloat(vessel.rob_threshold_mt);

              return (
                <Link
                  key={vessel.id}
                  href={`/fleet/vessels/${vessel.id}`}
                  className={cn(
                    "rounded-xl border border-slate-200/80 p-3 transition-all dark:border-border",
                    "hover:-translate-y-0.5 hover:border-primary/25 hover:shadow-[0_12px_24px_-16px_rgba(16,24,40,0.5)]",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-[13px] font-semibold text-foreground">
                        {vessel.vessel_name}
                      </p>
                      <p className="truncate font-mono text-[10px] text-muted-foreground">
                        {vessel.imo_number}
                      </p>
                    </div>
                    {isLow && (
                      <Badge variant="destructive" className="h-4 shrink-0 px-1.5 text-[10px]">
                        Low ROB
                      </Badge>
                    )}
                  </div>
                  <div className="mt-2.5 flex items-center gap-2">
                    <div
                      className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted"
                      role="progressbar"
                      aria-valuenow={robPct}
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-label={`${vessel.vessel_name} ROB`}
                    >
                      <div
                        className={cn(
                          "h-full rounded-full",
                          isLow ? "bg-red-500" : robPct > 50 ? "bg-emerald-500" : "bg-amber-500"
                        )}
                        style={{ width: `${robPct}%` }}
                      />
                    </div>
                    <span className="shrink-0 text-[10px] tabular-nums text-muted-foreground">
                      {formatNumber(parseFloat(vessel.current_rob_mt))} L
                    </span>
                  </div>
                </Link>
              );
            })}
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2 py-10 text-muted-foreground">
            <Ship className="h-8 w-8 opacity-25" />
            <p className="text-xs">No vessels registered</p>
          </div>
        )}
      </PanelCard>
    </DashboardShell>
  );
}
