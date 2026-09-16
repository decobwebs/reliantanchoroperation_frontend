"use client";

/**
 * The Command Center — the Bunker Manager's single screen (KPI Phase 3).
 *
 * Exception-first: what needs him leads the page, everything else supports it.
 * Three rules carried over from the backend and worth keeping in mind when
 * editing:
 *
 *  1. An absent figure renders BLANK, never a dash or a zero (`num()`).
 *  2. A panel the server could not compute says so, from `degraded` — an
 *     empty card that silently means "query failed" reads as good news.
 *  3. Vessel volume is only labelled MT(vac) when the server says the figures
 *     actually are tonnes. In production they are currently litres-scale.
 */

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import {
  Gauge, AlertTriangle, Activity, Fuel, Truck, FileBadge2,
  DollarSign, Users, ArrowDownRight, ArrowUpRight, Building2, ScanSearch,
} from "lucide-react";
import { api } from "@/lib/api";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { PanelCard } from "@/components/dashboard/PanelCard";
import { StatCard } from "@/components/shared/StatCard";
import { CapBar } from "@/components/dashboard/CapBar";
import { SectionNav, type NavSection } from "@/components/dashboard/SectionNav";
import { QueryError } from "@/components/shared/QueryError";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";
import type { ApiResponse } from "@/types";
import {
  age, deltaPct, num,
  type AttentionItem, type CommandCenter, type Severity,
} from "@/lib/kpi-command";

const SEVERITY_DOT: Record<Severity, string> = {
  critical: "bg-rose-500",
  warning: "bg-amber-500",
  info: "bg-sky-500",
};

const SEVERITY_ROW: Record<Severity, string> = {
  critical: "border-l-rose-500/70",
  warning: "border-l-amber-500/70",
  info: "border-l-sky-500/60",
};

