"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import {
  AlertCircle,
  CheckCircle2,
  CheckSquare,
  ChevronRight,
  ClipboardCheck,
  Play,
  Truck,
} from "lucide-react";
import { toast } from "sonner";
import { api, getErrorMessage } from "@/lib/api";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { AlertPanel, AlertRow } from "@/components/dashboard/AlertPanel";
import { KpiCard } from "@/components/dashboard/KpiCard";
import { PanelCard } from "@/components/dashboard/PanelCard";
import { QuickActionTile } from "@/components/dashboard/QuickActionTile";
import { TaskRow } from "@/components/dashboard/TaskRow";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/hooks/useAuth";
import { formatDate, OP_TYPE_LABELS } from "@/lib/utils";
import type { ApiResponse, PaginatedData, Task, Operation } from "@/types";

export function LogisticsOfficerDashboard() {
  const qc = useQueryClient();
  const { user } = useAuth();

  const { data: tasks, isLoading: tasksLoading } = useQuery({
    queryKey: ["my-tasks"],
    queryFn: async () => {
      const res = await api.get<ApiResponse<Task[]>>("/my-tasks");
      return res.data.data;
    },
  });

  const { data: awaitingFeedbackOps } = useQuery({
    queryKey: ["ops-awaiting-feedback"],
    queryFn: async () => {
      const res = await api.get<ApiResponse<PaginatedData<Operation>>>(
        "/operations?status=awaiting_feedback&per_page=10"
      );
      return res.data.data.items;
    },
  });

  const updateTaskMutation = useMutation({
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

  const pendingTasks = tasks?.filter((t) => t.status === "pending") ?? [];
  const activeTasks = tasks?.filter((t) => t.status === "in_progress") ?? [];
  const completedCount = tasks?.filter((t) => t.status === "completed").length ?? 0;
  const totalTasks = tasks?.length ?? 0;

  const share = (n: number) =>
    totalTasks > 0 ? `${Math.round((n / totalTasks) * 100)}% of your tasks` : "Nothing assigned";

  return (
    <DashboardShell
      eyebrow={
        <>
          Welcome back, {user?.full_name?.split(" ")[0] ?? "there"}{" "}
          <span aria-hidden="true">👋</span>
        </>
      }
      title="Logistics Dashboard"
      subtitle="Truck logistics — your task queue at a glance"
      actions={
        <Button
          asChild
          className="h-10.5 rounded-xl px-4 text-[13px] font-semibold shadow-[0_12px_26px_-14px_rgba(23,52,99,0.9)]"
        >
          <Link href="/tasks">
            <CheckSquare className="h-4 w-4" strokeWidth={2.5} />
            My Tasks
          </Link>
        </Button>
      }
    >
      <section
        className="animate-rise grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4"
        aria-label="Task metrics"
      >
        <KpiCard
          tone="navy"
          icon={CheckSquare}
          title="Total Tasks"
          value={totalTasks}
          caption="Assigned to you"
          note={`${activeTasks.length + pendingTasks.length} still open`}
          noteTrend="flat"
        />
        <KpiCard
          tone="emerald"
          icon={Play}
          title="Active"
          value={activeTasks.length}
          caption="In progress"
          note={share(activeTasks.length)}
          noteTrend="flat"
        />
        <KpiCard
          tone="amber"
          icon={AlertCircle}
          title="Pending"
          value={pendingTasks.length}
          caption="Not started"
          note={share(pendingTasks.length)}
          noteTrend="flat"
        />
        <KpiCard
          tone="violet"
          icon={CheckCircle2}
          title="Completed"
          value={completedCount}
          caption="All time"
          note={
            totalTasks > 0
              ? `${Math.round((completedCount / totalTasks) * 100)}% completion rate`
              : "Nothing assigned"
          }
          noteTrend="flat"
        />
      </section>

      {(awaitingFeedbackOps?.length ?? 0) > 0 && (
        <AlertPanel
          icon={ClipboardCheck}
          tone="blue"
          title={`Operations Awaiting Your Feedback (${awaitingFeedbackOps!.length})`}
        >
          {awaitingFeedbackOps!.map((op) => (
            <AlertRow
              key={op.id}
              mono
              primary={op.operation_number}
              secondary={`${OP_TYPE_LABELS[op.type]} · ${formatDate(op.created_at)}`}
              trailing={
                <Button
                  asChild
                  size="sm"
                  variant="outline"
                  className="h-8 rounded-lg border-blue-300 bg-white/70 text-xs text-blue-700 hover:bg-blue-100 hover:text-blue-800"
                >
                  <Link href="/tasks">
                    Submit Readiness
                    <ChevronRight className="h-3.5 w-3.5" />
                  </Link>
                </Button>
              }
            />
          ))}
        </AlertPanel>
      )}

      <div className="animate-rise grid grid-cols-1 gap-4 lg:grid-cols-2">
        <PanelCard
          icon={Play}
          tone="blue"
          title={`In Progress (${activeTasks.length})`}
          subtitle="Tasks you have already started"
          action={
            <Button
              asChild
              variant="outline"
              size="sm"
              className="h-8 rounded-lg text-xs font-semibold"
            >
              <Link href="/tasks">
                View all
                <ChevronRight className="h-3.5 w-3.5" />
              </Link>
            </Button>
          }
        >
          {tasksLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-20 w-full rounded-xl" />
              ))}
            </div>
          ) : activeTasks.length ? (
            <div className="space-y-2">
              {activeTasks.map((task) => (
                <TaskRow
                  key={task.id}
                  task={task}
                  actions={
                    <>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 rounded-lg text-xs"
                        disabled={updateTaskMutation.isPending}
                        onClick={() =>
                          updateTaskMutation.mutate({
                            taskId: task.id as string,
                            status: "completed",
                          })
                        }
                      >
                        <CheckCircle2 className="h-3 w-3" />
                        Complete
                      </Button>
                      {task.task_type === "truck_logistics" && task.operation?.id && (
                        <Button asChild size="sm" className="h-7 rounded-lg text-xs">
                          <Link href="/tasks">
                            <Truck className="h-3 w-3" />
                            Submit Report
                          </Link>
                        </Button>
                      )}
                    </>
                  }
                />
              ))}
            </div>
          ) : (
            <EmptyState icon={CheckCircle2} label="No active tasks" />
          )}
        </PanelCard>

        <PanelCard
          icon={AlertCircle}
          tone="amber"
          title={`Pending (${pendingTasks.length})`}
          subtitle="Waiting for you to start"
        >
          {tasksLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-20 w-full rounded-xl" />
              ))}
            </div>
          ) : pendingTasks.length ? (
            <div className="space-y-2">
              {pendingTasks.map((task) => (
                <TaskRow
                  key={task.id}
                  task={task}
                  showDueDate
                  actions={
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 rounded-lg text-xs"
                      disabled={updateTaskMutation.isPending}
                      onClick={() =>
                        updateTaskMutation.mutate({
                          taskId: task.id as string,
                          status: "in_progress",
                        })
                      }
                    >
                      <Play className="h-3 w-3" />
                      Start Task
                    </Button>
                  }
                />
              ))}
            </div>
          ) : (
            <EmptyState icon={CheckSquare} label="No pending tasks" />
          )}
        </PanelCard>
      </div>

      <PanelCard
        icon={Truck}
        tone="sky"
        title="Fleet Shortcuts"
        subtitle="Jump straight to the truck registry"
        className="animate-rise"
      >
        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
          <QuickActionTile
            href="/fleet"
            icon={Truck}
            tone="sky"
            label="Truck Fleet Registry"
            description="View availability and manage logistics"
          />
          <QuickActionTile
            href="/fleet/waivers"
            icon={ClipboardCheck}
            tone="emerald"
            label="Waivers"
            description="Track truck waiver status"
          />
        </div>
      </PanelCard>
    </DashboardShell>
  );
}

function EmptyState({
  icon: Icon,
  label,
}: {
  icon: typeof CheckSquare;
  label: string;
}) {
  return (
    <div className="flex flex-col items-center gap-2 py-10 text-muted-foreground">
      <Icon className="h-8 w-8 opacity-25" />
      <p className="text-xs">{label}</p>
    </div>
  );
}
