"use client";

import { Clock } from "lucide-react";
import { PanelCard } from "@/components/dashboard/PanelCard";
import { formatDateTime } from "@/lib/utils";
import type { Milestone } from "@/types";

/**
 * The Portal's progress rail — visually a sibling of StatusTimeline (same
 * dot/connector/label/blurb/timestamp shape), not a reuse of it: `Milestone`
 * ({milestone_type, title, description, reached_at}) has no `id`/`to_status`,
 * and StatusTimeline's colour/label maps are keyed to OperationStatus values,
 * so an arbitrary milestone_type string wouldn't resolve there.
 */
export function MilestoneTimeline({ milestones }: { milestones: Milestone[] }) {
  return (
    <PanelCard
      icon={Clock}
      tone="blue"
      title="Progress Milestones"
      action={
        milestones.length > 0 ? (
          <span className="text-[11px] font-medium text-muted-foreground">
            {milestones.length} event{milestones.length === 1 ? "" : "s"}
          </span>
        ) : undefined
      }
    >
      {milestones.length === 0 ? (
        <p className="py-6 text-center text-xs text-muted-foreground">No milestones yet.</p>
      ) : (
        <ol className="relative">
          {milestones.map((m, i) => {
            const last = i === milestones.length - 1;
            return (
              <li key={`${m.milestone_type}-${m.reached_at}`} className="relative flex gap-3 pb-4 last:pb-0">
                {!last && (
                  <span
                    aria-hidden="true"
                    className="absolute left-[5px] top-3.5 h-full w-px bg-border"
                  />
                )}
                <span
                  aria-hidden="true"
                  className="relative z-10 mt-1 h-2.5 w-2.5 shrink-0 rounded-full border-2 border-emerald-500 bg-emerald-500"
                />
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] font-semibold leading-tight text-foreground">{m.title}</p>
                  <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground">{m.description}</p>
                  <p className="mt-0.5 text-[11px] tabular-nums text-muted-foreground/70">
                    {formatDateTime(m.reached_at)}
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
