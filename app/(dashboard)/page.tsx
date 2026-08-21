"use client";


import { useAuth } from "@/hooks/useAuth";
import { Spinner } from "@/components/ui/spinner";
import { BunkerManagerDashboard } from "./_dashboards/BunkerManagerDashboard";
import { OpsSupervisorDashboard } from "./_dashboards/OpsSupervisorDashboard";
import { LogisticsOfficerDashboard } from "./_dashboards/LogisticsOfficerDashboard";
import { MarineManagerDashboard } from "./_dashboards/MarineManagerDashboard";
import { MarineOperatorDashboard } from "./_dashboards/MarineOperatorDashboard";
import { FinanceManagerDashboard } from "./_dashboards/FinanceManagerDashboard";

export default function DashboardPage() {
  const { user, loading, effectiveRole } = useAuth();

  if (loading || !user) {
    return (
      <div className="flex items-center justify-center h-full">
        <Spinner size={32} className="text-primary" />
      </div>
    );
  }

  switch (effectiveRole) {
    case "bunker_manager":
      return <BunkerManagerDashboard />;
    case "ops_supervisor":
      return <OpsSupervisorDashboard />;
    case "logistics_officer":
      return <LogisticsOfficerDashboard />;
    case "cargo_superintendent":
      return <MarineManagerDashboard />;
    case "marine_operator":
      return <MarineOperatorDashboard />;
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
