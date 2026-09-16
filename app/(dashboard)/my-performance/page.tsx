"use client";

/**
 * My Performance — every staff member's own scorecard (KPI Phase 2).
 *
 * The page is written to be argued with. Each metric shows the figure, the
 * target, the job document the target came from, and which of the person's
 * own records produced it — so a number someone disputes can be checked
 * against the records rather than debated.
 *
 * Visibility: a staff member sees their own score against an anonymous team
 * median, never a colleague's number. The named leaderboard below is rendered
 * only for the Bunker Manager, and its endpoint refuses anyone else anyway.
 */

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Gauge, Target, Users, TrendingUp, Info, ClipboardCheck, FileText, Printer, ChevronRight,
} from "lucide-react";
import { api } from "@/lib/api";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { PanelCard } from "@/components/dashboard/PanelCard";
import { TrendStrip, type TrendPoint } from "@/components/dashboard/TrendStrip";
import { QueryError } from "@/components/shared/QueryError";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";
import type { ApiResponse } from "@/types";
import { getErrorMessage } from "@/lib/api";
import {
  num, periodLabel, ratingBar, ratingTone, recentPeriods,
  type GradableMetric, type Leaderboard, type LeaderboardRow,
  type MonthlyReport, type MyMetric, type MyScorecard,
} from "@/lib/kpi-me";

function MetricRow({ m }: { m: MyMetric }) {
  const [open, setOpen] = useState(false);
  const measured = m.value !== null && m.value !== undefined;

  return (
    <div className="py-3">
      {/* Stacks on a phone. Three columns squeezed onto a 360px screen left
          the measure name about 180px wide, so "Departure after loading" and
          its attribution line wrapped into an unreadable column. Below `sm`
          the name gets the full width and the figures sit in a row under it. */}
      <button
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full flex-col gap-2 text-left sm:flex-row sm:items-start sm:gap-3"
      >
        <div className="flex min-w-0 flex-1 items-start gap-2">
          <ChevronRight
            className={cn(
              "mt-0.5 h-4 w-4 shrink-0 text-muted-foreground transition-transform",
              open && "rotate-90"
            )}
            aria-hidden="true"
          />
          <div className="min-w-0 flex-1">
          <p className="flex items-center gap-2 text-sm font-medium">
            {m.label}
            {m.critical && (
              <span className="rounded bg-rose-500/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-rose-600">
                Critical
              </span>
            )}
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {measured ? (
              <>
                {m.attribution}
                {m.sample_size ? ` · ${m.sample_size} record${m.sample_size === 1 ? "" : "s"}` : ""}
              </>
            ) : (
              m.no_data_reason
            )}
          </p>
          </div>
        </div>

        {/* On a phone these sit in a row beneath the name, not beside it. */}
        <div className="flex items-start gap-4 pl-6 sm:contents">
        <div className="shrink-0 text-right sm:min-w-[5.5rem]">
          <p className="font-mono text-sm tabular-nums">
            {num(m.value, { dp: m.unit === "%" ? 2 : m.unit === "hours" ? 1 : 0 })}
            {measured && m.unit !== "count" && (
              <span className="ml-1 text-xs text-muted-foreground">
                {m.unit === "%" ? "%" : m.unit === "hours" ? "h" : m.unit}
              </span>
            )}
          </p>
          <p className="text-xs text-muted-foreground">
            target {num(m.target, { dp: m.target && m.target < 1 ? 3 : 0 })}
            {m.unit === "%" ? "%" : m.unit === "hours" ? "h" : ` ${m.unit}`}
          </p>
        </div>

        <div className="w-16 shrink-0 text-right">
          <p className={cn("font-mono text-sm tabular-nums", ratingTone(m.rating))}>
            {num(m.score, { dp: 0 })}
          </p>
          {/* Ten rows of bare 0-100 numbers all read the same weight. The bar
              makes the weak measures findable in one glance instead of ten
              comparisons — which is the whole question a person opens this
              page to answer. Absent scores get no bar, not an empty track. */}
          {m.score !== null && m.score !== undefined && (
            <div className="mt-1 h-1 w-full overflow-hidden rounded-full bg-muted">
              <div
                className={cn("h-full rounded-full", ratingBar(m.rating))}
                style={{ width: `${Math.max(2, Math.min(m.score, 100))}%` }}
              />
            </div>
          )}
          <p className="mt-1 text-[10px] uppercase tracking-wide text-muted-foreground">
            {Math.round(m.weight * 100)}% wt
          </p>
        </div>
        </div>
      </button>

      {m.grade_reason && (
        <p className="mt-2 rounded-lg border-l-2 border-l-violet-500/60 bg-muted/40 px-3 py-2 text-xs leading-relaxed">
          <span className="font-medium">{m.graded_by ?? "Graded"}:</span>{" "}
          <span className="text-muted-foreground">{m.grade_reason}</span>
        </p>
      )}

      {open && (
        <p className="mt-2 flex items-start gap-2 rounded-lg bg-muted/50 px-3 py-2 text-xs leading-relaxed text-muted-foreground">
          <Info className="mt-0.5 h-3 w-3 shrink-0" />
          <span>{m.doc}</span>
        </p>
      )}
    </div>
  );
}

