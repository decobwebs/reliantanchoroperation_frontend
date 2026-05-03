"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import {
  CheckSquare,
  Loader2,
  Play,
  CheckCircle2,
  Truck,
  Anchor,
  ChevronRight,
  AlertCircle,
} from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { api, getErrorMessage } from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";
import { Header } from "@/components/layout/Header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatDate, formatDateTime } from "@/lib/utils";
import type { ApiResponse, Task, Truck as TruckType } from "@/types";

// ─── Styling helpers ─────────────────────────────────────────────────────────

const TASK_STATUS_COLOR: Record<string, string> = {
  pending:     "bg-gray-100 text-gray-700 border-gray-200",
  in_progress: "bg-blue-100 text-blue-700 border-blue-200",
  completed:   "bg-emerald-100 text-emerald-700 border-emerald-200",
  cancelled:   "bg-red-100 text-red-700 border-red-200",
};

const PRIORITY_COLOR: Record<string, string> = {
  low:    "bg-gray-100 text-gray-600",
  normal: "bg-blue-100 text-blue-700",
  high:   "bg-amber-100 text-amber-700",
  urgent: "bg-red-100 text-red-700",
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
                <Loader2 className="w-4 h-4 animate-spin" />
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
                          {parseFloat(truck.capacity_mt).toLocaleString()} MT
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
              {mutation.isPending && <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />}
              Submit Report
            </Button>
          </div>
        </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ─── Marine Manager "Mark Vessel Ready" Dialog ────────────────────────────────

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
    mutationFn: async (data: VesselReadyForm) => {
      await api.put(`/tasks/${task.id}`, {
        status: "completed",
        instructions: data.notes.trim(),
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
              {mutation.isPending && <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />}
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
  const { user } = useAuth();
  const qc = useQueryClient();
  const [readinessTask, setReadinessTask] = useState<Task | null>(null);
  const [vesselReadyTask, setVesselReadyTask] = useState<Task | null>(null);

  const isLO = user?.role === "logistics_officer";
  const isMM = user?.role === "marine_manager";

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
    <div>
      <Header
        title="My Tasks"
        subtitle={`${activeTasks.length} active · ${doneTasks.length} completed`}
      />

      <div className="p-6 space-y-6">
        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-7 h-7 animate-spin text-primary" />
          </div>
        ) : tasks?.length === 0 ? (
          <div className="flex flex-col items-center py-16 text-muted-foreground">
            <CheckSquare className="w-10 h-10 mb-3 opacity-30" />
            <p className="text-sm">No tasks assigned to you</p>
          </div>
        ) : (
          <>
            {/* Active tasks */}
            {activeTasks.length > 0 && (
              <div>
                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                  Active Tasks ({activeTasks.length})
                </h3>
                <Card className="border-0 shadow-sm">
                  <CardContent className="p-0">
                    <div className="divide-y">
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
                  </CardContent>
                </Card>
              </div>
            )}

            {/* Completed / cancelled tasks */}
            {doneTasks.length > 0 && (
              <div>
                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                  Completed / Cancelled ({doneTasks.length})
                </h3>
                <Card className="border-0 shadow-sm">
                  <CardContent className="p-0">
                    <div className="divide-y">
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
                  </CardContent>
                </Card>
              </div>
            )}
          </>
        )}
      </div>

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
    </div>
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
    <div className={`px-5 py-4 ${isDone ? "opacity-60" : ""}`}>
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          {/* Task type + operation */}
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-semibold">
              {TASK_TYPE_LABEL[task.task_type] ?? task.task_type.replace(/_/g, " ")}
            </p>
            {task.operation && (
              <Link href={`/operations/${task.operation.id}`}>
                <span className="text-[11px] text-primary font-mono hover:underline cursor-pointer">
                  {task.operation.operation_number}
                  <ChevronRight className="w-3 h-3 inline-block" />
                </span>
              </Link>
            )}
          </div>

          {/* Meta */}
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded border ${TASK_STATUS_COLOR[task.status] ?? "bg-gray-100 text-gray-700 border-gray-200"}`}>
              {task.status.replace(/_/g, " ")}
            </span>
            <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${PRIORITY_COLOR[task.priority] ?? "bg-gray-100 text-gray-600"}`}>
              {task.priority}
            </span>
            <span className="text-[10px] text-muted-foreground">{formatDateTime(task.created_at)}</span>
            {task.due_date && (
              <span className="text-[10px] text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded">
                Due: {formatDate(task.due_date)}
              </span>
            )}
          </div>

          {/* Instructions */}
          {task.instructions && (
            <p className="text-xs text-muted-foreground mt-1.5 italic leading-relaxed max-w-lg">
              {task.instructions}
            </p>
          )}
          {task.completed_at && (
            <p className="text-[10px] text-emerald-700 mt-1">
              Completed: {formatDateTime(task.completed_at)}
            </p>
          )}
        </div>

        {/* Action buttons */}
        {!isDone && (
          <div className="flex items-center gap-2 shrink-0 flex-wrap justify-end">
            {task.status === "pending" && (
              <Button
                size="sm"
                variant="outline"
                className="h-8 text-xs"
                disabled={isPending}
                onClick={onStart}
              >
                <Play className="w-3 h-3 mr-1" />
                Start
              </Button>
            )}

            {task.status === "in_progress" && isLO && task.task_type === "truck_logistics" && (
              <Button
                size="sm"
                className="h-8 text-xs"
                onClick={onReadiness}
              >
                <Truck className="w-3 h-3 mr-1" />
                Submit Readiness Report
              </Button>
            )}

            {task.status === "in_progress" && isMM && (task.task_type === "vessel_operations" || task.task_type === "marine_discharge") && (
              <Button
                size="sm"
                className="h-8 text-xs"
                onClick={onVesselReady}
              >
                <Anchor className="w-3 h-3 mr-1" />
                Mark Vessel Ready
              </Button>
            )}

            {task.status === "in_progress" && !(isLO && task.task_type === "truck_logistics") && !(isMM && (task.task_type === "vessel_operations" || task.task_type === "marine_discharge")) && (
              <Button
                size="sm"
                variant="outline"
                className="h-8 text-xs"
                disabled={isPending}
                onClick={onComplete}
              >
                <CheckCircle2 className="w-3 h-3 mr-1" />
                Complete
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
