"use client";

import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * One expandable row in a list — a header button (chevron + summary) that
 * reveals a body panel. The parent owns which row is open (typically a
 * single `useState<string | null>`, "one open at a time"); this component
 * only owns the chevron/rounded-panel chrome.
 */
export function AccordionRow({
  open,
  onToggle,
  summary,
  children,
  className,
}: {
  open: boolean;
  onToggle: () => void;
  /** Header content — rendered next to the chevron, before the row collapses. */
  summary: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <button
        type="button"
        className="flex w-full items-center gap-3 px-4 py-3.5 text-left transition-colors hover:bg-muted/40 lg:px-5"
        onClick={onToggle}
        aria-expanded={open}
      >
        <ChevronRight
          className={cn(
            "h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform",
            open && "rotate-90"
          )}
          strokeWidth={2.5}
        />
        <div className="flex min-w-0 flex-1 flex-wrap items-center justify-between gap-3">
          {summary}
        </div>
      </button>
      {open && (
        <div className="space-y-3 bg-muted/10 px-4 pb-4 lg:px-5">
          {children}
        </div>
      )}
    </div>
  );
}
