"use client";

import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export type AlertTone = "amber" | "red" | "blue";

const TONE: Record<AlertTone, { surface: string; head: string; divide: string }> = {
  amber: {
    surface:
      "border-amber-200 bg-amber-50/70 dark:border-amber-500/25 dark:bg-amber-500/10",
    head: "text-amber-800 dark:text-amber-300",
    divide: "divide-amber-200/70 dark:divide-amber-500/20",
  },
  red: {
    surface: "border-red-200 bg-red-50/70 dark:border-red-500/25 dark:bg-red-500/10",
    head: "text-red-800 dark:text-red-300",
    divide: "divide-red-200/70 dark:divide-red-500/20",
  },
  blue: {
    surface: "border-blue-200 bg-blue-50/70 dark:border-blue-500/25 dark:bg-blue-500/10",
    head: "text-blue-800 dark:text-blue-300",
    divide: "divide-blue-200/70 dark:divide-blue-500/20",
  },
};

interface AlertPanelProps {
  icon: LucideIcon;
  title: string;
  tone?: AlertTone;
  /** One `AlertRow` per item — they get divider borders automatically. */
  children: React.ReactNode;
  className?: string;
}

/**
 * The "needs your attention" banner shared by the role dashboards: a tinted
 * surface, an icon + count heading, then a divided list of actionable rows.
 */
export function AlertPanel({
  icon: Icon,
  title,
  tone = "amber",
  children,
  className,
}: AlertPanelProps) {
  const t = TONE[tone];
  return (
    <section
      className={cn("animate-rise overflow-hidden rounded-2xl border", t.surface, className)}
    >
      <div className={cn("flex items-center gap-2 px-4 pb-2 pt-3.5", t.head)}>
        <Icon className="h-4 w-4 shrink-0" strokeWidth={2.5} />
        <h2 className="text-[13px] font-bold">{title}</h2>
      </div>
      <div className={cn("divide-y", t.divide)}>{children}</div>
    </section>
  );
}

/** One row inside an `AlertPanel`: primary label, supporting line, trailing slot. */
export function AlertRow({
  primary,
  secondary,
  trailing,
  mono = false,
}: {
  primary: React.ReactNode;
  secondary?: React.ReactNode;
  trailing?: React.ReactNode;
  mono?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-3 px-4 py-2.5">
      <div className="min-w-0">
        <p
          className={cn(
            "truncate text-[13px] font-semibold text-foreground",
            mono && "font-mono"
          )}
        >
          {primary}
        </p>
        {secondary && (
          <p className="truncate text-[11px] text-muted-foreground">{secondary}</p>
        )}
      </div>
      {trailing && <div className="shrink-0 text-right">{trailing}</div>}
    </div>
  );
}
