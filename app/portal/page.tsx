"use client";

import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { api } from "@/lib/api";
import { StatCard } from "@/components/shared/StatCard";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, ClipboardList, CheckCircle2, Clock, XCircle } from "lucide-react";
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

  if (loadingSummary) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Greeting */}
      <div>
        <h1 className="text-2xl font-bold">
          Welcome back, {user?.full_name.split(" ")[0]}
        </h1>
        <p className="text-muted-foreground mt-1">
          Here&apos;s an overview of your operations with Reliant Anchor.
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          title="Total Operations"
          value={summary?.total_operations ?? 0}
          icon={ClipboardList}
          color="blue"
        />
        <StatCard
          title="Active"
          value={summary?.active_operations ?? 0}
          icon={Clock}
          color="amber"
        />
        <StatCard
          title="Completed"
          value={summary?.completed_operations ?? 0}
          icon={CheckCircle2}
          color="emerald"
        />
        <StatCard
          title="Cancelled"
          value={summary?.cancelled_operations ?? 0}
          icon={XCircle}
          color="red"
        />
      </div>

      {/* Recent operations */}
      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-3 flex flex-row items-center justify-between">
          <CardTitle className="text-base font-semibold">
            Recent Operations
          </CardTitle>
          <Link
            href="/portal/operations"
            className="text-xs text-primary hover:underline font-medium"
          >
            View all →
          </Link>
        </CardHeader>
        <CardContent className="p-0">
          {loadingOps ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
            </div>
          ) : recentOps?.length ? (
            <div className="divide-y">
              {recentOps.map((op) => (
                <Link
                  key={op.id}
                  href={`/portal/operations/${op.id}`}
                  className="flex items-center justify-between px-6 py-4 hover:bg-muted/50 transition-colors"
                >
                  <div>
                    <p className="text-sm font-mono font-semibold text-primary">
                      {op.operation_number}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {OP_TYPE_LABELS[op.type]} · {formatDate(op.created_at)}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <StatusBadge status={op.status as OperationStatus} />
                    <span className="text-xs text-muted-foreground hidden sm:block">
                      {formatRelative(op.updated_at)}
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-10">
              No operations yet
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
