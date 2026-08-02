"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import {
  CheckSquare,
  Play,
  CheckCircle2,
  Truck,
  Anchor,
  ChevronRight,
  AlertCircle,
} from "lucide-react";
import { Spinner } from "@/components/ui/spinner";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { api, getErrorMessage } from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { PanelCard } from "@/components/dashboard/PanelCard";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn, formatDate, formatDateTime } from "@/lib/utils";
import type { ApiResponse, Task, Truck as TruckType } from "@/types";

// ─── Styling helpers ─────────────────────────────────────────────────────────
// Task status/priority are their own four/four-value vocabularies (distinct
// from OperationStatus), so they keep a local colour map rather than routing
// through StatusBadge — but the actual colours converge with the dashboard
// TaskRow's STATUS_CLASSES/PRIORITY_CLASSES so the same word reads the same
// colour everywhere in the app.

const TASK_STATUS_COLOR: Record<string, string> = {
  pending:     "bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-500/15 dark:text-slate-300 dark:border-slate-500/30",
  in_progress: "bg-brand-50 text-brand-700 border-brand-200 dark:bg-brand-500/15 dark:text-brand-300 dark:border-brand-500/30",
  completed:   "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-300 dark:border-emerald-500/30",
  cancelled:   "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-500/15 dark:text-rose-300 dark:border-rose-500/30",
};

const PRIORITY_COLOR: Record<string, string> = {
  low:    "bg-slate-100 text-slate-600 dark:bg-slate-500/15 dark:text-slate-300",
  normal: "bg-brand-50 text-brand-700 dark:bg-brand-500/15 dark:text-brand-300",
  high:   "bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300",
  urgent: "bg-rose-50 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300",
};

const TASK_TYPE_LABEL: Record<string, string> = {
  truck_logistics:    "Truck Logistics",
  vessel_operations:  "Vessel Operations",
  marine_discharge:   "Marine Discharge",
  finance_processing: "Finance Processing",
};

// ─── LO Submit Readiness Dialog ───────────────────────────────────────────────

const feedbackSchema = z.object({
  readiness_summary: z.string().min(10, "Please provide at least 10 characters"),
  notes: z.string().optional(),
});
type FeedbackForm = z.infer<typeof feedbackSchema>;

