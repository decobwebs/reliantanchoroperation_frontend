"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { AlertOctagon, CalendarClock, ClipboardCheck, Droplets, FileText, Printer, ShieldAlert } from "lucide-react";
import { api } from "@/lib/api";
import { PanelCard } from "@/components/dashboard/PanelCard";
import { StatCard } from "@/components/shared/StatCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDate, formatDateTime, formatNumber } from "@/lib/utils";
import { INCIDENT_TYPE_LABEL, SEVERITY_LABEL } from "./VesselIncidentsPanel";
import { MAINTENANCE_TYPE_LABEL } from "./VesselMaintenancePanel";
import { defaultReportRange } from "./VesselReportDocument";
import type { ApiResponse, VesselIncident, VesselMaintenanceLog, VesselReport } from "@/types";

/** The Overview tab: the last 30 days at a glance, and what needs attention now. */
export function VesselOverviewPanel({
  vesselId,
  incidents,
  maintenance,
  onOpenTab,
}: {
  vesselId: string;
  incidents: VesselIncident[] | undefined;
  maintenance: VesselMaintenanceLog | undefined;
  onOpenTab: (tab: "incidents" | "maintenance") => void;
}) {
  const range = defaultReportRange();
  const { data: report } = useQuery({
    queryKey: ["vessel-report", vesselId, range.from, range.to],
    refetchOnWindowFocus: false,
    queryFn: async () => {
      const res = await api.get<ApiResponse<VesselReport>>(
        `/vessels/${vesselId}/report?date_from=${range.from}&date_to=${range.to}`
      );
      return res.data.data;
    },
  });

  const open = (incidents ?? []).filter((i) => i.status !== "closed");
  const due = maintenance?.due ?? [];
  const failedHse = (report?.hse_checks ?? []).filter((h) => h.result === "not_satisfactory");
  const s = report?.summary;

  return (
    <div className="space-y-4">
      <p className="text-[12px] text-muted-foreground">
        Last 30 days ({formatDate(range.from)} to {formatDate(range.to)})
      </p>
      {s ? (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <StatCard title="Deliveries" value={s.deliveries} subtitle={`${s.deliveries_approved} approved`} icon={FileText} color="blue" />
          <StatCard
            title="MT(vac) delivered"
            value={s.approved_mt_vacuum == null ? "" : formatNumber(s.approved_mt_vacuum)}
            subtitle={s.approved_missing_mt_vacuum > 0 ? `${s.approved_missing_mt_vacuum} BDNs with none recorded` : "Approved BDNs"}
            icon={Droplets}
            color="emerald"
          />
          <StatCard
            title="HSE checks"
            value={s.hse_checks}
            subtitle={s.hse_failed > 0 ? `${s.hse_failed} not satisfactory` : "None failed"}
            icon={ClipboardCheck}
            color={s.hse_failed > 0 ? "red" : "blue"}
          />
          <StatCard
            title="Incidents"
            value={s.incidents}
            subtitle={`${s.incidents_open_now} open now`}
            icon={AlertOctagon}
            color={s.incidents_open_now > 0 ? "red" : "blue"}
          />
        </div>
      ) : (
        <Skeleton className="h-24 w-full rounded-2xl" />
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <PanelCard
          icon={ShieldAlert}
          tone={open.length > 0 ? "amber" : "blue"}
          title="Open incidents"
          subtitle={open.length === 0 ? "Nothing open" : `${open.length} not closed`}
          action={
            <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => onOpenTab("incidents")}>
              View all
            </Button>
          }
        >
          {open.length === 0 ? (
            <p className="text-[12px] text-muted-foreground">No open incidents on this vessel.</p>
          ) : (
            <ul className="space-y-2">
              {open.slice(0, 5).map((i) => (
                <li key={i.id} className="text-[12px]">
                  <p className="font-semibold text-foreground">{i.title}</p>
                  <p className="text-muted-foreground">
                    {SEVERITY_LABEL[i.severity]} · {INCIDENT_TYPE_LABEL[i.incident_type]} · {formatDateTime(i.occurred_at)}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </PanelCard>

        <PanelCard
          icon={CalendarClock}
          tone={due.some((d) => d.state === "overdue") ? "amber" : "blue"}
          title="Maintenance due"
          subtitle={due.length === 0 ? "Nothing due in the next 30 days" : `${due.length} overdue or due soon`}
          action={
            <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => onOpenTab("maintenance")}>
              View all
            </Button>
          }
        >
          {due.length === 0 ? (
            <p className="text-[12px] text-muted-foreground">No services or certificates due.</p>
          ) : (
            <ul className="space-y-1.5 text-[12px]">
              {due.slice(0, 6).map((d) => (
                <li key={d.record_id} className={d.state === "overdue" ? "text-rose-700 dark:text-rose-300" : "text-foreground"}>
                  <span className="font-semibold">{d.title}</span> ({MAINTENANCE_TYPE_LABEL[d.maintenance_type].toLowerCase()}) —{" "}
                  {d.state === "overdue" ? `overdue since ${formatDate(d.due_date)}` : `due ${formatDate(d.due_date)}`}
                </li>
              ))}
            </ul>
          )}
        </PanelCard>
      </div>

      {failedHse.length > 0 && (
        <PanelCard icon={ClipboardCheck} tone="amber" title="HSE checks not satisfactory" subtitle="Last 30 days">
          <ul className="space-y-1.5 text-[12px]">
            {failedHse.map((h, i) => (
              <li key={i}>
                <span className="font-semibold">{h.source}</span> · {h.phase} · {formatDateTime(h.conducted_at)}
                {h.notes && <span className="text-muted-foreground"> — {h.notes}</span>}
              </li>
            ))}
          </ul>
        </PanelCard>
      )}
    </div>
  );
}

/** The Report tab: pick a period, open the printable report. */
export function VesselReportLauncher({ vesselId }: { vesselId: string }) {
  const [range, setRange] = useState(defaultReportRange);
  return (
    <PanelCard icon={Printer} tone="blue" title="Vessel report" subtitle="Deliveries, ROB, HSE checks, incidents and maintenance for a period">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="space-y-1">
          <Label htmlFor="vr-from" className="text-xs text-muted-foreground">From</Label>
          <Input id="vr-from" type="date" value={range.from} max={range.to} onChange={(e) => setRange({ ...range, from: e.target.value })} />
        </div>
        <div className="space-y-1">
          <Label htmlFor="vr-to" className="text-xs text-muted-foreground">To</Label>
          <Input id="vr-to" type="date" value={range.to} min={range.from} onChange={(e) => setRange({ ...range, to: e.target.value })} />
        </div>
        <Button asChild disabled={!range.from || !range.to}>
          <Link href={`/fleet/vessels/${vesselId}/report?from=${range.from}&to=${range.to}`}>
            <FileText className="mr-1.5 h-4 w-4" />
            Open report
          </Link>
        </Button>
      </div>
      <p className="mt-3 text-[11.5px] text-muted-foreground">
        The report opens as a clean page. Use &quot;Print or save as PDF&quot; there to keep a copy.
      </p>
    </PanelCard>
  );
}
