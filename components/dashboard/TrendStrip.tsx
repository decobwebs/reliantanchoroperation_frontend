"use client";

/**
 * Score history as a row of months.
 *
 * Two rules this has to respect, and both are easy to get wrong with a chart:
 *
 *  1. **A month with no score is blank, not zero.** "Nobody was scored" and
 *     "everybody scored nothing" are completely different facts, and a line
 *     drawn through zero turns the first into the second — inventing a
 *     collapse that never happened. Missing months render as an empty slot.
 *
 *  2. **The current month is not settled.** It is still accumulating, so it is
 *     drawn dashed and labelled, never presented as a finished result.
 *
 * A row of bars rather than a line chart, deliberately: with most months empty
 * a line has almost nothing to connect, and gaps in a line read as a dip.
 */

import { cn } from "@/lib/utils";

export interface TrendPoint {
  period: string;
  score?: number | null;
  rating?: string | null;
  provisional?: boolean;
  recorded?: boolean;
  people_scored?: number;
}

function monthLabel(period: string): string {
  const [y, m] = period.split("-").map(Number);
  if (!y || !m) return period;
  return new Date(y, m - 1, 1).toLocaleDateString(undefined, { month: "short" });
}

function toneFor(score: number | null | undefined): string {
  if (score === null || score === undefined) return "bg-muted";
  if (score >= 90) return "bg-emerald-500";
  if (score >= 75) return "bg-sky-500";
  if (score >= 60) return "bg-amber-500";
  return "bg-rose-500";
}

export function TrendStrip({
  points,
  message,
  direction,
  className,
}: {
  points: TrendPoint[];
  message?: string | null;
  direction?: string | null;
  className?: string;
}) {
  const scored = points.filter(
    (p) => p.score !== null && p.score !== undefined
  ) as Required<Pick<TrendPoint, "score">>[] & TrendPoint[];

  // Scale to the real range so small movements stay visible, but never let a
  // single point fill the frame — that would imply a trend from one month.
  const max = scored.length ? Math.max(...scored.map((p) => p.score as number), 100) : 100;

  return (
    <div className={cn("space-y-3", className)}>
      <div className="flex items-end gap-2">
        {points.map((p) => {
          const has = p.score !== null && p.score !== undefined;
          const pct = has ? Math.max(6, ((p.score as number) / max) * 100) : 0;
          return (
            <div key={p.period} className="flex min-w-0 flex-1 flex-col items-center gap-1.5">
              <div className="flex h-20 w-full items-end justify-center">
                {has ? (
                  <div
                    className={cn(
                      "w-full rounded-t transition-all",
                      toneFor(p.score),
                      p.provisional && "opacity-60 ring-1 ring-inset ring-foreground/20"
                    )}
                    style={{ height: `${pct}%` }}
                    title={`${p.period}: ${(p.score as number).toFixed(1)}`}
                  />
                ) : (
                  // An empty slot, not a zero bar.
                  <div className="h-full w-full rounded-t border border-dashed border-border/70" />
                )}
              </div>
              <span className="font-mono text-[10px] tabular-nums text-muted-foreground">
                {monthLabel(p.period)}
              </span>
              <span className="font-mono text-[11px] font-medium tabular-nums">
                {has ? (p.score as number).toFixed(0) : ""}
              </span>
            </div>
          );
        })}
      </div>

      {points.some((p) => p.provisional) && (
        <p className="text-xs text-muted-foreground">
          The faded bar is this month — still changing, not a final score.
        </p>
      )}

      {direction && (
        <p className="text-sm">
          Overall:{" "}
          <span
            className={cn(
              "font-medium",
              direction === "improving" && "text-emerald-600",
              direction === "slipping" && "text-rose-600"
            )}
          >
            {direction}
          </span>
        </p>
      )}

      {message && <p className="text-xs text-muted-foreground">{message}</p>}
    </div>
  );
}
