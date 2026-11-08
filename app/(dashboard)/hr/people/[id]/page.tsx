"use client";

/**
 * One staff member, seen by HR or the Bunker Manager. Read only.
 *
 * The same card the person sees about themselves on /my-performance: the
 * score, every measure behind it, the trend, and the monthly report. HR can
 * print it for an appraisal; grading stays with the Bunker Manager.
 */

import { Suspense, use, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowLeft, ClipboardCheck, FileText, Mail, Phone, Printer, Target, TrendingUp, UserRound,
} from "lucide-react";
import { api } from "@/lib/api";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { PanelCard } from "@/components/dashboard/PanelCard";
import { TrendStrip, type TrendPoint } from "@/components/dashboard/TrendStrip";
import { MetricRow } from "@/components/kpi/MetricRow";
import { QueryError } from "@/components/shared/QueryError";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";
import type { ApiResponse } from "@/types";
import {
  num, periodLabel, ratingTone, recentPeriods, type MonthlyReport,
} from "@/lib/kpi-me";
import { HR_VIEWER_ROLES, lastFullMonth, type PersonScorecard } from "@/lib/hr";

interface PersonTrend {
  points: TrendPoint[];
  direction?: string | null;
  has_history: boolean;
  message?: string | null;
}

const PERIOD_RE = /^\d{4}-(0[1-9]|1[0-2])$/;

