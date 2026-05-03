"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import {
  ClipboardList,
  CheckSquare,
  Truck,
  Ship,
  Clock,
  ChevronRight,
  Loader2,
} from "lucide-react";
import { api } from "@/lib/api";
import { Header } from "@/components/layout/Header";
import { StatCard } from "@/components/shared/StatCard";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDate, OP_TYPE_LABELS } from "@/lib/utils";
import type { ApiResponse, PaginatedData, Operation, Task, OperationStatus } from "@/types";

const TASK_STATUS_COLOR: Record<string, string> = {
  pending:     "bg-gray-100 text-gray-700",
  in_progress: "bg-blue-100 text-blue-700",
  completed:   "bg-emerald-100 text-emerald-700",
  cancelled:   "bg-red-100 text-red-700",
};

const PRIORITY_COLOR: Record<string, string> = {
  low:    "bg-gray-100 text-gray-600",
  normal: "bg-blue-100 text-blue-700",
  high:   "bg-amber-100 text-amber-700",
  urgent: "bg-red-100 text-red-700",
};

export function OpsSupervisorDashboard() {
  const { data: opsData, isLoading: opsLoading } = useQuery({
    queryKey: ["operations-recent"],
    queryFn: async () => {
      const res = await api.get<ApiResponse<PaginatedData<Operation>>>(
        "/operations?per_page=8"
      );
      return res.data.data;
    },
  });

  const { data: tasks, isLoading: tasksLoading } = useQuery({
    queryKey: ["my-tasks"],
    queryFn: async () => {
      const res = await api.get<ApiResponse<Task[]>>("/my-tasks");
      return res.data.data;
    },
  });

  const activeOps = opsData?.items?.filter(
    (op) => !["completed", "archived", "cancelled"].includes(op.status)
  ) ?? [];

  const activeTasks = tasks?.filter((t) => t.status !== "cancelled" && t.status !== "completed") ?? [];
  const completedTasks = tasks?.filter((t) => t.status === "completed").length ?? 0;

  return (
    <div>
      <Header title="Operations Overview" subtitle="Ops Supervisor workspace" />

      <div className="p-6 space-y-6">
        {/* KPIs */}
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
          <StatCard
            title="Total Operations"
            value={opsData?.total ?? 0}
            subtitle="All time"
            icon={ClipboardList}
            color="blue"
          />
          <StatCard
            title="Active Operations"
            value={activeOps.length}
            subtitle="In pipeline"
            icon={Clock}
            color="amber"
          />
          <StatCard
            title="My Active Tasks"
            value={activeTasks.length}
            subtitle="Pending / in progress"
            icon={CheckSquare}
            color="purple"
          />
          <StatCard
            title="Tasks Completed"
            value={completedTasks}
            subtitle="All time"
            icon={CheckSquare}
            color="emerald"
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Active Operations */}
          <Card className="lg:col-span-2 border-0 shadow-sm">
            <CardHeader className="pb-2 flex flex-row items-center justify-between">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <ClipboardList className="w-4 h-4 text-primary" />
                Recent Operations
              </CardTitle>
              <Link href="/operations" className="text-xs text-primary hover:underline">
                View all
              </Link>
            </CardHeader>
            <CardContent className="p-0">
              {opsLoading ? (
                <div className="flex items-center justify-center py-10">
                  <Loader2 className="w-6 h-6 animate-spin text-primary" />
                </div>
              ) : opsData?.items?.length ? (
                <div className="divide-y">
                  {opsData.items.map((op) => (
                    <Link
                      key={op.id}
                      href={`/operations/${op.id}`}
                      className="flex items-center justify-between px-5 py-3 hover:bg-muted/30 transition-colors"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-semibold font-mono">{op.operation_number}</p>
                        <p className="text-xs text-muted-foreground">
                          {OP_TYPE_LABELS[op.type]} · {formatDate(op.created_at)}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <StatusBadge status={op.status as OperationStatus} />
                        <ChevronRight className="w-4 h-4 text-muted-foreground" />
                      </div>
                    </Link>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-8">No operations yet</p>
              )}
            </CardContent>
          </Card>

          {/* My Tasks */}
          <Card className="border-0 shadow-sm">
            <CardHeader className="pb-2 flex flex-row items-center justify-between">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <CheckSquare className="w-4 h-4 text-primary" />
                My Tasks
              </CardTitle>
              <Link href="/tasks" className="text-xs text-primary hover:underline">
                View all
              </Link>
            </CardHeader>
            <CardContent className="p-0">
              {tasksLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-5 h-5 animate-spin text-primary" />
                </div>
              ) : tasks?.length ? (
                <div className="divide-y">
                  {tasks.slice(0, 6).map((task) => (
                    <div key={task.id} className="px-4 py-3">
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-xs font-medium capitalize leading-snug">
                          {task.task_type.replace(/_/g, " ")}
                        </p>
                        <span
                          className={`text-[10px] font-medium px-1.5 py-0.5 rounded shrink-0 ${
                            TASK_STATUS_COLOR[task.status] ?? "bg-gray-100 text-gray-700"
                          }`}
                        >
                          {task.status.replace(/_/g, " ")}
                        </span>
                      </div>
                      {task.operation && (
                        <p className="text-[10px] text-muted-foreground mt-0.5 font-mono">
                          {task.operation.operation_number}
                        </p>
                      )}
                      <span
                        className={`inline-block text-[10px] font-medium px-1.5 py-0.5 rounded mt-1 ${
                          PRIORITY_COLOR[task.priority] ?? "bg-gray-100 text-gray-600"
                        }`}
                      >
                        {task.priority}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center py-8 text-muted-foreground">
                  <CheckSquare className="w-8 h-8 mb-2 opacity-30" />
                  <p className="text-xs">No tasks assigned</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Fleet quick view */}
        <div className="grid grid-cols-2 gap-4">
          <Link href="/fleet">
            <Card className="border-0 shadow-sm hover:shadow-md transition-shadow cursor-pointer">
              <CardContent className="p-4 flex items-center gap-4">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                  <Truck className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <p className="text-sm font-semibold">Truck Fleet</p>
                  <p className="text-xs text-muted-foreground">View and manage trucks</p>
                </div>
                <ChevronRight className="w-4 h-4 text-muted-foreground ml-auto" />
              </CardContent>
            </Card>
          </Link>
          <Link href="/fleet/vessels">
            <Card className="border-0 shadow-sm hover:shadow-md transition-shadow cursor-pointer">
              <CardContent className="p-4 flex items-center gap-4">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                  <Ship className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <p className="text-sm font-semibold">Vessel Registry</p>
                  <p className="text-xs text-muted-foreground">View vessels and ROB</p>
                </div>
                <ChevronRight className="w-4 h-4 text-muted-foreground ml-auto" />
              </CardContent>
            </Card>
          </Link>
        </div>
      </div>
    </div>
  );
}
