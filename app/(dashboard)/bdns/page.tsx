"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { FileText, ExternalLink } from "lucide-react";
import { api } from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { PanelCard } from "@/components/dashboard/PanelCard";
import { QueryError } from "@/components/shared/QueryError";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn, formatDate } from "@/lib/utils";

/** One row of the global register — mirrors BdnOut. */
interface BdnRow {
  id: string;
  bdn_number: string;
  operation_id: string;
  operation_number?: string;
  operation_type?: string;
  operation_status?: string;
  status: "pending" | "approved" | "rejected";
  vessel_name?: string;
  generated_by_name?: string;
  company_name?: string;
  receiving_vessel?: string;
  vessel_activity_id?: string;
  product_type?: string;
  quantity_delivered_mt?: string;
  discharge_gov?: string;
  discharge_gsv?: string;
  discharge_mt_vacuum?: string;
  density?: string;
  temperature?: string;
  vcf?: string;
  delivery_date: string;
  created_at: string;
}

const STATUS_TONE: Record<string, string> = {
  approved: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300",
  pending: "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300",
  rejected: "bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300",
};

/** Vessel side is MT(vac); litres belong to trucks only. Blank when absent —
 *  never a dash, matching the on-screen readouts. */
const num = (v?: string | null, dp = 2): string => {
  if (!v) return "";
  const n = parseFloat(v);
  return Number.isFinite(n)
    ? n.toLocaleString(undefined, { minimumFractionDigits: dp, maximumFractionDigits: dp })
    : "";
};

export default function BdnRegisterPage() {
  const { user, effectiveRole } = useAuth();
  const isBM = (effectiveRole ?? user?.role) === "bunker_manager";
  const [page, setPage] = useState(1);
  const perPage = 25;

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["bdn-register", page],
    queryFn: async () => {
      const res = await api.get<{ items: BdnRow[]; total: number }>("/bdns", {
        params: { page, per_page: perPage },
      });
      return res.data;
    },
    enabled: isBM,
  });

  const rows = data?.items ?? [];
  const total = data?.total ?? 0;
  const lastPage = Math.max(1, Math.ceil(total / perPage));

  if (user && !isBM) {
    return (
      <DashboardShell icon={FileText} iconTone="blue" showRole={false} title="BDNs" subtitle="Restricted">
        <QueryError error={{ isAxiosError: true, response: { status: 403 } }} />
      </DashboardShell>
    );
  }

  return (
    <DashboardShell
      icon={FileText}
      iconTone="blue"
      showRole={false}
      title="Bunker Delivery Notes"
      subtitle={total ? `Every BDN across all operations · ${total} recorded` : "Every BDN across all operations"}
    >
      {isError ? (
        <QueryError error={error} onRetry={() => refetch()} />
      ) : isLoading ? (
        <Skeleton className="h-96 w-full rounded-2xl" />
      ) : (
        <PanelCard icon={FileText} tone="blue" title="Register" flush className="animate-rise">
          {rows.length ? (
            <div className="divide-y divide-border/70">
              {rows.map((b) => {
                // Both kinds share the bdns table — a Vessel Received Quantity
                // carries a vessel activity or client, a loading BDN does not.
                const isVesselRcvd = !!(b.vessel_activity_id || b.company_name);
                return (
                  <div key={b.id} className="px-4 py-4 lg:px-5">
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                      <p className="font-mono text-[13px] font-semibold text-foreground">{b.bdn_number}</p>
                      <Badge className={cn("rounded-md text-[11px]", STATUS_TONE[b.status])}>
                        {b.status}
                      </Badge>
                      <span className="rounded-md bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                        {isVesselRcvd ? "Vessel Received Quantity" : "Loading BDN"}
                      </span>
                      <span className="ml-auto text-[11px] text-muted-foreground">
                        {formatDate(b.delivery_date)}
                      </span>
                    </div>

                    <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-muted-foreground">
                      {b.operation_number && (
                        <Link
                          href={`/operations/${b.operation_id}`}
                          className="inline-flex items-center gap-1 font-medium text-primary hover:underline"
                        >
                          {b.operation_number}
                          <ExternalLink className="h-3 w-3" />
                        </Link>
                      )}
                      {b.operation_status && <span>{b.operation_status.replace(/_/g, " ")}</span>}
                      {b.vessel_name && <span>{b.vessel_name}</span>}
                      {b.product_type && <span>{b.product_type}</span>}
                      {b.company_name && <span>{b.company_name}</span>}
                      {b.receiving_vessel && <span>to {b.receiving_vessel}</span>}
                      {b.generated_by_name && <span>by {b.generated_by_name}</span>}
                    </div>

                    {/* GOV / GSV / MT(vac) plus the quality readings — the same
                        figures of record the operation page shows. */}
                    <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 rounded-lg bg-muted/40 px-3 py-2 text-[11px] sm:grid-cols-3 lg:grid-cols-6">
                      {([
                        ["GOV", num(b.discharge_gov)],
                        ["GSV", num(b.discharge_gsv)],
                        ["MT(vac)", num(b.discharge_mt_vacuum ?? b.quantity_delivered_mt, 3)],
                        ["Density", num(b.density, 4)],
                        ["Temp", b.temperature ? `${parseFloat(b.temperature).toFixed(1)}°` : ""],
                        ["VCF", num(b.vcf, 4)],
                      ] as [string, string][]).map(([label, value]) => (
                        <div key={label}>
                          <p className="text-[9px] uppercase tracking-wide text-muted-foreground">{label}</p>
                          <p className="min-h-[1rem] font-mono font-semibold text-foreground">{value}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="flex flex-col items-center py-16 text-center">
              <FileText className="h-9 w-9 text-muted-foreground/25" strokeWidth={1.5} />
              <p className="mt-3 text-sm font-medium text-foreground">No BDNs yet</p>
            </div>
          )}
        </PanelCard>
      )}

      {lastPage > 1 && (
        <div className="mt-4 flex items-center justify-center gap-3">
          <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
            Previous
          </Button>
          <span className="text-[12px] text-muted-foreground">Page {page} of {lastPage}</span>
          <Button variant="outline" size="sm" disabled={page >= lastPage} onClick={() => setPage((p) => p + 1)}>
            Next
          </Button>
        </div>
      )}
    </DashboardShell>
  );
}
