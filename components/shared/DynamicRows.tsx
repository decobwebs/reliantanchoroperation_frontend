"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

/**
 * Add/remove-row plumbing for forms with a repeatable line-item section
 * (PPDL's product lines, Naval Clearance's drawdowns/locations/vessels).
 * Deliberately just state management — each consumer keeps its own field
 * layout inside a `DynamicRowCard`, since the row shapes genuinely differ
 * from one consumer to the next.
 */
export function useDynamicRows<T>(makeEmpty: () => T, initial?: T[]) {
  const [rows, setRows] = useState<T[]>(initial ?? [makeEmpty()]);

  const add = () => setRows((r) => [...r, makeEmpty()]);
  const remove = (index: number) => setRows((r) => r.filter((_, i) => i !== index));
  const update = (index: number, patch: Partial<T>) =>
    setRows((r) => r.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  const reset = () => setRows(initial ?? [makeEmpty()]);

  return { rows, add, remove, update, reset, setRows };
}

/** The bordered card shell every dynamic row sits in. */
export function DynamicRowCard({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("rounded-lg border border-navy-100 bg-muted/30 p-3 dark:border-border", className)}>
      {children}
    </div>
  );
}
