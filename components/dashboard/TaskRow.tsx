"use client";

import { cn, formatDate } from "@/lib/utils";
import type { Task } from "@/types";

const PRIORITY_CLASSES: Record<string, string> = {
  low: "bg-slate-100 text-slate-600 dark:bg-slate-500/15 dark:text-slate-300",
  normal: "bg-blue-50 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300",
  high: "bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300",
  urgent: "bg-rose-50 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300",
};

const STATUS_CLASSES: Record<string, string> = {
  pending: "bg-slate-100 text-slate-600 dark:bg-slate-500/15 dark:text-slate-300",
  in_progress: "bg-blue-50 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300",
  completed: "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300",
  cancelled: "bg-rose-50 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300",
};

function Chip({ label, className }: { label: string; className?: string }) {
  return (
    <span
      className={cn(
        "shrink-0 rounded-md px-1.5 py-0.5 text-[10px] font-semibold capitalize",
        className
      )}
    >
      {label.replace(/_/g, " ")}
    </span>
  );
}

interface TaskRowProps {
  task: Task;
  /** Show the status chip alongside priority. */
  showStatus?: boolean;
  /** Show the due date line when the task has one. */
  showDueDate?: boolean;
  /** Buttons rendered under the task details. */
  actions?: React.ReactNode;
}

/**
 * One assigned task, as it appears on the Ops Supervisor and Logistics Officer
 * dashboards. Both showed the same type / operation / priority trio with
 * slightly different chrome — this is the single version.
 */
export function TaskRow({
  task,
  showStatus = false,
  showDueDate = false,
  actions,
}: TaskRowProps) {
  return (
    <div className="rounded-xl border border-slate-200/80 p-3 transition-colors hover:bg-muted/40 dark:border-border">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-[13px] font-semibold capitalize leading-tight text-foreground">
            {task.task_type.replace(/_/g, " ")}
          </p>
          {task.operation && (
            <p className="mt-0.5 truncate font-mono text-[11px] text-muted-foreground">
              {task.operation.operation_number}
            </p>
          )}
          {showDueDate && task.due_date && (
            <p className="mt-0.5 text-[11px] text-muted-foreground">
              Due {formatDate(task.due_date)}
            </p>
          )}
        </div>
        <div className="flex shrink-0 flex-wrap items-center justify-end gap-1">
          {showStatus && (
            <Chip
              label={task.status}
              className={STATUS_CLASSES[task.status] ?? STATUS_CLASSES.pending}
            />
          )}
          <Chip
            label={task.priority}
            className={PRIORITY_CLASSES[task.priority] ?? PRIORITY_CLASSES.normal}
          />
        </div>
      </div>
      {actions && <div className="mt-2.5 flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}
