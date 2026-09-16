"use client";

/**
 * The operation report card, as its own page.
 *
 * The scorecard itself lives in `OperationScorecardPanel`, shared with the KPI
 * tab inside the operation detail page. This file is only the frame: the
 * header, the back link, and the permission gate.
 *
 * The separate route exists because it is reachable for every operation type
 * and every role that can see the operation, whereas the KPI tab inside the
 * detail page is gated to the Bunker Manager on non-truck operations.
 */

import { use } from "react";
import Link from "next/link";
import { Gauge, ArrowLeft } from "lucide-react";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { OperationScorecardPanel } from "@/components/operations/OperationScorecardPanel";

export default function OperationScorecardPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);

  return (
    <DashboardShell
      icon={Gauge}
      iconTone="blue"
      showRole={false}
      title="Operation report card"
      subtitle="Performance for this operation"
      actions={
        <Link
          href={`/operations/${id}`}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to operation
        </Link>
      }
    >
      <OperationScorecardPanel operationId={id} />
    </DashboardShell>
  );
}
