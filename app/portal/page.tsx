"use client";

import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { api } from "@/lib/api";
import { StatCard } from "@/components/shared/StatCard";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { PanelCard } from "@/components/dashboard/PanelCard";
import { Skeleton } from "@/components/ui/skeleton";
import { ClipboardList, CheckCircle2, Clock, XCircle } from "lucide-react";
import { formatDate, formatRelative, OP_TYPE_LABELS } from "@/lib/utils";
import Link from "next/link";
import type { ApiResponse, PaginatedData, Operation, OperationStatus } from "@/types";

interface PortalDashboard {
  total_operations: number;
  active_operations: number;
  completed_operations: number;
  cancelled_operations: number;
}

export default function PortalDashboardPage() {
  const { user } = useAuth();

  const { data: summary, isLoading: loadingSummary } = useQuery({
    queryKey: ["portal-dashboard"],
    queryFn: async () => {
      const res = await api.get<ApiResponse<PortalDashboard>>("/portal/dashboard");
      return res.data.data;
    },
  });

  const { data: recentOps, isLoading: loadingOps } = useQuery({
    queryKey: ["portal-operations-recent"],
    queryFn: async () => {
      const res = await api.get<ApiResponse<PaginatedData<Operation>>>(
        "/portal/operations?per_page=5"
      );
      return res.data.data.items;
    },
  });

  return (
    <div className="animate-rise space-y-6">
      <div>
        <h1 className="text-[26px] font-extrabold leading-none tracking-tight text-foreground">
          Welcome back, {user?.full_name.split(" ")[0]}
        </h1>
        <p className="mt-2 text-[13px] text-muted-foreground">
          Here&apos;s an overview of your operations with Reliant Anchor.
        </p>
      </div>

      {loadingSummary ? (
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-32 rounded-2xl" />)}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <StatCard title="Total Operations" value={summary?.total_operations ?? 0} icon={ClipboardList} color="blue" />
          <StatCard title="Active" value={summary?.active_operations ?? 0} icon={Clock} color="amber" />
          <StatCard title="Completed" value={summary?.completed_operations ?? 0} icon={CheckCircle2} color="emerald" />
          <StatCard title="Cancelled" value={summary?.cancelled_operations ?? 0} icon={XCircle} color="red" />
        </div>
      )}

      <PanelCard
        icon={ClipboardList}
        tone="blue"
        title="Recent Operations"
        action={
          <Link href="/portal/operations" className="rounded text-[12px] font-semibold text-brand-600 transition-colors hover:text-brand-700">
            View all →
          </Link>
        }
        flush
      >
        {loadingOps ? (
          <Skeleton className="m-4 h-40 rounded-lg lg:m-5" />
        ) : recentOps?.length ? (
          <div className="divide-y divide-border/70">
            {recentOps.map((op) => (
              <Link
                key={op.id}
                href={`/portal/operations/${op.id}`}
                className="flex items-center justify-between px-4 py-4 transition-colors hover:bg-muted/40 lg:px-5"
              >
                <div>
                  <p className="font-mono text-[13px] font-semibold text-brand-600">
                    {op.operation_number}
                  </p>
                  <p className="mt-0.5 text-[12px] text-muted-foreground">
                    {OP_TYPE_LABELS[op.type]} · {formatDate(op.created_at)}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <StatusBadge status={op.status as OperationStatus} />
                  <span className="hidden text-[11px] tabular-nums text-muted-foreground sm:block">
                    {formatRelative(op.updated_at)}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <p className="py-10 text-center text-sm text-muted-foreground">
            No operations yet
          </p>
        )}
      </PanelCard>
    </div>
  );
}
