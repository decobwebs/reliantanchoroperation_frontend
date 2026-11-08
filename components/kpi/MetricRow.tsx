"use client";

/**
 * One measure of a person's score: figure, target, weight, and which records
 * produced it. Tap to see the job document the target comes from.
 *
 * Shared by /my-performance (your own card) and /hr/people/[id] (HR and the
 * Bunker Manager looking at one person), so both always read the same way.
 */

import { useState } from "react";
import { ChevronRight, Info } from "lucide-react";
import { cn } from "@/lib/utils";
import { num, ratingBar, ratingTone, type MyMetric } from "@/lib/kpi-me";

export function MetricRow({ m }: { m: MyMetric }) {
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
