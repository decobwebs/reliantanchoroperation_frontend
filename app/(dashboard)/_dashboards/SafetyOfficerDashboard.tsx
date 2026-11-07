"use client";

import Link from "next/link";
import { ClipboardCheck } from "lucide-react";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { SafetyOverviewPanel } from "@/components/safety/SafetyOverviewPanel";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";

export function SafetyOfficerDashboard() {
  const { user } = useAuth();

  return (
    <DashboardShell
      eyebrow={<>Welcome, {user?.full_name?.split(" ")[0] ?? "there"}</>}
      title="Safety Dashboard"
      subtitle="What needs your attention across the fleet"
      actions={
        <Button asChild size="sm">
          <Link href="/safety/inspections">
            <ClipboardCheck className="mr-1.5 h-4 w-4" />
            Inspections
          </Link>
        </Button>
      }
    >
      <SafetyOverviewPanel />
    </DashboardShell>
  );
}
