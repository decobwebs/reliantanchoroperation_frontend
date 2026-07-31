"use client";

import { useQuery } from "@tanstack/react-query";
import { TrendingUp, BarChart3 } from "lucide-react";
import { api } from "@/lib/api";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { PanelCard } from "@/components/dashboard/PanelCard";
import { StatCard } from "@/components/shared/StatCard";
import { OperationsStatusChart } from "@/components/dashboard/OperationsStatusChart";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCurrency, STATUS_LABELS } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { canAccessAnalytics } from "@/lib/auth";
import { QueryError } from "@/components/shared/QueryError";
import type { ApiResponse, AnalyticsDashboard, OperationStatus } from "@/types";

const MONTH_NAMES = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

export default function AnalyticsPage() {
  const { user, effectiveRole } = useAuth();
  const canSee = user && effectiveRole ? canAccessAnalytics(effectiveRole) : true;

  const { data: analytics, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["analytics-dashboard"],
    enabled: canSee,
    queryFn: async () => {
      const res = await api.get<ApiResponse<AnalyticsDashboard>>("/analytics/dashboard");
      return res.data.data;
    },
  });

  const { data: monthly } = useQuery({
    queryKey: ["analytics-monthly"],
    enabled: canSee,
    queryFn: async () => {
      // The endpoint returns { year, months: [{ month, total }] } — not a bare array.
      const res = await api.get<
        ApiResponse<{ year: number; months: { month: number; total: number }[] }>
      >(`/analytics/operations/monthly?year=${new Date().getFullYear()}`);
      return (res.data.data.months ?? []).map((m) => ({
        label: MONTH_NAMES[m.month - 1],
        count: m.total,
      }));
    },
  });

  if (user && !canSee) {
    return (
      <DashboardShell icon={BarChart3} iconTone="blue" showRole={false} title="Analytics" subtitle="Restricted">
        <QueryError error={{ isAxiosError: true, response: { status: 403 } }} />
      </DashboardShell>
    );
  }

  if (isError) {
    return (
      <DashboardShell icon={BarChart3} iconTone="blue" showRole={false} title="Analytics" subtitle="Operational insights">
        <QueryError error={error} onRetry={() => refetch()} />
      </DashboardShell>
    );
  }

  if (isLoading) {
    return (
      <DashboardShell icon={BarChart3} iconTone="blue" showRole={false} title="Analytics" subtitle="Operations and revenue insights">
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-32 rounded-2xl" />)}
        </div>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Skeleton className="h-72 rounded-2xl" />
          <Skeleton className="h-72 rounded-2xl" />
        </div>
      </DashboardShell>
    );
  }

  const ops = analytics?.operations;
  const statusData = ops?.by_status
    ?.filter((s) => s.count > 0)
    .map((s) => ({
      label: STATUS_LABELS[s.status as OperationStatus] ?? s.status,
      count: s.count,
    })) ?? [];

  return (
    <DashboardShell
      icon={BarChart3}
      iconTone="blue"
      showRole={false}
      title="Analytics"
      subtitle="Operations and revenue insights"
    >
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatCard title="Total Ops" value={ops?.total_operations ?? 0} icon={BarChart3} color="blue" />
        <StatCard title="Active Ops" value={ops?.active_operations ?? 0} icon={TrendingUp} color="amber" />
        <StatCard title="Completed (month)" value={ops?.completed_this_month ?? 0} icon={BarChart3} color="emerald" />
        {(analytics?.revenue ?? []).slice(0, 1).map((r) => (
          <StatCard key={r.currency} title={`Revenue (${r.currency})`} value={formatCurrency(parseFloat(r.total_amount), r.currency)} icon={TrendingUp} color="purple" />
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <PanelCard icon={BarChart3} tone="blue" title={`Monthly Operations (${new Date().getFullYear()})`} className="animate-rise">
          <OperationsStatusChart data={monthly ?? []} />
        </PanelCard>

        <PanelCard icon={BarChart3} tone="blue" title="Operations by Status" className="animate-rise">
          <OperationsStatusChart data={statusData} />
        </PanelCard>
      </div>
    </DashboardShell>
  );
}
