"use client";

import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Activity, LogIn, FileText, Settings, Globe, X,
} from "lucide-react";
import { api } from "@/lib/api";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { PanelCard } from "@/components/dashboard/PanelCard";
import { FilterBar, FilterSearch, FilterSelect } from "@/components/dashboard/FilterBar";
import { TablePagination } from "@/components/dashboard/TablePagination";
import { DetailsDialog } from "@/components/shared/DetailsDialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { cn, formatDateTime, getInitials } from "@/lib/utils";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Tooltip, TooltipContent, TooltipTrigger,
} from "@/components/ui/tooltip";

// ── Types ─────────────────────────────────────────────────────────────────────

interface AuditLog {
  id: string;
  user_id: string;
  actor_name: string | null;
  actor_email: string | null;
  actor_role: string | null;
  operation_id: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  changes: Record<string, unknown> | null;
  ip_address: string | null;
  user_agent: string | null;
  created_at: string;
}

interface AuditPageData {
  items: AuditLog[];
  total: number;
  page: number;
  per_page: number;
  pages: number;
}

// ── Constants ─────────────────────────────────────────────────────────────────
// These badge maps carry ten-plus semantic categories each — more than the
// five-tone AccentTone vocabulary can express without collapsing distinct
// meanings together, so they stay their own constants rather than being
// force-fit onto tones.ts. Only the raw hex/legacy classes are swapped for
// token-based equivalents.

const ENTITY_TYPES = [
  { value: "all",        label: "All Types" },
  { value: "api",        label: "API Request" },
  { value: "auth",       label: "Auth" },
  { value: "document",   label: "Document" },
  { value: "operation",  label: "Operation" },
  { value: "bdn",        label: "BDN" },
  { value: "invoice",    label: "Invoice" },
  { value: "pfi",        label: "PFI" },
  { value: "voucher",    label: "Voucher" },
  { value: "task",       label: "Task" },
  { value: "user",       label: "User" },
];

const ENTITY_BADGE: Record<string, string> = {
  api:       "bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-500/15 dark:text-slate-300 dark:border-slate-500/30",
  auth:      "bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-300 dark:border-emerald-500/30",
  document:  "bg-brand-100 text-brand-700 border-brand-200 dark:bg-brand-500/15 dark:text-brand-300 dark:border-brand-500/30",
  operation: "bg-violet-100 text-violet-700 border-violet-200 dark:bg-violet-500/15 dark:text-violet-300 dark:border-violet-500/30",
  bdn:       "bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-500/15 dark:text-amber-300 dark:border-amber-500/30",
  invoice:   "bg-violet-100 text-violet-700 border-violet-200 dark:bg-violet-500/15 dark:text-violet-300 dark:border-violet-500/30",
  pfi:       "bg-brand-100 text-brand-700 border-brand-200 dark:bg-brand-500/15 dark:text-brand-300 dark:border-brand-500/30",
  voucher:   "bg-teal-100 text-teal-700 border-teal-200 dark:bg-teal-500/15 dark:text-teal-300 dark:border-teal-500/30",
  task:      "bg-orange-100 text-orange-700 border-orange-200 dark:bg-orange-500/15 dark:text-orange-300 dark:border-orange-500/30",
  user:      "bg-pink-100 text-pink-700 border-pink-200 dark:bg-pink-500/15 dark:text-pink-300 dark:border-pink-500/30",
};

