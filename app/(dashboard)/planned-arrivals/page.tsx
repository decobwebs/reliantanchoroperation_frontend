"use client";

/**
 * Planned arrivals (KPI Phase 6).
 *
 * The capture point for the on-time delivery KPI. Without a planned arrival
 * there is nothing to measure "on time" against, so this screen exists to let
 * the truck team set one for every truck currently moving.
 *
 * Two rules the UI has to hold up:
 *
 *  1. A truck with no plan is NOT late — it is unmeasured. Never colour or
 *     label it as a miss.
 *  2. Moving a plan that already exists requires a written reason, because a
 *     plan quietly nudged after a truck runs late would turn a miss into a hit
 *     and nobody could tell.
 */

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { CalendarClock, TriangleAlert, CircleHelp, Check } from "lucide-react";
import { api, getErrorMessage } from "@/lib/api";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { PanelCard } from "@/components/dashboard/PanelCard";
import { StatCard } from "@/components/shared/StatCard";
import { QueryError } from "@/components/shared/QueryError";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/useAuth";
import type { ApiResponse } from "@/types";

interface InFlightTruck {
  truck_op_id: string;
  truck_id: string;
  truck_number: string;
  operation_id: string;
  operation_number: string;
  status?: string | null;
  driver_name?: string | null;
  vendor_name?: string | null;
  discharge_location?: string | null;
  departed_loading_at?: string | null;
  expected_arrival_at?: string | null;
  arrived_discharge_at?: string | null;
  is_late: boolean;
  hours_late?: number | null;
}

interface PlannedArrivals {
  trucks: InFlightTruck[];
  without_plan: number;
  late: number;
}

const CAN_PLAN = ["bunker_manager", "ops_supervisor", "logistics_officer"];

