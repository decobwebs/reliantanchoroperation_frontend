"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import {
  DollarSign,
  FileText,
  CheckCircle2,
  Clock,
  TrendingUp,
  ExternalLink,
} from "lucide-react";
import { api } from "@/lib/api";
import { Header } from "@/components/layout/Header";
import { StatCard } from "@/components/shared/StatCard";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatCurrency, formatDate } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { canManageFinance } from "@/lib/auth";
import { QueryError } from "@/components/shared/QueryError";
import type { ApiResponse, PaginatedData, Operation, OperationStatus } from "@/types";

// Finance-relevant statuses — ordered per new commercial flow:
// PFI (advance) → payment confirmed → ops → BDN → invoice → complete
const FINANCE_STATUSES: OperationStatus[] = [
  "pfi_linked",
  "payment_processing",
  "payment_confirmed",
  "vessel_operations",
  "bdn_pending",
  "bdn_approved",
  "invoiced",
  "completed",
];

interface AnalyticsDashboard {
  operations: {
    total_operations: number;
    total_pfis: number;
    total_bdns_approved: number;
    active_operations: number;
    completed_this_month: number;
  };
  revenue: { currency: string; total_amount: string; payment_count: number }[];
}

export default function FinancePage() {
  const { user } = useAuth();
  const canSee = user ? canManageFinance(user.role) : true;

  const { data: analytics } = useQuery<AnalyticsDashboard>({
    queryKey: ["analytics-dashboard"],
    enabled: canSee,
    queryFn: async () => {
      const res = await api.get("/analytics/dashboard");
      return res.data.data;
    },
  });

  // Fetch ALL finance-stage operations by paging through the list (the previous
  // single per_page=50 call silently dropped finance ops beyond row 50).
  const { data: opsData, isLoading: opsLoading, isError, error, refetch } = useQuery({
    queryKey: ["finance-operations"],
    enabled: canSee,
    queryFn: async () => {
      const perPage = 100;
      let page = 1;
      let all: Operation[] = [];
      let total = Infinity;
      while (all.length < total && page <= 20) {
        const res = await api.get<ApiResponse<PaginatedData<Operation>>>(
          `/operations?page=${page}&per_page=${perPage}`
        );
        const data = res.data.data;
        all = all.concat(data.items);
        total = data.total ?? all.length;
        if (data.items.length < perPage) break;
        page += 1;
      }
      return all.filter((op) =>
        FINANCE_STATUSES.includes(op.status as OperationStatus)
      );
    },
  });

  if (user && !canSee) {
    return (
      <div>
        <Header title="Finance" subtitle="Restricted" />
        <div className="p-6">
          <QueryError error={{ isAxiosError: true, response: { status: 403 } }} />
        </div>
      </div>
    );
  }

  const revenue = analytics?.revenue ?? [];
  const totalPayments = revenue.reduce(
    (sum, r) => sum + r.payment_count,
    0
  );

  return (
    <div>
      <Header title="Finance" subtitle="Revenue, PFIs and payment tracking" />

      <div className="p-4 md:p-6 space-y-6">
        {/* Revenue stat cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {revenue.map((r) => (
            <StatCard
              key={r.currency}
              title={`Revenue (${r.currency})`}
              value={formatCurrency(parseFloat(r.total_amount), r.currency)}
              subtitle={`${r.payment_count} payment${r.payment_count !== 1 ? "s" : ""}`}
              icon={DollarSign}
              color="emerald"
            />
          ))}
          {revenue.length === 0 && (
            <StatCard
              title="Total Revenue"
              value="—"
              subtitle="No payments recorded"
              icon={DollarSign}
              color="emerald"
            />
          )}
          <StatCard
            title="PFIs Linked"
            value={String(analytics?.operations.total_pfis ?? "—")}
            subtitle="Pro-forma invoices"
            icon={FileText}
            color="blue"
          />
          <StatCard
            title="BDNs Approved"
            value={String(analytics?.operations.total_bdns_approved ?? "—")}
            subtitle="Bunker delivery notes"
            icon={CheckCircle2}
            color="amber"
          />
          <StatCard
            title="Payments Confirmed"
            value={String(totalPayments || "—")}
            subtitle="Across all currencies"
            icon={TrendingUp}
            color="purple"
          />
        </div>

        {/* Finance-stage operations table */}
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Clock className="w-4 h-4 text-primary" />
              Operations in Finance Pipeline
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {isError ? (
              <div className="p-5"><QueryError error={error} onRetry={() => refetch()} /></div>
            ) : opsLoading ? (
              <div className="divide-y">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="h-14 bg-muted/30 animate-pulse mx-5 my-2 rounded" />
                ))}
              </div>
            ) : opsData?.length === 0 ? (
              <div className="flex flex-col items-center py-12 text-muted-foreground">
                <FileText className="w-10 h-10 mb-3 opacity-30" />
                <p className="text-sm">No operations currently in finance stage</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/30 hover:bg-muted/30">
                    <TableHead className="text-xs">Operation</TableHead>
                    <TableHead className="text-xs">Type</TableHead>
                    <TableHead className="text-xs">Status</TableHead>
                    <TableHead className="text-xs">Currency</TableHead>
                    <TableHead className="text-xs">Created</TableHead>
                    <TableHead className="w-10" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {opsData?.map((op) => (
                    <TableRow key={op.id} className="hover:bg-muted/20">
                      <TableCell className="font-mono text-xs font-semibold text-primary">
                        {op.operation_number}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs capitalize">
                          {op.type.replace(/_/g, " ")}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={op.status as OperationStatus} />
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {op.currency}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {formatDate(op.created_at)}
                      </TableCell>
                      <TableCell>
                        <Link
                          href={`/operations/${op.id}`}
                          className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                        >
                          <ExternalLink className="w-3 h-3" />
                        </Link>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
