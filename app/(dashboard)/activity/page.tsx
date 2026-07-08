"use client";

import { useState, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Search, ChevronLeft, ChevronRight, Loader2, Activity,
  Filter, X, LogIn, FileText, Settings, Globe,
} from "lucide-react";
import { api } from "@/lib/api";
import { Header } from "@/components/layout/Header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { formatDateTime, getInitials } from "@/lib/utils";
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
  api:       "bg-slate-100 text-slate-600 border-slate-200",
  auth:      "bg-emerald-100 text-emerald-700 border-emerald-200",
  document:  "bg-blue-100 text-blue-700 border-blue-200",
  operation: "bg-violet-100 text-violet-700 border-violet-200",
  bdn:       "bg-amber-100 text-amber-700 border-amber-200",
  invoice:   "bg-purple-100 text-purple-700 border-purple-200",
  pfi:       "bg-sky-100 text-sky-700 border-sky-200",
  voucher:   "bg-teal-100 text-teal-700 border-teal-200",
  task:      "bg-orange-100 text-orange-700 border-orange-200",
  user:      "bg-pink-100 text-pink-700 border-pink-200",
};

const ACTION_BADGE: Record<string, string> = {
  login:    "bg-emerald-100 text-emerald-800",
  logout:   "bg-gray-100 text-gray-600",
  create:   "bg-blue-100 text-blue-800",
  upload:   "bg-blue-100 text-blue-800",
  register: "bg-blue-100 text-blue-800",
  update:   "bg-amber-100 text-amber-800",
  approve:  "bg-green-100 text-green-800",
  reject:   "bg-red-100 text-red-800",
  delete:   "bg-red-100 text-red-800",
  cancel:   "bg-red-100 text-red-800",
  download: "bg-sky-100 text-sky-800",
  post:     "bg-violet-100 text-violet-800",
  put:      "bg-yellow-100 text-yellow-800",
  patch:    "bg-yellow-100 text-yellow-800",
};

function actionBadge(action: string) {
  const lower = action.toLowerCase();
  const key = Object.keys(ACTION_BADGE).find((k) => lower.includes(k));
  return key ? ACTION_BADGE[key] : "bg-gray-100 text-gray-600";
}

