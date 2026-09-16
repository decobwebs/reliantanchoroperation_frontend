"use client";

/**
 * The operation report card, as a self-contained panel.
 *
 * Lives in its own component so it can appear in two places without the code
 * existing twice: the standalone `/operations/[id]/scorecard` page, and the
 * KPI tab inside the operation detail page.
 *
 * That mattered for a specific reason. The detail page is ~10,000 lines and is
 * used every day, so the edit there had to be as small as possible — replacing
 * a block of markup with a single component call, rather than pasting a
 * scorecard into it.
 *
 * Layout note: metric rows are flex blocks, not table rows. A six-column table
 * either scrolls sideways on a phone or shrinks past readability; these stack.
 */

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Gauge, ChevronDown, Users, Info } from "lucide-react";
import { api } from "@/lib/api";
import { PanelCard } from "@/components/dashboard/PanelCard";
import { QueryError } from "@/components/shared/QueryError";
import { Skeleton } from "@/components/ui/skeleton";
import { ScoreDial } from "@/components/dashboard/ScoreDial";
import { cn } from "@/lib/utils";
import type { ApiResponse } from "@/types";
import {
  metricValue, ratingTone, targetText,
  type Metric, type OperationScorecard, type RoleScore,
} from "@/lib/kpi-admin";

function MetricRow({ m }: { m: Metric }) {
  const measured = m.value !== null && m.value !== undefined;
  const tone = ratingTone(m.rating);

  return (
    <div
      className={cn(
        "flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:gap-4",
        !measured && "opacity-70"
      )}
    >
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="text-sm font-medium">{m.label}</span>
          {m.critical && (
            <span className="rounded-full bg-rose-500/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-rose-600">
              Critical
            </span>
          )}
          {m.source === "graded" && (
            <span className="rounded-full bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-600">
              Judged
            </span>
          )}
          {m.target_overridden && (
            <span
              className="rounded-full bg-sky-500/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-sky-600"
              title="This target has been changed from the default"
            >
              Custom target
            </span>
          )}
        </div>
        {!measured && m.no_data_reason && (
          <p className="mt-0.5 text-xs text-muted-foreground">{m.no_data_reason}</p>
        )}
        {measured && m.sample_size ? (
          <p className="mt-0.5 text-xs text-muted-foreground">
            from {m.sample_size} record{m.sample_size === 1 ? "" : "s"}
          </p>
        ) : null}
      </div>

      <div className="flex shrink-0 items-baseline gap-3 sm:w-44 sm:justify-end">
        <span className="font-mono text-sm tabular-nums">{metricValue(m)}</span>
        {m.target !== null && m.target !== undefined && (
          <span className="font-mono text-xs tabular-nums text-muted-foreground">
            {targetText(m)}
          </span>
        )}
      </div>

      <div className="flex shrink-0 items-center gap-2 sm:w-32">
        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
          {m.score !== null && m.score !== undefined && (
            <div
              className={cn("h-full rounded-full transition-all", tone.bar)}
              style={{ width: `${Math.max(0, Math.min(100, m.score))}%` }}
            />
          )}
        </div>
        <span
          className={cn(
            "w-8 shrink-0 text-right font-mono text-xs tabular-nums",
            m.score !== null && m.score !== undefined ? tone.text : "text-muted-foreground/40"
          )}
        >
          {m.score !== null && m.score !== undefined ? Math.round(m.score) : ""}
        </span>
      </div>
    </div>
  );
}

function RoleSection({ role }: { role: RoleScore }) {
  const [open, setOpen] = useState(true);
  const measured = role.metrics.filter(
    (m) => m.value !== null && m.value !== undefined
  ).length;

  return (
    <PanelCard
      icon={Gauge}
      tone="blue"
      title={role.role_label}
      subtitle={`${measured} of ${role.metrics.length} measures recorded`}
      action={
        <button
          onClick={() => setOpen((o) => !o)}
          className="flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground"
          aria-expanded={open}
        >
          {open ? "Hide" : "Show"}
          <ChevronDown
            className={cn("h-3.5 w-3.5 transition-transform", open && "rotate-180")}
          />
        </button>
      }
      flush
    >
      <div className="flex items-center gap-4 border-b border-border/60 px-4 py-3">
        <ScoreDial
          score={role.score}
          rating={role.rating}
          size="sm"
          emptyLabel="Too little data"
        />
        <p className="text-xs leading-relaxed text-muted-foreground">
          {role.score !== null && role.score !== undefined
            ? "The weighted result of the measures below. Measures with nothing recorded are left out rather than counted as zero."
            : "Not enough was recorded on this operation for a fair score. Nothing here counts against anyone."}
        </p>
      </div>
      {open && (
        <div className="divide-y divide-border/60">
          {role.metrics.map((m) => (
            <MetricRow key={m.key} m={m} />
          ))}
        </div>
      )}
    </PanelCard>
  );
}

