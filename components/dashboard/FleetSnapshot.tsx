"use client";

import Link from "next/link";
import { ArrowRight, Ship, Truck } from "lucide-react";
import { cn, formatNumber } from "@/lib/utils";
import { PanelCard } from "./PanelCard";

interface FleetSnapshotProps {
  trucks?: {
    total_trucks: number;
    available: number;
    in_transit: number;
    discharging: number;
  };
  vessels?: {
    total_vessels: number;
    total_rob_entries: number;
    current_rob_mt: string;
  };
}

function StatRow({
  label,
  value,
  dot,
  emphasis,
}: {
  label: string;
  value: React.ReactNode;
  dot?: string;
  emphasis?: boolean;
}) {
  return (
    <div className="flex items-center justify-between py-1.5">
      <span
        className={cn(
          "flex items-center gap-2 text-[13px]",
          emphasis ? "font-semibold text-foreground" : "text-muted-foreground"
        )}
      >
        {dot && <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", dot)} />}
        {label}
      </span>
      <span
        className={cn(
          "text-[13px] tabular-nums",
          emphasis ? "font-bold text-foreground" : "font-semibold text-foreground/80"
        )}
      >
        {value}
      </span>
    </div>
  );
}

export function FleetSnapshot({ trucks, vessels }: FleetSnapshotProps) {
  const total = trucks?.total_trucks ?? 0;
  const available = trucks?.available ?? 0;
  const inTransit = trucks?.in_transit ?? 0;
  const discharging = trucks?.discharging ?? 0;
  const readyPct = total > 0 ? Math.round((available / total) * 100) : 0;

  return (
    <PanelCard
      icon={Truck}
      tone="sky"
      title="Fleet Snapshot"
      subtitle="Real-time status of trucks and vessels"
      action={
        <span className="flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300">
          <span className="relative flex h-1.5 w-1.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500" />
          </span>
          Live
        </span>
      }
      className="relative"
    >
      {/* Decorative fleet silhouettes — pure ornament, never data. */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-y-0 right-0 z-0 w-1/2 overflow-hidden rounded-r-2xl">
        <Truck className="absolute -right-6 top-24 h-32 w-32 text-sky-500/6" strokeWidth={1} />
        <Ship className="absolute -right-8 bottom-16 h-32 w-32 text-blue-600/6" strokeWidth={1} />
      </div>

      <div className="relative">
        {/* Trucks */}
        <div className="flex items-baseline justify-between">
          <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
            Trucks
          </p>
          <p className="text-[11px] font-medium text-muted-foreground tabular-nums">
            {readyPct}% fleet ready
          </p>
        </div>

        <div
          className="mt-2 h-2 w-full overflow-hidden rounded-full bg-muted"
          role="progressbar"
          aria-valuenow={readyPct}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Trucks available"
        >
          <div
            className="brand-grad-bar h-full rounded-full transition-[width] duration-700 ease-out"
            style={{ width: `${readyPct}%` }}
          />
        </div>

        <div className="mt-2 divide-y divide-border/60">
          <StatRow label="Available" value={available} dot="bg-emerald-500" />
          <StatRow label="In Transit" value={inTransit} dot="bg-blue-500" />
          <StatRow label="Discharging" value={discharging} dot="bg-amber-500" />
          <StatRow label="Total" value={total} emphasis />
        </div>

        {/* Vessels */}
        <p className="mt-5 text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
          Vessels
        </p>
        <div className="mt-1 divide-y divide-border/60">
          <StatRow label="Total" value={vessels?.total_vessels ?? 0} dot="bg-slate-400" />
          <StatRow label="ROB Entries" value={vessels?.total_rob_entries ?? 0} dot="bg-violet-500" />
          <StatRow
            label="Current ROB"
            value={`${formatNumber(vessels?.current_rob_mt ?? 0)} MT`}
            emphasis
          />
        </div>

        <div className="mt-5 grid grid-cols-1 gap-2 sm:grid-cols-2">
          {[
            { href: "/fleet", label: "Manage Trucks" },
            { href: "/fleet/vessels", label: "Manage Vessels" },
          ].map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              className={cn(
                "group flex items-center justify-between gap-2 rounded-xl border border-slate-200/80 px-3 py-2.5",
                "text-[12.5px] font-semibold text-foreground transition-colors hover:border-primary/25 hover:bg-muted/60",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                "dark:border-border"
              )}
            >
              {label}
              <ArrowRight
                className="h-3.5 w-3.5 text-muted-foreground transition-transform group-hover:translate-x-0.5"
                strokeWidth={2.5}
              />
            </Link>
          ))}
        </div>
      </div>
    </PanelCard>
  );
}
