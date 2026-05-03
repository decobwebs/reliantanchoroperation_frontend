"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { Search, ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import { api } from "@/lib/api";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatDate, formatRelative, OP_TYPE_LABELS } from "@/lib/utils";
import type { ApiResponse, PaginatedData, Operation, OperationStatus } from "@/types";

export default function PortalOperationsPage() {
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState("all");

  const { data, isLoading } = useQuery({
    queryKey: ["portal-operations", page, statusFilter],
    queryFn: async () => {
      const params = new URLSearchParams({ page: String(page), per_page: "10" });
      if (statusFilter !== "all") params.set("status", statusFilter);
      const res = await api.get<ApiResponse<PaginatedData<Operation>>>(
        `/portal/operations?${params}`
      );
      return res.data.data;
    },
  });

  const totalPages = data ? Math.ceil(data.total / 10) : 0;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold">My Operations</h2>
        <p className="text-muted-foreground text-sm mt-1">
          Track the status and progress of your fuel operations
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <Select
          value={statusFilter}
          onValueChange={(v) => { setStatusFilter(v); setPage(1); }}
        >
          <SelectTrigger className="w-48 bg-white">
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="draft">Draft</SelectItem>
            <SelectItem value="payment_confirmed">Payment Confirmed</SelectItem>
            <SelectItem value="vessel_operations">Vessel Operations</SelectItem>
            <SelectItem value="bdn_approved">BDN Approved</SelectItem>
            <SelectItem value="invoiced">Invoiced</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
            <SelectItem value="cancelled">Cancelled</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Operations list */}
      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-7 h-7 animate-spin text-primary" />
        </div>
      ) : (
        <div className="space-y-3">
          {data?.items?.length ? (
            data.items.map((op) => (
              <Link key={op.id} href={`/portal/operations/${op.id}`}>
                <Card className="border-0 shadow-sm hover:shadow-md transition-shadow cursor-pointer">
                  <CardContent className="px-6 py-4 flex items-center justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-mono font-bold text-primary">
                          {op.operation_number}
                        </span>
                        <Badge variant="outline" className="text-xs">
                          {OP_TYPE_LABELS[op.type]}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        Created {formatDate(op.created_at)}
                        {op.expected_volume_mt &&
                          ` · ${parseFloat(op.expected_volume_mt).toLocaleString()} MT`}
                      </p>
                    </div>
                    <div className="flex items-center gap-3 flex-shrink-0">
                      <StatusBadge status={op.status as OperationStatus} />
                      <span className="text-xs text-muted-foreground hidden md:block">
                        {formatRelative(op.updated_at)}
                      </span>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))
          ) : (
            <div className="text-center py-16 text-muted-foreground">
              No operations found
            </div>
          )}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Page {page} of {totalPages}
          </p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>
              <ChevronLeft className="w-4 h-4" /> Previous
            </Button>
            <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>
              Next <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
