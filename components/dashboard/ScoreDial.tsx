"use client";

/**
 * The score, shown as a ring.
 *
 * A number alone ("74") makes the reader do the work of remembering what good
 * looks like. The ring encodes it: how full, and what colour. The rating word
 * underneath is the company's own vocabulary, so the visual and the language
 * agree.
 *
 * An unscored subject renders an empty ring and the reason — never a zero,
 * which would read as a catastrophic score rather than an absence of one.
 */

import { cn } from "@/lib/utils";
import { ratingTone } from "@/lib/kpi-admin";

interface ScoreDialProps {
  score?: number | null;
  rating?: string | null;
  /** Rendered under the ring when there is no score. */
  emptyLabel?: string;
  size?: "sm" | "md" | "lg";
  className?: string;
}

const SIZES = {
  sm: { box: 64, stroke: 6, text: "text-base", label: "text-[10px]" },
  md: { box: 96, stroke: 8, text: "text-2xl", label: "text-[11px]" },
  lg: { box: 132, stroke: 10, text: "text-4xl", label: "text-xs" },
};

const STROKE: Record<string, string> = {
  Excellent: "stroke-emerald-500",
  Good: "stroke-sky-500",
  "Needs Improvement": "stroke-amber-500",
  Unsatisfactory: "stroke-rose-500",
};

export function ScoreDial({
  score,
  rating,
  emptyLabel,
  size = "md",
  className,
}: ScoreDialProps) {
  const s = SIZES[size];
  const r = (s.box - s.stroke) / 2;
  const circumference = 2 * Math.PI * r;
  const has = score !== null && score !== undefined;
  const pct = has ? Math.max(0, Math.min(100, score)) : 0;
  const tone = ratingTone(rating);

  return (
    <div className={cn("flex flex-col items-center gap-1.5", className)}>
      <div className="relative" style={{ width: s.box, height: s.box }}>
        <svg
          width={s.box}
          height={s.box}
          viewBox={`0 0 ${s.box} ${s.box}`}
          className="-rotate-90"
          aria-hidden="true"
        >
          <circle
            cx={s.box / 2}
            cy={s.box / 2}
            r={r}
            fill="none"
            strokeWidth={s.stroke}
            className="stroke-muted"
          />
          {has && (
            <circle
              cx={s.box / 2}
              cy={s.box / 2}
              r={r}
              fill="none"
              strokeWidth={s.stroke}
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={circumference - (pct / 100) * circumference}
              className={cn(
                STROKE[rating ?? ""] ?? "stroke-muted-foreground/40",
                "transition-[stroke-dashoffset] duration-700 ease-out motion-reduce:transition-none"
              )}
            />
          )}
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span
            className={cn(
              "font-mono font-semibold tabular-nums",
              s.text,
              has ? tone.text : "text-muted-foreground/40"
            )}
          >
            {has ? Math.round(score) : "—"}
          </span>
        </div>
      </div>
      {has ? (
        rating && (
          <span
            className={cn(
              "rounded-full px-2 py-0.5 font-medium",
              s.label,
              tone.bg,
              tone.text
            )}
          >
            {rating}
          </span>
        )
      ) : (
        <span className={cn("text-center text-muted-foreground", s.label)}>
          {emptyLabel ?? "Not scored"}
        </span>
      )}
    </div>
  );
}
