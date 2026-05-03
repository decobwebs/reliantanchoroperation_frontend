"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import {
  ClipboardList,
  CheckCircle2,
  Clock,
  Truck,
  Ship,
  AlertCircle,
  PlusCircle,
  TrendingUp,
  Loader2,
  ChevronRight,
  DollarSign,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { api } from "@/lib/api";
import { Header } from "@/components/layout/Header";
import { StatCard } from "@/components/shared/StatCard";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatDate, formatCurrency, STATUS_LABELS, OP_TYPE_LABELS } from "@/lib/utils";
import type { ApiResponse, PaginatedData, AnalyticsDashboard, Operation, OperationStatus } from "@/types";

export function BunkerManagerDashboard() {
  const { data: analytics, isLoading: loadingAnalytics } = useQuery({
    queryKey: ["analytics-dashboard"],
    queryFn: async () => {
      const res = await api.get<ApiResponse<AnalyticsDashboard>>("/analytics/dashboard");
      return res.data.data;
    },
  });

  const { data: pendingFeedback } = useQuery({
    queryKey: ["ops-feedback-submitted"],
    queryFn: async () => {
      const res = await api.get<ApiResponse<PaginatedData<Operation>>>(
        "/operations?status=feedback_submitted&per_page=10"
      );
      return res.data.data.items;
    },
  });

  const { data: recentOps } = useQuery({
    queryKey: ["operations-recent"],
    queryFn: async () => {
      const res = await api.get<ApiResponse<PaginatedData<Operation>>>(
        "/operations?per_page=5"
      );
      return res.data.data.items;
    },
  });

  const ops = analytics?.operations;
  const trucks = analytics?.trucks;
  const vessels = analytics?.vessels;
  const revenue = analytics?.revenue ?? [];

  const statusBarData =
    ops?.by_status
      ?.filter((s) => s.count > 0)
      .map((s) => ({
        status: STATUS_LABELS[s.status as OperationStatus] ?? s.status,
        count: s.count,
      })) ?? [];

  if (loadingAnalytics) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div>
      <Header
        title="Command Center"
        subtitle="Full operational overview — Bunker Manager"
        actions={
          <Link href="/operations">
            <Button size="sm">
              <PlusCircle className="w-4 h-4 mr-1.5" />
              New Operation
            </Button>
          </Link>
        }
      />

      <div className="p-6 space-y-6">
        {/* Primary KPIs */}
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
          <StatCard
            title="Total Operations"
            value={ops?.total_operations ?? 0}
            subtitle="All time"
            icon={ClipboardList}
            color="blue"
          />
          <StatCard
            title="Active Operations"
            value={ops?.active_operations ?? 0}
            subtitle="In progress"
            icon={Clock}
            color="amber"
          />
          <StatCard
            title="Completed This Month"
            value={ops?.completed_this_month ?? 0}
            icon={CheckCircle2}
            color="emerald"
          />
          <StatCard
            title="Available Trucks"
            value={`${trucks?.available ?? 0} / ${trucks?.total_trucks ?? 0}`}
            subtitle={`${trucks?.in_transit ?? 0} in transit`}
            icon={Truck}
            color="purple"
          />
        </div>

        {/* Revenue row */}
        {revenue.length > 0 && (
          <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
            {revenue.map((r) => (
              <StatCard
                key={r.currency}
                title={`Revenue (${r.currency})`}
                value={formatCurrency(r.total_amount, r.currency)}
                subtitle={`${r.payment_count} payment${r.payment_count !== 1 ? "s" : ""}`}
                icon={DollarSign}
                color="emerald"
              />
            ))}
            <StatCard
              title="PFIs Linked"
              value={ops?.total_pfis ?? 0}
              subtitle="Pro-forma invoices"
              icon={TrendingUp}
              color="blue"
            />
            <StatCard
              title="BDNs Approved"
              value={ops?.total_bdns_approved ?? 0}
              subtitle="Delivery notes"
              icon={CheckCircle2}
              color="amber"
            />
          </div>
        )}

        {/* Pending Feedback Approvals — urgent action area */}
        {(pendingFeedback?.length ?? 0) > 0 && (
          <Card className="border-amber-200 bg-amber-50/50 border shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold flex items-center gap-2 text-amber-700">
                <AlertCircle className="w-4 h-4" />
                Pending Feedback Review ({pendingFeedback!.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0 pb-2">
              <div className="divide-y divide-amber-100">
                {pendingFeedback!.map((op) => (
                  <div key={op.id} className="flex items-center justify-between px-5 py-3">
                    <div>
                      <p className="text-sm font-semibold font-mono">{op.operation_number}</p>
                      <p className="text-xs text-muted-foreground">
                        {OP_TYPE_LABELS[op.type]} · Created {formatDate(op.created_at)}
                      </p>
                    </div>
                    <Link href={`/operations/${op.id}`}>
                      <Button size="sm" variant="outline" className="border-amber-300 text-amber-700 hover:bg-amber-100">
                        Review
                        <ChevronRight className="w-3.5 h-3.5 ml-1" />
                      </Button>
                    </Link>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Charts + Fleet */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <Card className="lg:col-span-2 border-0 shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-primary" />
                Operations by Status
              </CardTitle>
            </CardHeader>
            <CardContent>
              {statusBarData.length > 0 ? (
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={statusBarData} barSize={26}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis
                      dataKey="status"
                      tick={{ fontSize: 9 }}
                      axisLine={false}
                      tickLine={false}
                      interval={0}
                      angle={-30}
                      textAnchor="end"
                      height={50}
                    />
                    <YAxis
                      tick={{ fontSize: 11 }}
                      axisLine={false}
                      tickLine={false}
                      allowDecimals={false}
                    />
                    <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} cursor={{ fill: "hsl(var(--muted))" }} />
                    <Bar dataKey="count" name="Ops" fill="oklch(0.255 0.09 240)" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-[200px] flex items-center justify-center text-sm text-muted-foreground">
                  No operations yet
                </div>
              )}
            </CardContent>
          </Card>

          {/* Fleet snapshot */}
          <Card className="border-0 shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Ship className="w-4 h-4 text-primary" />
                Fleet Snapshot
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider mb-2">
                  Trucks
                </p>
                {[
                  { label: "Available", value: trucks?.available ?? 0, cls: "text-emerald-600" },
                  { label: "In Transit", value: trucks?.in_transit ?? 0, cls: "text-blue-600" },
                  { label: "Discharging", value: trucks?.discharging ?? 0, cls: "text-amber-600" },
                  { label: "Total", value: trucks?.total_trucks ?? 0, cls: "font-semibold" },
                ].map(({ label, value, cls }) => (
                  <div key={label} className="flex justify-between text-sm mt-1">
                    <span className="text-muted-foreground">{label}</span>
                    <span className={cls}>{value}</span>
                  </div>
                ))}
              </div>
              <div className="border-t pt-4">
                <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider mb-2">
                  Vessels
                </p>
                {[
                  { label: "Total", value: vessels?.total_vessels ?? 0, cls: "" },
                  { label: "ROB Entries", value: vessels?.total_rob_entries ?? 0, cls: "text-amber-600" },
                ].map(({ label, value, cls }) => (
                  <div key={label} className="flex justify-between text-sm mt-1">
                    <span className="text-muted-foreground">{label}</span>
                    <span className={cls}>{value}</span>
                  </div>
                ))}
              </div>
              <div className="border-t pt-3 flex flex-col gap-1.5">
                <Link href="/fleet" className="text-xs text-primary hover:underline flex items-center gap-1">
                  <Truck className="w-3 h-3" /> Manage trucks
                </Link>
                <Link href="/fleet/vessels" className="text-xs text-primary hover:underline flex items-center gap-1">
                  <Ship className="w-3 h-3" /> Manage vessels
                </Link>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Recent Operations */}
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-semibold">Recent Operations</CardTitle>
            <Link href="/operations" className="text-xs text-primary hover:underline">
              View all
            </Link>
          </CardHeader>
          <CardContent className="p-0">
            {recentOps?.length ? (
              <div className="divide-y">
                {recentOps.map((op) => (
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

        {/* Quick action shortcuts */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { href: "/operations", label: "New Operation", icon: PlusCircle, desc: "Create a bunker op" },
            { href: "/fleet", label: "Add Truck", icon: Truck, desc: "Register fleet truck" },
            { href: "/fleet/vessels", label: "Add Vessel", icon: Ship, desc: "Register vessel" },
          ].map(({ href, label, icon: Icon, desc }) => (
            <Link key={href} href={href}>
              <Card className="border-0 shadow-sm hover:shadow-md transition-shadow cursor-pointer h-full">
                <CardContent className="p-4 flex flex-col items-center text-center gap-2">
                  <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Icon className="w-4.5 h-4.5 text-primary" />
                  </div>
                  <p className="text-sm font-semibold">{label}</p>
                  <p className="text-xs text-muted-foreground">{desc}</p>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