function entityBadge(et: string) {
  return ENTITY_BADGE[et] ?? "bg-muted text-muted-foreground border";
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
  if (type === "auth")     return <LogIn className="w-3 h-3" />;
  if (type === "document") return <FileText className="w-3 h-3" />;
  if (type === "api")      return <Globe className="w-3 h-3" />;
  return <Settings className="w-3 h-3" />;
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function ActivityPage() {
  const [page,       setPage]       = useState(1);
  const [action,     setAction]     = useState("");
  const [search,     setSearch]     = useState("");   // committed action search
  const [actorEmail, setActorEmail] = useState("");
  const [entityType, setEntityType] = useState("all");
  const [dateFrom,   setDateFrom]   = useState("");
  const [dateTo,     setDateTo]     = useState("");

  const PER_PAGE = 30;

  const commitSearch = useCallback(() => {
    setSearch(action);
    setPage(1);
  }, [action]);

  const clearFilters = () => {
    setAction(""); setSearch(""); setActorEmail("");
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
    <div>
      <Header
        title="Activity Log"
        subtitle={`${total.toLocaleString()} event${total !== 1 ? "s" : ""} recorded`}
      />

      <div className="p-4 md:p-6 space-y-5">
        {/* ── Filters */}
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-3 pt-4 px-5">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Filter className="w-4 h-4 text-primary" />
              Search & Filter
            </CardTitle>
          </CardHeader>
          <CardContent className="px-5 pb-5 space-y-3">
            {/* Action search */}
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                <Input
                  className="pl-8 h-9 text-sm"
                  placeholder="Search by action (e.g. CREATE_OPERATION, LOGIN, DOWNLOAD…)"
                  value={action}
                  onChange={(e) => setAction(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && commitSearch()}
                />
              </div>
              <Button size="sm" className="h-9 px-4" onClick={commitSearch}>Search</Button>
              {hasFilters && (
                <Button size="sm" variant="outline" className="h-9 gap-1.5" onClick={clearFilters}>
                  <X className="w-3.5 h-3.5" />Clear
                </Button>
              )}
            </div>

            {/* Row 2 */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Actor Email</Label>
                <Input
                  className="h-8 text-xs"
                  placeholder="user@example.com"
                  value={actorEmail}
                  onChange={(e) => { setActorEmail(e.target.value); setPage(1); }}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Entity Type</Label>
                <Select value={entityType} onValueChange={(v) => { setEntityType(v); setPage(1); }}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {ENTITY_TYPES.map((t) => (
                      <SelectItem key={t.value} value={t.value} className="text-xs">{t.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">From Date</Label>
                <Input
                  type="date" className="h-8 text-xs"
                  value={dateFrom}
                  onChange={(e) => { setDateFrom(e.target.value); setPage(1); }}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">To Date</Label>
                <Input
                  type="date" className="h-8 text-xs"
                  value={dateTo}
                  onChange={(e) => { setDateTo(e.target.value); setPage(1); }}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* ── Table */}
        <Card className="border-0 shadow-sm overflow-hidden">
          <CardContent className="p-0">
            {isLoading ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
              </div>
            ) : logs.length === 0 ? (
              <div className="flex flex-col items-center py-16 text-muted-foreground gap-2">
                <Activity className="w-10 h-10 opacity-25" />
                <p className="text-sm">{hasFilters ? "No events match your filters" : "No activity logged yet"}</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/30 hover:bg-muted/30">
                    <TableHead className="text-xs w-36">Timestamp</TableHead>
                    <TableHead className="text-xs">Actor</TableHead>
                    <TableHead className="text-xs">Action</TableHead>
                    <TableHead className="text-xs">Entity</TableHead>
                    <TableHead className="text-xs">Operation</TableHead>
                    <TableHead className="text-xs w-28">IP</TableHead>
                    <TableHead className="text-xs">Details</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {logs.map((log) => (
                    <TableRow key={log.id} className="hover:bg-muted/20">
                      {/* Timestamp */}
                      <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                        {formatDateTime(log.created_at)}
                      </TableCell>

                      {/* Actor */}
                      <TableCell>
                        <Tooltip delayDuration={0}>
                          <TooltipTrigger asChild>
                            <div className="flex items-center gap-2 cursor-default">
                              <Avatar className="w-6 h-6 shrink-0">
                                <AvatarFallback className="text-[9px] bg-primary/10 text-primary font-semibold">
                                  {log.actor_name ? getInitials(log.actor_name) : "?"}
                                </AvatarFallback>
                              </Avatar>
                              <div className="min-w-0">
                                <p className="text-xs font-medium truncate max-w-[110px]">
                                  {log.actor_name ?? "Unknown"}
                                </p>
                                {log.actor_role && (
                                  <p className="text-[10px] text-muted-foreground">
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

                      {/* Action */}
                      <TableCell>
                        <span className={`text-xs font-medium px-2 py-0.5 rounded whitespace-nowrap ${actionBadge(log.action)}`}>
                          {log.action}
                        </span>
                      </TableCell>

                      {/* Entity */}
                      <TableCell>
                        <div className="flex items-center gap-1.5">
                          <Badge className={`text-[10px] px-1.5 border gap-1 ${entityBadge(log.entity_type)}`}>
                            <EntityIcon type={log.entity_type} />
                            {log.entity_type}
                          </Badge>
                          {log.entity_id && (
                            <span className="text-[10px] font-mono text-muted-foreground">
                              {log.entity_id.slice(0, 8)}
                            </span>
                          )}
                        </div>
                      </TableCell>

                      {/* Operation */}
                      <TableCell className="text-xs font-mono text-muted-foreground">
                        {log.operation_id ? log.operation_id.slice(0, 8) + "…" : "—"}
                      </TableCell>

                      {/* IP */}
                      <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                        {log.ip_address ?? "—"}
                      </TableCell>

                      {/* Details (changes) */}
                      <TableCell className="max-w-[200px]">
                        {log.changes ? (
                          <details className="cursor-pointer">
                            <summary className="text-xs text-primary select-none list-none flex items-center gap-1">
                              <span className="underline underline-offset-2">View</span>
                              {!!(log.changes.status_code) && (
                                <span className={`ml-1 text-[10px] font-mono px-1 rounded ${
                                  Number(log.changes.status_code) < 300
                                    ? "bg-green-100 text-green-700"
                                    : Number(log.changes.status_code) < 500
                                    ? "bg-yellow-100 text-yellow-700"
                                    : "bg-red-100 text-red-700"
                                }`}>
                                  {String(log.changes.status_code)}
                                </span>
                              )}
                              {!!(log.changes.duration_ms) && (
                                <span className="text-[10px] text-muted-foreground">{String(log.changes.duration_ms)}ms</span>
                              )}
                            </summary>
                            <pre className="text-[10px] text-muted-foreground mt-1 whitespace-pre-wrap break-all max-h-24 overflow-y-auto">
                              {JSON.stringify(log.changes, null, 2)}
                            </pre>
                            {log.user_agent && (
                              <p className="text-[10px] text-muted-foreground mt-0.5 truncate" title={log.user_agent}>
                                {log.user_agent.slice(0, 60)}{log.user_agent.length > 60 ? "…" : ""}
                              </p>
                            )}
                          </details>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* ── Pagination */}
        {pages > 1 && (
          <div className="flex items-center justify-between px-1">
            <p className="text-xs text-muted-foreground">
              Showing {((page - 1) * PER_PAGE) + 1}–{Math.min(page * PER_PAGE, total)} of {total.toLocaleString()}
            </p>
            <div className="flex items-center gap-2">
              <Button size="sm" variant="outline" className="h-8 w-8 p-0" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <span className="text-xs font-medium">{page} / {pages}</span>
              <Button size="sm" variant="outline" className="h-8 w-8 p-0" disabled={page >= pages} onClick={() => setPage((p) => p + 1)}>
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
