"use client";

import type { LucideIcon } from "lucide-react";
import { Anchor, UserCog } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { ROLE_LABELS } from "@/lib/auth";
import { CommandBar } from "@/components/layout/CommandBar";
import { TONE_TILE_CLASSES, type AccentTone } from "./tones";

interface DashboardShellProps {
  /**
   * Skip the shell's own heading block. Detail pages own their header — a mono
   * identifier, a status badge and a chip row don't fit `title`/`subtitle`.
   */
  bare?: boolean;
  /** Small greeting line above the title. */
  eyebrow?: React.ReactNode;
  title?: string;
  subtitle?: string;
  /** Optional tile to the left of the title — used by section pages. */
  icon?: LucideIcon;
  iconTone?: AccentTone;
  /** Role pill left of the actions. On by default; off for section pages. */
  showRole?: boolean;
  /** Primary call-to-action, right of the role pill. */
  actions?: React.ReactNode;
  children: React.ReactNode;
}

/**
 * The Command Center frame every role dashboard sits in: a deep navy backdrop,
 * a floating rounded content panel, the search-led top bar, the hero heading
 * block and the footer. Pages supply only their sections.
 */
export function DashboardShell({
  bare = false,
  eyebrow,
  title,
  subtitle,
  icon: Icon,
  iconTone = "blue",
  showRole = true,
  actions,
  children,
}: DashboardShellProps) {
  const { effectiveRole } = useAuth();
  const roleLabel = ROLE_LABELS[effectiveRole ?? ""] ?? effectiveRole ?? "";

  return (
    <div className="min-h-full bg-shell p-0 sm:p-3">
      <div
        className={cn(
          "flex min-h-full flex-col overflow-hidden bg-shell-panel sm:rounded-[26px]",
          "shadow-[0_30px_80px_-40px_rgba(4,12,32,0.9)]"
        )}
      >
        <CommandBar />

        <div className="flex-1 space-y-5 px-4 pb-6 lg:px-6">
          {!bare && (
          <header className="animate-rise flex flex-wrap items-center justify-between gap-4">
            <div className="flex min-w-0 items-center gap-3.5">
              {Icon && (
                <span
                  className={cn(
                    "flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl",
                    TONE_TILE_CLASSES[iconTone]
                  )}
                >
                  <Icon className="h-5 w-5" strokeWidth={2} />
                </span>
              )}
              <div className="min-w-0">
                {eyebrow && (
                  <p className="text-[13px] font-medium text-muted-foreground">{eyebrow}</p>
                )}
                <h1 className="text-[28px] font-extrabold leading-none tracking-tight text-foreground lg:text-[34px]">
                  {title}
                </h1>
                {subtitle && (
                  <p className="mt-1.5 text-[13px] text-muted-foreground">{subtitle}</p>
                )}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              {showRole && (
                <span
                  className={cn(
                    "flex items-center gap-2 rounded-xl border border-navy-100 bg-card px-3.5 py-2.5",
                    "text-[13px] font-semibold text-foreground dark:border-border"
                  )}
                >
                  <UserCog className="h-4 w-4 text-muted-foreground" strokeWidth={2} />
                  {roleLabel}
                </span>
              )}
              {actions}
            </div>
          </header>
          )}

          {children}

          <footer className="flex flex-wrap items-center justify-between gap-2 border-t border-border/60 pt-4 text-[11px] text-muted-foreground">
            <p>
              © {new Date().getFullYear()} Reliant Anchor Operations. All rights reserved.
            </p>
            <p className="flex items-center gap-1.5">
              Efficiency <span className="text-border">•</span> Safety
              <span className="text-border">•</span> Excellence
              <Anchor className="h-3.5 w-3.5 text-primary" strokeWidth={2.5} />
            </p>
          </footer>
        </div>
      </div>
    </div>
  );
}