/** Reason-gated grading, matching the pattern used elsewhere in RAOMS:
 *  the confirm button stays disabled until a real reason is written. */
function GradeForm({
  row,
  metric,
  period,
  onDone,
}: {
  row: LeaderboardRow;
  metric: GradableMetric;
  period: string;
  onDone: () => void;
}) {
  const [score, setScore] = useState(80);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);

  const save = useMutation({
    mutationFn: async () => {
      await api.post("/kpi/grades", {
        user_id: row.user_id,
        metric_key: metric.metric_key,
        score,
        period,
        reason,
      });
    },
    onSuccess: onDone,
    onError: (e) => setError(getErrorMessage(e)),
  });

  const ready = reason.trim().length >= 10 && !save.isPending;

  return (
    <div className="mt-2 space-y-2 rounded-lg border border-border bg-muted/40 p-3">
      <p className="text-xs font-medium">{metric.label}</p>
      <p className="text-xs text-muted-foreground">{metric.description}</p>

      <div className="flex items-center gap-3">
        <input
          type="range"
          min={0}
          max={100}
          value={score}
          onChange={(e) => setScore(Number(e.target.value))}
          className="flex-1"
        />
        <span className="w-10 text-right font-mono text-sm tabular-nums">{score}</span>
      </div>

      <textarea
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        rows={2}
        placeholder="Why this score? They will read this."
        className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-xs"
      />

      {error && <p className="text-xs text-rose-500">{error}</p>}

      <div className="flex items-center justify-between">
        <span className="text-[11px] text-muted-foreground">
          {reason.trim().length < 10
            ? `${10 - reason.trim().length} more characters needed`
            : "Saved to the record with your name against it"}
        </span>
        <div className="flex gap-2">
          <button onClick={onDone} className="text-xs text-muted-foreground hover:text-foreground">
            Cancel
          </button>
          <button
            disabled={!ready}
            onClick={() => save.mutate()}
            className="rounded-md bg-foreground px-3 py-1 text-xs font-medium text-background disabled:opacity-40"
          >
            {save.isPending ? "Saving…" : "Save grade"}
          </button>
        </div>
      </div>
    </div>
  );
}

interface MyTrend {
  points: TrendPoint[];
  direction?: string | null;
  has_history: boolean;
  message?: string | null;
}