const ACTION_BADGE: Record<string, string> = {
  login:    "bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300",
  logout:   "bg-muted text-muted-foreground",
  create:   "bg-brand-100 text-brand-800 dark:bg-brand-500/15 dark:text-brand-300",
  upload:   "bg-brand-100 text-brand-800 dark:bg-brand-500/15 dark:text-brand-300",
  register: "bg-brand-100 text-brand-800 dark:bg-brand-500/15 dark:text-brand-300",
  update:   "bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300",
  approve:  "bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300",
  reject:   "bg-rose-100 text-rose-800 dark:bg-rose-500/15 dark:text-rose-300",
  delete:   "bg-rose-100 text-rose-800 dark:bg-rose-500/15 dark:text-rose-300",
  cancel:   "bg-rose-100 text-rose-800 dark:bg-rose-500/15 dark:text-rose-300",
  download: "bg-brand-100 text-brand-800 dark:bg-brand-500/15 dark:text-brand-300",
  post:     "bg-violet-100 text-violet-800 dark:bg-violet-500/15 dark:text-violet-300",
  put:      "bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300",
  patch:    "bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300",
};

function actionBadge(action: string) {
  const lower = action.toLowerCase();
  const key = Object.keys(ACTION_BADGE).find((k) => lower.includes(k));
  return key ? ACTION_BADGE[key] : "bg-muted text-muted-foreground";
}

function entityBadge(et: string) {
  return ENTITY_BADGE[et] ?? "bg-muted text-muted-foreground border-border";
}

const ROLE_LABELS: Record<string, string> = {
  bunker_manager:    "BM",
  ops_supervisor:    "Ops",
  logistics_officer: "Logistics",
  marine_manager:    "Marine",
  finance_manager:   "Finance",
  client:            "Client",
};

function EntityIcon({ type }: { type: string }) {
  if (type === "auth")     return <LogIn className="h-3 w-3" strokeWidth={2} />;
  if (type === "document") return <FileText className="h-3 w-3" strokeWidth={2} />;
  if (type === "api")      return <Globe className="h-3 w-3" strokeWidth={2} />;
  return <Settings className="h-3 w-3" strokeWidth={2} />;
}

