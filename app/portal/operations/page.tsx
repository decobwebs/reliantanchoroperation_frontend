"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { ClipboardList } from "lucide-react";
import { api } from "@/lib/api";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { PanelCard } from "@/components/dashboard/PanelCard";
import { FilterBar, FilterSelect } from "@/components/dashboard/FilterBar";
import { TablePagination } from "@/components/dashboard/TablePagination";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { formatDate, formatRelative, OP_TYPE_LABELS } from "@/lib/utils";
import { resolveExpectedVolumeMt } from "@/lib/operations";
import type { ApiResponse, PaginatedData, Operation, OperationStatus } from "@/types";

const STATUS_OPTIONS = [
  { value: "all", label: "All statuses" },
  { value: "draft", label: "Draft" },
  { value: "payment_confirmed", label: "Payment Confirmed" },
  { value: "vessel_operations", label: "Vessel Operations" },
  { value: "bdn_approved", label: "BDN Approved" },
  { value: "invoiced", label: "Invoiced" },
  { value: "completed", label: "Completed" },
  { value: "cancelled", label: "Cancelled" },
];

const PER_PAGE = 10;

export default function PortalOperationsPage() {
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState("all");

  const { data, isLoading } = useQuery({
    queryKey: ["portal-operations", page, statusFilter],
    queryFn: async () => {
      const params = new URLSearchParams({ page: String(page), per_page: String(PER_PAGE) });
      if (statusFilter !== "all") params.set("status", statusFilter);
      const res = await api.get<ApiResponse<PaginatedData<Operation>>>(
        `/portal/operations?${params}`
      );
      return res.data.data;
    },
  });

  const total = data?.total ?? 0;
  const totalPages = data ? Math.ceil(total / PER_PAGE) : 1;

  return (
    <div className="animate-rise space-y-6">
      <div>
        <h1 className="text-[26px] font-extrabold leading-none tracking-tight text-foreground">My Operations</h1>
        <p className="mt-2 text-[13px] text-muted-foreground">
          Track the status and progress of your fuel operations
        </p>
      </div>

      <FilterBar>
        <FilterSelect
          value={statusFilter}
          onChange={(v) => { setStatusFilter(v); setPage(1); }}
          options={STATUS_OPTIONS}
          label="Filter by status"
          className="w-full sm:w-56"
        />
      </FilterBar>

      {isLoading ? (
        <Skeleton className="h-96 w-full rounded-2xl" />
      ) : (
        <PanelCard icon={ClipboardList} tone="blue" title="Operations" flush>
          {data?.items?.length ? (
            <div className="divide-y divide-border/70">
              {data.items.map((op) => (
                <Link
                  key={op.id}
                  href={`/portal/operations/${op.id}`}
                  className="flex items-center justify-between gap-4 px-4 py-4 transition-colors hover:bg-muted/40 lg:px-5"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-[13px] font-bold text-brand-600">
                        {op.operation_number}
                      </span>
                      <Badge variant="outline" className="rounded-md text-[11px]">
                        {OP_TYPE_LABELS[op.type]}
                      </Badge>
                    </div>
                    <p className="mt-1 text-[12px] text-muted-foreground">
                      Created {formatDate(op.created_at)}
                      {resolveExpectedVolumeMt(op) != null &&
                        ` · ${resolveExpectedVolumeMt(op)!.toLocaleString()} L`}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-3">
                    <StatusBadge status={op.status as OperationStatus} />
                    <span className="hidden text-[11px] tabular-nums text-muted-foreground md:block">
                      {formatRelative(op.updated_at)}
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center py-16 text-center">
              <ClipboardList className="h-9 w-9 text-muted-foreground/25" strokeWidth={1.5} />
              <p className="mt-3 text-sm font-medium text-foreground">No operations found</p>
            </div>
          )}

          <TablePagination
            page={page}
            totalPages={totalPages}
            from={total === 0 ? 0 : (page - 1) * PER_PAGE + 1}
            to={Math.min(page * PER_PAGE, total)}
            total={total}
            noun="operations"
            onPageChange={setPage}
          />
        </PanelCard>
      )}
    </div>
  );
}
