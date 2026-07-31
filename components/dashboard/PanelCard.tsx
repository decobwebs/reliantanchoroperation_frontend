"use client";

import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { TONE_TILE_CLASSES, type AccentTone } from "./tones";

interface PanelCardProps {
  icon: LucideIcon;
  title: string;
  subtitle?: string;
  tone?: AccentTone;
  /** Controls, filters or a "view all" link, right-aligned in the header. */
  action?: React.ReactNode;
  /** Drop the default body padding — for edge-to-edge tables. */
  flush?: boolean;
  className?: string;
  bodyClassName?: string;
  children: React.ReactNode;
}

/**
 * The standard Command Center surface: rounded panel, icon-tiled header with a
 * title/subtitle pair, optional right-aligned controls, then the body.
 */
export function PanelCard({
  icon: Icon,
  title,
  subtitle,
  tone = "blue",
  action,
  flush = false,
  className,
  bodyClassName,
  children,
}: PanelCardProps) {
  return (
    <section
      className={cn(
        "flex flex-col overflow-hidden rounded-2xl border border-slate-200/80 bg-card",
        "shadow-[0_1px_2px_rgba(16,24,40,0.04)] dark:border-border",
        className
      )}
    >
      <header className="flex flex-wrap items-center justify-between gap-3 px-4 pt-4 pb-3 lg:px-5 lg:pt-5">
        <div className="flex min-w-0 items-center gap-3">
          <span
            className={cn(
              "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl",
              TONE_TILE_CLASSES[tone]
            )}
          >
            <Icon className="h-4.5 w-4.5" strokeWidth={2} />
          </span>
          <div className="min-w-0">
            <h2 className="truncate text-[15px] font-bold leading-tight tracking-tight text-foreground">
              {title}
            </h2>
            {subtitle && (
              <p className="truncate text-xs text-muted-foreground">{subtitle}</p>
            )}
          </div>
        </div>
        {action && <div className="flex shrink-0 items-center gap-2">{action}</div>}
      </header>

      <div className={cn("flex-1", flush ? "" : "px-4 pb-4 lg:px-5 lg:pb-5", bodyClassName)}>
        {children}
      </div>
    </section>
  );
}
