"use client";

import { useQuery } from "@tanstack/react-query";
import { Loader2, TrendingUp, BarChart3 } from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer,
} from "recharts";
import { api } from "@/lib/api";
import { Header } from "@/components/layout/Header";
import { StatCard } from "@/components/shared/StatCard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency, STATUS_LABELS } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { canAccessAnalytics } from "@/lib/auth";
import { QueryError } from "@/components/shared/QueryError";
import type { ApiResponse, AnalyticsDashboard, OperationStatus } from "@/types";

const MONTH_NAMES = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

export default function AnalyticsPage() {
  const { user } = useAuth();
  const canSee = user ? canAccessAnalytics(user.role) : true;

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
      const res = await api.get<ApiResponse<{month:number;count:number}[]>>(
        `/analytics/operations/monthly?year=${new Date().getFullYear()}`
      );
      return res.data.data.map((m) => ({ month: MONTH_NAMES[m.month - 1], count: m.count }));
    },
  });

  if (user && !canSee) {
    return (
      <div>
        <Header title="Analytics" subtitle="Restricted" />
        <div className="p-6"><QueryError error={{ isAxiosError: true, response: { status: 403 } }} /></div>
      </div>
    );
  }

  if (isError) {
    return (
      <div>
        <Header title="Analytics" subtitle="Operational insights" />
        <div className="p-6"><QueryError error={error} onRetry={() => refetch()} /></div>
      </div>
    );
  }

  if (isLoading) {
    return <div className="flex items-center justify-center h-full">
      <Loader2 className="w-8 h-8 animate-spin text-primary" />
    </div>;
  }

  const ops = analytics?.operations;
  const statusData = ops?.by_status
    ?.filter((s) => s.count > 0)
    .map((s) => ({
      status: STATUS_LABELS[s.status as OperationStatus] ?? s.status,
      count: s.count,
    })) ?? [];

  return (
    <div>
      <Header title="Analytics" subtitle="Operations and revenue insights" />
      <div className="p-6 space-y-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard title="Total Ops" value={ops?.total_operations ?? 0} icon={BarChart3} color="blue" />
          <StatCard title="Active Ops" value={ops?.active_operations ?? 0} icon={TrendingUp} color="amber" />
          <StatCard title="Completed (month)" value={ops?.completed_this_month ?? 0} icon={BarChart3} color="emerald" />
          {(analytics?.revenue ?? []).slice(0, 1).map((r) => (
            <StatCard key={r.currency} title={`Revenue (${r.currency})`} value={formatCurrency(parseFloat(r.total_amount), r.currency)} icon={TrendingUp} color="purple" />
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Card className="border-0 shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-semibold">Monthly Operations ({new Date().getFullYear()})</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={monthly ?? []} barSize={24}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="month" tick={{fontSize:11}} axisLine={false} tickLine={false} />
                  <YAxis tick={{fontSize:11}} axisLine={false} tickLine={false} allowDecimals={false} />
                  <Tooltip contentStyle={{fontSize:12,borderRadius:8}} />
                  <Bar dataKey="count" name="Operations" fill="oklch(0.255 0.09 240)" radius={[4,4,0,0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-semibold">Operations by Status</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={statusData} layout="vertical" barSize={16}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" horizontal={false} />
                  <XAxis type="number" tick={{fontSize:11}} axisLine={false} tickLine={false} />
                  <YAxis type="category" dataKey="status" tick={{fontSize:10}} width={110} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={{fontSize:12,borderRadius:8}} />
                  <Bar dataKey="count" name="Count" fill="oklch(0.58 0.125 247)" radius={[0,4,4,0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
