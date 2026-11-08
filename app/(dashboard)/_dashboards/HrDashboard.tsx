"use client";

/**
 * HR dashboard — people and performance at a glance, read only.
 *
 * Management agreed (1 Nov 2026) that HR sees named scores but does not
 * grade or close a month; those stay with the Bunker Manager. The API enforces
 * this (PERFORMANCE_VIEWER_ROLES): every HR route only reads.
 *
 * The page answers four questions in order: how is the team doing, who needs
 * support, whose work is not being recorded, and is anyone not using the
 * system at all.
 */

import { useMemo, useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import {
  AlertTriangle, BarChart3, ChevronRight, FileText, HeartHandshake, TrendingUp,
  UserCheck, UserX, Users,
} from "lucide-react";
import { api } from "@/lib/api";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { KpiCard } from "@/components/dashboard/KpiCard";
import { PanelCard } from "@/components/dashboard/PanelCard";
import { QuickActionTile } from "@/components/dashboard/QuickActionTile";
import { TrendStrip, type TrendPoint } from "@/components/dashboard/TrendStrip";
import { QueryError } from "@/components/shared/QueryError";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";
import type { ApiResponse } from "@/types";
import {
  num, periodLabel, ratingTone, recentPeriods, type Leaderboard,
} from "@/lib/kpi-me";
import {
  IDLE_DAYS, daysSince, lastFullMonth, lastSeen, needsSupport, roleMedians,
  type StaffMember,
} from "@/lib/hr";

interface CompanyTrend {
  points: TrendPoint[];
  has_history: boolean;
  message?: string | null;
}

export function HrDashboard() {
  const { user } = useAuth();
  const [period, setPeriod] = useState<string>(lastFullMonth());

  const board = useQuery({
    queryKey: ["kpi-leaderboard", period],
    enabled: !!user,
    refetchOnWindowFocus: false,
    staleTime: 60_000,
    queryFn: async () => {
      const res = await api.get<ApiResponse<Leaderboard>>(`/kpi/leaderboard?period=${period}`);
      return res.data.data;
    },
  });

  const staff = useQuery({
    queryKey: ["hr-staff"],
    enabled: !!user,
    staleTime: 60_000,
    queryFn: async () => {
      const res = await api.get<ApiResponse<StaffMember[]>>("/kpi/people");
      return res.data.data;
    },
  });

  const trend = useQuery({
    queryKey: ["kpi-company-trend"],
    enabled: !!user,
    refetchOnWindowFocus: false,
    queryFn: async () => {
      const res = await api.get<ApiResponse<CompanyTrend>>("/kpi/trends/company?months=6");
      return res.data.data;
    },
  });

  const rows = useMemo(() => board.data?.rows ?? [], [board.data]);
  const medians = useMemo(() => roleMedians(rows), [rows]);
  const support = rows.filter(needsSupport);
  const notScored = rows.filter((r) => r.score == null);

  const active = (staff.data ?? []).filter((s) => s.is_active);
  const loginWatch = active
    .filter((s) => {
      const d = daysSince(s.last_login_at);
      return d === null || d > IDLE_DAYS;
    })
    .sort((a, b) => (daysSince(b.last_login_at) ?? 1e9) - (daysSince(a.last_login_at) ?? 1e9));

  const periodPicker = (
    <select
      value={period}
      onChange={(e) => setPeriod(e.target.value)}
      aria-label="Month"
      className="rounded-lg border border-border bg-background px-2 py-1 text-xs"
    >
      {recentPeriods(6).map((p) => (
        <option key={p} value={p}>{periodLabel(p)}</option>
      ))}
    </select>
  );

  const loading = board.isLoading || staff.isLoading;

  return (
    <DashboardShell
      eyebrow={<>Welcome, {user?.full_name?.split(" ")[0] ?? "there"}</>}
      title="People & Performance"
      subtitle={`Reviewing ${periodLabel(period)} · read only`}
      actions={periodPicker}
    >
      {/* ── headline numbers ── */}
      <section className="animate-rise grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4" aria-label="People metrics">
        <KpiCard
          tone="navy"
          icon={Users}
          title="Active staff"
          value={loading ? "…" : active.length}
          caption={`${(staff.data ?? []).length - active.length} accounts switched off`}
          note={board.data?.team_median != null ? `Company median ${num(board.data.team_median, { dp: 1 })}` : "No median yet"}
          noteTrend="flat"
        />
        <KpiCard
          tone="emerald"
          icon={UserCheck}
          title="Scored"
          value={loading ? "…" : board.data?.scored_count ?? 0}
          caption={`of ${rows.length} people measured`}
          note={periodLabel(period)}
          noteTrend="flat"
        />
        <KpiCard
          tone="amber"
          icon={HeartHandshake}
          title="Needs support"
          value={loading ? "…" : support.length}
          caption="Needs Improvement or Unsatisfactory"
          note={support.length ? "See the list below" : "Nobody flagged"}
          noteTrend="flat"
        />
        <KpiCard
          tone="slate"
          icon={UserX}
          title="Not scored"
          value={loading ? "…" : notScored.length}
          caption="Too little work recorded"
          note="Usually missing records, not poor work"
          noteTrend="flat"
        />
      </section>

      {/* ── month never closed: the root cause of empty trends ── */}
      {trend.data && !trend.data.has_history && (
        <div className="flex items-start gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
          <div>
            <p className="font-medium text-amber-800 dark:text-amber-200">No month has been closed yet</p>
            <p className="mt-0.5 text-amber-800/80 dark:text-amber-200/80">
              Scores are only saved for good when the Bunker Manager closes a month in KPI Settings.
              Until then the trend stays empty and past scores can still move. Ask the Bunker Manager to close {periodLabel(lastFullMonth())}.
            </p>
          </div>
        </div>
      )}

      {/* ── quick access ── */}
      <PanelCard icon={BarChart3} tone="blue" title="Quick access" subtitle="Everything HR can open">
        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 xl:grid-cols-4">
          <QuickActionTile href="/hr/staff" icon={Users} tone="violet" label="Staff directory" description="Contacts, roles, last login" />
          <QuickActionTile href="/hr/performance" icon={BarChart3} tone="blue" label="Staff performance" description="Scores by role, export CSV" />
          <QuickActionTile href="/kpi-settings/hr-pack" icon={FileText} tone="emerald" label="HR grading pack" description="Print or save the month as PDF" />
          <QuickActionTile href="/hr/performance?show=support" icon={HeartHandshake} tone="amber" label="Needs support" description="People below target" />
        </div>
      </PanelCard>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        {/* ── who needs support ── */}
        <PanelCard
          icon={HeartHandshake}
          tone="amber"
          title="Needs support"
          subtitle="Compared with others in the same role"
          flush
        >
          {board.isError ? (
            <div className="p-4"><QueryError error={board.error} onRetry={() => board.refetch()} /></div>
          ) : board.isLoading ? (
            <div className="space-y-2 p-4"><Skeleton className="h-10 rounded-lg" /><Skeleton className="h-10 rounded-lg" /></div>
          ) : support.length === 0 ? (
            <p className="p-4 text-sm text-muted-foreground">
              Nobody is below target in {periodLabel(period)}.
            </p>
          ) : (
            <div className="divide-y divide-border/60">
              {support.map((r) => {
                const med = medians[r.role];
                return (
                  <Link
                    key={r.user_id}
                    href={`/hr/people/${r.user_id}?period=${period}`}
                    className="flex items-center gap-3 px-4 py-2.5 transition-colors hover:bg-muted/40"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{r.full_name}</p>
                      <p className="text-xs text-muted-foreground">
                        {r.role_label}
                        {med != null && ` · role median ${med.toFixed(1)}`}
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className={cn("font-mono text-sm tabular-nums", ratingTone(r.rating))}>{num(r.score, { dp: 1 })}</p>
                      <p className={cn("text-[11px]", ratingTone(r.rating))}>{r.rating}</p>
                    </div>
                    <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                  </Link>
                );
              })}
            </div>
          )}
        </PanelCard>

        {/* ── not using the system ── */}
        <PanelCard
          icon={UserX}
          tone="slate"
          title="Not using the system"
          subtitle={`Never logged in, or no login in ${IDLE_DAYS}+ days`}
          flush
        >
          {staff.isError ? (
            <div className="p-4"><QueryError error={staff.error} onRetry={() => staff.refetch()} /></div>
          ) : staff.isLoading ? (
            <div className="space-y-2 p-4"><Skeleton className="h-10 rounded-lg" /><Skeleton className="h-10 rounded-lg" /></div>
          ) : loginWatch.length === 0 ? (
            <p className="p-4 text-sm text-muted-foreground">Every active account has logged in recently.</p>
          ) : (
            <div className="divide-y divide-border/60">
              {loginWatch.map((s) => (
                <Link
                  key={s.user_id}
                  href={`/hr/people/${s.user_id}`}
                  className="flex items-center gap-3 px-4 py-2.5 transition-colors hover:bg-muted/40"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{s.full_name}</p>
                    <p className="text-xs text-muted-foreground">{s.role_label}</p>
                  </div>
                  <p className="shrink-0 text-xs text-amber-600">{lastSeen(s.last_login_at)}</p>
                  <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                </Link>
              ))}
            </div>
          )}
        </PanelCard>
      </div>

      <PanelCard icon={TrendingUp} tone="sky" title="Company trend" subtitle="Median score, last 6 months">
        {trend.isLoading ? (
          <Skeleton className="h-24 rounded-lg" />
        ) : trend.data ? (
          <TrendStrip points={trend.data.points} message={trend.data.message} />
        ) : (
          <p className="py-4 text-sm text-muted-foreground">History could not be loaded.</p>
        )}
      </PanelCard>
    </DashboardShell>
  );
}
