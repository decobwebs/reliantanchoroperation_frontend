"use client";

import { ClipboardCheck } from "lucide-react";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { InspectionsPanel } from "@/components/safety/InspectionsPanel";

export default function InspectionsPage() {
  return (
    <DashboardShell
      icon={ClipboardCheck}
      iconTone="blue"
      showRole={false}
      title="Inspections"
      subtitle="Inspections and compliance checks, what was found, and the fixes still open"
    >
      <InspectionsPanel />
    </DashboardShell>
  );
}
