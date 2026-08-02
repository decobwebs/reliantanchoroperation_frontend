"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  PlusCircle,
  Anchor,
  AlertTriangle,
  Upload,
} from "lucide-react";
import { api } from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { PanelCard } from "@/components/dashboard/PanelCard";
import { AccordionRow } from "@/components/shared/AccordionRow";
import { CreateNavalClearanceDialog } from "@/components/operations/CreateNavalClearanceDialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDate } from "@/lib/utils";
import type { ApiResponse, NavalClearance } from "@/types";

export default function NavalClearancesPage() {
  const { effectiveRole } = useAuth();
  const canAdd = effectiveRole === "cargo_superintendent" || effectiveRole === "bunker_manager" || effectiveRole === "marine_operator";
  const canView = canAdd;

  const { data: clearances, isLoading } = useQuery({
    queryKey: ["naval-clearances"],
    queryFn: async () => {
      const res = await api.get<ApiResponse<NavalClearance[]>>("/naval-clearances");
      return res.data.data ?? [];
    },
    enabled: canView,
  });

  const [showCreate, setShowCreate] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);

  return (
    <DashboardShell
      icon={Anchor}
      iconTone="blue"
      showRole={false}
      title="Naval Clearances"
      subtitle="The level an operation actually connects to — draws down from one or more BFLs"
      actions={canAdd ? (
        <Button
          className="h-10.5 gap-2 rounded-xl px-4 text-[13px] font-semibold"
          onClick={() => setShowCreate(true)}
        >
          <PlusCircle className="h-4 w-4" strokeWidth={2.5} />
          New Naval Clearance
        </Button>
      ) : undefined}
    >
      {isLoading ? (
        <Skeleton className="h-80 w-full rounded-2xl" />
      ) : (
        <PanelCard icon={Anchor} tone="blue" title="Registry" flush className="animate-rise">
          {clearances?.length ? (
            <div className="divide-y divide-border/70">
              {clearances.map((nc) => (
                <AccordionRow
                  key={nc.id}
                  open={expanded === nc.id}
                  onToggle={() => setExpanded(expanded === nc.id ? null : nc.id)}
                  summary={
                    <>
                      <div className="flex min-w-0 items-center gap-2">
                        <span className="font-mono text-[13px] font-semibold text-foreground">{nc.clearance_number}</span>
                        {!nc.is_valid && (
                          <Badge variant="outline" className="gap-1 rounded-md border-amber-300 bg-amber-50 text-[10px] text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/15 dark:text-amber-300">
                            <AlertTriangle className="h-3 w-3" />Expired
                          </Badge>
                        )}
                      </div>
                      <p className="text-[12px] text-muted-foreground">
                        {nc.products.join(", ")} · <span className="tabular-nums">{parseFloat(nc.total_quantity_litres).toLocaleString()} L</span> · {nc.vessels.length} vessel(s)
                      </p>
                    </>
                  }
                >
                  <div className="grid grid-cols-1 gap-3 text-[12.5px] sm:grid-cols-3">
                    <div><span className="text-muted-foreground">PPDL:</span> <span className="text-foreground">{nc.ppdl_number ?? "—"}</span></div>
                    <div><span className="text-muted-foreground">Loading Date:</span> <span className="text-foreground">{formatDate(nc.date_of_loading)}</span></div>
                    <div><span className="text-muted-foreground">Expiry:</span> <span className="text-foreground">{formatDate(nc.expiry_date)}</span></div>
                  </div>

                  <div>
                    <p className="mb-1.5 text-[10.5px] font-semibold uppercase tracking-wide text-muted-foreground">BFL Drawdowns</p>
                    <div className="space-y-1">
                      {nc.drawdowns.map((d) => (
                        <div key={d.id} className="flex justify-between rounded-lg border border-navy-100 bg-card px-3 py-1.5 text-[12px] dark:border-border">
                          <span className="font-mono text-foreground">{d.bfl_number}</span>
                          <span className="text-muted-foreground">{d.product_type} · <span className="tabular-nums">{parseFloat(d.quantity_litres).toLocaleString()} L</span></span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div>
                    <p className="mb-1.5 text-[10.5px] font-semibold uppercase tracking-wide text-muted-foreground">Loading Locations</p>
                    <div className="flex flex-wrap gap-1.5">
                      {nc.loading_locations.map((l) => (
                        <Badge key={l.id} variant="outline" className="rounded-md text-[10px]">{l.location}</Badge>
                      ))}
                    </div>
                  </div>

                  <div>
                    <p className="mb-1.5 text-[10.5px] font-semibold uppercase tracking-wide text-muted-foreground">Clients &amp; Vessels</p>
                    <div className="space-y-1">
                      {nc.vessels.map((v) => (
                        <div key={v.id} className="flex justify-between rounded-lg border border-navy-100 bg-card px-3 py-1.5 text-[12px] dark:border-border">
                          <span className="text-muted-foreground">{v.client_name ?? "—"} ({v.client_email ?? "—"})</span>
                          <span className="font-medium text-foreground">{v.vessel_name}{v.imo_number ? ` · IMO ${v.imo_number}` : ""}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {nc.document_url && (
                    <a
                      href={nc.document_url} target="_blank" rel="noreferrer"
                      className="inline-flex items-center gap-1.5 rounded text-[12px] font-semibold text-brand-600 underline underline-offset-2 hover:text-brand-700"
                    >
                      <Upload className="h-3 w-3" />View uploaded document
                    </a>
                  )}
                </AccordionRow>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center py-12 text-center">
              <Anchor className="h-8 w-8 text-muted-foreground/25" strokeWidth={1.5} />
              <p className="mt-2.5 text-sm font-medium text-foreground">No Naval Clearances yet</p>
            </div>
          )}
        </PanelCard>
      )}

      <CreateNavalClearanceDialog open={showCreate} onOpenChange={setShowCreate} />
    </DashboardShell>
  );
}
