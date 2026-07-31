"use client";

import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { TONE_TILE_CLASSES, type AccentTone } from "@/components/dashboard/tones";

interface StatTileProps {
  icon: LucideIcon;
  tone?: AccentTone;
  label: string;
  value: React.ReactNode;
  /** Secondary line under the value — the MTVC figure, IMO number, time, … */
  detail?: React.ReactNode;
}

/**
 * Compact figure used in the detail page's tab headers (Marine, KPI). Sits in a
 * divided row rather than its own card, so it stays visually lighter than a
 * dashboard KpiCard.
 */
export function StatTile({
  icon: Icon,
  tone = "blue",
  label,
  value,
  detail,
}: StatTileProps) {
  return (
    <div className="flex min-w-0 items-start gap-3 px-4 py-3.5 lg:px-5">
      <span
        className={cn(
          "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl",
          TONE_TILE_CLASSES[tone]
        )}
      >
        <Icon className="h-4.5 w-4.5" strokeWidth={2} />
      </span>
      <div className="min-w-0">
        <p className="text-[11px] font-medium leading-snug text-muted-foreground">{label}</p>
        <p className="mt-0.5 truncate text-[17px] font-bold leading-tight tracking-tight text-foreground">
          {value}
        </p>
        {detail && (
          <p className="mt-0.5 truncate text-[11px] tabular-nums text-muted-foreground">
            {detail}
          </p>
        )}
      </div>
    </div>
  );
}

/**
 * Divided row wrapper for a set of StatTiles. Uses an intrinsic auto-fit grid
 * rather than a `sm:`/`xl:` breakpoint — this row often sits beside a
 * fixed-width rail, so a viewport breakpoint would trigger 4 columns off the
 * full viewport width while the row itself has far less space to give them.
 * auto-fit reflows off the row's actual width instead.
 */
export function StatTileRow({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "grid grid-cols-[repeat(auto-fit,minmax(11rem,1fr))]",
        "[&>*:not(:first-child)]:border-l *:border-border/70",
        className
      )}
    >
      {children}
    </div>
  );
}
