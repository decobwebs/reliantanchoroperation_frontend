"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import {
  DollarSign,
  FileText,
  CheckCircle2,
  TrendingUp,
  ExternalLink,
  ChevronRight,
  Loader2,
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
import { formatCurrency, formatDate, OP_TYPE_LABELS } from "@/lib/utils";
import type { ApiResponse, PaginatedData, Operation, OperationStatus } from "@/types";

const FINANCE_STATUSES: OperationStatus[] = [
  "pfi_linked", "payment_processing", "payment_confirmed",
  "vessel_operations", "bdn_pending", "bdn_approved", "invoiced", "completed",
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

export function FinanceManagerDashboard() {
  const { data: analytics } = useQuery<AnalyticsDashboard>({
    queryKey: ["analytics-dashboard"],
    queryFn: async () => {
      const res = await api.get("/analytics/dashboard");
      return res.data.data;
    },
  });

  const { data: financeOps, isLoading: opsLoading } = useQuery({
    queryKey: ["finance-operations"],
    queryFn: async () => {
      const res = await api.get<ApiResponse<PaginatedData<Operation>>>(
        "/operations?page=1&per_page=50"
      );
      const all: Operation[] = res.data.data.items;
      return all.filter((op) => FINANCE_STATUSES.includes(op.status as OperationStatus));
    },
  });

  const revenue = analytics?.revenue ?? [];
  const totalPayments = revenue.reduce((s, r) => s + r.payment_count, 0);

  return (
    <div>
      <Header title="Finance Dashboard" subtitle="Revenue, PFIs and payment pipeline" />

      <div className="p-6 space-y-6">
        {/* Revenue KPIs */}
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
          {revenue.length > 0 ? (
            revenue.map((r) => (
              <StatCard
                key={r.currency}
                title={`Revenue (${r.currency})`}
                value={formatCurrency(r.total_amount, r.currency)}
                subtitle={`${r.payment_count} payment${r.payment_count !== 1 ? "s" : ""}`}
                icon={DollarSign}
                color="emerald"
              />
            ))
          ) : (
            <StatCard
              title="Total Revenue"
              value="—"
              subtitle="No payments yet"
              icon={DollarSign}
              color="emerald"
            />
          )}
          <StatCard
            title="PFIs Linked"
            value={analytics?.operations.total_pfis ?? 0}
            subtitle="Pro-forma invoices"
            icon={FileText}
            color="blue"
          />
          <StatCard
            title="BDNs Approved"
            value={analytics?.operations.total_bdns_approved ?? 0}
            subtitle="Delivery notes"
            icon={CheckCircle2}
            color="amber"
          />
          <StatCard
            title="Payments Confirmed"
            value={totalPayments}
            subtitle="All currencies"
            icon={TrendingUp}
            color="purple"
          />
        </div>

        {/* Finance pipeline */}
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-3 flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-primary" />
              Operations in Finance Pipeline
              {financeOps && (
                <Badge variant="secondary" className="ml-1 text-[10px] h-4 px-1.5">
                  {financeOps.length}
                </Badge>
              )}
            </CardTitle>
            <Link href="/finance" className="text-xs text-primary hover:underline flex items-center gap-1">
              Full Finance View
              <ChevronRight className="w-3 h-3" />
            </Link>
          </CardHeader>
          <CardContent className="p-0">
            {opsLoading ? (
              <div className="flex items-center justify-center py-10">
                <Loader2 className="w-6 h-6 animate-spin text-primary" />
              </div>
            ) : financeOps?.length === 0 ? (
              <div className="flex flex-col items-center py-12 text-muted-foreground">
                <FileText className="w-10 h-10 mb-3 opacity-30" />
                <p className="text-sm">No operations in finance stage</p>
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
                  {financeOps?.map((op) => (
                    <TableRow key={op.id} className="hover:bg-muted/20">
                      <TableCell className="font-mono text-xs font-semibold text-primary">
                        {op.operation_number}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs">
                          {OP_TYPE_LABELS[op.type] ?? op.type}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={op.status as OperationStatus} />
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">{op.currency}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{formatDate(op.created_at)}</TableCell>
                      <TableCell>
                        <Link href={`/operations/${op.id}`} className="inline-flex items-center gap-1 text-xs text-primary hover:underline">
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
