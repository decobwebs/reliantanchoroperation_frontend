"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search, ChevronLeft, ChevronRight, Loader2, Activity } from "lucide-react";
import { api } from "@/lib/api";
import { Header } from "@/components/layout/Header";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatDateTime, getInitials } from "@/lib/utils";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import type { ApiResponse } from "@/types";

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
  created_at: string;
}

interface AuditLogData {
  items: AuditLog[];
  total: number;
  page: number;
  per_page: number;
}

const ACTION_COLOR: Record<string, string> = {
  create:     "bg-emerald-100 text-emerald-700",
  update:     "bg-blue-100 text-blue-700",
  delete:     "bg-red-100 text-red-700",
  approve:    "bg-primary/10 text-primary",
  reject:     "bg-orange-100 text-orange-700",
  transition: "bg-purple-100 text-purple-700",
  login:      "bg-gray-100 text-gray-600",
  cancel:     "bg-red-100 text-red-600",
};

function actionColor(action: string): string {
  const key = Object.keys(ACTION_COLOR).find((k) => action.toLowerCase().includes(k));
  return key ? ACTION_COLOR[key] : "bg-gray-100 text-gray-600";
}

const ROLE_LABELS: Record<string, string> = {
  bunker_manager:    "BM",
  ops_supervisor:    "Ops",
  logistics_officer: "Logistics",
  marine_manager:    "Marine",
  finance_manager:   "Finance",
  client:            "Client",
};

export default function ActivityPage() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["audit-logs", page, search],
    queryFn: async () => {
      const params = new URLSearchParams({ page: String(page), per_page: "25" });
      if (search) params.set("action", search);
      const res = await api.get<ApiResponse<AuditLogData>>(`/admin/audit-logs?${params}`);
      return res.data.data;
    },
  });

  const totalPages = data ? Math.ceil(data.total / 25) : 0;

  return (
    <div>
      <Header
        title="Activity Log"
        subtitle={data ? `${data.total} events recorded` : undefined}
      />

      <div className="p-6 space-y-4">
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Filter by action…"
            className="pl-9"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          />
        </div>

        <Card className="border-0 shadow-sm overflow-hidden">
          <CardContent className="p-0">
            {isLoading ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="w-7 h-7 animate-spin text-primary" />
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent border-b">
                    <TableHead className="font-semibold text-xs uppercase tracking-wide">Timestamp</TableHead>
                    <TableHead className="font-semibold text-xs uppercase tracking-wide">Actor</TableHead>
                    <TableHead className="font-semibold text-xs uppercase tracking-wide">Action</TableHead>
                    <TableHead className="font-semibold text-xs uppercase tracking-wide">Entity</TableHead>
                    <TableHead className="font-semibold text-xs uppercase tracking-wide">Operation</TableHead>
                    <TableHead className="font-semibold text-xs uppercase tracking-wide">IP</TableHead>
                    <TableHead className="font-semibold text-xs uppercase tracking-wide">Changes</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data?.items?.length ? (
                    data.items.map((log) => (
                      <TableRow key={log.id} className="hover:bg-muted/40">
                        <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                          {formatDateTime(log.created_at)}
                        </TableCell>

                        {/* Actor */}
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Avatar className="w-6 h-6 shrink-0">
                              <AvatarFallback className="text-[9px] bg-primary/10 text-primary font-semibold">
                                {log.actor_name ? getInitials(log.actor_name) : "?"}
                              </AvatarFallback>
                            </Avatar>
                            <div className="min-w-0">
                              <p className="text-xs font-medium truncate max-w-30">
                                {log.actor_name ?? "Unknown"}
                              </p>
                              {log.actor_role && (
                                <p className="text-[10px] text-muted-foreground">
                                  {ROLE_LABELS[log.actor_role] ?? log.actor_role}
                                </p>
                              )}
                            </div>
                          </div>
                        </TableCell>

                        <TableCell>
                          <span className={`text-xs font-medium px-2 py-0.5 rounded ${actionColor(log.action)}`}>
                            {log.action}
                          </span>
                        </TableCell>

                        <TableCell className="text-xs">
                          <span className="capitalize">{log.entity_type}</span>
                          {log.entity_id && (
                            <span className="block font-mono text-muted-foreground truncate max-w-30">
                              {log.entity_id.slice(0, 8)}…
                            </span>
                          )}
                        </TableCell>

                        <TableCell className="text-xs font-mono text-muted-foreground">
                          {log.operation_id ? log.operation_id.slice(0, 8) + "…" : "—"}
                        </TableCell>

                        <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                          {log.ip_address ?? "—"}
                        </TableCell>

                        <TableCell className="max-w-50">
                          {log.changes ? (
                            <details className="cursor-pointer">
                              <summary className="text-xs text-primary select-none">View diff</summary>
                              <pre className="text-[10px] text-muted-foreground mt-1 whitespace-pre-wrap break-all">
                                {JSON.stringify(log.changes, null, 2)}
                              </pre>
                            </details>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-16 text-muted-foreground">
                        <Activity className="w-8 h-8 mx-auto mb-2 opacity-30" />
                        No activity logged yet
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {totalPages > 1 && (
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              Page {page} of {totalPages} ({data?.total} events)
            </p>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                <ChevronLeft className="w-4 h-4" /> Previous
              </Button>
              <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
                Next <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
