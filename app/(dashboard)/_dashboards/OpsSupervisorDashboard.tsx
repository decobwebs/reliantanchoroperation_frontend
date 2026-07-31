"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import {
  Activity,
  CheckSquare,
  ChevronRight,
  ClipboardList,
  Layers,
  Ship,
  Truck,
} from "lucide-react";
import { api } from "@/lib/api";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { KpiCard } from "@/components/dashboard/KpiCard";
import { PanelCard } from "@/components/dashboard/PanelCard";
import { QuickActionTile } from "@/components/dashboard/QuickActionTile";
import { RecentOperationsTable } from "@/components/dashboard/RecentOperationsTable";
import { TaskRow } from "@/components/dashboard/TaskRow";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/hooks/useAuth";
import type { ApiResponse, PaginatedData, Operation, Task, Vessel } from "@/types";

export function OpsSupervisorDashboard() {
  const { user } = useAuth();

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

  const { data: vessels } = useQuery({
    queryKey: ["vessels-lookup"],
    queryFn: async () => {
      const res = await api.get<ApiResponse<Vessel[]>>("/vessels");
      return res.data.data;
    },
  });

  const vesselNames = useMemo(
    () => Object.fromEntries((vessels ?? []).map((v) => [v.id, v.vessel_name])),
    [vessels]
  );

  const activeOps =
    opsData?.items?.filter(
      (op) => !["completed", "archived", "cancelled"].includes(op.status)
    ) ?? [];

  const activeTasks =
    tasks?.filter((t) => t.status !== "cancelled" && t.status !== "completed") ?? [];
  const completedTasks = tasks?.filter((t) => t.status === "completed").length ?? 0;

  const totalOps = opsData?.total ?? 0;
  const totalTasks = tasks?.length ?? 0;

  return (
    <DashboardShell
      eyebrow={
        <>
          Welcome back, {user?.full_name?.split(" ")[0] ?? "there"}{" "}
          <span aria-hidden="true">👋</span>
        </>
      }
      title="Operations Overview"
      subtitle="Coordinate operations and keep your task queue moving"
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
        aria-label="Key metrics"
      >
        <KpiCard
          tone="navy"
          icon={Layers}
          title="Total Operations"
          value={totalOps}
          caption="All time"
          note={`${activeOps.length} in the current pipeline`}
          noteTrend="flat"
        />
        <KpiCard
          tone="emerald"
          icon={Activity}
          title="Active Operations"
          value={activeOps.length}
          caption="In pipeline"
          note={
            totalOps > 0
              ? `${Math.round((activeOps.length / totalOps) * 100)}% of all operations`
              : "No operations yet"
          }
          noteTrend="flat"
        />
        <KpiCard
          tone="violet"
          icon={CheckSquare}
          title="My Active Tasks"
          value={activeTasks.length}
          caption="Pending / in progress"
          note={
            totalTasks > 0
              ? `${Math.round((activeTasks.length / totalTasks) * 100)}% of your tasks`
              : "Nothing assigned"
          }
          noteTrend="flat"
        />
        <KpiCard
          tone="amber"
          icon={CheckSquare}
          title="Tasks Completed"
          value={completedTasks}
          caption="All time"
          note={
            totalTasks > 0
              ? `${Math.round((completedTasks / totalTasks) * 100)}% completion rate`
              : "Nothing assigned"
          }
          noteTrend="flat"
        />
      </section>

      <div className="animate-rise grid grid-cols-1 gap-4 xl:grid-cols-3">
        <PanelCard
          icon={ClipboardList}
          tone="blue"
          title="Recent Operations"
          subtitle="Latest activities across the fleet"
          flush
          className="xl:col-span-2"
          action={
            <Button
              asChild
              variant="outline"
              size="sm"
              className="h-8 rounded-lg text-xs font-semibold"
            >
              <Link href="/operations">
                View all
                <ChevronRight className="h-3.5 w-3.5" />
              </Link>
            </Button>
          }
        >
          {opsLoading ? (
            <div className="space-y-2 px-5 pb-5">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full rounded-lg" />
              ))}
            </div>
          ) : (
            <RecentOperationsTable
              operations={opsData?.items ?? []}
              vesselNames={vesselNames}
            />
          )}
        </PanelCard>

        <PanelCard
          icon={CheckSquare}
          tone="violet"
          title="My Tasks"
          subtitle="Assigned to you right now"
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
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-14 w-full rounded-xl" />
              ))}
            </div>
          ) : tasks?.length ? (
            <div className="space-y-2">
              {tasks.slice(0, 6).map((task) => (
                <TaskRow key={task.id} task={task} showStatus />
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2 py-10 text-muted-foreground">
              <CheckSquare className="h-8 w-8 opacity-25" />
              <p className="text-xs">No tasks assigned</p>
            </div>
          )}
        </PanelCard>
      </div>

      <PanelCard
        icon={Truck}
        tone="sky"
        title="Fleet Shortcuts"
        subtitle="Jump straight to the registries"
        className="animate-rise"
      >
        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
          <QuickActionTile
            href="/fleet"
            icon={Truck}
            tone="sky"
            label="Truck Fleet"
            description="View and manage trucks"
          />
          <QuickActionTile
            href="/fleet/vessels"
            icon={Ship}
            tone="violet"
            label="Vessel Registry"
            description="View vessels and ROB"
          />
        </div>
      </PanelCard>
    </DashboardShell>
  );
}
