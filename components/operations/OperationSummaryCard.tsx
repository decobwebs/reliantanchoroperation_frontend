"use client";

import { Anchor, CheckCircle2, Ship, XCircle } from "lucide-react";
import { cn, OP_TYPE_LABELS } from "@/lib/utils";
import { operationProgress } from "@/lib/operations";
import { StatusBadge } from "@/components/shared/StatusBadge";
import type { Operation, OperationStatus } from "@/types";

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3 py-1.5">
      <span className="shrink-0 text-[12.5px] text-muted-foreground">{label}</span>
      <span className="min-w-0 text-right text-[12.5px] font-semibold text-foreground">
        {value}
      </span>
    </div>
  );
}

/**
 * Right-rail summary for an operation: the four facts worth seeing on every
 * tab, a pipeline progress bar, and a one-line outcome note.
 */
export function OperationSummaryCard({ op }: { op: Operation }) {
  const pct = operationProgress(op.type, op.status);
  const done = op.status === "completed" || op.status === "archived";
  const cancelled = op.status === "cancelled";

  const volume = op.actual_volume_mt
    ? `${parseFloat(op.actual_volume_mt).toLocaleString()} L`
    : op.expected_volume_mt
      ? `${parseFloat(op.expected_volume_mt).toLocaleString()} L expected`
      : "—";

  return (
    <section
      className={cn(
        "relative isolate overflow-hidden rounded-2xl border border-brand-100 p-4 lg:p-5",
        "brand-grad-tint shadow-[0_1px_2px_rgb(16_36_71/0.04)] dark:border-border"
      )}
    >
      {/* Decorative vessel — ornament, never data. */}
      <Ship
        aria-hidden="true"
        className="pointer-events-none absolute -bottom-4 -right-5 -z-10 h-32 w-32 text-brand-500/10"
        strokeWidth={1}
      />

      <h2 className="flex items-center gap-2 text-[15px] font-bold tracking-tight text-navy-900">
        <Anchor className="h-4 w-4 text-brand-600" strokeWidth={2.5} />
        Operation Summary
      </h2>

      <div className="mt-3 divide-y divide-brand-200/50">
        <Row label="Type" value={OP_TYPE_LABELS[op.type] ?? op.type} />
        <Row label="Status" value={<StatusBadge status={op.status as OperationStatus} />} />
        <Row label="Version" value={`v${op.version ?? 1}`} />
        <Row label="Actual Volume" value={volume} />
      </div>

      <div
        className="mt-4 h-1.5 w-full overflow-hidden rounded-full bg-white/70 dark:bg-white/10"
        role="progressbar"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="Operation progress"
      >
        <div
          className={cn(
            "h-full rounded-full transition-[width] duration-700 ease-out",
            cancelled ? "bg-rose-400" : done ? "bg-emerald-500" : "brand-grad-bar"
          )}
          style={{ width: `${cancelled ? 100 : pct}%` }}
        />
      </div>

      <p
        className={cn(
          "mt-2.5 flex items-center gap-1.5 text-[12px] font-medium",
          cancelled ? "text-rose-700" : done ? "text-emerald-700" : "text-navy-900/70"
        )}
      >
        {cancelled ? (
          <>
            <XCircle className="h-3.5 w-3.5 shrink-0" strokeWidth={2.5} />
            Operation cancelled
          </>
        ) : done ? (
          <>
            <CheckCircle2 className="h-3.5 w-3.5 shrink-0" strokeWidth={2.5} />
            Operation completed successfully
          </>
        ) : (
          <>{pct}% through the {OP_TYPE_LABELS[op.type] ?? op.type} pipeline</>
        )}
      </p>
    </section>
  );
}
