"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { AlertOctagon, CalendarClock, ClipboardCheck, ClipboardX, ShieldAlert, Truck, Wrench } from "lucide-react";
import { api } from "@/lib/api";
import { PanelCard } from "@/components/dashboard/PanelCard";
import { QueryError } from "@/components/shared/QueryError";
import { StatCard } from "@/components/shared/StatCard";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn, formatDate, formatDateTime } from "@/lib/utils";
import { INCIDENT_TYPE_LABEL, SEVERITY_LABEL } from "@/components/vessels/VesselIncidentsPanel";
import { MAINTENANCE_TYPE_LABEL } from "@/components/vessels/VesselMaintenancePanel";
import type { ApiResponse, SafetyOverview, VesselIncidentSeverity } from "@/types";

const SEVERITY_DOT: Record<VesselIncidentSeverity, string> = {
  low: "bg-slate-400",
  medium: "bg-amber-500",
  high: "bg-rose-500",
  critical: "bg-rose-700",
};

const PHASE_LABEL: Record<string, string> = {
  loading: "Loading",
  pre: "Pre",
  during: "During",
  post: "Post",
};

function ageText(days: number): string {
  return days === 0 ? "today" : days === 1 ? "1 day" : `${days} days`;
}

/** Each list shows its first few rows; the rest are a click away. */
const LIMIT = 8;

function More({ total, href }: { total: number; href?: string }) {
  if (total <= LIMIT) return null;
  const text = `and ${total - LIMIT} more`;
  return href ? (
    <Link href={href} className="mt-2 block text-[11.5px] font-semibold text-brand-600 hover:underline">
      {text}
    </Link>
  ) : (
    <p className="mt-2 text-[11.5px] text-muted-foreground">{text}</p>
  );
}

