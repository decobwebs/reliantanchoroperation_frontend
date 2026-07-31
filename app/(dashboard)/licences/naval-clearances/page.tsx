"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2, PlusCircle, Anchor, Trash2, AlertTriangle, Upload } from "lucide-react";
import { toast } from "sonner";
import { api, getErrorMessage } from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { PanelCard } from "@/components/dashboard/PanelCard";
import { AccordionRow } from "@/components/shared/AccordionRow";
import { useDynamicRows, DynamicRowCard } from "@/components/shared/DynamicRows";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { formatDate } from "@/lib/utils";
import type { ApiResponse, Bfl, NavalClearance } from "@/types";

interface ClientOption { id: string; full_name: string; email: string }

type DrawdownRow = { bfl_id: string; quantity_litres: string };
const emptyDrawdown = (): DrawdownRow => ({ bfl_id: "", quantity_litres: "" });

type VesselRow = { client_id: string; vessel_name: string; imo_number: string };
const emptyVessel = (): VesselRow => ({ client_id: "", vessel_name: "", imo_number: "" });

export default function NavalClearancesPage() {
  const { effectiveRole } = useAuth();
  const qc = useQueryClient();
  const canAdd = effectiveRole === "marine_manager" || effectiveRole === "bunker_manager";
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
  const { data: activeBfls } = useQuery({
    queryKey: ["bfls-active"],
    queryFn: async () => {
      const res = await api.get<ApiResponse<Bfl[]>>("/bfls/active");
      return res.data.data ?? [];
    },
    enabled: showCreate && canAdd,
  });
  const { data: clients } = useQuery({
    queryKey: ["admin-clients"],
    queryFn: async () => {
      const res = await api.get<ApiResponse<ClientOption[]>>("/admin/clients");
      return res.data.data ?? [];
    },
    enabled: showCreate && canAdd,
  });

  const [number, setNumber] = useState("");
  const [dateOfLoading, setDateOfLoading] = useState("");
  const [expiryDate, setExpiryDate] = useState("");
  const [locations, setLocations] = useState<string[]>([""]);
  const drawdownRows = useDynamicRows<DrawdownRow>(emptyDrawdown);
  const vesselRows = useDynamicRows<VesselRow>(emptyVessel);

  const resetCreate = () => {
    setNumber(""); setDateOfLoading(""); setExpiryDate("");
    setLocations([""]); drawdownRows.reset(); vesselRows.reset();
  };

  const createValid =
    number.trim() && dateOfLoading && expiryDate &&
    locations.some((l) => l.trim()) &&
    drawdownRows.rows.every((d) => d.bfl_id && parseFloat(d.quantity_litres) > 0) &&
    vesselRows.rows.every((v) => v.client_id && v.vessel_name.trim());

  const createMutation = useMutation({
    mutationFn: async () => {
      await api.post("/naval-clearances", {
        clearance_number: number.trim(),
        date_of_loading: dateOfLoading,
        expiry_date: expiryDate,
        loading_locations: locations.filter((l) => l.trim()),
        drawdowns: drawdownRows.rows.map((d) => ({ bfl_id: d.bfl_id, quantity_litres: parseFloat(d.quantity_litres) })),
        vessels: vesselRows.rows.map((v) => ({ client_id: v.client_id, vessel_name: v.vessel_name.trim(), imo_number: v.imo_number.trim() || undefined })),
      });
    },
    onSuccess: () => {
      toast.success("Naval Clearance created");
      setShowCreate(false);
      resetCreate();
      qc.invalidateQueries({ queryKey: ["naval-clearances"] });
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

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

      {/* ── Create dialog ── */}
      <Dialog open={showCreate} onOpenChange={(v) => { setShowCreate(v); if (!v) resetCreate(); }}>
        <DialogContent className="sm:max-w-2xl" aria-describedby={undefined}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-[15px] font-bold tracking-tight">
              <Anchor className="h-4 w-4 text-brand-600" strokeWidth={2.2} />New Naval Clearance
            </DialogTitle>
          </DialogHeader>
          <div className="mt-1 max-h-[70vh] space-y-4 overflow-y-auto pr-1">
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Clearance Number *</Label>
                <Input value={number} onChange={(e) => setNumber(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Date of Loading *</Label>
                <Input type="date" value={dateOfLoading} onChange={(e) => setDateOfLoading(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Expiry Date *</Label>
                <Input type="date" value={expiryDate} onChange={(e) => setExpiryDate(e.target.value)} />
              </div>
            </div>

            {/* Drawdowns */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs">BFL Drawdowns</Label>
                <Button type="button" size="sm" variant="outline" className="h-6 gap-1 rounded-md text-xs" onClick={drawdownRows.add}>
                  <PlusCircle className="h-3 w-3" />Add BFL
                </Button>
              </div>
              {drawdownRows.rows.map((d, i) => (
                <DynamicRowCard key={i} className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <Label className="text-[10px] text-muted-foreground">BFL</Label>
                    <Select value={d.bfl_id} onValueChange={(v) => drawdownRows.update(i, { bfl_id: v })}>
                      <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Select BFL…" /></SelectTrigger>
                      <SelectContent>
                        {activeBfls?.map((b) => (
                          <SelectItem key={b.id} value={b.id} className="text-xs">
                            {b.bfl_number} · {b.product_type} · {b.remaining_litres ? parseFloat(b.remaining_litres).toLocaleString() : "—"} L left
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[10px] text-muted-foreground">Quantity (L)</Label>
                    <div className="flex gap-1">
                      <Input type="number" className="h-8 text-xs" value={d.quantity_litres} onChange={(e) => drawdownRows.update(i, { quantity_litres: e.target.value })} />
                      {drawdownRows.rows.length > 1 && (
                        <Button type="button" size="icon" variant="ghost" aria-label="Remove drawdown" className="h-8 w-8 shrink-0 text-destructive" onClick={() => drawdownRows.remove(i)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>
                  </div>
                </DynamicRowCard>
              ))}
            </div>

            {/* Loading locations */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs">Loading Locations</Label>
                <Button type="button" size="sm" variant="outline" className="h-6 gap-1 rounded-md text-xs" onClick={() => setLocations((r) => [...r, ""])}>
                  <PlusCircle className="h-3 w-3" />Add Location
                </Button>
              </div>
              {locations.map((loc, i) => (
                <div key={i} className="flex gap-1">
                  <Input className="h-8 text-xs" value={loc} onChange={(e) => setLocations((rows) => rows.map((r, idx) => idx === i ? e.target.value : r))} />
                  {locations.length > 1 && (
                    <Button type="button" size="icon" variant="ghost" aria-label="Remove location" className="h-8 w-8 shrink-0 text-destructive" onClick={() => setLocations((rows) => rows.filter((_, idx) => idx !== i))}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
              ))}
            </div>

            {/* Clients + vessels */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs">Clients &amp; Vessels</Label>
                <Button type="button" size="sm" variant="outline" className="h-6 gap-1 rounded-md text-xs" onClick={vesselRows.add}>
                  <PlusCircle className="h-3 w-3" />Add Vessel
                </Button>
              </div>
              {vesselRows.rows.map((v, i) => (
                <DynamicRowCard key={i} className="grid grid-cols-3 gap-2">
                  <div className="space-y-1">
                    <Label className="text-[10px] text-muted-foreground">Client</Label>
                    <Select value={v.client_id} onValueChange={(val) => vesselRows.update(i, { client_id: val })}>
                      <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Select client…" /></SelectTrigger>
                      <SelectContent>
                        {clients?.map((c) => <SelectItem key={c.id} value={c.id} className="text-xs">{c.full_name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[10px] text-muted-foreground">Vessel Name</Label>
                    <Input className="h-8 text-xs" value={v.vessel_name} onChange={(e) => vesselRows.update(i, { vessel_name: e.target.value })} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[10px] text-muted-foreground">IMO Number</Label>
                    <div className="flex gap-1">
                      <Input className="h-8 text-xs" value={v.imo_number} onChange={(e) => vesselRows.update(i, { imo_number: e.target.value })} />
                      {vesselRows.rows.length > 1 && (
                        <Button type="button" size="icon" variant="ghost" aria-label="Remove vessel" className="h-8 w-8 shrink-0 text-destructive" onClick={() => vesselRows.remove(i)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>
                  </div>
                </DynamicRowCard>
              ))}
            </div>
          </div>
          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setShowCreate(false)}>Cancel</Button>
            <Button disabled={!createValid || createMutation.isPending} onClick={() => createMutation.mutate()}>
              {createMutation.isPending && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
              Create Naval Clearance
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardShell>
  );
}