/** datetime-local wants "YYYY-MM-DDTHH:mm" in local time. */
function toLocalInput(iso?: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours()
  )}:${pad(d.getMinutes())}`;
}

function TruckRow({ truck }: { truck: InFlightTruck }) {
  const qc = useQueryClient();
  const hadPlan = Boolean(truck.expected_arrival_at);
  const [when, setWhen] = useState(toLocalInput(truck.expected_arrival_at));
  const [reason, setReason] = useState("");
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = useMutation({
    mutationFn: async () => {
      setError(null);
      await api.put(`/kpi/planned-arrivals/${truck.truck_op_id}`, {
        expected_arrival_at: new Date(when).toISOString(),
        reason: reason.trim() || undefined,
      });
    },
    onSuccess: () => {
      setOpen(false);
      setReason("");
      qc.invalidateQueries({ queryKey: ["planned-arrivals"] });
    },
    onError: (e) => setError(getErrorMessage(e)),
  });

  // Changing an existing plan needs a reason of at least 10 characters.
  const reasonNeeded = hadPlan;
  const canSave =
    Boolean(when) && (!reasonNeeded || reason.trim().length >= 10) && !save.isPending;

  return (
    <div className="px-4 py-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-mono text-sm font-medium">{truck.truck_number}</span>
            {truck.is_late ? (
              <Badge variant="destructive" className="gap-1 text-[10px]">
                <TriangleAlert className="h-3 w-3" />
                {truck.hours_late != null && truck.hours_late >= 1
                  ? `${Math.round(truck.hours_late)}h late`
                  : "Late"}
              </Badge>
            ) : !truck.expected_arrival_at ? (
              // Not a failure — just nothing to measure against yet.
              <Badge variant="secondary" className="gap-1 text-[10px]">
                <CircleHelp className="h-3 w-3" />
                No plan set
              </Badge>
            ) : truck.arrived_discharge_at ? (
              <Badge variant="secondary" className="gap-1 text-[10px]">
                <Check className="h-3 w-3" />
                On time
              </Badge>
            ) : null}
          </div>
          <p className="mt-0.5 truncate text-xs text-muted-foreground">
            <Link href={`/operations/${truck.operation_id}`} className="hover:underline">
              {truck.operation_number}
            </Link>
            {truck.vendor_name && ` · ${truck.vendor_name}`}
            {truck.discharge_location && ` · to ${truck.discharge_location}`}
            {truck.status && ` · ${truck.status.replace(/_/g, " ")}`}
          </p>
        </div>

        <div className="flex items-center gap-3">
          <span className="font-mono text-xs tabular-nums text-muted-foreground">
            {truck.expected_arrival_at
              ? new Date(truck.expected_arrival_at).toLocaleString()
              : ""}
          </span>
          <Button size="sm" variant={hadPlan ? "outline" : "default"} onClick={() => setOpen(!open)}>
            {hadPlan ? "Change" : "Set plan"}
          </Button>
        </div>
      </div>

      {open && (
        <div className="mt-3 space-y-3 rounded-lg border bg-muted/40 p-3">
          <div className="flex flex-wrap items-end gap-3">
            <div className="min-w-[220px] flex-1">
              <label className="mb-1 block text-xs font-medium text-muted-foreground">
                Planned arrival at discharge
              </label>
              <Input
                type="datetime-local"
                value={when}
                onChange={(e) => setWhen(e.target.value)}
              />
            </div>
          </div>

          {reasonNeeded && (
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">
                Reason for changing the plan (required, min 10 characters)
              </label>
              <Input
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Why is the planned arrival moving?"
              />
              <p className="mt-1 text-xs text-muted-foreground">
                A plan moved after the fact would change the on-time score, so
                the reason is recorded in the operation&apos;s activity log.
              </p>
            </div>
          )}

          {error && <p className="text-xs text-rose-500">{error}</p>}

          <div className="flex gap-2">
            <Button size="sm" disabled={!canSave} onClick={() => save.mutate()}>
              {save.isPending ? "Saving…" : "Save"}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function PlannedArrivalsPage() {
  const { user, effectiveRole } = useAuth();
  const canSee = user && effectiveRole ? CAN_PLAN.includes(effectiveRole) : true;

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["planned-arrivals"],
    enabled: canSee,
    refetchOnWindowFocus: false,
    queryFn: async () => {
      const res = await api.get<ApiResponse<PlannedArrivals>>("/kpi/planned-arrivals");
      return res.data.data;
    },
  });

  const shell = {
    icon: CalendarClock,
    iconTone: "amber" as const,
    showRole: false,
    title: "Planned Arrivals",
    subtitle: "Set when each truck in flight is due at discharge",
  };

  if (user && !canSee) {
    return (
      <DashboardShell {...shell} subtitle="Restricted">
        <QueryError error={{ isAxiosError: true, response: { status: 403 } }} />
      </DashboardShell>
    );
  }
  if (isError) {
    return (
      <DashboardShell {...shell}>
        <QueryError error={error} onRetry={() => refetch()} />
      </DashboardShell>
    );
  }
  if (isLoading || !data) {
    return (
      <DashboardShell {...shell}>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-32 rounded-2xl" />
          ))}
        </div>
        <Skeleton className="h-96 rounded-2xl" />
      </DashboardShell>
    );
  }

  const planned = data.trucks.length - data.without_plan;

  return (
    <DashboardShell {...shell}>
      <div className="rounded-xl border border-sky-500/30 bg-sky-500/10 px-4 py-3">
        <p className="text-sm leading-snug text-sky-900 dark:text-sky-200">
          On-time delivery is measured against these plans. A truck without a
          plan is left out of the score entirely — it is never counted late.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
        <StatCard title="Trucks in flight" value={data.trucks.length} icon={CalendarClock} color="blue" />
        <StatCard
          title="Planned"
          value={`${planned} of ${data.trucks.length}`}
          icon={Check}
          color={data.without_plan === 0 ? "emerald" : "amber"}
        />
        <StatCard
          title="Running late"
          value={data.late}
          icon={TriangleAlert}
          color={data.late ? "red" : "emerald"}
        />
      </div>

      <PanelCard
        icon={CalendarClock}
        tone="amber"
        title="Trucks in flight"
        subtitle="Overdue first, then those still without a plan"
        flush
      >
        {data.trucks.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted-foreground">
            No trucks are in flight. Plans can be set once trucks are dispatched.
          </p>
        ) : (
          <div className="divide-y divide-border/60">
            {data.trucks.map((t) => (
              <TruckRow key={t.truck_op_id} truck={t} />
            ))}
          </div>
        )}
      </PanelCard>
    </DashboardShell>
  );
}
