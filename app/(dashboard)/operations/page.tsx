"use client";

import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Plus,
  Search,
  Filter,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Download,
} from "lucide-react";
import { api } from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";
import { Header } from "@/components/layout/Header";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  formatDateTime,
  formatRelative,
  OP_TYPE_LABELS,
} from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { ApiResponse, PaginatedData, Operation, OperationStatus } from "@/types";
import { CreateOperationDialog } from "./CreateOperationDialog";

const STATUS_OPTIONS: { value: string; label: string }[] = [
  { value: "all", label: "All statuses" },
  { value: "draft", label: "Draft" },
  { value: "tasks_assigned", label: "Tasks Assigned" },
  { value: "awaiting_feedback", label: "Awaiting Feedback" },
  { value: "feedback_approved", label: "Feedback Approved" },
  { value: "pfi_linked", label: "PFI Linked" },
  { value: "payment_confirmed", label: "Payment Confirmed" },
  { value: "vessel_operations", label: "Vessel Operations" },
  { value: "bdn_approved", label: "BDN Approved" },
  { value: "invoiced", label: "Invoiced" },
  { value: "completed", label: "Completed" },
  { value: "cancelled", label: "Cancelled" },
];

const TYPE_OPTIONS = [
  { value: "all", label: "All types" },
  { value: "full_operation", label: "Full Operation" },
  { value: "vessel_only", label: "Vessel Only" },
  { value: "truck_only", label: "Truck Only" },
];