function SubmitReadinessDialog({
  task,
  open,
  onClose,
  onSubmitted,
}: {
  task: Task;
  open: boolean;
  onClose: () => void;
  onSubmitted: () => void;
}) {
  const [selectedTruckIds, setSelectedTruckIds] = useState<string[]>([]);

  const { register, handleSubmit, reset, formState: { errors } } =
    useForm<FeedbackForm>({ resolver: zodResolver(feedbackSchema) });

  const { data: trucks, isLoading: trucksLoading } = useQuery({
    queryKey: ["trucks"],
    queryFn: async () => {
      const res = await api.get<ApiResponse<TruckType[]>>("/trucks?per_page=100");
      const d = res.data.data;
      return Array.isArray(d) ? d : (d as { items: TruckType[] }).items ?? [];
    },
    enabled: open,
  });

  const mutation = useMutation({
    mutationFn: async (data: FeedbackForm) => {
      if (selectedTruckIds.length === 0) {
        throw new Error("Select at least one truck");
      }
      const operationId = task.operation?.id ?? task.operation_id;
      // Submit truck readiness feedback
      await api.post(`/operations/${operationId}/feedback`, {
        truck_ids: selectedTruckIds,
        readiness_summary: data.readiness_summary.trim(),
        truck_details: data.notes?.trim()
          ? { notes: data.notes.trim() }
          : {},
      });
    },
    onSuccess: () => {
      toast.success("Readiness report submitted — awaiting BM approval");
      reset();
      setSelectedTruckIds([]);
      onSubmitted();
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  const toggleTruck = (id: string) => {
    setSelectedTruckIds((prev) =>
      prev.includes(id) ? prev.filter((t) => t !== id) : [...prev, id]
    );
  };

  const opStatus = task.operation?.status;
  const canSubmit = opStatus === "awaiting_feedback";

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) { reset(); setSelectedTruckIds([]); onClose(); } }}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto" aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Truck className="w-4 h-4 text-primary" />
            Submit Readiness Report
          </DialogTitle>
          {task.operation && (
            <p className="text-xs text-muted-foreground font-mono mt-0.5">
              Operation: {task.operation.operation_number}
            </p>
          )}
        </DialogHeader>

        {!canSubmit ? (
          <div className="flex flex-col items-center gap-3 py-8 text-center">
            <AlertCircle className="w-10 h-10 text-amber-500 opacity-80" />
            <div>
              <p className="text-sm font-medium">Feedback not yet requested</p>
              <p className="text-xs text-muted-foreground mt-1">
                The Bunker Manager must request truck readiness feedback before you can submit a report.
                Current status: <span className="font-mono font-medium">{opStatus?.replace(/_/g, " ") ?? "unknown"}</span>.
              </p>
            </div>
            <Button variant="outline" size="sm" onClick={onClose}>Close</Button>
          </div>
        ) : (
        <form onSubmit={handleSubmit((d) => mutation.mutate(d))} className="space-y-5 mt-2">
          {/* Truck selection */}
          <div className="space-y-2">
            <Label>
              Select Trucks for this Operation <span className="text-destructive">*</span>
            </Label>
            {trucksLoading ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
                <Spinner size={16} />
                Loading trucks...
              </div>
            ) : trucks?.length ? (
              <div className="border rounded-lg divide-y max-h-44 overflow-y-auto">
                {trucks
                  .filter((t) => ["available", "assigned"].includes(t.status))
                  .map((truck) => (
                    <label
                      key={truck.id}
                      className="flex items-center gap-3 px-4 py-2.5 hover:bg-muted/40 cursor-pointer"
                    >
                      <Checkbox
                        checked={selectedTruckIds.includes(truck.id)}
                        onCheckedChange={() => toggleTruck(truck.id)}
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium font-mono">{truck.truck_number}</p>
                        <p className="text-xs text-muted-foreground">
                          {parseFloat(truck.capacity_mt).toLocaleString()} L
                          {truck.driver_name ? ` · ${truck.driver_name}` : ""}
                        </p>
                      </div>
                      <span className="text-xs text-muted-foreground capitalize shrink-0">
                        {truck.status.replace(/_/g, " ")}
                      </span>
                    </label>
                  ))}
                {trucks.filter((t) => ["available", "assigned"].includes(t.status)).length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    No available trucks. All trucks must be &apos;available&apos; or &apos;assigned&apos;.
                  </p>
                )}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground py-2">No trucks registered in fleet.</p>
            )}
            {selectedTruckIds.length > 0 && (
              <p className="text-xs text-muted-foreground">
                {selectedTruckIds.length} truck{selectedTruckIds.length > 1 ? "s" : ""} selected
              </p>
            )}
          </div>

          {/* Readiness summary */}
          <div className="space-y-1.5">
            <Label>
              Readiness Summary <span className="text-destructive">*</span>
            </Label>
            <Textarea
              placeholder="Describe the overall truck readiness — fuel levels, mechanical checks, driver availability…"
              className="resize-none"
              rows={3}
              {...register("readiness_summary")}
            />
            {errors.readiness_summary && (
              <p className="text-xs text-destructive">{errors.readiness_summary.message}</p>
            )}
          </div>

          {/* Additional per-truck notes */}
          <div className="space-y-1.5">
            <Label>
              Additional Notes <span className="text-muted-foreground font-normal text-xs">(optional)</span>
            </Label>
            <Textarea
              placeholder="Any per-truck specifics, loading points, driver instructions…"
              className="resize-none"
              rows={2}
              {...register("notes")}
            />
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <Button
              type="button"
              variant="outline"
              onClick={() => { reset(); setSelectedTruckIds([]); onClose(); }}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={mutation.isPending || selectedTruckIds.length === 0}>
              {mutation.isPending && <Spinner size={16} className="mr-1.5" />}
              Submit Report
            </Button>
          </div>
        </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ─── Cargo Superintendent "Mark Vessel Ready" Dialog ──────────────────────────

const vesselReadySchema = z.object({
  notes: z.string().min(10, "Please describe the vessel readiness (min 10 chars)"),
});
type VesselReadyForm = z.infer<typeof vesselReadySchema>;

function MarkVesselReadyDialog({
  task,
  open,
  onClose,
  onSubmitted,
}: {
  task: Task;
  open: boolean;
  onClose: () => void;
  onSubmitted: () => void;
}) {
  const { register, handleSubmit, reset, formState: { errors } } =
    useForm<VesselReadyForm>({ resolver: zodResolver(vesselReadySchema) });

  const mutation = useMutation({
    mutationFn: async (_data: VesselReadyForm) => {
      // Only flip status — do NOT write the readiness note into `instructions`,
      // which would clobber the Bunker Manager's original assignment instructions.
      await api.put(`/tasks/${task.id}`, {
        status: "completed",
      });
    },
    onSuccess: () => {
      toast.success("Vessel marked as ready — task completed");
      reset();
      onSubmitted();
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) { reset(); onClose(); } }}>
      <DialogContent className="sm:max-w-md" aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Anchor className="w-4 h-4 text-primary" />
            Mark Vessel Ready
          </DialogTitle>
          {task.operation && (
            <p className="text-xs text-muted-foreground font-mono mt-0.5">
              Operation: {task.operation.operation_number}
            </p>
          )}
        </DialogHeader>
        <form onSubmit={handleSubmit((d) => mutation.mutate(d))} className="space-y-4 mt-2">
          <div className="space-y-1.5">
            <Label>
              Vessel Readiness Notes <span className="text-destructive">*</span>
            </Label>
            <Textarea
              placeholder="Confirm vessel inspection, fuel levels, crew readiness, mooring status…"
              className="resize-none"
              rows={4}
              {...register("notes")}
            />
            {errors.notes && (
              <p className="text-xs text-destructive">{errors.notes.message}</p>
            )}
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="outline" onClick={() => { reset(); onClose(); }}>Cancel</Button>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending && <Spinner size={16} className="mr-1.5" />}
              Confirm Vessel Ready
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ─── Main Tasks Page ──────────────────────────────────────────────────────────

export default function TasksPage() {
  const { user, effectiveRole } = useAuth();
  const qc = useQueryClient();
  const [readinessTask, setReadinessTask] = useState<Task | null>(null);
  const [vesselReadyTask, setVesselReadyTask] = useState<Task | null>(null);

  const isLO = effectiveRole === "logistics_officer";
  const isMM = effectiveRole === "cargo_superintendent";

  const { data: tasks, isLoading } = useQuery({
    queryKey: ["my-tasks"],
    queryFn: async () => {
      const res = await api.get<ApiResponse<Task[]>>("/my-tasks");
      return res.data.data;
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ taskId, status }: { taskId: string; status: string }) => {
      const res = await api.put(`/tasks/${taskId}`, { status });
      return res.data;
    },
    onSuccess: (_, { status }) => {
      toast.success(status === "in_progress" ? "Task started" : "Task completed");
      qc.invalidateQueries({ queryKey: ["my-tasks"] });
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  const activeTasks = tasks?.filter((t) => !["completed", "cancelled"].includes(t.status)) ?? [];
  const doneTasks = tasks?.filter((t) => ["completed", "cancelled"].includes(t.status)) ?? [];

  return (
    <DashboardShell
      icon={CheckSquare}
      iconTone="blue"
      showRole={false}
      title="My Tasks"
      subtitle={`${activeTasks.length} active · ${doneTasks.length} completed`}
    >
      {isLoading ? (
        <div className="space-y-4">
          <Skeleton className="h-48 w-full rounded-2xl" />
          <Skeleton className="h-48 w-full rounded-2xl" />
        </div>
      ) : tasks?.length === 0 ? (
        <PanelCard icon={CheckSquare} tone="blue" title="Active Tasks" className="animate-rise">
          <div className="flex flex-col items-center py-12 text-center">
            <CheckSquare className="h-9 w-9 text-muted-foreground/25" strokeWidth={1.5} />
            <p className="mt-3 text-sm font-medium text-foreground">No tasks assigned to you</p>
          </div>
        </PanelCard>
      ) : (
        <>
          {/* Active tasks */}
          {activeTasks.length > 0 && (
            <PanelCard
              icon={Play}
              tone="blue"
              title="Active Tasks"
              subtitle={`${activeTasks.length} in progress or pending`}
              flush
              className="animate-rise"
            >
              <div className="divide-y divide-border/70">
                {activeTasks.map((task) => (
                  <TaskRow
                    key={task.id}
                    task={task}
                    isLO={isLO}
                    isMM={isMM}
                    onStart={() => updateMutation.mutate({ taskId: task.id as string, status: "in_progress" })}
                    onComplete={() => updateMutation.mutate({ taskId: task.id as string, status: "completed" })}
                    onReadiness={() => setReadinessTask(task)}
                    onVesselReady={() => setVesselReadyTask(task)}
                    isPending={updateMutation.isPending}
                  />
                ))}
              </div>
            </PanelCard>
          )}

          {/* Completed / cancelled tasks */}
          {doneTasks.length > 0 && (
            <PanelCard
              icon={CheckCircle2}
              tone="emerald"
              title="Completed / Cancelled"
              subtitle={`${doneTasks.length} resolved`}
              flush
              className="animate-rise"
            >
              <div className="divide-y divide-border/70">
                {doneTasks.map((task) => (
                  <TaskRow
                    key={task.id}
                    task={task}
                    isLO={isLO}
                    isMM={isMM}
                    isPending={false}
                  />
                ))}
              </div>
            </PanelCard>
          )}
        </>
      )}

      {/* LO Readiness Report Dialog */}
      {readinessTask && (
        <SubmitReadinessDialog
          task={readinessTask}
          open={!!readinessTask}
          onClose={() => setReadinessTask(null)}
          onSubmitted={() => {
            setReadinessTask(null);
            qc.invalidateQueries({ queryKey: ["my-tasks"] });
          }}
        />
      )}

      {/* MM Vessel Ready Dialog */}
      {vesselReadyTask && (
        <MarkVesselReadyDialog
          task={vesselReadyTask}
          open={!!vesselReadyTask}
          onClose={() => setVesselReadyTask(null)}
          onSubmitted={() => {
            setVesselReadyTask(null);
            qc.invalidateQueries({ queryKey: ["my-tasks"] });
          }}
        />
      )}
    </DashboardShell>
  );
}

// ─── TaskRow component ────────────────────────────────────────────────────────

function TaskRow({
  task,
  isLO,
  isMM,
  onStart,
  onComplete,
  onReadiness,
  onVesselReady,
  isPending,
}: {
  task: Task;
  isLO: boolean;
  isMM: boolean;
  onStart?: () => void;
  onComplete?: () => void;
  onReadiness?: () => void;
  onVesselReady?: () => void;
  isPending: boolean;
}) {
  const isDone = task.status === "completed" || task.status === "cancelled";

  return (
    <div className={cn("px-4 py-4 lg:px-5", isDone && "opacity-60")}>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          {/* Task type + operation */}
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-[13px] font-semibold text-foreground">
              {TASK_TYPE_LABEL[task.task_type] ?? task.task_type.replace(/_/g, " ")}
            </p>
            {task.operation && (
              <Link
                href={`/operations/${task.operation.id}`}
                className="inline-flex items-center gap-0.5 rounded font-mono text-[11px] font-semibold text-brand-600 transition-colors hover:text-brand-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {task.operation.operation_number}
                <ChevronRight className="h-3 w-3" strokeWidth={2.5} />
              </Link>
            )}
          </div>

          {/* Meta */}
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            <span className={cn(
              "rounded-md border px-1.5 py-0.5 text-[10px] font-semibold capitalize",
              TASK_STATUS_COLOR[task.status] ?? TASK_STATUS_COLOR.pending
            )}>
              {task.status.replace(/_/g, " ")}
            </span>
            <span className={cn(
              "rounded-md px-1.5 py-0.5 text-[10px] font-semibold capitalize",
              PRIORITY_COLOR[task.priority] ?? PRIORITY_COLOR.normal
            )}>
              {task.priority}
            </span>
            <span className="text-[10.5px] tabular-nums text-muted-foreground">{formatDateTime(task.created_at)}</span>
            {task.due_date && (
              <span className="rounded-md bg-amber-50 px-1.5 py-0.5 text-[10px] font-medium text-amber-700 dark:bg-amber-500/15 dark:text-amber-300">
                Due: {formatDate(task.due_date)}
              </span>
            )}
          </div>

          {/* Instructions */}
          {task.instructions && (
            <p className="mt-1.5 max-w-lg text-[12.5px] italic leading-relaxed text-muted-foreground">
              {task.instructions}
            </p>
          )}
          {task.completed_at && (
            <p className="mt-1 text-[10.5px] text-emerald-700 dark:text-emerald-400">
              Completed: {formatDateTime(task.completed_at)}
            </p>
          )}
        </div>

        {/* Action buttons */}
        {!isDone && (
          <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
            {task.status === "pending" && (
              <Button
                size="sm"
                variant="outline"
                className="h-8 rounded-lg text-xs font-semibold"
                disabled={isPending}
                onClick={onStart}
              >
                <Play className="h-3 w-3" strokeWidth={2.5} />
                Start
              </Button>
            )}

            {task.status === "in_progress" && isLO && task.task_type === "truck_logistics" && (
              <Button
                size="sm"
                className="h-8 rounded-lg text-xs font-semibold"
                onClick={onReadiness}
              >
                <Truck className="h-3 w-3" strokeWidth={2.5} />
                Submit Readiness Report
              </Button>
            )}

            {task.status === "in_progress" && isMM && (task.task_type === "vessel_operations" || task.task_type === "marine_discharge") && (
              <Button
                size="sm"
                className="h-8 rounded-lg text-xs font-semibold"
                onClick={onVesselReady}
              >
                <Anchor className="h-3 w-3" strokeWidth={2.5} />
                Mark Vessel Ready
              </Button>
            )}

            {task.status === "in_progress" && !(isLO && task.task_type === "truck_logistics") && !(isMM && (task.task_type === "vessel_operations" || task.task_type === "marine_discharge")) && (
              <Button
                size="sm"
                variant="outline"
                className="h-8 rounded-lg text-xs font-semibold"
                disabled={isPending}
                onClick={onComplete}
              >
                <CheckCircle2 className="h-3 w-3" strokeWidth={2.5} />
                Complete
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
