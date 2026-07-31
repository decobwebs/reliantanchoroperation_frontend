"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import {
  CheckCircle2,
  ChevronRight,
  DollarSign,
  FileBadge2,
  FileText,
  Receipt,
  TrendingUp,
} from "lucide-react";
import { api } from "@/lib/api";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { KpiCard } from "@/components/dashboard/KpiCard";
import { PanelCard } from "@/components/dashboard/PanelCard";
import { QuickActionTile } from "@/components/dashboard/QuickActionTile";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/hooks/useAuth";
import { formatCurrency, formatDate, OP_TYPE_LABELS } from "@/lib/utils";
import type { ApiResponse, PaginatedData, Operation, OperationStatus } from "@/types";

const FINANCE_STATUSES: OperationStatus[] = [
  "active", "pfi_linked", "payment_processing", "payment_confirmed",
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
  const { user } = useAuth();

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
  const totalOps = analytics?.operations.total_operations ?? 0;

  const share = (n: number) =>
    totalOps > 0 ? `${Math.round((n / totalOps) * 100)}% of all operations` : "No operations yet";

  return (
    <DashboardShell
      eyebrow={
        <>
          Welcome back, {user?.full_name?.split(" ")[0] ?? "there"}{" "}
          <span aria-hidden="true">👋</span>
        </>
      }
      title="Finance Dashboard"
      subtitle="Revenue, PFIs and the payment pipeline"
      actions={
        <Button
          asChild
          className="h-10.5 rounded-xl px-4 text-[13px] font-semibold shadow-[0_12px_26px_-14px_rgba(23,52,99,0.9)]"
        >
          <Link href="/finance">
            <DollarSign className="h-4 w-4" strokeWidth={2.5} />
            Full Finance View
          </Link>
        </Button>
      }
    >
      <section
        className="animate-rise grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4"
        aria-label="Finance metrics"
      >
        {revenue.length > 0 ? (
          revenue.map((r) => (
            <KpiCard
              key={r.currency}
              tone="navy"
              icon={DollarSign}
              title={`Revenue (${r.currency})`}
              value={formatCurrency(r.total_amount, r.currency)}
              caption="Confirmed payments"
              note={`${r.payment_count} payment${r.payment_count === 1 ? "" : "s"}`}
              noteTrend="flat"
            />
          ))
        ) : (
          <KpiCard
            tone="navy"
            icon={DollarSign}
            title="Total Revenue"
            value="—"
            caption="No payments yet"
            note="Awaiting first confirmed payment"
            noteTrend="flat"
          />
        )}
        <KpiCard
          tone="sky"
          icon={FileText}
          title="PFIs Linked"
          value={analytics?.operations.total_pfis ?? 0}
          caption="Pro-forma invoices"
          note={share(analytics?.operations.total_pfis ?? 0)}
          noteTrend="flat"
        />
        <KpiCard
          tone="amber"
          icon={FileBadge2}
          title="BDNs Approved"
          value={analytics?.operations.total_bdns_approved ?? 0}
          caption="Delivery notes"
          note={share(analytics?.operations.total_bdns_approved ?? 0)}
          noteTrend="flat"
        />
        <KpiCard
          tone="emerald"
          icon={CheckCircle2}
          title="Payments Confirmed"
          value={totalPayments}
          caption="All currencies"
          note={`${revenue.length} currenc${revenue.length === 1 ? "y" : "ies"} in play`}
          noteTrend="flat"
        />
      </section>

      <PanelCard
        icon={TrendingUp}
        tone="violet"
        title="Operations in Finance Pipeline"
        subtitle="Everything awaiting invoicing or payment"
        className="animate-rise"
        flush
        action={
          <>
            {financeOps && (
              <Badge variant="secondary" className="h-6 rounded-full px-2.5 text-[11px]">
                {financeOps.length}
              </Badge>
            )}
            <Button
              asChild
              variant="outline"
              size="sm"
              className="h-8 rounded-lg text-xs font-semibold"
            >
              <Link href="/finance">
                Full Finance View
                <ChevronRight className="h-3.5 w-3.5" />
              </Link>
            </Button>
          </>
        }
      >
        {opsLoading ? (
          <div className="space-y-2 px-5 pb-5">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full rounded-lg" />
            ))}
          </div>
        ) : financeOps?.length ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-160 border-collapse text-left">
              <thead>
                <tr className="bg-muted/50">
                  {["Operation", "Type", "Status", "Currency", "Created", ""].map((h, i) => (
                    <th
                      key={h || i}
                      scope="col"
                      className="whitespace-nowrap px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground first:pl-5 last:pr-5"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border/70">
                {financeOps.map((op) => (
                  <tr key={op.id} className="transition-colors hover:bg-muted/40">
                    <td className="whitespace-nowrap px-4 py-3 pl-5">
                      <Link
                        href={`/operations/${op.id}`}
                        className="rounded font-mono text-[13px] font-semibold text-foreground hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                      >
                        {op.operation_number}
                      </Link>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-[13px] text-muted-foreground">
                      {OP_TYPE_LABELS[op.type] ?? op.type}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3">
                      <StatusBadge status={op.status as OperationStatus} />
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-[13px] font-semibold tabular-nums text-foreground/80">
                      {op.currency}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-[13px] tabular-nums text-muted-foreground">
                      {formatDate(op.created_at)}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 pr-5 text-right">
                      <Link
                        href={`/operations/${op.id}`}
                        aria-label={`Open ${op.operation_number}`}
                        className="inline-flex rounded p-1 text-muted-foreground hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        <ChevronRight className="h-4 w-4" />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2 py-12 text-muted-foreground">
            <FileText className="h-10 w-10 opacity-25" />
            <p className="text-sm">No operations in finance stage</p>
          </div>
        )}
      </PanelCard>

      <PanelCard
        icon={Receipt}
        tone="emerald"
        title="Quick Actions"
        subtitle="Common finance tasks"
        className="animate-rise"
      >
        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 xl:grid-cols-4">
          <QuickActionTile
            href="/finance"
            icon={DollarSign}
            tone="emerald"
            label="Finance Workspace"
            description="Invoices, vouchers, payments"
          />
          <QuickActionTile
            href="/pfi"
            icon={FileText}
            tone="blue"
            label="PFI Register"
            description="Link and review pro-formas"
          />
          <QuickActionTile
            href="/operations"
            icon={FileBadge2}
            tone="violet"
            label="All Operations"
            description="Browse the full pipeline"
          />
          <QuickActionTile
            href="/analytics"
            icon={TrendingUp}
            tone="amber"
            label="Analytics"
            description="Export operational data"
          />
        </div>
      </PanelCard>
    </DashboardShell>
  );
}