function PersonView({ id }: { id: string }) {
  const { user, effectiveRole } = useAuth();
  const allowed = !effectiveRole || HR_VIEWER_ROLES.includes(effectiveRole);
  const qp = useSearchParams().get("period");
  const [period, setPeriod] = useState(qp && PERIOD_RE.test(qp) ? qp : lastFullMonth());

  const card = useQuery({
    queryKey: ["hr-person", id, period],
    enabled: !!user && allowed,
    refetchOnWindowFocus: false,
    queryFn: async () => {
      const res = await api.get<ApiResponse<PersonScorecard>>(`/kpi/people/${id}?period=${period}`);
      return res.data.data;
    },
  });

  const trend = useQuery({
    queryKey: ["hr-person-trend", id],
    enabled: !!user && allowed,
    refetchOnWindowFocus: false,
    queryFn: async () => {
      const res = await api.get<ApiResponse<PersonTrend>>(`/kpi/people/${id}/trend?months=6`);
      return res.data.data;
    },
  });

  const report = useQuery({
    queryKey: ["hr-person-report", id, period],
    enabled: !!user && allowed && !!card.data?.scored_role,
    refetchOnWindowFocus: false,
    queryFn: async () => {
      const res = await api.get<ApiResponse<MonthlyReport>>(`/kpi/people/${id}/report?period=${period}`);
      return res.data.data;
    },
  });

  const data = card.data;

  const shell = {
    icon: UserRound,
    iconTone: "violet" as const,
    showRole: false,
    title: data?.full_name ?? "Staff member",
    subtitle: data ? `${data.role_label} · ${periodLabel(period)}` : periodLabel(period),
    actions: (
      <div className="flex items-center gap-2 print:hidden">
        <Link
          href="/hr/performance"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </Link>
        <Button size="sm" onClick={() => window.print()} disabled={!data}>
          <Printer className="mr-1.5 h-4 w-4" />
          Print
        </Button>
      </div>
    ),
  };

  if (user && !allowed) {
    return (
      <DashboardShell {...shell} actions={undefined} subtitle="Restricted">
        <QueryError error={{ isAxiosError: true, response: { status: 403 } }} />
      </DashboardShell>
    );
  }
  if (card.isError) {
    return (
      <DashboardShell {...shell}>
        <QueryError error={card.error} onRetry={() => card.refetch()} />
      </DashboardShell>
    );
  }
  if (card.isLoading || !data) {
    return (
      <DashboardShell {...shell}>
        <Skeleton className="h-40 rounded-2xl" />
        <Skeleton className="h-96 rounded-2xl" />
      </DashboardShell>
    );
  }

  const vsMedian =
    data.score != null && data.team_median != null && data.team_size > 1
      ? data.score - data.team_median
      : null;

  const periodPicker = (
    <select
      value={period}
      onChange={(e) => setPeriod(e.target.value)}
      aria-label="Month"
      className="rounded-lg border border-border bg-background px-2 py-1 text-xs print:hidden"
    >
      {recentPeriods(12).map((p) => (
        <option key={p} value={p}>{periodLabel(p)}</option>
      ))}
    </select>
  );

  return (
    <DashboardShell {...shell}>
      <style>{`
        @media print {
          nav, aside, header button, .print\\:hidden { display: none !important; }
          body { background: #fff !important; }
        }
      `}</style>

      {/* who */}
      <div className="flex flex-wrap items-center gap-x-5 gap-y-1 rounded-xl border border-border bg-card px-4 py-3 text-sm">
        <span className="inline-flex min-w-0 items-center gap-1.5 text-muted-foreground">
          <Mail className="h-3.5 w-3.5 shrink-0" />
          <span className="truncate">{data.email}</span>
        </span>
        {data.phone && (
          <span className="inline-flex items-center gap-1.5 text-muted-foreground">
            <Phone className="h-3.5 w-3.5" />
            {data.phone}
          </span>
        )}
        {!data.is_active && (
          <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            Account switched off
          </span>
        )}
      </div>

      {/* headline */}
      <PanelCard
        icon={Target}
        tone="violet"
        title={`Score · ${periodLabel(data.period)}`}
        subtitle={data.provisional ? "This month is still running, so figures will change" : undefined}
        action={periodPicker}
      >
        {!data.scored_role ? (
          <p className="py-4 text-sm text-muted-foreground">
            The {data.role_label} role has no performance measures yet, so there is no score.
          </p>
        ) : data.insufficient_data ? (
          <div className="py-4">
            <p className="text-sm">Not enough of their work was recorded this month to score them fairly.</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {data.coverage.toFixed(0)}% of the role&apos;s measures have data ({data.metrics_measured} of{" "}
              {data.metrics_total}). A low figure here usually means missing records, not poor work.
            </p>
          </div>
        ) : data.score == null ? (
          <div className="py-4">
            <p className="text-sm">Nothing was recorded against them this month.</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Check with their manager: were they on leave, or is their work not being logged in the system?
            </p>
          </div>
        ) : (
          <div className="flex flex-wrap items-end gap-x-12 gap-y-4">
            <div>
              <p className="font-mono text-5xl font-semibold leading-none tabular-nums">{data.score.toFixed(1)}</p>
              <p className={cn("mt-1 text-sm font-medium", ratingTone(data.rating))}>{data.rating}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">{data.role_label} median</p>
              <p className="font-mono text-2xl tabular-nums">{num(data.team_median, { dp: 1 })}</p>
              {vsMedian !== null ? (
                <p className={cn("text-xs", vsMedian >= 0 ? "text-emerald-600" : "text-amber-600")}>
                  {vsMedian >= 0 ? "+" : ""}
                  {vsMedian.toFixed(1)} vs {data.team_size} in the role
                </p>
              ) : (
                <p className="text-xs text-muted-foreground">Only person scored in this role</p>
              )}
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Measures with data</p>
              <p className="font-mono text-2xl tabular-nums">
                {data.metrics_measured}/{data.metrics_total}
              </p>
              <p className="text-xs text-muted-foreground">{data.coverage.toFixed(0)}% covered</p>
            </div>
          </div>
        )}
      </PanelCard>

      {/* breakdown */}
      {data.scored_role && (
        <PanelCard
          icon={ClipboardCheck}
          tone="blue"
          title="What makes up the score"
          subtitle="Tap a measure to see the job document its target comes from"
        >
          {data.metrics.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">No measures recorded.</p>
          ) : (
            <div className="divide-y divide-border/60">
              {data.metrics.map((m) => <MetricRow key={m.key} m={m} />)}
            </div>
          )}
        </PanelCard>
      )}

      {/* trend */}
      {data.scored_role && (
        <PanelCard icon={TrendingUp} tone="sky" title="Score over time" subtitle="Last 6 months">
          {trend.isLoading ? (
            <Skeleton className="h-32 rounded-xl" />
          ) : trend.data ? (
            <TrendStrip points={trend.data.points} direction={trend.data.direction} message={trend.data.message} />
          ) : (
            <p className="py-4 text-sm text-muted-foreground">History could not be loaded.</p>
          )}
        </PanelCard>
      )}

      {/* monthly report */}
      {data.scored_role && (
        <PanelCard
          icon={FileText}
          tone="emerald"
          title="Monthly report"
          subtitle="Their job document's template, filled in from the records"
        >
          {report.isLoading || !report.data ? (
            report.isError ? (
              <QueryError error={report.error} onRetry={() => report.refetch()} />
            ) : (
              <Skeleton className="h-56 rounded-xl" />
            )
          ) : (
            <div className="space-y-5">
              {report.data.sections.map((sec) => (
                <div key={sec.heading}>
                  <p className="text-sm font-semibold">{sec.heading}</p>
                  <p className="mb-2 text-xs text-muted-foreground">{sec.source}</p>
                  <div className="divide-y divide-border/60">
                    {sec.rows.map(([label, value], i) => (
                      <div key={i} className="flex justify-between gap-4 py-1.5 text-sm">
                        <span className="text-muted-foreground">{label}</span>
                        <span className="text-right font-mono tabular-nums">{value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
              {report.data.to_complete.length > 0 && (
                <div className="rounded-lg border border-dashed border-border p-3">
                  <p className="text-sm font-semibold">Written by the staff member</p>
                  <ul className="mt-1 list-inside list-disc text-sm text-muted-foreground">
                    {report.data.to_complete.map((s) => <li key={s}>{s}</li>)}
                  </ul>
                </div>
              )}
            </div>
          )}
        </PanelCard>
      )}

      <p className="text-center text-xs text-muted-foreground">
        Read only. Grades are entered by the Bunker Manager.
      </p>
    </DashboardShell>
  );
}

export default function PersonPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return (
    <Suspense fallback={null}>
      <PersonView id={id} />
    </Suspense>
  );
}
