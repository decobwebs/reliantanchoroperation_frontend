"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import {
  CheckSquare,
  Truck,
  ClipboardCheck,
  Play,
  CheckCircle2,
  Loader2,
  AlertCircle,
  ChevronRight,
} from "lucide-react";
import { toast } from "sonner";
import { api, getErrorMessage } from "@/lib/api";
import { Header } from "@/components/layout/Header";
import { StatCard } from "@/components/shared/StatCard";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatDate, formatDateTime, OP_TYPE_LABELS } from "@/lib/utils";
import type { ApiResponse, PaginatedData, Task, Operation, OperationStatus } from "@/types";

const PRIORITY_COLOR: Record<string, string> = {
  low:    "bg-gray-100 text-gray-600",
  normal: "bg-blue-100 text-blue-700",
  high:   "bg-amber-100 text-amber-700",
  urgent: "bg-red-100 text-red-700",
};

export function LogisticsOfficerDashboard() {
  const qc = useQueryClient();

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
  const truckTasks = tasks?.filter((t) => t.task_type === "truck_logistics") ?? [];

  return (
    <div>
      <Header title="Logistics Dashboard" subtitle="Truck logistics — Logistics Officer" />

      <div className="p-4 md:p-6 space-y-6">
        {/* KPIs */}
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
          <StatCard title="Total Tasks" value={tasks?.length ?? 0} icon={CheckSquare} color="blue" />
          <StatCard title="Active" value={activeTasks.length} subtitle="In progress" icon={Play} color="amber" />
          <StatCard title="Pending" value={pendingTasks.length} subtitle="Not started" icon={AlertCircle} color="purple" />
          <StatCard title="Completed" value={completedCount} icon={CheckCircle2} color="emerald" />
        </div>

        {/* Operations needing my feedback */}
        {(awaitingFeedbackOps?.length ?? 0) > 0 && (
          <Card className="border-blue-200 bg-blue-50/40 border shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold flex items-center gap-2 text-blue-700">
                <ClipboardCheck className="w-4 h-4" />
                Operations Awaiting Your Feedback ({awaitingFeedbackOps!.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0 pb-2">
              <div className="divide-y divide-blue-100">
                {awaitingFeedbackOps!.map((op) => (
                  <div key={op.id} className="flex items-center justify-between px-5 py-3">
                    <div>
                      <p className="text-sm font-semibold font-mono">{op.operation_number}</p>
                      <p className="text-xs text-muted-foreground">
                        {OP_TYPE_LABELS[op.type]} · {formatDate(op.created_at)}
                      </p>
                    </div>
                    <Link href="/tasks">
                      <Button size="sm" variant="outline" className="border-blue-300 text-blue-700 hover:bg-blue-100">
                        Submit Readiness
                        <ChevronRight className="w-3.5 h-3.5 ml-1" />
                      </Button>
                    </Link>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Active & Pending Tasks */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Active tasks */}
          <Card className="border-0 shadow-sm">
            <CardHeader className="pb-2 flex flex-row items-center justify-between">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Play className="w-4 h-4 text-blue-600" />
                In Progress ({activeTasks.length})
              </CardTitle>
              <Link href="/tasks" className="text-xs text-primary hover:underline">View all</Link>
            </CardHeader>
            <CardContent className="p-0">
              {tasksLoading ? (
                <div className="flex justify-center py-6">
                  <Loader2 className="w-5 h-5 animate-spin text-primary" />
                </div>
              ) : activeTasks.length ? (
                <div className="divide-y">
                  {activeTasks.map((task) => (
                    <div key={task.id} className="px-4 py-3">
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div>
                          <p className="text-xs font-semibold capitalize">{task.task_type.replace(/_/g, " ")}</p>
                          {task.operation && (
                            <p className="text-[10px] text-muted-foreground font-mono">{task.operation.operation_number}</p>
                          )}
                        </div>
                        <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded shrink-0 ${PRIORITY_COLOR[task.priority] ?? ""}`}>
                          {task.priority}
                        </span>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs"
                          disabled={updateTaskMutation.isPending}
                          onClick={() => updateTaskMutation.mutate({ taskId: task.id as string, status: "completed" })}
                        >
                          <CheckCircle2 className="w-3 h-3 mr-1" />
                          Complete
                        </Button>
                        {task.task_type === "truck_logistics" && task.operation?.id && (
                          <Link href="/tasks">
                            <Button size="sm" className="h-7 text-xs">
                              <Truck className="w-3 h-3 mr-1" />
                              Submit Report
                            </Button>
                          </Link>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center py-8 text-muted-foreground">
                  <CheckCircle2 className="w-8 h-8 mb-2 opacity-30" />
                  <p className="text-xs">No active tasks</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Pending tasks */}
          <Card className="border-0 shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-amber-600" />
                Pending ({pendingTasks.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {pendingTasks.length ? (
                <div className="divide-y">
                  {pendingTasks.map((task) => (
                    <div key={task.id} className="px-4 py-3">
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div>
                          <p className="text-xs font-semibold capitalize">{task.task_type.replace(/_/g, " ")}</p>
                          {task.operation && (
                            <p className="text-[10px] text-muted-foreground font-mono">{task.operation.operation_number}</p>
                          )}
                          {task.due_date && (
                            <p className="text-[10px] text-muted-foreground">Due: {formatDate(task.due_date)}</p>
                          )}
                        </div>
                        <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded shrink-0 ${PRIORITY_COLOR[task.priority] ?? ""}`}>
                          {task.priority}
                        </span>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs"
                        disabled={updateTaskMutation.isPending}
                        onClick={() => updateTaskMutation.mutate({ taskId: task.id as string, status: "in_progress" })}
                      >
                        <Play className="w-3 h-3 mr-1" />
                        Start Task
                      </Button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center py-8 text-muted-foreground">
                  <CheckSquare className="w-8 h-8 mb-2 opacity-30" />
                  <p className="text-xs">No pending tasks</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Truck fleet link */}
        <Link href="/fleet">
          <Card className="border-0 shadow-sm hover:shadow-md transition-shadow cursor-pointer">
            <CardContent className="p-4 flex items-center gap-4">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                <Truck className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-sm font-semibold">Truck Fleet Registry</p>
                <p className="text-xs text-muted-foreground">View truck availability and manage logistics</p>
              </div>
              <ChevronRight className="w-4 h-4 text-muted-foreground ml-auto" />
            </CardContent>
          </Card>
        </Link>
      </div>
    </div>
  );
}
