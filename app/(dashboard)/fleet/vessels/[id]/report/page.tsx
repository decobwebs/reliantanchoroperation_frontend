"use client";

import { Suspense, use, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, FileText, Printer } from "lucide-react";
import { api } from "@/lib/api";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { QueryError } from "@/components/shared/QueryError";
import { VesselReportDocument, defaultReportRange } from "@/components/vessels/VesselReportDocument";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import type { ApiResponse, VesselReport } from "@/types";

function ReportView({ id }: { id: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const fallback = defaultReportRange();
  const from = params.get("from") || fallback.from;
  const to = params.get("to") || fallback.to;
  const [draftFrom, setDraftFrom] = useState(from);
  const [draftTo, setDraftTo] = useState(to);

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["vessel-report", id, from, to],
    refetchOnWindowFocus: false,
    queryFn: async () => {
      const res = await api.get<ApiResponse<VesselReport>>(
        `/vessels/${id}/report?date_from=${from}&date_to=${to}`
      );
      return res.data.data;
    },
  });

  const shell = {
    icon: FileText,
    iconTone: "blue" as const,
    showRole: false,
    title: data ? `Vessel report — ${data.vessel.vessel_name}` : "Vessel report",
    actions: (
      <Link
        href={`/fleet/vessels/${id}`}
        className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground print:hidden"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to vessel
      </Link>
    ),
  };

  return (
    <DashboardShell {...shell}>
      {/* Hide everything except the document itself when printing. */}
      <style>{`
        @media print {
          nav, aside, header, .print\\:hidden { display: none !important; }
          body { background: #fff !important; }
          @page { size: A4 landscape; margin: 12mm; }
        }
      `}</style>

      <div className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4 sm:flex-row sm:items-end print:hidden">
        <div className="space-y-1">
          <Label htmlFor="rep-from" className="text-xs text-muted-foreground">From</Label>
          <Input id="rep-from" type="date" value={draftFrom} max={draftTo} onChange={(e) => setDraftFrom(e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label htmlFor="rep-to" className="text-xs text-muted-foreground">To</Label>
          <Input id="rep-to" type="date" value={draftTo} min={draftFrom} onChange={(e) => setDraftTo(e.target.value)} />
        </div>
        <Button
          variant="outline"
          disabled={!draftFrom || !draftTo || (draftFrom === from && draftTo === to)}
          onClick={() => router.replace(`${pathname}?from=${draftFrom}&to=${draftTo}`)}
        >
          Show this period
        </Button>
        <Button onClick={() => window.print()} disabled={!data} className="sm:ml-auto">
          <Printer className="mr-1.5 h-4 w-4" />
          Print or save as PDF
        </Button>
      </div>

      {isError ? (
        <QueryError error={error} onRetry={() => refetch()} />
      ) : isLoading || !data ? (
        <>
          <Skeleton className="h-40 rounded-2xl" />
          <Skeleton className="h-64 rounded-2xl" />
        </>
      ) : (
        <VesselReportDocument report={data} />
      )}
    </DashboardShell>
  );
}

export default function VesselReportPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return (
    <Suspense fallback={<Skeleton className="h-40 rounded-2xl" />}>
      <ReportView id={id} />
    </Suspense>
  );
}
