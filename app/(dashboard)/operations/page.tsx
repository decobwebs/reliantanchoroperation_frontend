"use client";

import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  Clock,
  Copy,
  Download,
  FileText,
  Filter,
  Hourglass,
  LayoutGrid,
  MoreHorizontal,
  Plus,
  Settings2,
} from "lucide-react";
import { Spinner } from "@/components/ui/spinner";
import { api } from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { KpiCard } from "@/components/dashboard/KpiCard";
import {
  FilterBar,
  FilterSearch,
  FilterSelect,
} from "@/components/dashboard/FilterBar";
import { TablePagination } from "@/components/dashboard/TablePagination";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  cn,
  formatDateTime,
  formatRelative,
  OP_TYPE_LABELS,
  OPERATION_COLOR_SWATCHES,
} from "@/lib/utils";
import { resolveExpectedVolumeMt } from "@/lib/operations";
import type {
  ApiResponse,
  PaginatedData,
  Operation,
  OperationStatus,
} from "@/types";
import { CreateOperationDialog } from "./CreateOperationDialog";

const PER_PAGE = 15;

const STATUS_OPTIONS = [
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

// Server-side via the list endpoint's date_from param — not a client-side slice.
const RANGE_OPTIONS = [
  { value: "all", label: "All time" },
  { value: "7", label: "Last 7 days" },
  { value: "30", label: "Last 30 days" },
  { value: "90", label: "Last 90 days" },
];

const DAY_MS = 86_400_000;

/* ── Status buckets for the stat strip ───────────────────────────────────── */

const BUCKETS = {
  completed: ["completed", "archived"],
  inProgress: [
    "active", "vessel_operations", "bdn_pending", "bdn_approved",
    "pfi_linked", "payment_processing", "payment_confirmed",
    "invoiced", "pending_completion",
  ],
  pending: [
    "tasks_assigned", "awaiting_feedback", "feedback_submitted", "feedback_approved",
  ],
  draft: ["draft"],
} satisfies Record<string, string[]>;

/* ── Column definitions ─────────────────────────────────────────────────── */

const COLUMNS = [
  { id: "number", label: "Number", always: true },
  { id: "type", label: "Type" },
  { id: "status", label: "Status" },
  { id: "volume", label: "Volume (L)" },
  { id: "currency", label: "Currency" },
  { id: "created", label: "Created" },
  { id: "updated", label: "Updated" },
] as const;

type ColumnId = (typeof COLUMNS)[number]["id"];

async function downloadCSV(
  search: string,
  statusFilter: string,
  typeFilter: string,
  dateFrom: string | null
) {
  const allItems: Operation[] = [];
  let page = 1;
  let total = Infinity;

  while (allItems.length < total) {
    const params = new URLSearchParams({ page: String(page), per_page: "100" });
    if (search) params.set("search", search);
    if (statusFilter !== "all") params.set("status", statusFilter);
    if (typeFilter !== "all") params.set("type", typeFilter);
    if (dateFrom) params.set("date_from", dateFrom);
    const res = await api.get<ApiResponse<PaginatedData<Operation>>>(`/operations?${params}`);
    const data = res.data.data;
    allItems.push(...(data?.items ?? []));
    total = data?.total ?? 0;
    if (!data?.items?.length || allItems.length >= total) break;
    page++;
  }

  const headers = ["Number", "Type", "Status", "Volume (L)", "Currency", "Created", "Updated"];
  const rows = allItems.map((op) => [
    op.operation_number,
    OP_TYPE_LABELS[op.type] ?? op.type,
    op.status,
    (() => { const v = resolveExpectedVolumeMt(op); return v != null ? v.toLocaleString() : ""; })(),
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
  const { effectiveRole } = useAuth();
  const router = useRouter();

  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [range, setRange] = useState("all");
  const [showCreate, setShowCreate] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [hidden, setHidden] = useState<ColumnId[]>([]);

  // Debounce the search box so typing doesn't fire a request per keystroke.
  useEffect(() => {
    const t = setTimeout(() => {
      setSearch(searchInput);
      setPage(1);
    }, 350);
    return () => clearTimeout(t);
  }, [searchInput]);

  const { data, isLoading, isFetching, refetch } = useQuery({
    queryKey: ["operations", page, search, statusFilter, typeFilter, range],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: String(page),
        per_page: String(PER_PAGE),
      });
      if (search) params.set("search", search);
      if (statusFilter !== "all") params.set("status", statusFilter);
      if (typeFilter !== "all") params.set("type", typeFilter);
      if (range !== "all") {
        params.set(
          "date_from",
          new Date(Date.now() - Number(range) * DAY_MS).toISOString()
        );
      }
      const res = await api.get<ApiResponse<PaginatedData<Operation>>>(
        `/operations?${params}`
      );
      return res.data.data;
    },
  });

  // Unfiltered window powering the stat strip, so the tiles keep describing the
  // whole workload while the table below is being filtered.
  const { data: overview } = useQuery({
    queryKey: ["operations-overview"],
    queryFn: async () => {
      const res = await api.get<ApiResponse<PaginatedData<Operation>>>(
        "/operations?per_page=100"
      );
      return res.data.data;
    },
  });

  const stats = useMemo(() => {
    const items = overview?.items ?? [];
    const total = overview?.total ?? 0;
    const count = (statuses: readonly string[]) =>
      items.filter((op) => statuses.includes(op.status)).length;
    // Percentages are only honest while the window covers every operation.
    const exact = total <= items.length;
    const share = (n: number) =>
      exact && total > 0 ? `${((n / total) * 100).toFixed(1)}% of total` : "In recent 100";
    return {
      total,
      completed: count(BUCKETS.completed),
      inProgress: count(BUCKETS.inProgress),
      pending: count(BUCKETS.pending),
      draft: count(BUCKETS.draft),
      share,
    };
  }, [overview]);

  const isBM = effectiveRole === "bunker_manager";
  // Creation only — the Ops Supervisor gets no other operation-level action
  // (edit, close, pause, transition, delete all stay BM-only, front and back).
  const canCreateOperation = isBM || effectiveRole === "ops_supervisor";
  const total = data?.total ?? 0;
  const totalPages = Math.ceil(total / PER_PAGE);
  const from = total === 0 ? 0 : (page - 1) * PER_PAGE + 1;
  const to = Math.min(page * PER_PAGE, total);
  const items = data?.items ?? [];

  const visible = (id: ColumnId) => !hidden.includes(id);
  const shownColumns = COLUMNS.filter((c) => visible(c.id));

  return (
    <DashboardShell
      icon={FileText}
      iconTone="blue"
      showRole={false}
      title="Operations"
      subtitle={
        data ? `${total} operation${total === 1 ? "" : "s"} total` : "Loading…"
      }
      actions={
        <>
          <Button
            variant="outline"
            className="h-10.5 rounded-xl border-navy-100 px-4 text-[13px] font-semibold dark:border-border"
            disabled={exporting}
            onClick={async () => {
              setExporting(true);
              // Recomputed at click time so the export matches what the user
              // currently sees, not whenever the table last refetched.
              const dateFrom =
                range === "all"
                  ? null
                  : new Date(Date.now() - Number(range) * DAY_MS).toISOString();
              try {
                await downloadCSV(search, statusFilter, typeFilter, dateFrom);
              } catch {
                toast.error("CSV export failed. Please try again.");
              } finally {
                setExporting(false);
              }
            }}
          >
            {exporting ? (
              <Spinner size={16} />
            ) : (
              <Download className="h-4 w-4" strokeWidth={2.5} />
            )}
            Export CSV
          </Button>
          {canCreateOperation && (
            <Button
              className="brand-grad-active h-10.5 rounded-xl px-4 text-[13px] font-semibold text-white shadow-[0_12px_26px_-14px_rgb(14_121_200/0.9)] hover:opacity-95"
              onClick={() => setShowCreate(true)}
            >
              <Plus className="h-4 w-4" strokeWidth={2.5} />
              New Operation
            </Button>
          )}
        </>
      }
    >
      {/* ── Stat strip ──────────────────────────────────────────────────── */}
      {!overview ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-5">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-38 rounded-2xl" />
          ))}
        </div>
      ) : (
        <section
          className="animate-rise grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-5"
          aria-label="Operation totals"
        >
          <KpiCard
            variant="plain"
            tone="blue"
            icon={FileText}
            title="Total Operations"
            value={stats.total}
            caption="All time"
          />
          <KpiCard
            variant="plain"
            tone="emerald"
            icon={CheckCircle2}
            title="Completed"
            value={stats.completed}
            caption={stats.share(stats.completed)}
          />
          <KpiCard
            variant="plain"
            tone="sky"
            icon={Clock}
            title="In Progress"
            value={stats.inProgress}
            caption={stats.share(stats.inProgress)}
          />
          <KpiCard
            variant="plain"
            tone="amber"
            icon={Hourglass}
            title="Pending"
            value={stats.pending}
            caption={stats.share(stats.pending)}
          />
          <KpiCard
            variant="plain"
            tone="violet"
            icon={FileText}
            title="Draft"
            value={stats.draft}
            caption={stats.share(stats.draft)}
          />
        </section>
      )}

      {/* ── Filters ─────────────────────────────────────────────────────── */}
      <FilterBar className="animate-rise">
        <FilterSearch
          value={searchInput}
          onChange={setSearchInput}
          placeholder="Search by number or notes…"
          className="min-w-60"
        />
        <FilterSelect
          value={statusFilter}
          onChange={(v) => {
            setStatusFilter(v);
            setPage(1);
          }}
          options={STATUS_OPTIONS}
          label="Filter by status"
          icon={Filter}
          className="w-full sm:w-48"
        />
        <FilterSelect
          value={typeFilter}
          onChange={(v) => {
            setTypeFilter(v);
            setPage(1);
          }}
          options={TYPE_OPTIONS}
          label="Filter by type"
          icon={LayoutGrid}
          className="w-full sm:w-44"
        />
        <FilterSelect
          value={range}
          onChange={(v) => {
            setRange(v);
            setPage(1);
          }}
          options={RANGE_OPTIONS}
          label="Filter by date range"
          icon={CalendarDays}
          className="w-full sm:w-44"
        />
      </FilterBar>

      {/* ── Table ───────────────────────────────────────────────────────── */}
      <section
        className={cn(
          "animate-rise overflow-hidden rounded-2xl border border-navy-100 bg-card",
          "shadow-[0_1px_2px_rgb(16_36_71/0.04)] dark:border-border"
        )}
      >
        {isLoading ? (
          <div className="space-y-2 p-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-11 w-full rounded-lg" />
            ))}
          </div>
        ) : (
          <>
            {/* Mobile: stacked cards */}
            <div className="divide-y divide-border/70 md:hidden">
              {items.length ? (
                items.map((op) => (
                  <button
                    key={op.id}
                    onClick={() => router.push(`/operations/${op.id}`)}
                    className="w-full px-4 py-3 text-left transition-colors hover:bg-muted/50"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="flex items-center gap-1.5 font-mono text-[13px] font-semibold text-foreground">
                        {op.color && (
                          <span
                            className={cn(
                              "h-2 w-2 shrink-0 rounded-full",
                              OPERATION_COLOR_SWATCHES[op.color] ?? ""
                            )}
                          />
                        )}
                        {op.operation_number}
                      </span>
                      <StatusBadge status={op.status as OperationStatus} />
                    </div>
                    <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
                      <Badge variant="outline" className="text-[10px]">
                        {OP_TYPE_LABELS[op.type] ?? op.type}
                      </Badge>
                      <span>
                        {(() => {
                          const v = resolveExpectedVolumeMt(op);
                          return v != null ? `${v.toLocaleString()} L` : "—";
                        })()}{" "}
                        {op.currency}
                      </span>
                      <span>{formatDateTime(op.created_at)}</span>
                    </div>
                  </button>
                ))
              ) : (
                <EmptyRow />
              )}
            </div>

            {/* Desktop: table */}
            <div className={cn("hidden md:block", isFetching && "opacity-60 transition-opacity")}>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-left">
                  <thead>
                    <tr className="bg-muted/50">
                      {shownColumns.map((c) => (
                        <th
                          key={c.id}
                          scope="col"
                          className="whitespace-nowrap px-4 py-3 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground first:pl-5"
                        >
                          {c.label}
                        </th>
                      ))}
                      <th scope="col" className="w-12 px-2 py-3 pr-5 text-right">
                        <ColumnPicker hidden={hidden} onChange={setHidden} />
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/70">
                    {items.length ? (
                      items.map((op) => (
                        <tr
                          key={op.id}
                          className="cursor-pointer transition-colors hover:bg-muted/40"
                          onClick={() => router.push(`/operations/${op.id}`)}
                        >
                          {visible("number") && (
                            <td className="whitespace-nowrap px-4 py-3.5 pl-5">
                              <span className="flex items-center gap-1.5 font-mono text-[13px] font-semibold text-foreground">
                                {op.color && (
                                  <span
                                    className={cn(
                                      "h-2 w-2 shrink-0 rounded-full",
                                      OPERATION_COLOR_SWATCHES[op.color] ?? ""
                                    )}
                                  />
                                )}
                                {op.operation_number}
                              </span>
                            </td>
                          )}
                          {visible("type") && (
                            <td className="whitespace-nowrap px-4 py-3.5">
                              <Badge
                                variant="outline"
                                className="rounded-lg border-navy-100 text-[11px] font-medium dark:border-border"
                              >
                                {OP_TYPE_LABELS[op.type] ?? op.type}
                              </Badge>
                            </td>
                          )}
                          {visible("status") && (
                            <td className="whitespace-nowrap px-4 py-3.5">
                              <StatusBadge status={op.status as OperationStatus} />
                            </td>
                          )}
                          {visible("volume") && (
                            <td className="whitespace-nowrap px-4 py-3.5 text-[13px] tabular-nums text-foreground/80">
                              {(() => {
                                const v = resolveExpectedVolumeMt(op);
                                return v != null ? v.toLocaleString() : "—";
                              })()}
                            </td>
                          )}
                          {visible("currency") && (
                            <td className="whitespace-nowrap px-4 py-3.5 text-[13px] font-semibold text-foreground/80">
                              {op.currency}
                            </td>
                          )}
                          {visible("created") && (
                            <td className="whitespace-nowrap px-4 py-3.5 text-[13px] tabular-nums text-muted-foreground">
                              {formatDateTime(op.created_at)}
                            </td>
                          )}
                          {visible("updated") && (
                            <td className="whitespace-nowrap px-4 py-3.5 text-[13px] tabular-nums text-muted-foreground">
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <span className="cursor-default">
                                    {formatDateTime(op.updated_at)}
                                  </span>
                                </TooltipTrigger>
                                <TooltipContent>
                                  {formatRelative(op.updated_at)}
                                </TooltipContent>
                              </Tooltip>
                            </td>
                          )}
                          <td
                            className="px-2 py-3.5 pr-5 text-right"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <RowActions op={op} />
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={shownColumns.length + 1}>
                          <EmptyRow />
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <TablePagination
              page={page}
              totalPages={totalPages}
              from={from}
              to={to}
              total={total}
              noun="operations"
              onPageChange={setPage}
            />
          </>
        )}
      </section>

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
    </DashboardShell>
  );
}

/* ── Local pieces ───────────────────────────────────────────────────────── */

function EmptyRow() {
  return (
    <div className="flex flex-col items-center gap-2 py-16 text-muted-foreground">
      <FileText className="h-9 w-9 opacity-25" />
      <p className="text-sm font-medium text-foreground">No operations found</p>
      <p className="text-xs">Try clearing the search or widening the filters.</p>
    </div>
  );
}

/** Header gear — toggles column visibility for this session. */
function ColumnPicker({
  hidden,
  onChange,
}: {
  hidden: ColumnId[];
  onChange: (v: ColumnId[]) => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label="Choose columns"
        className={cn(
          "inline-flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground",
          "transition-colors hover:bg-muted hover:text-foreground",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        )}
      >
        <Settings2 className="h-4 w-4" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44">
        <DropdownMenuLabel className="text-xs text-muted-foreground">
          Columns
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {COLUMNS.map((c) => (
          <DropdownMenuCheckboxItem
            key={c.id}
            className="text-xs"
            checked={!hidden.includes(c.id)}
            disabled={"always" in c && c.always}
            onCheckedChange={(on) =>
              onChange(on ? hidden.filter((h) => h !== c.id) : [...hidden, c.id])
            }
          >
            {c.label}
          </DropdownMenuCheckboxItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function RowActions({ op }: { op: Operation }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={`Actions for ${op.operation_number}`}
        className={cn(
          "inline-flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground",
          "transition-colors hover:bg-muted hover:text-foreground",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        )}
      >
        <MoreHorizontal className="h-4 w-4" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuItem asChild className="text-xs">
          <a href={`/operations/${op.id}`}>
            <ChevronRight className="mr-2 h-3.5 w-3.5" />
            Open operation
          </a>
        </DropdownMenuItem>
        <DropdownMenuItem
          className="text-xs"
          onSelect={() => {
            void navigator.clipboard
              .writeText(op.operation_number)
              .then(() => toast.success(`Copied ${op.operation_number}`))
              .catch(() => toast.error("Could not copy to clipboard"));
          }}
        >
          <Copy className="mr-2 h-3.5 w-3.5" />
          Copy number
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
