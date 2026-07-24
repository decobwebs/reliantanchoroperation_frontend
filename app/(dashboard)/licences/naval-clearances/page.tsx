"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2, PlusCircle, Anchor, Trash2, ChevronDown, ChevronRight, AlertTriangle, Upload } from "lucide-react";
import { toast } from "sonner";
import { api, getErrorMessage } from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";
import { Header } from "@/components/layout/Header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
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
type VesselRow = { client_id: string; vessel_name: string; imo_number: string };

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
  const [drawdowns, setDrawdowns] = useState<DrawdownRow[]>([{ bfl_id: "", quantity_litres: "" }]);
  const [vessels, setVessels] = useState<VesselRow[]>([{ client_id: "", vessel_name: "", imo_number: "" }]);

  const resetCreate = () => {
    setNumber(""); setDateOfLoading(""); setExpiryDate("");
    setLocations([""]); setDrawdowns([{ bfl_id: "", quantity_litres: "" }]);
    setVessels([{ client_id: "", vessel_name: "", imo_number: "" }]);
  };

  const createValid =
    number.trim() && dateOfLoading && expiryDate &&
    locations.some((l) => l.trim()) &&
    drawdowns.every((d) => d.bfl_id && parseFloat(d.quantity_litres) > 0) &&
    vessels.every((v) => v.client_id && v.vessel_name.trim());

  const createMutation = useMutation({
    mutationFn: async () => {
      await api.post("/naval-clearances", {
        clearance_number: number.trim(),
        date_of_loading: dateOfLoading,
        expiry_date: expiryDate,
        loading_locations: locations.filter((l) => l.trim()),
        drawdowns: drawdowns.map((d) => ({ bfl_id: d.bfl_id, quantity_litres: parseFloat(d.quantity_litres) })),
        vessels: vessels.map((v) => ({ client_id: v.client_id, vessel_name: v.vessel_name.trim(), imo_number: v.imo_number.trim() || undefined })),
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
    <div>
      <Header
        title="Naval Clearances"
        subtitle="The level an operation actually connects to — draws down from one or more BFLs"
        actions={canAdd ? (
          <Button size="sm" onClick={() => setShowCreate(true)} className="gap-1.5">
            <PlusCircle className="w-3.5 h-3.5" />New Naval Clearance
          </Button>
        ) : undefined}
      />

      <div className="p-4 md:p-6">
        <Card className="border-0 shadow-sm">
          <CardContent className="p-0">
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-7 h-7 animate-spin text-primary" />
              </div>
            ) : clearances?.length ? (
              <div className="divide-y">
                {clearances.map((nc) => {
                  const isOpen = expanded === nc.id;
                  return (
                    <div key={nc.id}>
                      <button
                        className="w-full text-left px-5 py-3.5 flex items-center justify-between hover:bg-muted/30 transition-colors"
                        onClick={() => setExpanded(isOpen ? null : nc.id)}
                      >
                        <div className="flex items-center gap-2">
                          {isOpen ? <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" /> : <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />}
                          <span className="text-sm font-mono font-semibold">{nc.clearance_number}</span>
                          {!nc.is_valid && (
                            <Badge variant="outline" className="text-[10px] gap-1 border-amber-300 text-amber-700 bg-amber-50">
                              <AlertTriangle className="w-3 h-3" />Expired
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {nc.products.join(", ")} · {parseFloat(nc.total_quantity_litres).toLocaleString()} L · {nc.vessels.length} vessel(s)
                        </p>
                      </button>
                      {isOpen && (
                        <div className="px-5 pb-4 space-y-3 bg-muted/10">
                          <div className="grid grid-cols-3 gap-3 text-xs">
                            <div><span className="text-muted-foreground">PPDL:</span> {nc.ppdl_number ?? "—"}</div>
                            <div><span className="text-muted-foreground">Loading Date:</span> {formatDate(nc.date_of_loading)}</div>
                            <div><span className="text-muted-foreground">Expiry:</span> {formatDate(nc.expiry_date)}</div>
                          </div>

                          <div>
                            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-1">BFL Drawdowns</p>
                            <div className="space-y-1">
                              {nc.drawdowns.map((d) => (
                                <div key={d.id} className="text-xs flex justify-between border rounded px-2 py-1 bg-background">
                                  <span className="font-mono">{d.bfl_number}</span>
                                  <span>{d.product_type} · {parseFloat(d.quantity_litres).toLocaleString()} L</span>
                                </div>
                              ))}
                            </div>
                          </div>

                          <div>
                            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-1">Loading Locations</p>
                            <div className="flex flex-wrap gap-1.5">
                              {nc.loading_locations.map((l) => (
                                <Badge key={l.id} variant="outline" className="text-[10px]">{l.location}</Badge>
                              ))}
                            </div>
                          </div>

                          <div>
                            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-1">Clients & Vessels</p>
                            <div className="space-y-1">
                              {nc.vessels.map((v) => (
                                <div key={v.id} className="text-xs flex justify-between border rounded px-2 py-1 bg-background">
                                  <span>{v.client_name ?? "—"} ({v.client_email ?? "—"})</span>
                                  <span className="font-medium">{v.vessel_name}{v.imo_number ? ` · IMO ${v.imo_number}` : ""}</span>
                                </div>
                              ))}
                            </div>
                          </div>

                          {nc.document_url && (
                            <a href={nc.document_url} target="_blank" rel="noreferrer" className="text-xs text-primary underline inline-flex items-center gap-1">
                              <Upload className="w-3 h-3" />View uploaded document
                            </a>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="flex flex-col items-center py-12 text-muted-foreground gap-1">
                <Anchor className="w-7 h-7 mb-1 opacity-25" />
                <p className="text-sm font-medium">No Naval Clearances yet</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── Create dialog ── */}
      <Dialog open={showCreate} onOpenChange={(v) => { setShowCreate(v); if (!v) resetCreate(); }}>
        <DialogContent className="sm:max-w-2xl" aria-describedby={undefined}>
          <DialogHeader><DialogTitle>New Naval Clearance</DialogTitle></DialogHeader>
          <div className="space-y-4 mt-1 max-h-[70vh] overflow-y-auto pr-1">
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
                <Button type="button" size="sm" variant="outline" className="h-6 text-xs gap-1" onClick={() => setDrawdowns((r) => [...r, { bfl_id: "", quantity_litres: "" }])}>
                  <PlusCircle className="w-3 h-3" />Add BFL
                </Button>
              </div>
              {drawdowns.map((d, i) => (
                <div key={i} className="rounded-lg border bg-muted/30 p-3 grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <Label className="text-[10px] text-muted-foreground">BFL</Label>
                    <Select value={d.bfl_id} onValueChange={(v) => setDrawdowns((rows) => rows.map((r, idx) => idx === i ? { ...r, bfl_id: v } : r))}>
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
                      <Input type="number" className="h-8 text-xs" value={d.quantity_litres} onChange={(e) => setDrawdowns((rows) => rows.map((r, idx) => idx === i ? { ...r, quantity_litres: e.target.value } : r))} />
                      {drawdowns.length > 1 && (
                        <Button type="button" size="icon" variant="ghost" className="h-8 w-8 shrink-0 text-destructive" onClick={() => setDrawdowns((rows) => rows.filter((_, idx) => idx !== i))}>
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Loading locations */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs">Loading Locations</Label>
                <Button type="button" size="sm" variant="outline" className="h-6 text-xs gap-1" onClick={() => setLocations((r) => [...r, ""])}>
                  <PlusCircle className="w-3 h-3" />Add Location
                </Button>
              </div>
              {locations.map((loc, i) => (
                <div key={i} className="flex gap-1">
                  <Input className="h-8 text-xs" value={loc} onChange={(e) => setLocations((rows) => rows.map((r, idx) => idx === i ? e.target.value : r))} />
                  {locations.length > 1 && (
                    <Button type="button" size="icon" variant="ghost" className="h-8 w-8 shrink-0 text-destructive" onClick={() => setLocations((rows) => rows.filter((_, idx) => idx !== i))}>
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  )}
                </div>
              ))}
            </div>

            {/* Clients + vessels */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs">Clients & Vessels</Label>
                <Button type="button" size="sm" variant="outline" className="h-6 text-xs gap-1" onClick={() => setVessels((r) => [...r, { client_id: "", vessel_name: "", imo_number: "" }])}>
                  <PlusCircle className="w-3 h-3" />Add Vessel
                </Button>
              </div>
              {vessels.map((v, i) => (
                <div key={i} className="rounded-lg border bg-muted/30 p-3 grid grid-cols-3 gap-2">
                  <div className="space-y-1">
                    <Label className="text-[10px] text-muted-foreground">Client</Label>
                    <Select value={v.client_id} onValueChange={(val) => setVessels((rows) => rows.map((r, idx) => idx === i ? { ...r, client_id: val } : r))}>
                      <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Select client…" /></SelectTrigger>
                      <SelectContent>
                        {clients?.map((c) => <SelectItem key={c.id} value={c.id} className="text-xs">{c.full_name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[10px] text-muted-foreground">Vessel Name</Label>
                    <Input className="h-8 text-xs" value={v.vessel_name} onChange={(e) => setVessels((rows) => rows.map((r, idx) => idx === i ? { ...r, vessel_name: e.target.value } : r))} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[10px] text-muted-foreground">IMO Number</Label>
                    <div className="flex gap-1">
                      <Input className="h-8 text-xs" value={v.imo_number} onChange={(e) => setVessels((rows) => rows.map((r, idx) => idx === i ? { ...r, imo_number: e.target.value } : r))} />
                      {vessels.length > 1 && (
                        <Button type="button" size="icon" variant="ghost" className="h-8 w-8 shrink-0 text-destructive" onClick={() => setVessels((rows) => rows.filter((_, idx) => idx !== i))}>
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setShowCreate(false)}>Cancel</Button>
            <Button disabled={!createValid || createMutation.isPending} onClick={() => createMutation.mutate()}>
              {createMutation.isPending && <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />}
              Create Naval Clearance
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
