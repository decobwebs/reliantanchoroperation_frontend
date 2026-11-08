"use client";

/**
 * Staff directory — HR and the Bunker Manager, read only.
 *
 * Who works here, in what role, how to reach them, and whether they actually
 * use the system. Creating, switching off or resetting an account stays on
 * /admin with the Bunker Manager.
 */

import { useMemo, useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { ChevronRight, Download, Mail, Phone, Search, Users } from "lucide-react";
import { api } from "@/lib/api";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { PanelCard } from "@/components/dashboard/PanelCard";
import { QueryError } from "@/components/shared/QueryError";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";
import type { ApiResponse } from "@/types";
import {
  HR_VIEWER_ROLES, IDLE_DAYS, daysSince, downloadCsv, lastSeen, shortDate,
  type StaffMember,
} from "@/lib/hr";

type StatusFilter = "active" | "inactive" | "all";

export default function StaffDirectoryPage() {
  const { user, effectiveRole } = useAuth();
  const allowed = !effectiveRole || HR_VIEWER_ROLES.includes(effectiveRole);
  const [search, setSearch] = useState("");
  const [role, setRole] = useState("all");
  const [status, setStatus] = useState<StatusFilter>("active");

  const staff = useQuery({
    queryKey: ["hr-staff"],
    enabled: !!user && allowed,
    staleTime: 60_000,
    queryFn: async () => {
      const res = await api.get<ApiResponse<StaffMember[]>>("/kpi/people");
      return res.data.data;
    },
  });

  const all = useMemo(() => staff.data ?? [], [staff.data]);
  const roles = useMemo(
    () => Array.from(new Map(all.map((s) => [s.role, s.role_label])).entries())
      .sort((a, b) => a[1].localeCompare(b[1])),
    [all]
  );

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return all.filter((s) =>
      (status === "all" || (status === "active") === s.is_active) &&
      (role === "all" || s.role === role) &&
      (!q || [s.full_name, s.email, s.phone ?? "", s.role_label].some((v) => v.toLowerCase().includes(q)))
    );
  }, [all, search, role, status]);

  const active = all.filter((s) => s.is_active);
  const neverLogged = active.filter((s) => !s.last_login_at).length;
  const idle = active.filter((s) => (daysSince(s.last_login_at) ?? 0) > IDLE_DAYS).length;

  const exportCsv = () =>
    downloadCsv(
      `staff-directory-${new Date().toISOString().slice(0, 10)}.csv`,
      ["Name", "Role", "Email", "Phone", "Status", "Joined", "Last login"],
      rows.map((s) => [
        s.full_name, s.role_label, s.email, s.phone, s.is_active ? "Active" : "Switched off",
        shortDate(s.created_at), s.last_login_at ? shortDate(s.last_login_at) : "Never",
      ])
    );

  const shell = {
    icon: Users,
    iconTone: "violet" as const,
    showRole: false,
    title: "Staff directory",
    subtitle: "Everyone with a staff account, read only",
    actions: (
      <Button variant="outline" size="sm" onClick={exportCsv} disabled={!rows.length}>
        <Download className="mr-1.5 h-4 w-4" />
        Export CSV
      </Button>
    ),
  };

  if (user && !allowed) {
    return (
      <DashboardShell {...shell} actions={undefined} subtitle="Restricted">
        <QueryError error={{ isAxiosError: true, response: { status: 403 } }} />
      </DashboardShell>
    );
  }

  return (
    <DashboardShell {...shell}>
      {/* summary */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: "Active staff", value: active.length },
          { label: "Switched off", value: all.length - active.length },
          { label: "Never logged in", value: neverLogged, warn: neverLogged > 0 },
          { label: `No login in ${IDLE_DAYS}+ days`, value: idle, warn: idle > 0 },
        ].map((t) => (
          <div key={t.label} className="rounded-xl border border-border bg-card p-3">
            <p className="text-xs text-muted-foreground">{t.label}</p>
            <p className={cn("mt-1 font-mono text-2xl tabular-nums", t.warn && "text-amber-600")}>
              {staff.isLoading ? "…" : t.value}
            </p>
          </div>
        ))}
      </div>

      {/* filters */}
      <div className="flex flex-col gap-2 rounded-xl border border-border bg-card p-3 sm:flex-row sm:items-center">
        <label className="relative flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name, email, phone or role"
            className="h-9 w-full rounded-md border border-input bg-background pl-8 pr-3 text-sm"
          />
        </label>
        <select
          value={role}
          onChange={(e) => setRole(e.target.value)}
          aria-label="Role"
          className="h-9 rounded-md border border-input bg-background px-3 text-sm"
        >
          <option value="all">All roles</option>
          {roles.map(([value, label]) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </select>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value as StatusFilter)}
          aria-label="Status"
          className="h-9 rounded-md border border-input bg-background px-3 text-sm"
        >
          <option value="active">Active</option>
          <option value="inactive">Switched off</option>
          <option value="all">Everyone</option>
        </select>
      </div>

      <PanelCard
        icon={Users}
        tone="violet"
        title={`${rows.length} ${rows.length === 1 ? "person" : "people"}`}
        subtitle="Tap a name to see their performance"
        flush
      >
        {staff.isError ? (
          <div className="p-4">
            <QueryError error={staff.error} onRetry={() => staff.refetch()} />
          </div>
        ) : staff.isLoading ? (
          <div className="space-y-2 p-4">
            {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-14 rounded-lg" />)}
          </div>
        ) : rows.length === 0 ? (
          <p className="p-4 text-sm text-muted-foreground">Nobody matches these filters.</p>
        ) : (
          <div className="divide-y divide-border/60">
            {rows.map((s) => {
              const d = daysSince(s.last_login_at);
              const loginWarn = s.is_active && (d === null || d > IDLE_DAYS);
              return (
                <Link
                  key={s.user_id}
                  href={`/hr/people/${s.user_id}`}
                  className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-muted/40"
                >
                  <div className="min-w-0 flex-1">
                    <p className="flex flex-wrap items-center gap-2 text-sm font-medium">
                      <span className="truncate">{s.full_name}</span>
                      {!s.is_active && (
                        <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                          Switched off
                        </span>
                      )}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {s.role_label}
                      <span className={cn("sm:hidden", loginWarn && "text-amber-600")}>
                        {" · "}{lastSeen(s.last_login_at)}
                      </span>
                    </p>
                    <p className="mt-1 flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-muted-foreground">
                      <span className="inline-flex min-w-0 items-center gap-1">
                        <Mail className="h-3 w-3 shrink-0" />
                        <span className="truncate">{s.email}</span>
                      </span>
                      {s.phone && (
                        <span className="inline-flex items-center gap-1">
                          <Phone className="h-3 w-3" />
                          {s.phone}
                        </span>
                      )}
                    </p>
                  </div>
                  <div className="hidden shrink-0 text-right sm:block">
                    <p className={cn("text-xs", loginWarn ? "text-amber-600" : "text-muted-foreground")}>
                      {lastSeen(s.last_login_at)}
                    </p>
                    <p className="text-[11px] text-muted-foreground">Joined {shortDate(s.created_at)}</p>
                  </div>
                  <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                </Link>
              );
            })}
          </div>
        )}
      </PanelCard>
    </DashboardShell>
  );
}