function statusCodeTone(code: number) {
  if (code < 300) return "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300";
  if (code < 500) return "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300";
  return "bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300";
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function ActivityPage() {
  const [page,        setPage]        = useState(1);
  const [actionInput, setActionInput] = useState("");
  const [search,       setSearch]      = useState("");
  const [actorEmail,   setActorEmail]  = useState("");
  const [entityType,   setEntityType]  = useState("all");
  const [dateFrom,     setDateFrom]    = useState("");
  const [dateTo,       setDateTo]      = useState("");
  const [detailsLog,   setDetailsLog]  = useState<AuditLog | null>(null);

  const PER_PAGE = 30;

  // Debounce the action search so typing doesn't fire a request per keystroke
  // — matches the operations list's search convention.
  useEffect(() => {
    const t = setTimeout(() => {
      setSearch(actionInput);
      setPage(1);
    }, 350);
    return () => clearTimeout(t);
  }, [actionInput]);

  const clearFilters = () => {
    setActionInput(""); setSearch(""); setActorEmail("");
    setEntityType("all"); setDateFrom(""); setDateTo(""); setPage(1);
  };
  const hasFilters = search || actorEmail || entityType !== "all" || dateFrom || dateTo;

  const { data, isLoading } = useQuery({
    queryKey: ["audit-logs", page, search, actorEmail, entityType, dateFrom, dateTo],
    queryFn: async () => {
      const params = new URLSearchParams({ page: String(page), per_page: String(PER_PAGE) });
      if (search)              params.set("action",       search);
      if (actorEmail)          params.set("actor_email",  actorEmail);
      if (entityType !== "all") params.set("entity_type", entityType);
      if (dateFrom)            params.set("date_from",    new Date(dateFrom).toISOString());
      if (dateTo)              params.set("date_to",      new Date(dateTo + "T23:59:59").toISOString());
      const res = await api.get<{ success: boolean; data: AuditPageData }>(`/admin/audit-logs?${params}`);
      return res.data.data;
    },
    staleTime: 0,
  });

  const logs  = data?.items ?? [];
  const total = data?.total ?? 0;
  const pages = data?.pages ?? 1;

  return (
    <DashboardShell
      icon={Activity}
      iconTone="blue"
      showRole={false}
      title="Activity Log"
      subtitle={`${total.toLocaleString()} event${total !== 1 ? "s" : ""} recorded`}
    >
      <FilterBar className="animate-rise">
        <FilterSearch
          value={actionInput}
          onChange={setActionInput}
          placeholder="Search by action (e.g. CREATE_OPERATION, LOGIN, DOWNLOAD…)"
        />
        <div className="w-full sm:w-52">
          <Input
            className="h-11 rounded-xl border-navy-100 text-[13px] dark:border-border"
            placeholder="Actor email…"
            value={actorEmail}
            onChange={(e) => { setActorEmail(e.target.value); setPage(1); }}
          />
        </div>
        <FilterSelect
          value={entityType}
          onChange={(v) => { setEntityType(v); setPage(1); }}
          options={ENTITY_TYPES}
          label="Entity type"
          className="w-full sm:w-44"
        />
        <div className="flex items-center gap-2">
          <Label className="sr-only" htmlFor="activity-date-from">From date</Label>
          <Input
            id="activity-date-from"
            type="date"
            className="h-11 w-36 rounded-xl border-navy-100 text-[13px] dark:border-border"
            value={dateFrom}
            onChange={(e) => { setDateFrom(e.target.value); setPage(1); }}
          />
          <span className="text-xs text-muted-foreground">to</span>
          <Label className="sr-only" htmlFor="activity-date-to">To date</Label>
          <Input
            id="activity-date-to"
            type="date"
            className="h-11 w-36 rounded-xl border-navy-100 text-[13px] dark:border-border"
            value={dateTo}
            onChange={(e) => { setDateTo(e.target.value); setPage(1); }}
          />
        </div>
        {hasFilters && (
          <Button
            variant="outline"
            className="h-11 gap-1.5 rounded-xl border-navy-100 text-[13px] font-semibold dark:border-border"
            onClick={clearFilters}
          >
            <X className="h-3.5 w-3.5" />
            Clear
          </Button>
        )}
      </FilterBar>

      {isLoading ? (
        <Skeleton className="h-96 w-full rounded-2xl" />
      ) : (
        <PanelCard
          icon={Activity}
          tone="blue"
          title="Audit Trail"
          flush
          className="animate-rise overflow-hidden"
        >
          {logs.length === 0 ? (
            <div className="flex flex-col items-center py-16 text-center">
              <Activity className="h-9 w-9 text-muted-foreground/25" strokeWidth={1.5} />
              <p className="mt-3 text-sm font-medium text-foreground">
                {hasFilters ? "No events match your filters" : "No activity logged yet"}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50 hover:bg-muted/50">
                    <TableHead className="w-36 text-[11px] font-semibold uppercase tracking-wide">Timestamp</TableHead>
                    <TableHead className="text-[11px] font-semibold uppercase tracking-wide">Actor</TableHead>
                    <TableHead className="text-[11px] font-semibold uppercase tracking-wide">Action</TableHead>
                    <TableHead className="text-[11px] font-semibold uppercase tracking-wide">Entity</TableHead>
                    <TableHead className="text-[11px] font-semibold uppercase tracking-wide">Operation</TableHead>
                    <TableHead className="w-28 text-[11px] font-semibold uppercase tracking-wide">IP</TableHead>
                    <TableHead className="text-[11px] font-semibold uppercase tracking-wide">Details</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {logs.map((log) => (
                    <TableRow key={log.id} className="hover:bg-muted/40">
                      <TableCell className="whitespace-nowrap text-[12px] tabular-nums text-muted-foreground">
                        {formatDateTime(log.created_at)}
                      </TableCell>

                      <TableCell>
                        <Tooltip delayDuration={0}>
                          <TooltipTrigger asChild>
                            <div className="flex cursor-default items-center gap-2">
                              <Avatar className="h-6 w-6 shrink-0">
                                <AvatarFallback className="bg-brand-50 text-[9px] font-semibold text-brand-700 dark:bg-brand-500/15 dark:text-brand-300">
                                  {log.actor_name ? getInitials(log.actor_name) : "?"}
                                </AvatarFallback>
                              </Avatar>
                              <div className="min-w-0">
                                <p className="max-w-[110px] truncate text-[12.5px] font-medium text-foreground">
                                  {log.actor_name ?? "Unknown"}
                                </p>
                                {log.actor_role && (
                                  <p className="text-[10.5px] text-muted-foreground">
                                    {ROLE_LABELS[log.actor_role] ?? log.actor_role}
                                  </p>
                                )}
                              </div>
                            </div>
                          </TooltipTrigger>
                          {log.actor_email && (
                            <TooltipContent side="right" className="text-xs">
                              {log.actor_email}
                            </TooltipContent>
                          )}
                        </Tooltip>
                      </TableCell>

                      <TableCell>
                        <span className={cn("whitespace-nowrap rounded-md px-2 py-0.5 text-[11.5px] font-medium", actionBadge(log.action))}>
                          {log.action}
                        </span>
                      </TableCell>

                      <TableCell>
                        <div className="flex items-center gap-1.5">
                          <Badge className={cn("gap-1 rounded-md border px-1.5 text-[10px]", entityBadge(log.entity_type))}>
                            <EntityIcon type={log.entity_type} />
                            {log.entity_type}
                          </Badge>
                          {log.entity_id && (
                            <span className="font-mono text-[10px] text-muted-foreground">
                              {log.entity_id.slice(0, 8)}
                            </span>
                          )}
                        </div>
                      </TableCell>

                      <TableCell className="font-mono text-[12px] text-muted-foreground">
                        {log.operation_id ? log.operation_id.slice(0, 8) + "…" : "—"}
                      </TableCell>

                      <TableCell className="whitespace-nowrap text-[12px] tabular-nums text-muted-foreground">
                        {log.ip_address ?? "—"}
                      </TableCell>

                      <TableCell>
                        {log.changes ? (
                          <button
                            type="button"
                            className="flex items-center gap-1.5 rounded text-[12px] font-semibold text-brand-600 underline underline-offset-2 transition-colors hover:text-brand-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                            onClick={() => setDetailsLog(log)}
                          >
                            View
                            {!!log.changes.status_code && (
                              <span className={cn(
                                "rounded px-1 font-mono text-[10px] font-normal no-underline",
                                statusCodeTone(Number(log.changes.status_code))
                              )}>
                                {String(log.changes.status_code)}
                              </span>
                            )}
                          </button>
                        ) : (
                          <span className="text-[12px] text-muted-foreground">—</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          <TablePagination
            page={page}
            totalPages={pages}
            from={total === 0 ? 0 : (page - 1) * PER_PAGE + 1}
            to={Math.min(page * PER_PAGE, total)}
            total={total}
            noun="events"
            onPageChange={setPage}
          />
        </PanelCard>
      )}

      <DetailsDialog
        open={!!detailsLog}
        onOpenChange={(open) => !open && setDetailsLog(null)}
        title={detailsLog ? `${detailsLog.action} — ${detailsLog.entity_type}` : "Event Details"}
        json={detailsLog?.changes ?? {}}
        meta={
          detailsLog && (
            <>
              {!!detailsLog.changes?.status_code && (
                <span className={cn("rounded px-1.5 py-0.5 font-mono text-[11px]", statusCodeTone(Number(detailsLog.changes.status_code)))}>
                  {String(detailsLog.changes.status_code)}
                </span>
              )}
              {!!detailsLog.changes?.duration_ms && (
                <span className="text-muted-foreground">{String(detailsLog.changes.duration_ms)}ms</span>
              )}
              {detailsLog.user_agent && (
                <span className="truncate text-muted-foreground" title={detailsLog.user_agent}>
                  {detailsLog.user_agent.slice(0, 60)}{detailsLog.user_agent.length > 60 ? "…" : ""}
                </span>
              )}
            </>
          )
        }
      />
    </DashboardShell>
  );
}