async function downloadCSV(search: string, statusFilter: string, typeFilter: string) {
  const { api } = await import("@/lib/api");
  const allItems: Operation[] = [];
  let page = 1;
  let total = Infinity;

  while (allItems.length < total) {
    const params = new URLSearchParams({ page: String(page), per_page: "100" });
    if (search) params.set("search", search);
    if (statusFilter !== "all") params.set("status", statusFilter);
    if (typeFilter !== "all") params.set("type", typeFilter);
    const res = await api.get<ApiResponse<PaginatedData<Operation>>>(`/operations?${params}`);
    const data = res.data.data;
    allItems.push(...(data?.items ?? []));
    total = data?.total ?? 0;
    if (!data?.items?.length || allItems.length >= total) break;
    page++;
  }

  const items = allItems;

  const headers = ["Number", "Type", "Status", "Volume (MT)", "Currency", "Created", "Updated"];
  const rows = items.map((op) => [
    op.operation_number,
    OP_TYPE_LABELS[op.type] ?? op.type,
    op.status,
    op.expected_volume_mt ? parseFloat(op.expected_volume_mt).toLocaleString() : "",
    op.currency,
    op.created_at ? new Date(op.created_at).toISOString() : "",
    op.updated_at ? new Date(op.updated_at).toISOString() : "",
  ]);

  const csv = [headers, ...rows]
    .map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(","))
    .join("\n");

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `operations-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function OperationsPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  // Debounce the search box so typing doesn't fire a request per keystroke.
  useEffect(() => {
    const t = setTimeout(() => {
      setSearch(searchInput);
      setPage(1);
    }, 350);
    return () => clearTimeout(t);
  }, [searchInput]);
  const [typeFilter, setTypeFilter] = useState("all");
  const [showCreate, setShowCreate] = useState(false);
  const [exporting, setExporting] = useState(false);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["operations", page, search, statusFilter, typeFilter],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: String(page),
        per_page: "15",
      });
      if (search) params.set("search", search);
      if (statusFilter !== "all") params.set("status", statusFilter);
      if (typeFilter !== "all") params.set("type", typeFilter);

      const res = await api.get<ApiResponse<PaginatedData<Operation>>>(
        `/operations?${params}`
      );
      return res.data.data;
    },
  });

  const isBM = user?.role === "bunker_manager";
  const totalPages = data ? Math.ceil(data.total / 15) : 0;

  return (
    <div>
      <Header
        title="Operations"
        subtitle={data ? `${data.total} operations total` : undefined}
        actions={
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              disabled={exporting}
              onClick={async () => {
                setExporting(true);
                try { await downloadCSV(search, statusFilter, typeFilter); }
                catch { toast.error("CSV export failed. Please try again."); }
                finally { setExporting(false); }
              }}
            >
              {exporting ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <Download className="w-4 h-4 mr-1.5" />}
              Export CSV
            </Button>
            {isBM && (
              <Button size="sm" onClick={() => setShowCreate(true)}>
                <Plus className="w-4 h-4 mr-1.5" />
                New Operation
              </Button>
            )}
          </div>
        }
      />

      <div className="p-6 space-y-4">
        {/* Filters */}
        <div className="flex flex-wrap gap-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search by number or notes…"
              className="pl-9"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
            />
          </div>
          <Select
            value={statusFilter}
            onValueChange={(v) => {
              setStatusFilter(v);
              setPage(1);
            }}
          >
            <SelectTrigger className="w-48">
              <Filter className="w-3.5 h-3.5 mr-2 text-muted-foreground" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {STATUS_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={typeFilter}
            onValueChange={(v) => {
              setTypeFilter(v);
              setPage(1);
            }}
          >
            <SelectTrigger className="w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TYPE_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Table */}
        <Card className="border-0 shadow-sm overflow-hidden">
          <CardContent className="p-0">
            {isLoading ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="w-7 h-7 animate-spin text-primary" />
              </div>
            ) : (
              <>
              {/* Mobile: stacked cards (the wide table is hidden below md) */}
              <div className="md:hidden divide-y">
                {data?.items?.length ? (
                  data.items.map((op) => (
                    <button
                      key={op.id}
                      onClick={() => router.push(`/operations/${op.id}`)}
                      className="w-full text-left px-4 py-3 hover:bg-muted/50 transition-colors"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-mono text-sm font-semibold text-primary">{op.operation_number}</span>
                        <StatusBadge status={op.status as OperationStatus} />
                      </div>
                      <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                        <Badge variant="outline" className="text-[10px]">{OP_TYPE_LABELS[op.type] ?? op.type}</Badge>
                        <span>{op.expected_volume_mt ? `${parseFloat(op.expected_volume_mt).toLocaleString()} MT` : "—"} {op.currency}</span>
                        <span>{formatDateTime(op.created_at)}</span>
                      </div>
                    </button>
                  ))
                ) : (
                  <div className="text-center py-16 text-muted-foreground text-sm">No operations found</div>
                )}
              </div>

              {/* Desktop: full table */}
              <div className="hidden md:block">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent border-b">
                    <TableHead className="font-semibold text-xs uppercase tracking-wide">
                      Number
                    </TableHead>
                    <TableHead className="font-semibold text-xs uppercase tracking-wide">
                      Type
                    </TableHead>
                    <TableHead className="font-semibold text-xs uppercase tracking-wide">
                      Status
                    </TableHead>
                    <TableHead className="font-semibold text-xs uppercase tracking-wide">
                      Volume (MT)
                    </TableHead>
                    <TableHead className="font-semibold text-xs uppercase tracking-wide">
                      Currency
                    </TableHead>
                    <TableHead className="font-semibold text-xs uppercase tracking-wide">
                      Created
                    </TableHead>
                    <TableHead className="font-semibold text-xs uppercase tracking-wide">
                      Updated
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data?.items?.length ? (
                    data.items.map((op) => (
                      <TableRow
                        key={op.id}
                        className="cursor-pointer hover:bg-muted/50 transition-colors"
                        onClick={() => router.push(`/operations/${op.id}`)}
                      >
                        <TableCell className="font-mono text-sm font-semibold text-primary">
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
                        <TableCell className="text-sm">
                          {op.expected_volume_mt
                            ? `${parseFloat(op.expected_volume_mt).toLocaleString()} MT`
                            : "—"}
                        </TableCell>
                        <TableCell className="text-sm font-medium">
                          {op.currency}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                          {formatDateTime(op.created_at)}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="cursor-default">{formatDateTime(op.updated_at)}</span>
                            </TooltipTrigger>
                            <TooltipContent>{formatRelative(op.updated_at)}</TooltipContent>
                          </Tooltip>
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell
                        colSpan={7}
                        className="text-center py-16 text-muted-foreground"
                      >
                        No operations found
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
              </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              Page {page} of {totalPages} ({data?.total} total)
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
              >
                <ChevronLeft className="w-4 h-4" />
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                Next
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        )}
      </div>

      {isBM && (
        <CreateOperationDialog
          open={showCreate}
          onClose={() => setShowCreate(false)}
          onCreated={() => {
            setShowCreate(false);
            refetch();
          }}
        />
      )}
    </div>
  );
}
