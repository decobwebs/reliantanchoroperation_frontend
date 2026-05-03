"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import {
  CheckSquare,
  Ship,
  AlertTriangle,
  Play,
  Loader2,
  Anchor,
} from "lucide-react";
import { toast } from "sonner";
import { api, getErrorMessage } from "@/lib/api";
import { Header } from "@/components/layout/Header";
import { StatCard } from "@/components/shared/StatCard";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatNumber } from "@/lib/utils";
import type { ApiResponse, Task, Vessel } from "@/types";

const PRIORITY_COLOR: Record<string, string> = {
  low:    "bg-gray-100 text-gray-600",
  normal: "bg-blue-100 text-blue-700",
  high:   "bg-amber-100 text-amber-700",
  urgent: "bg-red-100 text-red-700",
};

export function MarineManagerDashboard() {
  const qc = useQueryClient();

  const { data: tasks, isLoading: tasksLoading } = useQuery({
    queryKey: ["my-tasks"],
    queryFn: async () => {
      const res = await api.get<ApiResponse<Task[]>>("/my-tasks");
      return res.data.data;
    },
  });

  const { data: vessels, isLoading: vesselsLoading } = useQuery({
    queryKey: ["vessels"],
    queryFn: async () => {
      const res = await api.get<ApiResponse<Vessel[]>>("/vessels");
      return res.data.data;
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

  const activeTasks = tasks?.filter((t) => t.status !== "cancelled" && t.status !== "completed") ?? [];
  const lowRobVessels = vessels?.filter(
    (v) => v.rob_threshold_mt && parseFloat(v.current_rob_mt) <= parseFloat(v.rob_threshold_mt)
  ) ?? [];

  return (
    <div>
      <Header title="Marine Dashboard" subtitle="Vessel operations — Marine Manager" />

      <div className="p-6 space-y-6">
        {/* KPIs */}
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
          <StatCard title="My Tasks" value={tasks?.length ?? 0} icon={CheckSquare} color="blue" />
          <StatCard title="Active Tasks" value={activeTasks.length} subtitle="In progress / pending" icon={Play} color="amber" />
          <StatCard title="Vessels Registered" value={vessels?.length ?? 0} icon={Ship} color="purple" />
          <StatCard
            title="Low ROB Alerts"
            value={lowRobVessels.length}
            subtitle={lowRobVessels.length > 0 ? "Below threshold" : "All vessels OK"}
            icon={AlertTriangle}
            color={lowRobVessels.length > 0 ? "red" : "emerald"}
          />
        </div>

        {/* ROB Alerts */}
        {lowRobVessels.length > 0 && (
          <Card className="border-red-200 bg-red-50/40 border shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold flex items-center gap-2 text-red-700">
                <AlertTriangle className="w-4 h-4" />
                Low ROB Alert — {lowRobVessels.length} vessel{lowRobVessels.length > 1 ? "s" : ""} below threshold
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0 pb-2">
              <div className="divide-y divide-red-100">
                {lowRobVessels.map((vessel) => (
                  <div key={vessel.id} className="flex items-center justify-between px-5 py-3">
                    <div>
                      <p className="text-sm font-semibold">{vessel.vessel_name}</p>
                      <p className="text-xs text-muted-foreground font-mono">{vessel.imo_number}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold text-red-700">
                        {formatNumber(parseFloat(vessel.current_rob_mt))} MT
                      </p>
                      <p className="text-[10px] text-muted-foreground">
                        Threshold: {vessel.rob_threshold_mt ? `${formatNumber(parseFloat(vessel.rob_threshold_mt))} MT` : "—"}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* My Tasks */}
          <Card className="border-0 shadow-sm">
            <CardHeader className="pb-2 flex flex-row items-center justify-between">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <CheckSquare className="w-4 h-4 text-primary" />
                My Tasks
              </CardTitle>
              <Link href="/tasks" className="text-xs text-primary hover:underline">View all</Link>
            </CardHeader>
            <CardContent className="p-0">
              {tasksLoading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="w-5 h-5 animate-spin text-primary" />
                </div>
              ) : activeTasks.length ? (
                <div className="divide-y">
                  {activeTasks.slice(0, 5).map((task) => (
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
                        {task.status === "pending" && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-xs"
                            disabled={updateTaskMutation.isPending}
                            onClick={() => updateTaskMutation.mutate({ taskId: task.id as string, status: "in_progress" })}
                          >
                            <Play className="w-3 h-3 mr-1" />
                            Start
                          </Button>
                        )}
                        {task.status === "in_progress" && (
                          <Link href="/tasks">
                            <Button size="sm" className="h-7 text-xs">
                              <Anchor className="w-3 h-3 mr-1" />
                              Mark Vessel Ready
                            </Button>
                          </Link>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center py-8 text-muted-foreground">
                  <CheckSquare className="w-8 h-8 mb-2 opacity-30" />
                  <p className="text-xs">No active tasks</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Vessels */}
          <Card className="border-0 shadow-sm">
            <CardHeader className="pb-2 flex flex-row items-center justify-between">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Ship className="w-4 h-4 text-primary" />
                Vessel Registry
              </CardTitle>
              <Link href="/fleet/vessels" className="text-xs text-primary hover:underline">View all</Link>
            </CardHeader>
            <CardContent className="p-0">
              {vesselsLoading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="w-5 h-5 animate-spin text-primary" />
                </div>
              ) : vessels?.length ? (
                <div className="divide-y">
                  {vessels.slice(0, 5).map((vessel) => {
                    const robPct = vessel.capacity_mt
                      ? Math.min(100, Math.round((parseFloat(vessel.current_rob_mt) / parseFloat(vessel.capacity_mt)) * 100))
                      : 0;
                    const isLow = vessel.rob_threshold_mt &&
                      parseFloat(vessel.current_rob_mt) <= parseFloat(vessel.rob_threshold_mt);

                    return (
                      <div key={vessel.id} className="px-4 py-3">
                        <div className="flex items-center justify-between mb-1.5">
                          <div>
                            <p className="text-xs font-semibold">{vessel.vessel_name}</p>
                            <p className="text-[10px] text-muted-foreground font-mono">{vessel.imo_number}</p>
                          </div>
                          {isLow && (
                            <Badge variant="destructive" className="text-[10px] h-4 px-1.5">Low ROB</Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full ${isLow ? "bg-red-500" : robPct > 50 ? "bg-emerald-500" : "bg-amber-500"}`}
                              style={{ width: `${robPct}%` }}
                            />
                          </div>
                          <span className="text-[10px] text-muted-foreground shrink-0 tabular-nums">
                            {formatNumber(parseFloat(vessel.current_rob_mt))} MT
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="flex flex-col items-center py-8 text-muted-foreground">
                  <Ship className="w-8 h-8 mb-2 opacity-30" />
                  <p className="text-xs">No vessels registered</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
