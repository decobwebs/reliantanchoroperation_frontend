"use client";

import { Loader2 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { BunkerManagerDashboard } from "./_dashboards/BunkerManagerDashboard";
import { OpsSupervisorDashboard } from "./_dashboards/OpsSupervisorDashboard";
import { LogisticsOfficerDashboard } from "./_dashboards/LogisticsOfficerDashboard";
import { MarineManagerDashboard } from "./_dashboards/MarineManagerDashboard";
import { FinanceManagerDashboard } from "./_dashboards/FinanceManagerDashboard";

export default function DashboardPage() {
  const { user, loading } = useAuth();

  if (loading || !user) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  switch (user.role) {
    case "bunker_manager":
      return <BunkerManagerDashboard />;
    case "ops_supervisor":
      return <OpsSupervisorDashboard />;
    case "logistics_officer":
      return <LogisticsOfficerDashboard />;
    case "marine_manager":
      return <MarineManagerDashboard />;
    case "finance_manager":
      return <FinanceManagerDashboard />;
    default:
      return (
        <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
          No dashboard configured for your role.
        </div>
      );
  }
}