/** Shown in place of a panel the server could not compute. */
function Unavailable({ what }: { what: string }) {
  return (
    <p className="py-6 text-center text-sm text-muted-foreground">
      {what} could not be loaded this time. The rest of the page is unaffected —
      refresh to try again.
    </p>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="py-6 text-center text-sm text-muted-foreground">{children}</p>;
}

/** Severity in words as well as colour.
 *
 * The row previously signalled urgency with a coloured dot and border and
 * nothing else. That fails twice over for this user: the Bunker Manager reads
 * this on a phone, outdoors, in Lagos sun where colour washes out — and about
 * one man in twelve cannot reliably separate red from amber anyway. A short
 * word costs almost no space and survives both.
 */
const SEVERITY_WORD: Record<Severity, string> = {
  critical: "Urgent",
  warning: "Soon",
  info: "FYI",
};

const SEVERITY_TEXT: Record<Severity, string> = {
  critical: "text-rose-600",
  warning: "text-amber-600",
  info: "text-sky-600",
};

function AttentionRow({ item }: { item: AttentionItem }) {
  const body = (
    <div
      className={cn(
        "flex items-start gap-3 border-l-2 py-2.5 pl-3 pr-2 transition-colors",
        SEVERITY_ROW[item.severity],
        item.operation_id && "hover:bg-muted/50"
      )}
    >
      <span
        className={cn("mt-1.5 h-2 w-2 shrink-0 rounded-full", SEVERITY_DOT[item.severity])}
        aria-hidden="true"
      />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium leading-snug">
          <span
            className={cn(
              "mr-1.5 text-[10px] font-bold uppercase tracking-wide",
              SEVERITY_TEXT[item.severity]
            )}
          >
            {SEVERITY_WORD[item.severity]}
          </span>
          {item.title}
        </p>
        {item.subtitle && (
          <p className="mt-0.5 truncate text-xs text-muted-foreground">{item.subtitle}</p>
        )}
      </div>
      <span className="shrink-0 font-mono text-xs tabular-nums text-muted-foreground">
        {age(item.age_hours)}
      </span>
    </div>
  );

  return item.operation_id ? (
    <Link href={`/operations/${item.operation_id}`} className="block">
      {body}
    </Link>
  ) : (
    body
  );
}

export default function CommandCenterPage() {
  const { user, effectiveRole } = useAuth();
  // Company-wide by design — money, fleet, licences and every person's work.
  // That puts it outside the operation boundary the Ops Supervisor works in.
  const canSee = user && effectiveRole ? effectiveRole === "bunker_manager" : true;

  const { data, isLoading, isError, error, refetch, isFetching } = useQuery({
    queryKey: ["kpi-command-center"],
    enabled: canSee,
    // The whole dashboard is one request and takes a few seconds against a
    // database a continent away — don't refire it on every window focus.
    refetchOnWindowFocus: false,
    staleTime: 60_000,
    queryFn: async () => {
      const res = await api.get<ApiResponse<CommandCenter>>("/kpi/command-center");
      return res.data.data;
    },
  });

  const shell = {
    icon: Gauge,
    iconTone: "blue" as const,
    showRole: false,
    title: "Command Center",
    subtitle: "What needs you, and how the business is running",
  };

  if (user && !canSee) {
    return (
      <DashboardShell {...shell} subtitle="Restricted">
        <QueryError error={{ isAxiosError: true, response: { status: 403 } }} />
      </DashboardShell>
    );
  }

  if (isError) {
    return (
      <DashboardShell {...shell}>
        <QueryError error={error} onRetry={() => refetch()} />
      </DashboardShell>
    );
  }

  if (isLoading || !data) {
    return (
      <DashboardShell {...shell}>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-32 rounded-2xl" />
          ))}
        </div>
        <Skeleton className="h-80 rounded-2xl" />
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Skeleton className="h-72 rounded-2xl" />
          <Skeleton className="h-72 rounded-2xl" />
        </div>
      </DashboardShell>
    );
  }

  const down = (panel: string) => data.degraded.includes(panel);
  const { volume, loss, money, team } = data;
  const litresDelta = deltaPct(volume.litres_trucked_this_month, volume.litres_trucked_last_month);
  const critical = data.attention.filter((a) => a.severity === "critical").length;

  const generatedAt = new Date(data.generated_at);

  // Counts come from the same data the panels render, so the menu can never
  // promise something the panel does not have.
  const sections: NavSection[] = [
    { id: "sec-attention", label: "Needs your attention", count: data.attention_total, urgent: true },
    { id: "sec-discrepancies", label: "Figures that disagree", count: data.discrepancies.length, urgent: true },
    { id: "sec-live", label: "Live operations", count: data.live_operations.length },
    { id: "sec-loss", label: "Loss watch", count: loss.worst_operations.length },
    { id: "sec-volume", label: "Volume this month", count: volume.by_product.length },
    { id: "sec-fleet", label: "Fleet league", count: data.fleet.length },
    { id: "sec-vendors", label: "Vendor league", count: data.vendors.length },
    { id: "sec-licences", label: "Licence runway", count: data.licences.length },
    { id: "sec-money", label: "Money", count: money.invoices_outstanding_count },
    { id: "sec-team", label: "Team pulse", count: team.roles.length },
  ];

  return (
    <DashboardShell {...shell}>
      <SectionNav sections={sections} />

      {/* A flex column purely so the ORDER can differ by screen size.
          On a phone the exception feed comes first: this page's whole
          premise is "you should never hunt for what is wrong", and four
          summary tiles above the fold quietly breaks that promise on the
          screen the Bunker Manager actually uses. On a wide screen the
          tiles and the feed are both visible at once, so the original
          order stands. */}
      <div className="flex flex-col gap-5">

      {/* Freshness, up top. This page is cached for a minute and takes a
          few seconds to build, so "how old is this?" is a fair question
          to ask before acting on it — and it was previously answerable
          only by scrolling to the very bottom. */}
      <div className="order-2 flex flex-wrap items-center justify-between gap-2 lg:order-1">
        <p className="text-xs text-muted-foreground">
          Figures as at{" "}
          <time dateTime={generatedAt.toISOString()} className="font-medium">
            {generatedAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
          </time>
          {isFetching && <span className="ml-2 italic">refreshing…</span>}
        </p>
        <button
          onClick={() => refetch()}
          disabled={isFetching}
          aria-label="Refresh the Command Center"
          className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground disabled:opacity-50"
        >
          {isFetching ? "Refreshing…" : "Refresh"}
        </button>
      </div>

      {/* Figures that computed but should not be read at face value. */}
      {data.data_warnings.length > 0 && (
        <div className="order-3 space-y-2 lg:order-2">
          {data.data_warnings.map((w, i) => (
            <div
              key={i}
              className="flex items-start gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3"
            >
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
              <p className="text-sm leading-snug text-amber-900 dark:text-amber-200">{w}</p>
            </div>
          ))}
        </div>
      )}

      <div className="order-4 grid grid-cols-2 gap-4 md:grid-cols-4 lg:order-3">
        <StatCard
          title="Needs you"
          value={data.attention_total}
          subtitle={critical ? `${critical} critical` : undefined}
          icon={AlertTriangle}
          color={critical ? "red" : "emerald"}
        />
        <StatCard
          title="Live operations"
          value={data.live_operations.length}
          icon={Activity}
          color="blue"
        />
        {/* These two are blank for the first days of a month, before any truck
            has been measured. The figure itself stays blank — the house rule
            is that an absent number is never a dash or a zero — but the
            subtitle then has to carry the explanation, or the card reads as
            broken rather than as "nothing has happened yet". */}
        <StatCard
          title="Avg loss per truck"
          value={num(loss.avg_litres_lost_per_truck, { unit: "L" })}
          subtitle={
            loss.trucks_measured
              ? loss.loss_cap_litres
                ? `cap ${num(loss.loss_cap_litres, { unit: "L" })} · ${loss.trucks_measured} measured`
                : `${loss.trucks_measured} measured`
              : "No trucks measured yet this month"
          }
          icon={Fuel}
          color={
            loss.avg_litres_lost_per_truck && loss.loss_cap_litres
              ? loss.avg_litres_lost_per_truck > loss.loss_cap_litres
                ? "red"
                : "emerald"
              : "blue"
          }
        />
        <StatCard
          title="Value of loss"
          value={loss.naira_lost_estimate ? `₦${num(loss.naira_lost_estimate)}` : ""}
          subtitle={
            loss.trucks_measured
              ? `${loss.trucks_over_cap} of ${loss.trucks_measured} trucks over cap`
              : "Appears once trucks are measured"
          }
          icon={Truck}
          color={loss.naira_lost_estimate ? "red" : "blue"}
        />
      </div>

      {/* ── the reason this page exists ── */}
      <PanelCard
        id="sec-attention"
        className="order-1 scroll-mt-4 lg:order-4"
        icon={AlertTriangle}
        tone={critical ? "amber" : "emerald"}
        title="Needs your attention"
        subtitle={
          data.attention_total
            ? `${data.attention_total} item${data.attention_total === 1 ? "" : "s"}, most urgent first`
            : undefined
        }
        flush
      >
        {down("attention") ? (
          <Unavailable what="The attention feed" />
        ) : data.attention.length === 0 ? (
          <Empty>Nothing is waiting on you. Every approval is cleared.</Empty>
        ) : (
          <div className="divide-y divide-border/60">
            {data.attention.map((item, i) => (
              <AttentionRow key={`${item.kind}-${item.operation_id ?? i}-${i}`} item={item} />
            ))}
          </div>
        )}
      </PanelCard>

      {/* The Data Trust Score, per document. */}
      {data.discrepancies.length > 0 && (
        <PanelCard
          id="sec-discrepancies"
          className="order-5 scroll-mt-4"
          icon={ScanSearch}
          tone="amber"
          title="Figures that disagree with the system"
          subtitle="Submitted on a Truck BDN vs what RAOMS had already recorded"
          flush
        >
          <div className="divide-y divide-border/60">
            {data.discrepancies.map((d, i) => (
              <div key={`${d.bdn_number}-${d.field}-${i}`} className="px-4 py-3">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <span className="font-mono text-sm font-medium">
                    {d.operation_id ? (
                      <Link href={`/operations/${d.operation_id}`} className="hover:underline">
                        {d.bdn_number}
                      </Link>
                    ) : (
                      d.bdn_number
                    )}
                    <span className="ml-2 text-xs font-normal text-muted-foreground">
                      {d.field}
                    </span>
                  </span>
                  <span
                    className={cn(
                      "font-mono text-sm tabular-nums",
                      (d.gap_pct ?? 0) >= 5 ? "text-rose-500" : "text-amber-600"
                    )}
                  >
                    {num(d.gap_pct, { dp: 2 })}% · {num(d.litres_gap)} L
                  </span>
                </div>
                <p className="mt-1 font-mono text-xs text-muted-foreground">
                  submitted {num(d.submitted)} vs recorded {num(d.system_recorded)}
                  {d.naira_gap ? ` · ~₦${num(d.naira_gap)}` : ""}
                  {d.submitted_by ? ` · ${d.submitted_by}` : ""}
                </p>
              </div>
            ))}
          </div>
          <p className="border-t border-border/60 px-4 py-3 text-xs leading-relaxed text-muted-foreground">
            A gap is a question, not a verdict. A re-measure, a correction made
            upstream after submission, and a genuine miscount all look the same
            here — the value is that someone gets to ask why.
          </p>
        </PanelCard>
      )}

      <div className="order-5 grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* ── live operations ── */}
        <PanelCard
          id="sec-live"
          className="scroll-mt-4"
          icon={Activity}
          tone="blue"
          title="Live operations"
          subtitle="Longest quiet first"
          flush
        >
          {down("live_operations") ? (
            <Unavailable what="Live operations" />
          ) : data.live_operations.length === 0 ? (
            <Empty>No operations are running.</Empty>
          ) : (
            <div className="divide-y divide-border/60">
              {data.live_operations.map((op) => (
                <Link
                  key={op.operation_id}
                  href={`/operations/${op.operation_id}`}
                  className="flex items-center justify-between gap-3 px-4 py-2.5 hover:bg-muted/50"
                >
                  <div className="min-w-0">
                    <p className="font-mono text-sm font-medium">{op.operation_number}</p>
                    <p className="truncate text-xs capitalize text-muted-foreground">
                      {(op.status ?? "").replace(/_/g, " ")}
                    </p>
                  </div>
                  <span
                    className={cn(
                      "shrink-0 font-mono text-xs tabular-nums",
                      (op.idle_hours ?? 0) >= 72
                        ? "text-rose-500"
                        : (op.idle_hours ?? 0) >= 24
                          ? "text-amber-600"
                          : "text-muted-foreground"
                    )}
                  >
                    {age(op.idle_hours)} quiet
                  </span>
                </Link>
              ))}
            </div>
          )}
        </PanelCard>

        {/* ── loss watch ── */}
        <PanelCard id="sec-loss" className="scroll-mt-4" icon={Fuel} tone="amber" title="Loss watch" subtitle="Worst operations this month">
          {down("loss") ? (
            <Unavailable what="Loss watch" />
          ) : (
            <div className="space-y-4">
              <div className="flex flex-wrap gap-x-8 gap-y-2 text-sm">
                <div>
                  <p className="text-xs text-muted-foreground">Truck loss</p>
                  <p className="font-mono text-lg tabular-nums">
                    {num(loss.truck_loss_pct_this_month, { dp: 2 })}
                    {loss.truck_loss_pct_this_month != null && "%"}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Trucks measured</p>
                  <p className="font-mono text-lg tabular-nums">{num(loss.trucks_measured)}</p>
                </div>
                {loss.naira_lost_estimate != null && (
                  <div>
                    <p className="text-xs text-muted-foreground">Estimated value</p>
                    <p className="font-mono text-lg tabular-nums text-rose-500">
                      ₦{num(loss.naira_lost_estimate)}
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      {num(loss.litres_lost_this_month, { unit: "L" })} at ₦
                      {num(loss.price_per_litre, { dp: 2 })}/L
                    </p>
                  </div>
                )}
              </div>
              {loss.worst_operations.length === 0 ? (
                <Empty>No truck losses recorded this month.</Empty>
              ) : (
                <div className="divide-y divide-border/60">
                  {loss.worst_operations.map((w) => (
                    <Link
                      key={w.operation_id}
                      href={`/operations/${w.operation_id}`}
                      className="flex items-center justify-between gap-3 py-2 hover:opacity-80"
                    >
                      {/* min-w-0 + truncate on the left, shrink-0 on the right:
                          at phone width the figures must stay readable, so the
                          operation number is the part allowed to give way. */}
                      <span className="min-w-0 truncate font-mono text-sm">
                        {w.operation_number}
                      </span>
                      <span className="flex shrink-0 items-baseline gap-3">
                        <span className="font-mono text-xs tabular-nums text-muted-foreground">
                          {num(w.litres_lost, { unit: "L" })}
                        </span>
                        <span className="font-mono text-sm tabular-nums text-rose-500">
                          {w.loss_pct.toFixed(2)}%
                        </span>
                      </span>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          )}
        </PanelCard>

        {/* ── volume ── */}
        <PanelCard id="sec-volume" className="scroll-mt-4" icon={Fuel} tone="sky" title="Volume this month">
          {down("volume") ? (
            <Unavailable what="Volume" />
          ) : (
            <div className="space-y-4">
              <div className="flex flex-wrap gap-x-8 gap-y-3">
                <div>
                  <p className="text-xs text-muted-foreground">Trucked</p>
                  <p className="font-mono text-2xl tabular-nums">
                    {num(volume.litres_trucked_this_month)}
                    {volume.litres_trucked_this_month != null && (
                      <span className="ml-1 text-sm text-muted-foreground">L</span>
                    )}
                  </p>
                  {litresDelta !== null && (
                    <p
                      className={cn(
                        "mt-0.5 flex items-center gap-1 text-xs",
                        litresDelta >= 0 ? "text-emerald-600" : "text-rose-500"
                      )}
                    >
                      {litresDelta >= 0 ? (
                        <ArrowUpRight className="h-3 w-3" />
                      ) : (
                        <ArrowDownRight className="h-3 w-3" />
                      )}
                      {Math.abs(litresDelta).toFixed(0)}% vs last month
                    </p>
                  )}
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">
                    Delivered to vessels{" "}
                    <span className="opacity-70">({volume.vessel_unit_label})</span>
                  </p>
                  <p className="font-mono text-2xl tabular-nums">
                    {num(volume.mt_delivered_this_month)}
                  </p>
                  {volume.vessel_figures_suspect && (
                    <p className="mt-0.5 text-xs text-amber-600">unit unconfirmed</p>
                  )}
                </div>
              </div>
              {volume.by_product.length > 0 && (
                <div className="divide-y divide-border/60 border-t border-border/60 pt-1">
                  {volume.by_product.map((p) => (
                    <div key={p.product_type} className="flex justify-between py-1.5 text-sm">
                      <span>{p.product_type}</span>
                      <span className="font-mono tabular-nums text-muted-foreground">
                        {num(p.mt_vacuum)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </PanelCard>

        {/* ── fleet league ── */}
        <PanelCard
          id="sec-fleet"
          className="scroll-mt-4"
          icon={Truck}
          tone="slate"
          title="Fleet — highest average loss"
          subtitle={
            loss.loss_cap_litres
              ? `The line marks the ${num(loss.loss_cap_litres)} L cap`
              : undefined
          }
          flush
        >
          {down("fleet") ? (
            <Unavailable what="The fleet league" />
          ) : data.fleet.length === 0 ? (
            <Empty>Not enough completed trips to rank trucks yet.</Empty>
          ) : (
            <div className="divide-y divide-border/60">
              {data.fleet.map((t) => {
                const over =
                  t.avg_litres_lost != null &&
                  loss.loss_cap_litres != null &&
                  t.avg_litres_lost > loss.loss_cap_litres;
                return (
                  <div key={t.truck_id} className="px-4 py-2.5">
                    <div className="flex items-baseline justify-between gap-3">
                      <p className="min-w-0 truncate font-mono text-sm font-medium">
                        {t.truck_number}
                      </p>
                      <span
                        className={cn(
                          "shrink-0 font-mono text-sm tabular-nums",
                          over && "font-semibold text-rose-600"
                        )}
                      >
                        {num(t.avg_litres_lost, { unit: "L" })}
                      </span>
                    </div>
                    <CapBar
                      value={t.avg_litres_lost}
                      cap={loss.loss_cap_litres}
                      className="mt-1.5"
                    />
                    <p className="mt-1 text-xs text-muted-foreground">
                      {t.trips} trips
                      {t.over_cap_trips > 0 && ` · ${t.over_cap_trips} over cap`}
                    </p>
                  </div>
                );
              })}
            </div>
          )}
        </PanelCard>

        {/* ── vendor league ── */}
        <PanelCard
          id="sec-vendors"
          className="scroll-mt-4"
          icon={Building2}
          tone="slate"
          title="Vendors — highest average loss"
          subtitle={
            loss.loss_cap_litres
              ? `The line marks the ${num(loss.loss_cap_litres)} L cap`
              : "The vendor assessment the truck operations document asks for"
          }
          flush
        >
          {down("vendors") ? (
            <Unavailable what="The vendor league" />
          ) : data.vendors.length === 0 ? (
            <Empty>Not enough completed trips to rank vendors yet.</Empty>
          ) : (
            <div className="divide-y divide-border/60">
              {data.vendors.map((v) => {
                const over =
                  v.avg_litres_lost != null &&
                  loss.loss_cap_litres != null &&
                  v.avg_litres_lost > loss.loss_cap_litres;
                return (
                  <div key={v.vendor_name} className="px-4 py-2.5">
                    <div className="flex items-baseline justify-between gap-3">
                      <p className="min-w-0 truncate text-sm font-medium">{v.vendor_name}</p>
                      <span
                        className={cn(
                          "shrink-0 font-mono text-sm tabular-nums",
                          over && "font-semibold text-rose-600"
                        )}
                      >
                        {num(v.avg_litres_lost, { unit: "L" })}
                      </span>
                    </div>
                    <CapBar
                      value={v.avg_litres_lost}
                      cap={loss.loss_cap_litres}
                      className="mt-1.5"
                    />
                    <p className="mt-1 text-xs text-muted-foreground">
                      {v.trips} trips · {v.trucks} trucks
                      {v.over_cap_pct != null && ` · ${v.over_cap_pct.toFixed(0)}% of trips over cap`}
                    </p>
                  </div>
                );
              })}
            </div>
          )}
        </PanelCard>

        {/* ── licence runway ── */}
        <PanelCard id="sec-licences" className="scroll-mt-4" icon={FileBadge2} tone="violet" title="Licence runway" subtitle="At the current drawdown rate">
          {down("licences") ? (
            <Unavailable what="Licence runway" />
          ) : data.licences.length === 0 ? (
            <Empty>No current PPDL product lines to report on.</Empty>
          ) : (
            <div className="divide-y divide-border/60">
              {data.licences.map((l) => (
                <div key={l.product_type} className="flex items-center justify-between gap-3 py-2.5">
                  <div>
                    <p className="text-sm font-medium">{l.product_type}</p>
                    <p className="font-mono text-xs text-muted-foreground">
                      {num(l.remaining_litres, { unit: "L" })} left
                    </p>
                  </div>
                  <span
                    className={cn(
                      "shrink-0 font-mono text-sm tabular-nums",
                      l.severity === "critical"
                        ? "text-rose-500"
                        : l.severity === "warning"
                          ? "text-amber-600"
                          : "text-muted-foreground"
                    )}
                  >
                    {l.days_left != null ? `${num(l.days_left)} days` : ""}
                  </span>
                </div>
              ))}
            </div>
          )}
        </PanelCard>

        {/* ── money ── */}
        <PanelCard id="sec-money" className="scroll-mt-4" icon={DollarSign} tone="emerald" title="Money">
          {down("money") ? (
            <Unavailable what="The money panel" />
          ) : (
            <div className="space-y-2 text-sm">
              <div className="flex justify-between py-1.5">
                <span className="text-muted-foreground">Collected this month</span>
                <span className="font-mono tabular-nums">
                  {num(money.collected_this_month, { dp: 2 })}
                </span>
              </div>
              <div className="flex justify-between border-t border-border/60 py-1.5">
                <span className="text-muted-foreground">
                  Outstanding invoices
                  {money.invoices_outstanding_count > 0 &&
                    ` (${money.invoices_outstanding_count})`}
                </span>
                <span className="font-mono tabular-nums">
                  {num(money.outstanding_invoices, { dp: 2 })}
                </span>
              </div>
              <div className="flex justify-between border-t border-border/60 py-1.5">
                <span className="text-muted-foreground">Vouchers awaiting approval</span>
                <span className="font-mono tabular-nums">{money.vouchers_pending}</span>
              </div>
            </div>
          )}
        </PanelCard>

        {/* ── team pulse (arrives with Phase 2) ── */}
        <PanelCard id="sec-team" className="scroll-mt-4" icon={Users} tone="blue" title="Team pulse" subtitle="Average score per role">
          {!team.available ? (
            <Empty>{team.unavailable_reason}</Empty>
          ) : team.roles.length === 0 ? (
            <Empty>No scores recorded for this period.</Empty>
          ) : (
            <div className="divide-y divide-border/60">
              {team.roles.map((r) => (
                <div key={r.role} className="flex items-center justify-between gap-3 py-2.5">
                  <span className="text-sm">{r.role_label}</span>
                  <span className="flex items-baseline gap-3">
                    <span className="text-xs text-muted-foreground">{r.rating}</span>
                    <span className="font-mono text-sm tabular-nums">{num(r.score, { dp: 1 })}</span>
                  </span>
                </div>
              ))}
            </div>
          )}
        </PanelCard>
      </div>

      <p className="order-6 pt-2 text-center font-mono text-xs text-muted-foreground">
        Generated {generatedAt.toLocaleString()}
      </p>
      </div>
    </DashboardShell>
  );
}
