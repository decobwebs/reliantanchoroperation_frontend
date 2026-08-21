"use client";

import { useQuery } from "@tanstack/react-query";
import {
  Anchor,
  BadgeCheck,
  CalendarClock,
  ClipboardCheck,
  FileBadge2,
  Link2,
} from "lucide-react";
import { api } from "@/lib/api";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { AlertPanel, AlertRow } from "@/components/dashboard/AlertPanel";
import { KpiCard } from "@/components/dashboard/KpiCard";
import { PanelCard } from "@/components/dashboard/PanelCard";
import { QuickActionTile } from "@/components/dashboard/QuickActionTile";
import { useAuth } from "@/hooks/useAuth";
import { formatDate } from "@/lib/utils";
import type { ApiResponse, Bfl, NavalClearance, TruckWaiver } from "@/types";

const EXPIRY_WINDOW_DAYS = 14;

function daysUntil(dateStr: string): number {
  return Math.ceil((new Date(dateStr).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
}

export function MarineOperatorDashboard() {
  const { user } = useAuth();

  const { data: waivers } = useQuery({
    queryKey: ["truck-waivers"],
    queryFn: async () => {
      const res = await api.get<ApiResponse<TruckWaiver[]>>("/trucks/waivers");
      return res.data.data ?? [];
    },
  });

  const { data: bfls } = useQuery({
    queryKey: ["bfls"],
    queryFn: async () => {
      const res = await api.get<ApiResponse<Bfl[]>>("/bfls");
      return res.data.data ?? [];
    },
  });

  const { data: clearances } = useQuery({
    queryKey: ["naval-clearances"],
    queryFn: async () => {
      const res = await api.get<ApiResponse<NavalClearance[]>>("/naval-clearances");
      return res.data.data ?? [];
    },
  });

  const availableWaivers = waivers?.filter((w) => w.status === "available").length ?? 0;
  const linkedWaivers = waivers?.filter((w) => w.status === "linked").length ?? 0;
  const activeBfls = bfls?.filter((b) => b.is_active) ?? [];
  const validClearances = clearances?.filter((c) => c.is_valid) ?? [];

  // Anything active/valid but running out inside the window gets surfaced.
  const expiringBfls = activeBfls.filter((b) => {
    const d = daysUntil(b.expiry_date);
    return d >= 0 && d <= EXPIRY_WINDOW_DAYS;
  });
  const expiringClearances = validClearances.filter((c) => {
    const d = daysUntil(c.expiry_date);
    return d >= 0 && d <= EXPIRY_WINDOW_DAYS;
  });
  const expiringCount = expiringBfls.length + expiringClearances.length;

  return (
    <DashboardShell
      eyebrow={
        <>
          Welcome back, {user?.full_name?.split(" ")[0] ?? "there"}{" "}
          <span aria-hidden="true">👋</span>
        </>
      }
      title="Marine Operations Dashboard"
      subtitle="Licences, clearances, and truck waivers at a glance"
    >
      <section
        className="animate-rise grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4"
        aria-label="Compliance metrics"
      >
        <KpiCard
          tone="navy"
          icon={BadgeCheck}
          title="Available Waivers"
          value={availableWaivers}
          caption="Ready to link"
          note={`${(waivers?.length ?? 0)} total in register`}
          noteTrend="flat"
        />
        <KpiCard
          tone="emerald"
          icon={Link2}
          title="Linked Waivers"
          value={linkedWaivers}
          caption="In use on operations"
          note={
            waivers?.length
              ? `${Math.round((linkedWaivers / waivers.length) * 100)}% of register`
              : "No waivers yet"
          }
          noteTrend="flat"
        />
        <KpiCard
          tone="amber"
          icon={FileBadge2}
          title="Active BFLs"
          value={activeBfls.length}
          caption="Bulk fuel licences"
          note={
            expiringBfls.length
              ? `${expiringBfls.length} expiring within ${EXPIRY_WINDOW_DAYS} days`
              : "None expiring soon"
          }
          noteTrend="flat"
        />
        <KpiCard
          tone="violet"
          icon={Anchor}
          title="Valid Clearances"
          value={validClearances.length}
          caption="Naval clearances"
          note={
            expiringClearances.length
              ? `${expiringClearances.length} expiring within ${EXPIRY_WINDOW_DAYS} days`
              : "None expiring soon"
          }
          noteTrend="flat"
        />
      </section>

      {expiringCount > 0 && (
        <AlertPanel
          icon={CalendarClock}
          tone="amber"
          title={`Expiring Within ${EXPIRY_WINDOW_DAYS} Days (${expiringCount})`}
        >
          {expiringBfls.map((b) => (
            <AlertRow
              key={b.id}
              mono
              primary={`BFL ${b.bfl_number}`}
              secondary={`${b.product_type} · expires ${formatDate(b.expiry_date)}`}
            />
          ))}
          {expiringClearances.map((c) => (
            <AlertRow
              key={c.id}
              mono
              primary={`NC ${c.clearance_number}`}
              secondary={`expires ${formatDate(c.expiry_date)}`}
            />
          ))}
        </AlertPanel>
      )}

      <PanelCard
        icon={ClipboardCheck}
        tone="sky"
        title="Your Workspaces"
        subtitle="Jump straight to the registers you manage"
        className="animate-rise"
      >
        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
          <QuickActionTile
            href="/fleet/waivers"
            icon={BadgeCheck}
            tone="emerald"
            label="Truck Waivers"
            description="Add waiver numbers and track their links"
          />
          <QuickActionTile
            href="/licences/naval-clearances"
            icon={Anchor}
            tone="sky"
            label="Naval Clearances"
            description="Clearances, vessels, loading locations, ETAs"
          />
          <QuickActionTile
            href="/licences/bfl"
            icon={FileBadge2}
            tone="amber"
            label="BFL Register"
            description="Bulk fuel licences and remaining volumes"
          />
          <QuickActionTile
            href="/licences/ppdl"
            icon={FileBadge2}
            tone="violet"
            label="PPDL Register"
            description="Depot licences and product entries"
          />
        </div>
      </PanelCard>
    </DashboardShell>
  );
}
