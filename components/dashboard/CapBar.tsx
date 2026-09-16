"use client";

/**
 * A value measured against a limit, shown as a bar.
 *
 * The league tables previously printed the average loss as bare text —
 * "2,370 L" — with the cap named once in the panel subtitle. Reading that
 * meant holding 1,500 in your head and doing the comparison again on every
 * row. Ten rows, ten small calculations, on a phone, in a hurry.
 *
 * The bar does the comparison for you. The cap is drawn as a fixed marker at
 * the same position on every row, so the rows are also comparable with each
 * other at a glance — which the numbers alone never were.
 *
 * Scale is fixed at twice the cap rather than to the largest value, so the
 * marker sits mid-track and a row's meaning does not change when a new worst
 * offender appears. Anything beyond twice the cap is clamped and marked, since
 * past that point the exact figure matters less than "far over".
 */

import { cn } from "@/lib/utils";

export function CapBar({
  value,
  cap,
  className,
}: {
  value?: number | null;
  cap?: number | null;
  className?: string;
}) {
  // No reading, or nothing to measure against: render nothing rather than an
  // empty track, which would read as "measured, and it is zero".
  if (value === null || value === undefined || !cap || cap <= 0) return null;

  const scale = cap * 2;
  const pct = Math.min((value / scale) * 100, 100);
  const over = value > cap;
  const clamped = value > scale;

  return (
    <div
      className={cn("relative h-1.5 w-full overflow-hidden rounded-full bg-muted", className)}
      role="img"
      aria-label={
        over
          ? `${Math.round(value).toLocaleString()} litres, over the ${Math.round(cap).toLocaleString()} litre cap`
          : `${Math.round(value).toLocaleString()} litres, within the ${Math.round(cap).toLocaleString()} litre cap`
      }
    >
      <div
        className={cn(
          "h-full rounded-full transition-all",
          over ? "bg-rose-500" : "bg-emerald-500",
          clamped && "rounded-r-none"
        )}
        style={{ width: `${pct}%` }}
      />
      {/* The cap, always at the midpoint — the reference every row shares. */}
      <span
        className="absolute inset-y-0 w-px bg-foreground/45"
        style={{ left: "50%" }}
        aria-hidden="true"
      />
    </div>
  );
}