/** The safety dashboard: what needs attention now, fleet-wide. Read only. */
export function SafetyOverviewPanel() {
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["safety-overview"],
    refetchOnWindowFocus: false,
    queryFn: async () => (await api.get<ApiResponse<SafetyOverview>>("/safety/overview")).data.data,
  });

  if (isError) return <QueryError error={error} onRetry={() => refetch()} />;
  if (isLoading || !data) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-24 w-full rounded-2xl" />
        <div className="grid gap-4 lg:grid-cols-2">
          <Skeleton className="h-56 rounded-2xl" />
          <Skeleton className="h-56 rounded-2xl" />
        </div>
      </div>
    );
  }

  const incidents = data.incidents.open;
  const failed = data.failed_checks.failed;
  const missing = data.missing_truck_audits;
  const issues = data.open_truck_issues;
  const due = data.maintenance_due;
  const actions = data.inspections.open_actions;
  const overdueActions = actions.filter((a) => a.overdue).length;
  const sev = data.incidents.by_severity;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          title="Open incidents"
          value={incidents.length}
          subtitle={incidents.length ? `${sev.critical} critical · ${sev.high} high` : "Nothing open"}
          icon={AlertOctagon}
          color={sev.critical + sev.high > 0 ? "red" : "blue"}
        />
        <StatCard
          title="Failed checks"
          value={failed.length}
          subtitle={`of ${data.failed_checks.total_checks} in the last ${data.recent_days} days`}
          icon={ClipboardX}
          color={failed.length > 0 ? "red" : "blue"}
        />
        <StatCard
          title="Missing truck audits"
          value={missing.length}
          subtitle="On live operations"
          icon={Truck}
          color={missing.length > 0 ? "amber" : "blue"}
        />
        <StatCard
          title="Inspections this month"
          value={data.inspections.this_month}
          subtitle={
            overdueActions > 0
              ? `${overdueActions} action${overdueActions === 1 ? "" : "s"} overdue`
              : `${actions.length} action${actions.length === 1 ? "" : "s"} open`
          }
          icon={ClipboardCheck}
          color={overdueActions > 0 ? "amber" : "blue"}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <PanelCard
          icon={ShieldAlert}
          tone={incidents.length > 0 ? "amber" : "blue"}
          title="Open incidents"
          subtitle="Worst first, then oldest"
        >
          {incidents.length === 0 ? (
            <p className="text-[12px] text-muted-foreground">No incidents open on any vessel.</p>
          ) : (
            <ul className="space-y-2">
              {incidents.slice(0, LIMIT).map((i) => (
                <li key={i.id} className="flex items-start gap-2 text-[12px]">
                  <span className={cn("mt-1.5 h-2 w-2 shrink-0 rounded-full", SEVERITY_DOT[i.severity])} />
                  <div className="min-w-0">
                    <Link href={`/fleet/vessels/${i.vessel_id}?tab=incidents`} className="font-semibold text-foreground hover:underline">
                      {i.title}
                    </Link>
                    <p className="text-muted-foreground">
                      {i.vessel_name} · {SEVERITY_LABEL[i.severity]} · {INCIDENT_TYPE_LABEL[i.incident_type]} · open{" "}
                      {ageText(i.age_days)}
                      {i.status === "under_investigation" && " · under investigation"}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
          <More total={incidents.length} />
        </PanelCard>

        <PanelCard
          icon={ClipboardX}
          tone={failed.length > 0 ? "amber" : "blue"}
          title="Checks not satisfactory"
          subtitle={`Vessel HSE checks and truck audits, last ${data.recent_days} days`}
        >
          {failed.length === 0 ? (
            <p className="text-[12px] text-muted-foreground">Every check in the last {data.recent_days} days passed.</p>
          ) : (
            <ul className="space-y-2 text-[12px]">
              {failed.slice(0, LIMIT).map((f, n) => (
                <li key={n}>
                  <p>
                    <span className="font-semibold text-foreground">{f.subject ?? f.source}</span>
                    <span className="text-muted-foreground">
                      {" · "}
                      {f.kind === "truck" ? "Truck audit" : f.source} · {PHASE_LABEL[f.phase] ?? f.phase}
                    </span>
                  </p>
                  <p className="text-muted-foreground">
                    {f.conducted_at && formatDateTime(f.conducted_at)}
                    {f.operation_number && (
                      <>
                        {" · "}
                        <Link href={`/operations/${f.operation_id}`} className="font-mono font-semibold text-brand-600 hover:underline">
                          {f.operation_number}
                        </Link>
                      </>
                    )}
                    {f.notes && ` · ${f.notes}`}
                  </p>
                </li>
              ))}
            </ul>
          )}
          <More total={failed.length} />
        </PanelCard>

        <PanelCard
          icon={Truck}
          tone={missing.length > 0 ? "amber" : "blue"}
          title="Trucks missing a safety audit"
          subtitle="Pre is due at the jetty, Post once discharge ends"
        >
          {missing.length === 0 ? (
            <p className="text-[12px] text-muted-foreground">Every truck on a live operation has the audits it needs so far.</p>
          ) : (
            <ul className="space-y-1.5 text-[12px]">
              {missing.slice(0, LIMIT).map((m) => (
                <li key={m.truck_op_id}>
                  <span className="font-mono font-semibold text-foreground">{m.truck_number}</span>
                  <span className="text-muted-foreground">
                    {" · missing "}
                    {m.missing.map((p) => PHASE_LABEL[p]).join(" and ")}
                    {" · "}
                  </span>
                  <Link href={`/operations/${m.operation_id}`} className="font-mono font-semibold text-brand-600 hover:underline">
                    {m.operation_number}
                  </Link>
                </li>
              ))}
            </ul>
          )}
          <More total={missing.length} />
        </PanelCard>

        <PanelCard
          icon={Wrench}
          tone={issues.some((i) => i.severity === "high") ? "amber" : "blue"}
          title="Open truck issues"
          subtitle={issues.length ? `${issues.length} not resolved` : "Nothing open"}
        >
          {issues.length === 0 ? (
            <p className="text-[12px] text-muted-foreground">No truck issues open.</p>
          ) : (
            <ul className="space-y-1.5 text-[12px]">
              {issues.slice(0, LIMIT).map((i) => (
                <li key={i.id}>
                  <Link href={`/fleet/${i.truck_id}`} className="font-mono font-semibold text-foreground hover:underline">
                    {i.truck_number}
                  </Link>
                  <span className="text-muted-foreground">
                    {" · "}
                    {i.title} · {i.severity} · open {ageText(i.age_days)}
                  </span>
                </li>
              ))}
            </ul>
          )}
          <More total={issues.length} href="/fleet" />
        </PanelCard>

        <PanelCard
          icon={CalendarClock}
          tone={due.some((d) => d.state === "overdue") ? "amber" : "blue"}
          title="Vessel maintenance due"
          subtitle="Overdue, or due in the next 30 days"
        >
          {due.length === 0 ? (
            <p className="text-[12px] text-muted-foreground">No services or certificates due on any vessel.</p>
          ) : (
            <ul className="space-y-1.5 text-[12px]">
              {due.slice(0, LIMIT).map((d) => (
                <li key={d.record_id} className={d.state === "overdue" ? "text-rose-700 dark:text-rose-300" : "text-foreground"}>
                  <Link href={`/fleet/vessels/${d.vessel_id}?tab=maintenance`} className="font-semibold hover:underline">
                    {d.vessel_name}
                  </Link>
                  {": "}
                  {d.title} ({MAINTENANCE_TYPE_LABEL[d.maintenance_type].toLowerCase()}) —{" "}
                  {d.state === "overdue" ? `overdue since ${formatDate(d.due_date)}` : `due ${formatDate(d.due_date)}`}
                </li>
              ))}
            </ul>
          )}
          <More total={due.length} href="/fleet/vessels" />
        </PanelCard>

        <PanelCard
          icon={ClipboardCheck}
          tone={overdueActions > 0 ? "amber" : "blue"}
          title="Inspection actions open"
          subtitle={`${data.inspections.this_month} inspections this month, ${data.inspections.failed_this_month} failed`}
          action={
            <Button asChild size="sm" variant="ghost" className="h-7 text-xs">
              <Link href="/safety/inspections">View all</Link>
            </Button>
          }
        >
          {actions.length === 0 ? (
            <p className="text-[12px] text-muted-foreground">No follow-up actions open.</p>
          ) : (
            <ul className="space-y-1.5 text-[12px]">
              {actions.slice(0, LIMIT).map((a) => (
                <li key={a.id} className={a.overdue ? "text-rose-700 dark:text-rose-300" : "text-foreground"}>
                  <span className="font-semibold">{a.description}</span>
                  <span className={a.overdue ? "" : "text-muted-foreground"}>
                    {" · "}
                    {a.owner_name} · {a.overdue ? `overdue since ${formatDate(a.due_date)}` : `due ${formatDate(a.due_date)}`}
                  </span>
                </li>
              ))}
            </ul>
          )}
          <More total={actions.length} href="/safety/inspections" />
        </PanelCard>
      </div>
    </div>
  );
}
