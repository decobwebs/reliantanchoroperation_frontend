"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2, PlusCircle, Fuel, Pencil, Trash2 } from "lucide-react";
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
import { PRODUCT_TYPE_LABELS, type ApiResponse, type Bfl } from "@/types";

const PRODUCT_TYPES = Object.keys(PRODUCT_TYPE_LABELS);

export default function BflPage() {
  const { effectiveRole } = useAuth();
  const qc = useQueryClient();
  const canAdd = effectiveRole === "marine_manager" || effectiveRole === "bunker_manager";
  const canView = canAdd;

  const { data: bfls, isLoading } = useQuery({
    queryKey: ["bfls"],
    queryFn: async () => {
      const res = await api.get<ApiResponse<Bfl[]>>("/bfls");
      return res.data.data ?? [];
    },
    enabled: canView,
  });

  // ── Create ──
  const [showCreate, setShowCreate] = useState(false);
  const [number, setNumber] = useState("");
  const [productType, setProductType] = useState("");
  const [quantity, setQuantity] = useState("");
  const [vessel, setVessel] = useState("");
  const [expiryDate, setExpiryDate] = useState("");

  const resetCreate = () => {
    setNumber(""); setProductType(""); setQuantity(""); setVessel(""); setExpiryDate("");
  };
  const createValid = number.trim() && productType && parseFloat(quantity) > 0 && expiryDate;

  const createMutation = useMutation({
    mutationFn: async () => {
      await api.post("/bfls", {
        bfl_number: number.trim(), product_type: productType,
        quantity_litres: parseFloat(quantity), vessel: vessel.trim() || undefined,
        expiry_date: expiryDate,
      });
    },
    onSuccess: () => {
      toast.success("BFL created");
      setShowCreate(false);
      resetCreate();
      qc.invalidateQueries({ queryKey: ["bfls"] });
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  // ── Edit ──
  const [editId, setEditId] = useState<string | null>(null);
  const [editQuantity, setEditQuantity] = useState("");
  const [editVessel, setEditVessel] = useState("");
  const [editReason, setEditReason] = useState("");

  const openEdit = (b: Bfl) => {
    setEditId(b.id); setEditQuantity(b.quantity_litres); setEditVessel(b.vessel ?? ""); setEditReason("");
  };

  const editMutation = useMutation({
    mutationFn: async () => {
      if (!editId) return;
      await api.put(`/bfls/${editId}`, {
        quantity_litres: parseFloat(editQuantity), vessel: editVessel.trim() || undefined,
        reason: editReason.trim(),
      });
    },
    onSuccess: () => {
      toast.success("BFL updated");
      setEditId(null);
      qc.invalidateQueries({ queryKey: ["bfls"] });
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  // ── Deactivate ──
  const [deactivateId, setDeactivateId] = useState<string | null>(null);
  const [deactivateReason, setDeactivateReason] = useState("");

  const deactivateMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/bfls/${id}`, { data: { reason: deactivateReason.trim() } });
    },
    onSuccess: () => {
      toast.success("BFL deactivated");
      setDeactivateId(null); setDeactivateReason("");
      qc.invalidateQueries({ queryKey: ["bfls"] });
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  return (
    <div>
      <Header
        title="BFL"
        subtitle="Sits under the current PPDL — multiple BFLs can be active at once"
        actions={canAdd ? (
          <Button size="sm" onClick={() => setShowCreate(true)} className="gap-1.5">
            <PlusCircle className="w-3.5 h-3.5" />New BFL
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
            ) : bfls?.length ? (
              <div className="divide-y">
                {bfls.map((b) => {
                  const total = parseFloat(b.quantity_litres) || 0;
                  const remaining = b.remaining_litres !== undefined ? parseFloat(b.remaining_litres) : total;
                  return (
                    <div key={b.id} className="px-5 py-3.5 space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-mono font-semibold">{b.bfl_number}</span>
                          <Badge variant="outline" className="text-[10px]">{b.product_type}</Badge>
                          {!b.is_active && <Badge variant="secondary" className="text-[10px]">Inactive</Badge>}
                        </div>
                        {canAdd && b.is_active && (
                          <div className="flex items-center gap-1">
                            <Button size="sm" variant="ghost" className="h-6 px-1.5" onClick={() => openEdit(b)}>
                              <Pencil className="w-3 h-3" />
                            </Button>
                            <Button
                              size="sm" variant="ghost" className="h-6 px-1.5 text-destructive hover:text-destructive"
                              onClick={() => { setDeactivateId(b.id); setDeactivateReason(""); }}
                            >
                              <Trash2 className="w-3 h-3" />
                            </Button>
                          </div>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        PPDL {b.ppdl_number ?? "—"} · {remaining.toLocaleString()} / {total.toLocaleString()} L remaining
                        {b.vessel && <> · Vessel: {b.vessel}</>}
                        {" · "}Expires {formatDate(b.expiry_date)}
                      </p>
                      {deactivateId === b.id && (
                        <div className="flex items-center gap-1.5 pt-1">
                          <Input
                            className="h-7 text-xs" placeholder="Reason for deactivating this BFL…"
                            value={deactivateReason} onChange={(e) => setDeactivateReason(e.target.value)}
                          />
                          <Button
                            size="sm" variant="destructive" className="h-7 px-2 text-xs shrink-0"
                            disabled={!deactivateReason.trim() || deactivateMutation.isPending}
                            onClick={() => deactivateMutation.mutate(b.id)}
                          >
                            {deactivateMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : "Confirm"}
                          </Button>
                          <Button size="sm" variant="ghost" className="h-7 px-2 text-xs shrink-0" onClick={() => setDeactivateId(null)}>Cancel</Button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="flex flex-col items-center py-12 text-muted-foreground gap-1">
                <Fuel className="w-7 h-7 mb-1 opacity-25" />
                <p className="text-sm font-medium">No BFLs yet</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── Create dialog ── */}
      <Dialog open={showCreate} onOpenChange={(v) => { setShowCreate(v); if (!v) resetCreate(); }}>
        <DialogContent className="sm:max-w-md" aria-describedby={undefined}>
          <DialogHeader><DialogTitle>New BFL</DialogTitle></DialogHeader>
          <div className="space-y-3 mt-1">
            <div className="space-y-1.5">
              <Label className="text-xs">BFL Number *</Label>
              <Input value={number} onChange={(e) => setNumber(e.target.value)} placeholder="From the issued document" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Product Type *</Label>
                <Select value={productType} onValueChange={setProductType}>
                  <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Select…" /></SelectTrigger>
                  <SelectContent>
                    {PRODUCT_TYPES.map((pt) => <SelectItem key={pt} value={pt}>{pt}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Quantity (L) *</Label>
                <Input type="number" value={quantity} onChange={(e) => setQuantity(e.target.value)} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Vessel</Label>
                <Input value={vessel} onChange={(e) => setVessel(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Expiry Date *</Label>
                <Input type="date" value={expiryDate} onChange={(e) => setExpiryDate(e.target.value)} />
              </div>
            </div>
          </div>
          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setShowCreate(false)}>Cancel</Button>
            <Button disabled={!createValid || createMutation.isPending} onClick={() => createMutation.mutate()}>
              {createMutation.isPending && <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />}
              Create BFL
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Edit dialog ── */}
      <Dialog open={!!editId} onOpenChange={(v) => { if (!v) setEditId(null); }}>
        <DialogContent className="sm:max-w-sm" aria-describedby={undefined}>
          <DialogHeader><DialogTitle className="flex items-center gap-2"><Pencil className="w-4 h-4 text-primary" />Edit BFL</DialogTitle></DialogHeader>
          <div className="space-y-3 mt-1">
            <div className="space-y-1.5">
              <Label className="text-xs">Quantity (L)</Label>
              <Input type="number" value={editQuantity} onChange={(e) => setEditQuantity(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Vessel</Label>
              <Input value={editVessel} onChange={(e) => setEditVessel(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Reason for edit <span className="text-destructive">*</span></Label>
              <Input placeholder="Why is this being changed…" value={editReason} onChange={(e) => setEditReason(e.target.value)} />
            </div>
          </div>
          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setEditId(null)}>Cancel</Button>
            <Button disabled={!editQuantity || !editReason.trim() || editMutation.isPending} onClick={() => editMutation.mutate()}>
              {editMutation.isPending && <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
