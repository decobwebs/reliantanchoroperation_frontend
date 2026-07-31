"use client";

import { Clock } from "lucide-react";
import { cn, formatDateTime, STATUS_LABELS } from "@/lib/utils";
import { PanelCard } from "@/components/dashboard/PanelCard";
import type { OperationStatus, StatusHistory } from "@/types";

/**
 * Dot colour per status. Terminal states read green/red; everything in flight
 * stays on the brand ramp so the rail doesn't turn into a rainbow.
 */
const DOT: Partial<Record<OperationStatus, string>> = {
  draft: "border-navy-300 bg-card",
  completed: "border-emerald-500 bg-emerald-500",
  archived: "border-navy-400 bg-navy-400",
  cancelled: "border-rose-500 bg-rose-500",
  feedback_rejected: "border-rose-500 bg-card",
  vessel_operations: "border-amber-500 bg-card",
  bdn_pending: "border-brand-500 bg-card",
};

const DEFAULT_DOT = "border-brand-500 bg-card";

/** Short human line under each status — falls back to the recorded reason. */
const BLURB: Partial<Record<OperationStatus, string>> = {
  draft: "Operation created",
  tasks_assigned: "Tasks assigned",
  awaiting_feedback: "Awaiting readiness feedback",
  feedback_submitted: "Readiness feedback submitted",
  feedback_approved: "Feedback approved",
  feedback_rejected: "Feedback sent back",
  active: "Operation activated",
  pending_completion: "Completion submitted for review",
  vessel_operations: "Vessel activity opened",
  bdn_pending: "BDN created",
  bdn_approved: "BDN approved",
  pfi_linked: "Pro-forma invoice linked",
  payment_processing: "Payment in progress",
  payment_confirmed: "Payment confirmed",
  invoiced: "Invoice raised",
  completed: "Operation completed successfully",
  archived: "Operation archived",
  cancelled: "Operation cancelled",
};

export function StatusTimeline({
  events,
  isLoading,
}: {
  events: StatusHistory[];
  isLoading?: boolean;
}) {
  return (
    <PanelCard
      icon={Clock}
      tone="blue"
      title="Status Timeline"
      subtitle={isLoading ? "Loading…" : undefined}
      action={
        events.length > 0 ? (
          <span className="text-[11px] font-medium text-muted-foreground">
            {events.length} event{events.length === 1 ? "" : "s"}
          </span>
        ) : undefined
      }
    >
      {events.length === 0 ? (
        <p className="py-6 text-center text-xs text-muted-foreground">
          {isLoading ? "Loading timeline…" : "No status changes recorded yet."}
        </p>
      ) : (
        <ol className="relative">
          {events.map((e, i) => {
            const status = e.to_status as OperationStatus;
            const last = i === events.length - 1;
            return (
              <li key={e.id} className="relative flex gap-3 pb-4 last:pb-0">
                {/* Connector — stops at the final node */}
                {!last && (
                  <span
                    aria-hidden="true"
                    className="absolute left-[5px] top-3.5 h-full w-px bg-border"
                  />
                )}
                <span
                  aria-hidden="true"
                  className={cn(
                    "relative z-10 mt-1 h-2.5 w-2.5 shrink-0 rounded-full border-2",
                    DOT[status] ?? DEFAULT_DOT
                  )}
                />
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] font-semibold leading-tight text-foreground">
                    {STATUS_LABELS[status] ?? status}
                  </p>
                  <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground">
                    {e.reason?.trim() || BLURB[status] || "Status updated"}
                  </p>
                  <p className="mt-0.5 text-[11px] tabular-nums text-muted-foreground/70">
                    {formatDateTime(e.created_at)}
                  </p>
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </PanelCard>
  );
}
