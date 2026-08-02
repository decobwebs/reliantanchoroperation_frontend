"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { PlusCircle, Anchor, Trash2, Fuel } from "lucide-react";
import { Spinner } from "@/components/ui/spinner";
import { toast } from "sonner";
import { api, getErrorMessage } from "@/lib/api";
import { useDynamicRows, DynamicRowCard } from "@/components/shared/DynamicRows";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { PRODUCT_TYPE_LABELS, type ApiResponse, type Bfl, type NavalClearance } from "@/types";

const PRODUCT_TYPES = Object.keys(PRODUCT_TYPE_LABELS);

interface ClientOption { id: string; full_name: string; email: string }

type DrawdownRow = { bfl_id: string; quantity_litres: string };
const emptyDrawdown = (): DrawdownRow => ({ bfl_id: "", quantity_litres: "" });

type VesselRow = { client_id: string; vessel_name: string; imo_number: string };
const emptyVessel = (): VesselRow => ({ client_id: "", vessel_name: "", imo_number: "" });

/**
 * The Naval Clearance create form — shared between the Licences page and the
 * operation detail page's "Link BFL / Naval Clearance" More Actions shortcut
 * (31 Jul 2026 decision: that shortcut wraps this exact existing creation
 * flow, it doesn't invent a second one). `onCreated` lets the caller decide
 * what happens next — the Licences page just refetches its list; the
 * operation page auto-links the new clearance to the current operation.
 *
 * Includes a quick "+ New BFL" affordance per drawdown row, since BFL
 * creation needs no PPDL selection (the backend auto-resolves the current
 * PPDL by product type) — cheap enough to fold into this same dialog rather
 * than sending the BM away mid-flow if the right BFL doesn't exist yet.
 */
export function CreateNavalClearanceDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated?: (nc: NavalClearance) => void;
}) {
  const qc = useQueryClient();

  const { data: activeBfls } = useQuery({
    queryKey: ["bfls-active"],
    queryFn: async () => {
      const res = await api.get<ApiResponse<Bfl[]>>("/bfls/active");
      return res.data.data ?? [];
    },
    enabled: open,
  });
  const { data: clients } = useQuery({
    queryKey: ["admin-clients"],
    queryFn: async () => {
      const res = await api.get<ApiResponse<ClientOption[]>>("/admin/clients");
      return res.data.data ?? [];
    },
    enabled: open,
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
      const res = await api.post<ApiResponse<NavalClearance>>("/naval-clearances", {
        clearance_number: number.trim(),
        date_of_loading: dateOfLoading,
        expiry_date: expiryDate,
        loading_locations: locations.filter((l) => l.trim()),
        drawdowns: drawdownRows.rows.map((d) => ({ bfl_id: d.bfl_id, quantity_litres: parseFloat(d.quantity_litres) })),
        vessels: vesselRows.rows.map((v) => ({ client_id: v.client_id, vessel_name: v.vessel_name.trim(), imo_number: v.imo_number.trim() || undefined })),
      });
      return res.data.data;
    },
    onSuccess: (nc) => {
      toast.success("Naval Clearance created");
      onOpenChange(false);
      resetCreate();
      qc.invalidateQueries({ queryKey: ["naval-clearances"] });
      onCreated?.(nc);
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  // ── Quick "+ New BFL" for a drawdown row ──
  const [quickBflRow, setQuickBflRow] = useState<number | null>(null);
  const [qNumber, setQNumber] = useState("");
  const [qProductType, setQProductType] = useState("");
  const [qQuantity, setQQuantity] = useState("");
  const [qVessel, setQVessel] = useState("");
  const [qExpiry, setQExpiry] = useState("");

  const resetQuickBfl = () => {
    setQuickBflRow(null); setQNumber(""); setQProductType("");
    setQQuantity(""); setQVessel(""); setQExpiry("");
  };
  const quickBflValid = qNumber.trim() && qProductType && parseFloat(qQuantity) > 0 && qExpiry;

  const quickBflMutation = useMutation({
    mutationFn: async () => {
      const res = await api.post<ApiResponse<Bfl>>("/bfls", {
        bfl_number: qNumber.trim(), product_type: qProductType,
        quantity_litres: parseFloat(qQuantity), vessel: qVessel.trim() || undefined,
        expiry_date: qExpiry,
      });
      return res.data.data;
    },
    onSuccess: (bfl) => {
      toast.success("BFL created");
      qc.invalidateQueries({ queryKey: ["bfls-active"] });
      qc.invalidateQueries({ queryKey: ["bfls"] });
      if (quickBflRow !== null) drawdownRows.update(quickBflRow, { bfl_id: bfl.id });
      resetQuickBfl();
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  return (
    <>
      <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) resetCreate(); }}>
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
                    <div className="flex items-center justify-between">
                      <Label className="text-[10px] text-muted-foreground">BFL</Label>
                      <button
                        type="button"
                        className="rounded text-[10px] font-semibold text-brand-600 underline underline-offset-2 hover:text-brand-700"
                        onClick={() => { setQuickBflRow(i); setQProductType(""); setQNumber(""); setQQuantity(""); setQVessel(""); setQExpiry(""); }}
                      >
                        + New BFL
                      </button>
                    </div>
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
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button disabled={!createValid || createMutation.isPending} onClick={() => createMutation.mutate()}>
              {createMutation.isPending && <Spinner size={14} className="mr-1.5" />}
              Create Naval Clearance
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Quick "+ New BFL" nested dialog ── */}
      <Dialog open={quickBflRow !== null} onOpenChange={(v) => !v && resetQuickBfl()}>
        <DialogContent className="sm:max-w-md" aria-describedby={undefined}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-[15px] font-bold tracking-tight">
              <Fuel className="h-4 w-4 text-brand-600" strokeWidth={2.2} />
              New BFL
            </DialogTitle>
          </DialogHeader>
          <div className="mt-1 space-y-3">
            <div className="space-y-1.5">
              <Label className="text-xs">BFL Number *</Label>
              <Input value={qNumber} onChange={(e) => setQNumber(e.target.value)} placeholder="From the issued document" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Product Type *</Label>
                <Select value={qProductType} onValueChange={setQProductType}>
                  <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Select…" /></SelectTrigger>
                  <SelectContent>
                    {PRODUCT_TYPES.map((pt) => <SelectItem key={pt} value={pt}>{pt}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Quantity (L) *</Label>
                <Input type="number" value={qQuantity} onChange={(e) => setQQuantity(e.target.value)} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Vessel</Label>
                <Input value={qVessel} onChange={(e) => setQVessel(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Expiry Date *</Label>
                <Input type="date" value={qExpiry} onChange={(e) => setQExpiry(e.target.value)} />
              </div>
            </div>
          </div>
          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={resetQuickBfl}>Cancel</Button>
            <Button disabled={!quickBflValid || quickBflMutation.isPending} onClick={() => quickBflMutation.mutate()}>
              {quickBflMutation.isPending && <Spinner size={14} className="mr-1.5" />}
              Create BFL
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
