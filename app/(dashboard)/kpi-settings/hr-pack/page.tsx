"use client";

/**
 * The HR grading pack, as a document a person can actually read.
 *
 * This replaces a raw JSON download. The data was always correct; it was
 * handed over in a developer's format, which meant the person it was built for
 * — an HR officer or the Bunker Manager — could not use it at all.
 *
 * Two things shape the layout:
 *
 *  1. It is meant to be PRINTED and taken into a grading conversation. So it
 *     is a document, not a dashboard: one section per person, ordered, with
 *     page breaks between them and the navigation hidden on paper.
 *  2. Every number shows where it came from. If a person disputes a score,
 *     the answer has to be a record, not an opinion.
 */

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { ArrowLeft, Printer, FileDown, Users } from "lucide-react";
import { api } from "@/lib/api";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { QueryError } from "@/components/shared/QueryError";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";
import type { ApiResponse } from "@/types";
import {
  metricValue, num, periodLabel, periodOption, ratingTone, targetText,
  type HrPack, type HrPackPerson,
} from "@/lib/kpi-admin";

function PersonSection({ p }: { p: HrPackPerson }) {
  const tone = ratingTone(p.rating);
  const scored = p.score !== null && p.score !== undefined;

  return (
    <section className="hr-person break-inside-avoid rounded-xl border border-border bg-card p-5 print:break-before-page print:rounded-none print:border-0 print:p-0 print:pt-6">
      {/* who */}
      <div className="flex flex-col gap-3 border-b border-border pb-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h2 className="text-lg font-semibold">{p.full_name}</h2>
          <p className="text-sm text-muted-foreground">{p.role_label}</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-right">
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
              Data available
            </p>
            <p className="font-mono text-sm tabular-nums">
              {p.metrics_measured} of {p.metrics_total}
              {p.coverage !== null && p.coverage !== undefined
                ? ` · ${num(p.coverage, { dp: 0 })}%`
                : ""}
            </p>
          </div>
          <div className="text-right">
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
              Score
            </p>
            {scored ? (
              <p className={cn("font-mono text-2xl font-semibold tabular-nums", tone.text)}>
                {num(p.score, { dp: 1 })}
              </p>
            ) : (
              <p className="text-sm text-muted-foreground">Not scored</p>
            )}
          </div>
          {scored && p.rating && (
            <span
              className={cn(
                "shrink-0 rounded-full px-2.5 py-1 text-xs font-medium",
                tone.bg,
                tone.text
              )}
            >
              {p.rating}
            </span>
          )}
        </div>
      </div>

      {!scored && (
        <p className="mt-3 rounded-lg bg-muted/50 px-3 py-2 text-sm text-muted-foreground">
          Not enough was recorded under this person&apos;s account this month to
          score them fairly. This is an absence of data, not poor performance, and
          it should not count against them.
        </p>
      )}

      {/* the measures */}
      <div className="mt-4 space-y-3">
        {p.metrics.map((m, i) => {
          const mTone = ratingTone(undefined);
          const measured = m.value !== null && m.value !== undefined;
          return (
            <div
              key={`${m.label}-${i}`}
              className={cn(
                "flex flex-col gap-1 border-b border-border/50 pb-3 last:border-0 sm:flex-row sm:items-start sm:gap-4",
                !measured && "opacity-70"
              )}
            >
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-medium">{m.label}</span>
                  {m.critical && (
                    <span className="rounded-full bg-rose-500/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-rose-600">
                      Critical
                    </span>
                  )}
                </div>
                {m.attribution && (
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Comes from: {m.attribution}
                  </p>
                )}
                {m.grade_reason && (
                  <p className="mt-1 text-xs italic text-muted-foreground">
                    “{m.grade_reason}”
                    {m.graded_by ? ` — ${m.graded_by}` : ""}
                  </p>
                )}
                {!measured && (
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Nothing recorded this month
                  </p>
                )}
              </div>

              <div className="flex shrink-0 gap-5 sm:w-64 sm:justify-end">
                <div className="text-right">
                  <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                    Their figure
                  </p>
                  <p className="font-mono text-sm tabular-nums">{metricValue(m)}</p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                    Target
                  </p>
                  <p className="font-mono text-sm tabular-nums text-muted-foreground">
                    {targetText({ target: m.target, unit: m.unit })}
                  </p>
                </div>
                <div className="w-12 text-right">
                  <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                    Score
                  </p>
                  <p className={cn("font-mono text-sm tabular-nums", mTone.text)}>
                    {m.score !== null && m.score !== undefined
                      ? Math.round(m.score)
                      : ""}
                  </p>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* space for the grading conversation itself */}
      <div className="mt-4 hidden border-t border-border pt-3 print:block">
        <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
          Grader&apos;s notes
        </p>
        <div className="mt-1 h-16 rounded border border-dashed border-border" />
      </div>
    </section>
  );
}

export default function HrPackPage() {
  const { user, effectiveRole } = useAuth();
  const canSee = user && effectiveRole ? effectiveRole === "bunker_manager" : true;
  const periods = [0, 1, 2, 3, 4, 5].map(periodOption);
  const [period, setPeriod] = useState(periodOption(1).value);


  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["kpi-hr-pack", period],
    enabled: canSee,
    refetchOnWindowFocus: false,
    queryFn: async () => {
      const res = await api.get<ApiResponse<HrPack>>(
        `/kpi/reports/hr-pack?period=${period}`
      );
      return res.data.data;
    },
  });

  const saveJson = () => {
    if (!data) return;
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `hr-pack-${period}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const shell = {
    icon: Users,
    iconTone: "emerald" as const,
    showRole: false,
    title: "HR grading pack",
    subtitle: periodLabel(period),
    actions: (
      <Link
        href="/kpi-settings"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to KPI Settings
      </Link>
    ),
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

  return (
    <DashboardShell {...shell}>
      {/* Hide everything except the document itself when printing. */}
      <style>{`
        @media print {
          nav, aside, header button, .print\\:hidden { display: none !important; }
          body { background: #fff !important; }
          .hr-person:first-of-type { break-before: auto !important; }
        }
      `}</style>

      {/* controls — screen only */}
      <div className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4 sm:flex-row sm:items-end print:hidden">
        <div className="flex-1">
          <label htmlFor="period" className="text-xs text-muted-foreground">
            Month
          </label>
          <select
            id="period"
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
            className="mt-1 h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
          >
            {periods.map((p) => (
              <option key={p.value} value={p.value}>
                {p.label}
              </option>
            ))}
          </select>
        </div>
        <Button onClick={() => window.print()} disabled={!data} className="shrink-0">
          <Printer className="mr-1.5 h-4 w-4" />
          Print or save as PDF
        </Button>
        <Button
          variant="outline"
          onClick={saveJson}
          disabled={!data}
          className="shrink-0"
          title="Raw data, for a spreadsheet or another system"
        >
          <FileDown className="mr-1.5 h-4 w-4" />
          Raw data
        </Button>
      </div>

      {isLoading || !data ? (
        <>
          <Skeleton className="h-32 rounded-2xl" />
          <Skeleton className="h-64 rounded-2xl" />
        </>
      ) : (
        <>
          {/* cover */}
          <div className="rounded-xl border border-border bg-card p-5">
            <h1 className="text-xl font-semibold">
              Performance pack — {periodLabel(data.period)}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Every staff member&apos;s figures and the records behind them, so
              grading is done from evidence rather than memory.
            </p>
            <div className="mt-4 flex flex-wrap gap-6">
              <div>
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                  Staff
                </p>
                <p className="font-mono text-lg tabular-nums">{data.staff_total}</p>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                  Scored
                </p>
                <p className="font-mono text-lg tabular-nums">{data.scored}</p>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                  Prepared
                </p>
                <p className="font-mono text-sm tabular-nums">
                  {new Date(data.generated_at).toLocaleString()}
                </p>
              </div>
            </div>

            {data.scored < data.staff_total && (
              <p className="mt-4 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-900 dark:text-amber-200">
                <strong>
                  {data.staff_total - data.scored} of {data.staff_total} staff have
                  no score this month.
                </strong>{" "}
                Work is only measured when it is recorded under a person&apos;s own
                account. An absent score means nothing was recorded — it is not a
                poor result and must not be graded as one.
              </p>
            )}
          </div>

          {data.people.map((p) => (
            <PersonSection key={p.user_id} p={p} />
          ))}

          <p className="pt-2 text-center text-xs text-muted-foreground print:pt-6">
            Figures read from live records on{" "}
            {new Date(data.generated_at).toLocaleDateString()}. Scores change as
            records are added or corrected.
          </p>
        </>
      )}
    </DashboardShell>
  );
}