export function OperationScorecardPanel({
  operationId,
  showHeadline = true,
}: {
  operationId: string;
  /** The standalone page shows its own big headline; the tab wants it inline. */
  showHeadline?: boolean;
}) {
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["kpi-scorecard", operationId],
    refetchOnWindowFocus: false,
    queryFn: async () => {
      const res = await api.get<ApiResponse<OperationScorecard>>(
        `/kpi/operations/${operationId}/scorecard`
      );
      return res.data.data;
    },
  });

  if (isError) return <QueryError error={error} onRetry={() => refetch()} />;

  if (isLoading || !data) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-40 rounded-2xl" />
        <Skeleton className="h-64 rounded-2xl" />
      </div>
    );
  }

  const scoredRoles = data.roles.filter(
    (r) => r.score !== null && r.score !== undefined
  ).length;

  return (
    <div className="space-y-4">
      {showHeadline && (
        <PanelCard icon={Gauge} tone="blue" title="Overall" flush>
          <div className="flex flex-col items-center gap-5 px-4 py-6 sm:flex-row sm:items-center sm:gap-8">
            <ScoreDial
              score={data.overall_score}
              rating={data.overall_rating}
              size="lg"
              emptyLabel="Not enough data"
            />
            <div className="min-w-0 flex-1 text-center sm:text-left">
              <p className="font-mono text-lg font-semibold">{data.operation_number}</p>
              <p className="mt-0.5 text-sm capitalize text-muted-foreground">
                {(data.operation_type ?? "").replace(/_/g, " ")}
                {data.status ? ` · ${data.status.replace(/_/g, " ")}` : ""}
              </p>
              <p className="mt-3 max-w-prose text-sm leading-relaxed text-muted-foreground">
                {data.overall_score !== null && data.overall_score !== undefined ? (
                  <>
                    Combined across {scoredRoles} scored{" "}
                    {scoredRoles === 1 ? "role" : "roles"}. Every figure below comes
                    from records already in the system — nothing was entered
                    specially for this page.
                  </>
                ) : (
                  <>
                    Too little has been recorded on this operation to score it
                    fairly. This is an absence of data, not a poor result.
                  </>
                )}
              </p>
            </div>
          </div>
        </PanelCard>
      )}

      <div className="flex items-start gap-3 rounded-xl border border-sky-500/25 bg-sky-500/5 px-4 py-3">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-sky-600" />
        <p className="text-sm leading-relaxed text-muted-foreground">
          A measure with nothing recorded is <strong>left out</strong> of the score
          and its weight shared among the rest — never counted as zero. A stage
          that has not been reached has not been failed.
        </p>
      </div>

      {data.roles.map((r) => (
        <RoleSection key={r.role} role={r} />
      ))}

      <PanelCard
        icon={Users}
        tone="slate"
        title="Who worked on this operation"
        subtitle="Drawn from the records each person created"
        flush
      >
        {data.contributors.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            No individual contributions are recorded against this operation.
          </p>
        ) : (
          <div className="divide-y divide-border/60">
            {data.contributors.map((c) => (
              <div
                key={c.user_id}
                className="flex flex-col gap-1 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium">{c.full_name}</p>
                  <p className="text-xs text-muted-foreground">{c.role_label}</p>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {c.involvement.map((i) => (
                    <span
                      key={i}
                      className="rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground"
                    >
                      {i}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </PanelCard>

      <p className="text-center font-mono text-xs text-muted-foreground">
        Computed {new Date(data.computed_at).toLocaleString()} from live records.
      </p>
    </div>
  );
}
