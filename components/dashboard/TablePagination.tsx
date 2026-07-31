"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

/** Page numbers to render, with `null` marking an ellipsis gap. */
function pageWindow(current: number, total: number): (number | null)[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const pages = new Set<number>([1, total, current]);
  for (const d of [-1, 1]) {
    const p = current + d;
    if (p > 1 && p < total) pages.add(p);
  }
  const sorted = [...pages].sort((a, b) => a - b);
  const out: (number | null)[] = [];
  let prev = 0;
  for (const p of sorted) {
    if (prev && p - prev > 1) out.push(null);
    out.push(p);
    prev = p;
  }
  return out;
}

interface Props {
  page: number;
  totalPages: number;
  /** Index of the first row on this page, 1-based. */
  from: number;
  /** Index of the last row on this page, 1-based. */
  to: number;
  total: number;
  /** Plural noun for the summary line, e.g. "operations". */
  noun: string;
  onPageChange: (page: number) => void;
}

const arrowClasses = cn(
  "flex h-9 w-9 items-center justify-center rounded-lg border border-navy-100 bg-card",
  "text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
  "disabled:pointer-events-none disabled:opacity-40",
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
  "dark:border-border"
);

export function TablePagination({
  page,
  totalPages,
  from,
  to,
  total,
  noun,
  onPageChange,
}: Props) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border/70 px-4 py-3 lg:px-5">
      <p className="text-xs text-muted-foreground">
        {total === 0 ? (
          <>No {noun}</>
        ) : (
          <>
            Showing <span className="font-semibold text-foreground tabular-nums">{from}</span> to{" "}
            <span className="font-semibold text-foreground tabular-nums">{to}</span> of{" "}
            <span className="font-semibold text-foreground tabular-nums">{total}</span> {noun}
          </>
        )}
      </p>

      {totalPages > 1 && (
        <nav className="flex items-center gap-1.5" aria-label="Pagination">
          <button
            type="button"
            className={arrowClasses}
            disabled={page <= 1}
            onClick={() => onPageChange(page - 1)}
            aria-label="Previous page"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>

          {pageWindow(page, totalPages).map((p, i) =>
            p === null ? (
              <span key={`gap-${i}`} className="px-1 text-xs text-muted-foreground">
                …
              </span>
            ) : (
              <button
                key={p}
                type="button"
                onClick={() => onPageChange(p)}
                aria-label={`Page ${p}`}
                aria-current={p === page ? "page" : undefined}
                className={cn(
                  "h-9 min-w-9 rounded-lg px-2.5 text-[13px] font-semibold tabular-nums transition-colors",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                  p === page
                    ? "brand-grad-active text-white shadow-[0_8px_18px_-10px_rgb(14_121_200/0.85)]"
                    : "border border-navy-100 bg-card text-foreground hover:bg-muted dark:border-border"
                )}
              >
                {p}
              </button>
            )
          )}

          <button
            type="button"
            className={arrowClasses}
            disabled={page >= totalPages}
            onClick={() => onPageChange(page + 1)}
            aria-label="Next page"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </nav>
      )}
    </div>
  );
}
