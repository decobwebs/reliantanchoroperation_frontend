"use client";

import Link from "next/link";
import { Anchor, Truck, Ship } from "lucide-react";
import { cn, formatDate, OP_TYPE_LABELS } from "@/lib/utils";
import { operationProgress } from "@/lib/operations";
import { StatusBadge } from "@/components/shared/StatusBadge";
import type { Operation, OperationStatus } from "@/types";

const TYPE_ICON: Record<string, typeof Anchor> = {
  vessel_only: Anchor,
  truck_only: Truck,
  full_operation: Ship,
};

/**
 * Progress fill colour. In-flight work is brand azure (getting deeper as it
 * advances); only the two meaningful end states borrow another hue — emerald
 * for done, amber for barely-started.
 */
function progressClasses(pct: number): string {
  if (pct >= 100) return "bg-emerald-500";
  if (pct >= 60) return "brand-grad-bar";
  if (pct >= 30) return "bg-brand-400";
  return "bg-amber-400";
}

interface Props {
  operations: Operation[];
  /** vessel_id → vessel name, for the Vessel / Truck column. */
  vesselNames: Record<string, string>;
}

/** What sits in the "Vessel / Truck" column, using only data the row carries. */
function assetLabel(op: Operation, vesselNames: Record<string, string>): string {
  if (op.vessel_id && vesselNames[op.vessel_id]) return vesselNames[op.vessel_id];
  if (op.type === "truck_only" && op.trucks_required) {
    return `${op.trucks_required} truck${op.trucks_required === 1 ? "" : "s"}`;
  }
  return OP_TYPE_LABELS[op.type] ?? "—";
}

export function RecentOperationsTable({ operations, vesselNames }: Props) {
  if (operations.length === 0) {
    return (
      <p className="px-5 py-10 text-center text-sm text-muted-foreground">
        No operations yet.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-180 border-collapse text-left">
        <thead>
          <tr className="bg-muted/50">
            {["Operation ID", "Vessel / Truck", "Type", "Status", "Progress", "Date"].map(
              (h) => (
                <th
                  key={h}
                  scope="col"
                  className="whitespace-nowrap px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground first:pl-5 last:pr-5"
                >
                  {h}
                </th>
              )
            )}
          </tr>
        </thead>
        <tbody className="divide-y divide-border/70">
          {operations.map((op) => {
            const Icon = TYPE_ICON[op.type] ?? Ship;
            const pct = operationProgress(op.type, op.status);
            return (
              <tr key={op.id} className="group transition-colors hover:bg-muted/40">
                <td className="whitespace-nowrap px-4 py-3 pl-5">
                  <Link
                    href={`/operations/${op.id}`}
                    className="flex items-center gap-2 font-mono text-[13px] font-semibold text-foreground hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded"
                  >
                    <Icon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" strokeWidth={2} />
                    {op.operation_number}
                  </Link>
                </td>
                <td className="max-w-45 truncate px-4 py-3 text-[13px] text-foreground/80">
                  {assetLabel(op, vesselNames)}
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-[13px] text-muted-foreground">
                  {OP_TYPE_LABELS[op.type] ?? op.type}
                </td>
                <td className="whitespace-nowrap px-4 py-3">
                  <StatusBadge status={op.status as OperationStatus} />
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2.5">
                    <div
                      className="h-1.5 w-24 overflow-hidden rounded-full bg-muted"
                      role="progressbar"
                      aria-valuenow={pct}
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-label={`${op.operation_number} progress`}
                    >
                      <div
                        className={cn("h-full rounded-full", progressClasses(pct))}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <span className="w-9 shrink-0 text-[11px] font-semibold tabular-nums text-muted-foreground">
                      {pct}%
                    </span>
                  </div>
                </td>
                <td className="whitespace-nowrap px-4 py-3 pr-5 text-[13px] text-muted-foreground tabular-nums">
                  {formatDate(op.created_at)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
