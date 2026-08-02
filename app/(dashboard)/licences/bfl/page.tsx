"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  PlusCircle,
  Fuel,
  Pencil,
  Trash2,
} from "lucide-react";
import { Spinner } from "@/components/ui/spinner";
import { toast } from "sonner";
import { api, getErrorMessage } from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { PanelCard } from "@/components/dashboard/PanelCard";
import { ReasonGatedDialog } from "@/components/shared/ReasonGatedDialog";
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
import { Skeleton } from "@/components/ui/skeleton";
import { formatDate } from "@/lib/utils";
import { PRODUCT_TYPE_LABELS, type ApiResponse, type Bfl } from "@/types";

const PRODUCT_TYPES = Object.keys(PRODUCT_TYPE_LABELS);

export default function BflPage() {
  const { effectiveRole } = useAuth();
  const qc = useQueryClient();
  const canAdd = effectiveRole === "cargo_superintendent" || effectiveRole === "bunker_manager" || effectiveRole === "marine_operator";
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

  const deactivatingBfl = bfls?.find((b) => b.id === deactivateId);

  return (
    <DashboardShell
      icon={Fuel}
      iconTone="blue"
      showRole={false}
      title="BFL"
      subtitle="Sits under the current PPDL — multiple BFLs can be active at once"
      actions={canAdd ? (
        <Button
          className="h-10.5 gap-2 rounded-xl px-4 text-[13px] font-semibold"
          onClick={() => setShowCreate(true)}
        >
          <PlusCircle className="h-4 w-4" strokeWidth={2.5} />
          New BFL
        </Button>
      ) : undefined}
    >
      {isLoading ? (
        <Skeleton className="h-80 w-full rounded-2xl" />
      ) : (
        <PanelCard icon={Fuel} tone="blue" title="Registry" flush className="animate-rise">
          {bfls?.length ? (
            <div className="divide-y divide-border/70">
              {bfls.map((b) => {
                const total = parseFloat(b.quantity_litres) || 0;
                const remaining = b.remaining_litres !== undefined ? parseFloat(b.remaining_litres) : total;
                return (
                  <div key={b.id} className="space-y-2 px-4 py-3.5 lg:px-5">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-[13px] font-semibold text-foreground">{b.bfl_number}</span>
                        <Badge variant="outline" className="rounded-md text-[10px]">{b.product_type}</Badge>
                        {!b.is_active && (
                          <Badge variant="secondary" className="rounded-md text-[10px]">Inactive</Badge>
                        )}
                      </div>
                      {canAdd && b.is_active && (
                        <div className="flex shrink-0 items-center gap-1">
                          <Button
                            size="icon" variant="ghost"
                            aria-label="Edit BFL"
                            className="h-7 w-7 text-muted-foreground hover:text-foreground"
                            onClick={() => openEdit(b)}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            size="icon" variant="ghost"
                            aria-label="Deactivate BFL"
                            className="h-7 w-7 text-destructive hover:text-destructive"
                            onClick={() => { setDeactivateId(b.id); setDeactivateReason(""); }}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      )}
                    </div>
                    <p className="text-[12.5px] text-muted-foreground">
                      PPDL {b.ppdl_number ?? "—"} ·{" "}
                      <span className="tabular-nums">{remaining.toLocaleString()} / {total.toLocaleString()} L</span> remaining
                      {b.vessel && <> · Vessel: {b.vessel}</>}
                      {" · "}Expires {formatDate(b.expiry_date)}
                    </p>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="flex flex-col items-center py-12 text-center">
              <Fuel className="h-8 w-8 text-muted-foreground/25" strokeWidth={1.5} />
              <p className="mt-2.5 text-sm font-medium text-foreground">No BFLs yet</p>
            </div>
          )}
        </PanelCard>
      )}

      {/* ── Create dialog ── */}
      <Dialog open={showCreate} onOpenChange={(v) => { setShowCreate(v); if (!v) resetCreate(); }}>
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
              {createMutation.isPending && <Spinner size={14} className="mr-1.5" />}
              Create BFL
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Edit dialog ── */}
      <ReasonGatedDialog
        open={!!editId}
        onOpenChange={(v) => !v && setEditId(null)}
        title="Edit BFL"
        icon={Pencil}
        reason={editReason}
        onReasonChange={setEditReason}
        confirmLabel="Save Changes"
        pending={editMutation.isPending}
        confirmDisabled={!editQuantity}
        onConfirm={() => editMutation.mutate()}
      >
        <div className="space-y-1.5">
          <Label className="text-xs">Quantity (L)</Label>
          <Input type="number" value={editQuantity} onChange={(e) => setEditQuantity(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Vessel</Label>
          <Input value={editVessel} onChange={(e) => setEditVessel(e.target.value)} />
        </div>
      </ReasonGatedDialog>

      {/* ── Deactivate dialog ── */}
      <ReasonGatedDialog
        open={!!deactivateId}
        onOpenChange={(v) => !v && setDeactivateId(null)}
        title="Deactivate BFL"
        icon={Trash2}
        description={deactivatingBfl ? `${deactivatingBfl.bfl_number} will no longer be usable for drawdowns.` : undefined}
        destructive
        reason={deactivateReason}
        onReasonChange={setDeactivateReason}
        reasonLabel="Reason for deactivating"
        confirmLabel="Deactivate"
        pending={deactivateMutation.isPending}
        onConfirm={() => deactivateId && deactivateMutation.mutate(deactivateId)}
      />
    </DashboardShell>
  );
}
