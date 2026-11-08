"use client";

/**
 * Staff performance — HR and the Bunker Manager, read only.
 *
 * Grouped by role on purpose. Each role is scored on different measures from
 * its own job document, so a Logistics Officer's 70 and a Finance Manager's 70
 * are not the same thing. Each person is compared with the middle score of
 * their own role, never with the whole company.
 */

import { Suspense, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { BarChart3, ChevronRight, Download, Search } from "lucide-react";
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
  num, periodLabel, ratingBar, ratingTone, recentPeriods,
  type Leaderboard, type LeaderboardRow,
} from "@/lib/kpi-me";
import { HR_VIEWER_ROLES, downloadCsv, lastFullMonth, needsSupport, roleMedians } from "@/lib/hr";

type Show = "all" | "support" | "unscored";

export default function StaffPerformancePage() {
  return (
    <Suspense fallback={null}>
      <StaffPerformance />
    </Suspense>
  );
}

function StaffPerformance() {
  const { user, effectiveRole } = useAuth();
  const qs = useSearchParams().get("show");
  const allowed = !effectiveRole || HR_VIEWER_ROLES.includes(effectiveRole);
  const [period, setPeriod] = useState(lastFullMonth());
  const [search, setSearch] = useState("");
  const [role, setRole] = useState("all");
  const [show, setShow] = useState<Show>(qs === "support" || qs === "unscored" ? qs : "all");

  const board = useQuery({
    queryKey: ["kpi-leaderboard", period],
    enabled: !!user && allowed,
    refetchOnWindowFocus: false,
    staleTime: 60_000,
    queryFn: async () => {
      const res = await api.get<ApiResponse<Leaderboard>>(`/kpi/leaderboard?period=${period}`);
      return res.data.data;
    },
  });

  const all = useMemo(() => board.data?.rows ?? [], [board.data]);
  const medians = useMemo(() => roleMedians(all), [all]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return all.filter((r) =>
      (role === "all" || r.role === role) &&
      (show === "all" || (show === "support" ? needsSupport(r) : r.score == null)) &&
      (!q || (r.full_name ?? "").toLowerCase().includes(q))
    );
  }, [all, search, role, show]);

  const groups = useMemo(() => {
    const m = new Map<string, { label: string; rows: LeaderboardRow[] }>();
    for (const r of filtered) {
      if (!m.has(r.role)) m.set(r.role, { label: r.role_label, rows: [] });
      m.get(r.role)!.rows.push(r);
    }
    return Array.from(m.entries()).sort((a, b) => a[1].label.localeCompare(b[1].label));
  }, [filtered]);

  const roles = useMemo(
    () => Array.from(new Map(all.map((r) => [r.role, r.role_label])).entries())
      .sort((a, b) => a[1].localeCompare(b[1])),
    [all]
  );

  const exportCsv = () =>
    downloadCsv(
      `staff-performance-${period}.csv`,
      ["Name", "Role", "Score", "Rating", "Role median", "Vs role median", "Measures with data", "Coverage %"],
      filtered.map((r) => {
        const med = medians[r.role];
        return [
          r.full_name, r.role_label,
          r.score != null ? r.score.toFixed(1) : "",
          r.rating ?? (r.insufficient_data ? "Not enough data" : "Nothing recorded"),
          med != null ? med.toFixed(1) : "",
          r.score != null && med != null ? (r.score - med).toFixed(1) : "",
          `${r.metrics_measured}/${r.metrics_total}`,
          r.coverage.toFixed(0),
        ];
      })
    );

  const shell = {
    icon: BarChart3,
    iconTone: "blue" as const,
    showRole: false,
    title: "Staff performance",
    subtitle: `${periodLabel(period)} · grouped by role, read only`,
    actions: (
      <Button variant="outline" size="sm" onClick={exportCsv} disabled={!filtered.length}>
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

  const data = board.data;

  return (
    <DashboardShell {...shell}>
      {/* filters */}
      <div className="flex flex-col gap-2 rounded-xl border border-border bg-card p-3 sm:flex-row sm:flex-wrap sm:items-center">
        <select
          value={period}
          onChange={(e) => setPeriod(e.target.value)}
          aria-label="Month"
          className="h-9 rounded-md border border-input bg-background px-3 text-sm"
        >
          {recentPeriods(12).map((p) => (
            <option key={p} value={p}>{periodLabel(p)}</option>
          ))}
        </select>
        <label className="relative flex-1 sm:min-w-[12rem]">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name"
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
          value={show}
          onChange={(e) => setShow(e.target.value as Show)}
          aria-label="Show"
          className="h-9 rounded-md border border-input bg-background px-3 text-sm"
        >
          <option value="all">Everyone</option>
          <option value="support">Needs support</option>
          <option value="unscored">Not scored</option>
        </select>
      </div>

      {data?.provisional && (
        <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-300">
          {periodLabel(period)} is still running, so these scores will change.
        </p>
      )}

      {board.isError ? (
        <QueryError error={board.error} onRetry={() => board.refetch()} />
      ) : board.isLoading || !data ? (
        <>
          <Skeleton className="h-40 rounded-2xl" />
          <Skeleton className="h-40 rounded-2xl" />
        </>
      ) : groups.length === 0 ? (
        <p className="rounded-xl border border-border bg-card p-6 text-center text-sm text-muted-foreground">
          Nobody matches these filters.
        </p>
      ) : (
        groups.map(([roleKey, g]) => {
          const med = medians[roleKey];
          const scored = g.rows.filter((r) => r.score != null).length;
          return (
            <PanelCard
              key={roleKey}
              icon={BarChart3}
              tone="blue"
              title={g.label}
              subtitle={`${scored} of ${g.rows.length} scored` + (med != null ? ` · role median ${med.toFixed(1)}` : "")}
              flush
            >
              <div className="divide-y divide-border/60">
                {g.rows.map((r) => {
                  const diff = r.score != null && med != null && scored > 1 ? r.score - med : null;
                  return (
                    <Link
                      key={r.user_id}
                      href={`/hr/people/${r.user_id}?period=${period}`}
                      className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-muted/40"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{r.full_name}</p>
                        <p className="text-xs text-muted-foreground">
                          {r.score == null
                            ? r.insufficient_data
                              ? `Not enough data · only ${r.coverage.toFixed(0)}% of measures covered`
                              : "Nothing recorded this month"
                            : `${r.metrics_measured} of ${r.metrics_total} measures with data`}
                        </p>
                        {r.score != null && (
                          <div className="mt-1.5 h-1 w-full max-w-[14rem] overflow-hidden rounded-full bg-muted">
                            <div
                              className={cn("h-full rounded-full", ratingBar(r.rating))}
                              style={{ width: `${Math.max(2, Math.min(r.score, 100))}%` }}
                            />
                          </div>
                        )}
                      </div>
                      <div className="shrink-0 text-right">
                        <p className={cn("font-mono text-sm tabular-nums", ratingTone(r.rating))}>
                          {num(r.score, { dp: 1 })}
                        </p>
                        <p className={cn("text-[11px]", ratingTone(r.rating))}>{r.rating ?? ""}</p>
                        {diff != null && (
                          <p className={cn("text-[11px]", diff >= 0 ? "text-emerald-600" : "text-amber-600")}>
                            {diff >= 0 ? "+" : ""}{diff.toFixed(1)} vs role
                          </p>
                        )}
                      </div>
                      <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                    </Link>
                  );
                })}
              </div>
            </PanelCard>
          );
        })
      )}

      <p className="text-center text-xs text-muted-foreground">
        Scores come from records already in the system. Grades are entered by the Bunker Manager.
      </p>
    </DashboardShell>
  );
}
