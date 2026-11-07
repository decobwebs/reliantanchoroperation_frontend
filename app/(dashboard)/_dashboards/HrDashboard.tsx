"use client";

/**
 * HR dashboard — every staff member's named score, read only.
 *
 * Management agreed (1 Nov 2026) that HR sees named scores but does not
 * grade or close a month; those stay with the Bunker Manager. The API enforces
 * this (PERFORMANCE_VIEWER_ROLES): HR can call the leaderboard, the company
 * trend and the HR pack, and nothing that writes.
 */

import { useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { ChevronRight, FileText, TrendingUp, Users } from "lucide-react";
import { api } from "@/lib/api";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { PanelCard } from "@/components/dashboard/PanelCard";
import { TrendStrip, type TrendPoint } from "@/components/dashboard/TrendStrip";
import { QueryError } from "@/components/shared/QueryError";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";
import type { ApiResponse } from "@/types";
import {
  num, periodLabel, ratingTone, recentPeriods, type Leaderboard,
} from "@/lib/kpi-me";

interface CompanyTrend {
  points: TrendPoint[];
  has_history: boolean;
  message?: string | null;
}

export function HrDashboard() {
  const { user } = useAuth();
  const [period, setPeriod] = useState<string>(recentPeriods(1)[0]);

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

  const trend = useQuery({
    queryKey: ["kpi-company-trend"],
    enabled: !!user,
    refetchOnWindowFocus: false,
    queryFn: async () => {
      const res = await api.get<ApiResponse<CompanyTrend>>("/kpi/trends/company?months=6");
      return res.data.data;
    },
  });

  const periodPicker = (
    <select
      value={period}
      onChange={(e) => setPeriod(e.target.value)}
      className="rounded-lg border border-border bg-background px-2 py-1 text-xs"
    >
      {recentPeriods(6).map((p) => (
        <option key={p} value={p}>
          {periodLabel(p)}
        </option>
      ))}
    </select>
  );

  const data = board.data;

  return (
    <DashboardShell
      eyebrow={<>Welcome, {user?.full_name?.split(" ")[0] ?? "there"}</>}
      title="People & Performance"
      subtitle="Every staff member's score, read only"
    >
      <PanelCard
        icon={Users}
        tone="violet"
        title={`Staff · ${periodLabel(period)}`}
        subtitle={
          data
            ? `${data.scored_count} scored · ${data.unscored_count} without enough recorded work` +
              (data.team_median != null ? ` · median ${num(data.team_median, { dp: 1 })}` : "")
            : undefined
        }
        action={periodPicker}
        flush
      >
        {board.isError ? (
          <div className="p-4">
            <QueryError error={board.error} onRetry={() => board.refetch()} />
          </div>
        ) : board.isLoading || !data ? (
          <div className="space-y-2 p-4">
            <Skeleton className="h-10 rounded-lg" />
            <Skeleton className="h-10 rounded-lg" />
            <Skeleton className="h-10 rounded-lg" />
          </div>
        ) : data.rows.length === 0 ? (
          <p className="p-4 text-sm text-muted-foreground">No active staff found.</p>
        ) : (
          <div className="divide-y divide-border/60">
            {data.provisional && (
              <p className="px-4 py-2 text-xs text-muted-foreground">
                This month is still running, so these scores will change.
              </p>
            )}
            {data.rows.map((r) => (
              <div key={r.user_id} className="flex items-center justify-between gap-3 px-4 py-2.5">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{r.full_name}</p>
                  <p className="text-xs text-muted-foreground">
                    {r.role_label}
                    {r.score == null &&
                      (r.insufficient_data
                        ? ` · only ${r.coverage.toFixed(0)}% covered`
                        : " · nothing recorded")}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <p className={cn("font-mono text-sm tabular-nums", ratingTone(r.rating))}>
                    {num(r.score, { dp: 1 })}
                  </p>
                  <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                    {r.metrics_measured}/{r.metrics_total}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </PanelCard>

      <PanelCard icon={TrendingUp} tone="blue" title="Company trend" subtitle="Median score, last 6 months">
        {trend.isLoading ? (
          <Skeleton className="h-24 rounded-lg" />
        ) : trend.data ? (
          <TrendStrip points={trend.data.points} message={trend.data.message} />
        ) : (
          <p className="py-4 text-sm text-muted-foreground">History could not be loaded.</p>
        )}
      </PanelCard>

      <Link href="/kpi-settings/hr-pack" className="block">
        <PanelCard
          icon={FileText}
          tone="emerald"
          title="HR grading pack"
          subtitle="Each person's figures and evidence for a month — print or save as PDF"
          action={<ChevronRight className="h-4 w-4 text-muted-foreground" />}
        >
          <p className="text-sm text-muted-foreground">
            Open the monthly pack. Grades are entered by the Bunker Manager.
          </p>
        </PanelCard>
      </Link>
    </DashboardShell>
  );
}
