"use client";

/**
 * Delivery performance, shown to the client (KPI Phase 5).
 *
 * Clients are never scored. They are shown proof of service: what was
 * ordered, what arrived, and how closely the two matched. Variance is the
 * number every bunkering customer quietly suspects, so publishing it
 * unprompted is the point of the page rather than a side effect.
 *
 * Same house rule as everywhere else: an absent figure renders blank, never a
 * dash or a zero.
 */

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { ShieldCheck, Ship, FileText } from "lucide-react";
import { api } from "@/lib/api";
import { PanelCard } from "@/components/dashboard/PanelCard";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { ApiResponse } from "@/types";

interface DeliveryRow {
  operation_id: string;
  operation_number: string;
  status?: string | null;
  completed_at?: string | null;
  receiving_vessel?: string | null;
  product_type?: string | null;
  quantity_delivered?: number | null;
  variance_pct?: number | null;
  bdn_number?: string | null;
  bdn_approved: boolean;
}

interface DeliveryPerformance {
  operations_total: number;
  operations_completed: number;
  deliveries_documented: number;
  average_variance_pct?: number | null;
  unit_label: string;
  rows: DeliveryRow[];
}

function num(v: number | null | undefined, dp = 0): string {
  if (v === null || v === undefined || Number.isNaN(v)) return "";
  return v.toLocaleString(undefined, {
    minimumFractionDigits: dp,
    maximumFractionDigits: dp,
  });
}

export default function DeliveryPerformancePage() {
  const { data, isLoading } = useQuery({
    queryKey: ["portal-delivery-performance"],
    queryFn: async () => {
      const res = await api.get<ApiResponse<DeliveryPerformance>>(
        "/kpi/portal/delivery-performance"
      );
      return res.data.data;
    },
  });

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-28 rounded-2xl" />
        <Skeleton className="h-80 rounded-2xl" />
      </div>
    );
  }

  const d = data;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Delivery performance</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          What we delivered against what was measured on arrival, on every
          operation we have run for you.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <div className="rounded-2xl border bg-card p-4">
          <p className="text-xs text-muted-foreground">Operations</p>
          <p className="mt-1 font-mono text-2xl tabular-nums">{num(d?.operations_total)}</p>
        </div>
        <div className="rounded-2xl border bg-card p-4">
          <p className="text-xs text-muted-foreground">Completed</p>
          <p className="mt-1 font-mono text-2xl tabular-nums">{num(d?.operations_completed)}</p>
        </div>
        <div className="rounded-2xl border bg-card p-4">
          <p className="text-xs text-muted-foreground">Documented deliveries</p>
          <p className="mt-1 font-mono text-2xl tabular-nums">{num(d?.deliveries_documented)}</p>
        </div>
        <div className="rounded-2xl border bg-card p-4">
          <p className="text-xs text-muted-foreground">Average variance</p>
          <p
            className={cn(
              "mt-1 font-mono text-2xl tabular-nums",
              (d?.average_variance_pct ?? 0) > 1 ? "text-amber-600" : "text-emerald-600"
            )}
          >
            {num(d?.average_variance_pct, 2)}
            {d?.average_variance_pct != null && "%"}
          </p>
        </div>
      </div>

      <PanelCard icon={Ship} tone="sky" title="Every delivery on record" flush>
        {!d || d.rows.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted-foreground">
            No delivery notes have been issued yet. They appear here as soon as
            each one is approved.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="px-4 py-2 font-medium">Operation</th>
                  <th className="px-4 py-2 font-medium">Receiving vessel</th>
                  <th className="px-4 py-2 font-medium">Product</th>
                  <th className="px-4 py-2 text-right font-medium">Delivered</th>
                  <th className="px-4 py-2 text-right font-medium">Variance</th>
                  <th className="px-4 py-2 font-medium">Delivery note</th>
                </tr>
              </thead>
              <tbody>
                {d.rows.map((r, i) => (
                  <tr key={`${r.operation_id}-${r.bdn_number}-${i}`} className="border-b last:border-0">
                    <td className="px-4 py-2.5">
                      <Link
                        href={`/portal/operations/${r.operation_id}`}
                        className="font-mono text-xs hover:underline"
                      >
                        {r.operation_number}
                      </Link>
                    </td>
                    <td className="px-4 py-2.5">{r.receiving_vessel ?? ""}</td>
                    <td className="px-4 py-2.5">{r.product_type ?? ""}</td>
                    <td className="px-4 py-2.5 text-right font-mono tabular-nums">
                      {num(r.quantity_delivered)}
                    </td>
                    <td
                      className={cn(
                        "px-4 py-2.5 text-right font-mono tabular-nums",
                        (r.variance_pct ?? 0) > 1 ? "text-amber-600" : ""
                      )}
                    >
                      {num(r.variance_pct, 2)}
                      {r.variance_pct != null && "%"}
                    </td>
                    <td className="px-4 py-2.5">
                      <span className="flex items-center gap-2">
                        <FileText className="h-3.5 w-3.5 text-muted-foreground" />
                        <span className="font-mono text-xs">{r.bdn_number ?? ""}</span>
                        {r.bdn_approved && (
                          <Badge variant="secondary" className="gap-1 text-[10px]">
                            <ShieldCheck className="h-3 w-3" />
                            Approved
                          </Badge>
                        )}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </PanelCard>

      <p className="text-center text-xs text-muted-foreground">
        Figures are taken directly from the signed Bunker Delivery Notes for
        each operation.
      </p>
    </div>
  );
}
