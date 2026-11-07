"use client";

import { ShieldCheck } from "lucide-react";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { SafetyOverviewPanel } from "@/components/safety/SafetyOverviewPanel";

// The Bunker Manager's way into the safety dashboard. The Safety Officer
// lands on the same view as their Dashboard (SafetyOfficerDashboard).
export default function SafetyPage() {
  return (
    <DashboardShell
      icon={ShieldCheck}
      iconTone="amber"
      showRole={false}
      title="Safety"
      subtitle="Incidents, failed checks, truck audits, maintenance and inspections across the fleet"
    >
      <SafetyOverviewPanel />
    </DashboardShell>
  );
}