export default function MyPerformancePage() {
  const { user, effectiveRole } = useAuth();
  const [period, setPeriod] = useState<string>(recentPeriods(1)[0]);
  const [showReport, setShowReport] = useState(false);
  const [grading, setGrading] = useState<string | null>(null);
  const isBM = effectiveRole === "bunker_manager";
  const queryClient = useQueryClient();

  const { data: trend, isLoading: trendLoading } = useQuery({
    queryKey: ["kpi-my-trend"],
    refetchOnWindowFocus: false,
    queryFn: async () => {
      const res = await api.get<ApiResponse<MyTrend>>("/kpi/trends/me?months=6");
      return res.data.data;
    },
  });

  const { data: report, isFetching: reportLoading } = useQuery({
    queryKey: ["kpi-report-me", period],
    enabled: showReport,
    refetchOnWindowFocus: false,
    queryFn: async () => {
      const res = await api.get<ApiResponse<MonthlyReport>>(`/kpi/reports/me?period=${period}`);
      return res.data.data;
    },
  });

  const { data: gradable } = useQuery({
    queryKey: ["kpi-gradable"],
    enabled: !!user && isBM,
    staleTime: 10 * 60_000,
    queryFn: async () => {
      const res = await api.get<ApiResponse<GradableMetric[]>>("/kpi/grades/metrics");
      return res.data.data;
    },
  });

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["kpi-me", period],
    enabled: !!user && effectiveRole !== "client",
    refetchOnWindowFocus: false,
    staleTime: 60_000,
    queryFn: async () => {
      const res = await api.get<ApiResponse<MyScorecard>>(`/kpi/me?period=${period}`);
      return res.data.data;
    },
  });

  const { data: board } = useQuery({
    queryKey: ["kpi-leaderboard", period],
    enabled: !!user && isBM,
    refetchOnWindowFocus: false,
    staleTime: 60_000,
    queryFn: async () => {
      const res = await api.get<ApiResponse<Leaderboard>>(`/kpi/leaderboard?period=${period}`);
      return res.data.data;
    },
  });

  const shell = {
    icon: Gauge,
    iconTone: "violet" as const,
    showRole: false,
    title: "My Performance",
    subtitle: "Your score, and exactly what it is built from",
  };

  const periodPicker = (
    <select
      value={period}
      onChange={(e) => setPeriod(e.target.value)}
      className="rounded-lg border border-border bg-background px-2 py-1 text-xs"
    >
      {recentPeriods(6).map((p) => (
        <option key={p} value={p}>
          {periodLabel(p)}
        </option>
      ))}
    </select>
  );

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
        <Skeleton className="h-40 rounded-2xl" />
        <Skeleton className="h-96 rounded-2xl" />
      </DashboardShell>
    );
  }

  const vsMedian =
    data.score != null && data.team_median != null ? data.score - data.team_median : null;

  return (
    <DashboardShell {...shell}>
      {/* ── the headline ── */}
      <PanelCard
        icon={Target}
        tone="violet"
        title={`${data.role_label} · ${periodLabel(data.period)}`}
        subtitle={data.provisional ? "This month is still running — figures will keep moving" : undefined}
        action={periodPicker}
      >
        {data.insufficient_data ? (
          <div className="py-4">
            <p className="text-sm">
              Not enough of your work was recorded this month to score you fairly.
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              {data.coverage.toFixed(0)}% of your role&apos;s measures have data
              ({data.metrics_measured} of {data.metrics_total}). A score built on a
              couple of records would say more about the paperwork than about you,
              so it is withheld until there is more to go on.
            </p>
          </div>
        ) : data.score == null ? (
          <div className="py-4">
            <p className="text-sm">Nothing was recorded against you this month.</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Scores appear once your work shows up in the system — trucks logged,
              vessel runs assigned, documents submitted or approved.
            </p>
          </div>
        ) : (
          <div className="flex flex-wrap items-end gap-x-12 gap-y-4">
            <div>
              <p className="font-mono text-5xl font-semibold tabular-nums leading-none">
                {data.score.toFixed(1)}
              </p>
              <p className={cn("mt-1 text-sm font-medium", ratingTone(data.rating))}>
                {data.rating}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Your team&apos;s median</p>
              <p className="font-mono text-2xl tabular-nums">
                {num(data.team_median, { dp: 1 })}
              </p>
              {vsMedian !== null && (
                <p
                  className={cn(
                    "text-xs",
                    vsMedian >= 0 ? "text-emerald-600" : "text-amber-600"
                  )}
                >
                  {vsMedian >= 0 ? "+" : ""}
                  {vsMedian.toFixed(1)} vs median of {data.team_size}
                </p>
              )}
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Measures with data</p>
              <p className="font-mono text-2xl tabular-nums">
                {data.metrics_measured}/{data.metrics_total}
              </p>
              <p className="text-xs text-muted-foreground">
                {data.coverage.toFixed(0)}% of your role covered
              </p>
            </div>
          </div>
        )}
      </PanelCard>

      {/* ── the breakdown ── */}
      <PanelCard
        icon={ClipboardCheck}
        tone="blue"
        title="What makes up your score"
        subtitle="Tap any measure to see the job document its target comes from"
      >
        {data.metrics.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            No measures are defined for your role yet.
          </p>
        ) : (
          <div className="divide-y divide-border/60">
            {data.metrics.map((m) => (
              <MetricRow key={m.key} m={m} />
            ))}
          </div>
        )}
      </PanelCard>

      {/* ── is this getting better or worse? ── */}
      <PanelCard
        icon={TrendingUp}
        tone="sky"
        title="Your score over time"
        subtitle="Closed months only — this month is still changing"
      >
        {trendLoading ? (
          <Skeleton className="h-32 rounded-xl" />
        ) : trend ? (
          <TrendStrip
            points={trend.points}
            direction={trend.direction}
            message={trend.message}
          />
        ) : (
          <p className="py-4 text-sm text-muted-foreground">
            History could not be loaded. Your score above is unaffected.
          </p>
        )}
      </PanelCard>

      {/* ── the report that writes itself ── */}
      <PanelCard
        icon={FileText}
        tone="emerald"
        title="Your monthly report"
        subtitle="Your job document's own template, filled in from the records"
        action={
          <div className="flex gap-3">
            {showReport && report && (
              <button
                onClick={() => window.print()}
                className="flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground"
              >
                <Printer className="h-3 w-3" /> Print
              </button>
            )}
            <button
              onClick={() => setShowReport((v) => !v)}
              className="text-xs font-medium text-muted-foreground hover:text-foreground"
            >
              {showReport ? "Hide" : "Generate"}
            </button>
          </div>
        }
      >
        {!showReport ? (
          <p className="py-4 text-sm text-muted-foreground">
            Every figure your monthly report asks for is already in the system.
            Generate it and only the written sections are left for you.
          </p>
        ) : reportLoading || !report ? (
          <Skeleton className="h-56 rounded-xl" />
        ) : (
          <div className="space-y-5">
            {report.sections.map((sec) => (
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
            <div className="rounded-lg border border-dashed border-border p-3">
              <p className="text-sm font-semibold">Left for you to write</p>
              <ul className="mt-1 list-inside list-disc text-sm text-muted-foreground">
                {report.to_complete.map((s) => (
                  <li key={s}>{s}</li>
                ))}
              </ul>
              <p className="mt-2 text-xs text-muted-foreground">
                The system fills in what it can prove. It will not write your
                account of what went wrong or what you plan to do next.
              </p>
            </div>
          </div>
        )}
      </PanelCard>

      {/* ── BM only ── */}
      {isBM && board && (
        <PanelCard
          icon={Users}
          tone="amber"
          title="Everyone this month"
          subtitle={`${board.scored_count} scored · ${board.unscored_count} without enough recorded work`}
          flush
        >
          <div className="divide-y divide-border/60">
            {board.rows.map((r) => {
              const metric = (gradable ?? []).find((g) => g.role === r.role);
              return (
                <div key={r.user_id} className="px-4 py-2.5">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{r.full_name}</p>
                      <p className="text-xs text-muted-foreground">
                        {r.role_label}
                        {r.score == null &&
                          (r.insufficient_data
                            ? ` · only ${r.coverage.toFixed(0)}% covered`
                            : " · nothing recorded")}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-4">
                      {metric && (
                        <button
                          onClick={() =>
                            setGrading(grading === r.user_id ? null : r.user_id)
                          }
                          className="text-xs font-medium text-muted-foreground hover:text-foreground"
                        >
                          {grading === r.user_id ? "Close" : "Grade"}
                        </button>
                      )}
                      <div className="text-right">
                        <p className={cn("font-mono text-sm tabular-nums", ratingTone(r.rating))}>
                          {num(r.score, { dp: 1 })}
                        </p>
                        <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                          {r.metrics_measured}/{r.metrics_total}
                        </p>
                      </div>
                    </div>
                  </div>

                  {grading === r.user_id && metric && (
                    <GradeForm
                      row={r}
                      metric={metric}
                      period={period}
                      onDone={() => {
                        setGrading(null);
                        queryClient.invalidateQueries({ queryKey: ["kpi-leaderboard"] });
                        queryClient.invalidateQueries({ queryKey: ["kpi-me"] });
                      }}
                    />
                  )}
                </div>
              );
            })}
          </div>
        </PanelCard>
      )}

      <p className="flex items-center justify-center gap-1.5 pt-2 text-center text-xs text-muted-foreground">
        <TrendingUp className="h-3 w-3" />
        Every figure here comes from records already in the system. Nothing is
        entered by hand, and nothing is graded by opinion.
      </p>
    </DashboardShell>
  );
}
