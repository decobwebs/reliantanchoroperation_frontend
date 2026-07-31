"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2, PlusCircle, FileText, Pencil, Trash2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { api, getErrorMessage } from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { PanelCard } from "@/components/dashboard/PanelCard";
import { ReasonGatedDialog } from "@/components/shared/ReasonGatedDialog";
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
import { PRODUCT_TYPE_LABELS, type ApiResponse, type Ppdl } from "@/types";

const PRODUCT_TYPES = Object.keys(PRODUCT_TYPE_LABELS);

type ProductRow = { product_type: string; quantity_litres: string };
const emptyProductRow = (): ProductRow => ({ product_type: "", quantity_litres: "" });

export default function PpdlPage() {
  const { effectiveRole } = useAuth();
  const qc = useQueryClient();
  const canAdd = effectiveRole === "marine_manager" || effectiveRole === "bunker_manager";
  const canView = canAdd;

  const { data: ppdls, isLoading } = useQuery({
    queryKey: ["ppdls"],
    queryFn: async () => {
      const res = await api.get<ApiResponse<Ppdl[]>>("/ppdls");
      return res.data.data ?? [];
    },
    enabled: canView,
  });

  // ── Create ──
  const [showCreate, setShowCreate] = useState(false);
  const [number, setNumber] = useState("");
  const [issueDate, setIssueDate] = useState("");
  const [expiryDate, setExpiryDate] = useState("");
  const productRows = useDynamicRows<ProductRow>(emptyProductRow);

  const resetCreate = () => {
    setNumber(""); setIssueDate(""); setExpiryDate("");
    productRows.reset();
  };

  const productsValid = productRows.rows.length > 0 && productRows.rows.every((p) => p.product_type && parseFloat(p.quantity_litres) > 0);
  const createValid = number.trim() && issueDate && expiryDate && productsValid;

  const createMutation = useMutation({
    mutationFn: async () => {
      await api.post("/ppdls", {
        ppdl_number: number.trim(),
        issue_date: issueDate,
        expiry_date: expiryDate,
        products: productRows.rows.map((p) => ({ product_type: p.product_type, quantity_litres: parseFloat(p.quantity_litres) })),
      });
    },
    onSuccess: () => {
      toast.success("PPDL created — now the current licence");
      setShowCreate(false);
      resetCreate();
      qc.invalidateQueries({ queryKey: ["ppdls"] });
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  // ── Edit product quantity ──
  const [editTarget, setEditTarget] = useState<{ ppdlId: string; productId: string; current: string; label: string } | null>(null);
  const [editQuantity, setEditQuantity] = useState("");
  const [editReason, setEditReason] = useState("");

  const editMutation = useMutation({
    mutationFn: async () => {
      if (!editTarget) return;
      await api.put(`/ppdls/${editTarget.ppdlId}/products/${editTarget.productId}`, {
        quantity_litres: parseFloat(editQuantity),
        reason: editReason.trim(),
      });
    },
    onSuccess: () => {
      toast.success("PPDL product quantity updated");
      setEditTarget(null);
      qc.invalidateQueries({ queryKey: ["ppdls"] });
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  return (
    <DashboardShell
      icon={FileText}
      iconTone="blue"
      showRole={false}
      title="PPDL"
      subtitle="Top of the licence chain — every operation carries whichever PPDL is current"
      actions={canAdd ? (
        <Button
          className="h-10.5 gap-2 rounded-xl px-4 text-[13px] font-semibold"
          onClick={() => setShowCreate(true)}
        >
          <PlusCircle className="h-4 w-4" strokeWidth={2.5} />
          New PPDL
        </Button>
      ) : undefined}
    >
      {isLoading ? (
        <div className="space-y-4">
          <Skeleton className="h-48 w-full rounded-2xl" />
          <Skeleton className="h-48 w-full rounded-2xl" />
        </div>
      ) : ppdls?.length ? (
        <div className="space-y-4">
          {ppdls.map((ppdl) => (
            <PanelCard
              key={ppdl.id}
              icon={FileText}
              tone={ppdl.is_current ? "emerald" : "blue"}
              title={ppdl.ppdl_number}
              subtitle={`Issued ${formatDate(ppdl.issue_date)} · Expires ${formatDate(ppdl.expiry_date)}`}
              action={ppdl.is_current ? (
                <Badge className="gap-1 rounded-md bg-emerald-100 text-[10px] text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300">
                  <ShieldCheck className="h-3 w-3" />Current
                </Badge>
              ) : undefined}
              className="animate-rise"
            >
              <div className="space-y-3">
                {ppdl.products.map((p) => {
                  const total = parseFloat(p.quantity_litres) || 0;
                  const remaining = p.remaining_litres !== undefined ? parseFloat(p.remaining_litres) : total;
                  const pct = total > 0 ? Math.max(0, Math.min(100, (remaining / total) * 100)) : 0;
                  return (
                    <div key={p.id} className="space-y-1.5">
                      <div className="flex items-center justify-between text-[12.5px]">
                        <span className="font-medium text-foreground">{p.product_type}</span>
                        <div className="flex items-center gap-1.5">
                          <span className="tabular-nums text-muted-foreground">
                            {remaining.toLocaleString()} / {total.toLocaleString()} L remaining
                          </span>
                          {canAdd && (
                            <Button
                              size="icon" variant="ghost"
                              aria-label={`Edit ${p.product_type} quantity`}
                              className="h-6 w-6 text-muted-foreground hover:text-foreground"
                              onClick={() => {
                                setEditTarget({ ppdlId: ppdl.id, productId: p.id, current: p.quantity_litres, label: p.product_type });
                                setEditQuantity(p.quantity_litres);
                                setEditReason("");
                              }}
                            >
                              <Pencil className="h-3 w-3" />
                            </Button>
                          )}
                        </div>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-muted">
                        <div className="brand-grad-bar h-full rounded-full" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </PanelCard>
          ))}
        </div>
      ) : (
        <PanelCard icon={FileText} tone="blue" title="Registry" className="animate-rise">
          <div className="flex flex-col items-center py-12 text-center">
            <FileText className="h-8 w-8 text-muted-foreground/25" strokeWidth={1.5} />
            <p className="mt-2.5 text-sm font-medium text-foreground">No PPDLs yet</p>
          </div>
        </PanelCard>
      )}

      {/* ── Create dialog ── */}
      <Dialog open={showCreate} onOpenChange={(v) => { setShowCreate(v); if (!v) resetCreate(); }}>
        <DialogContent className="sm:max-w-lg" aria-describedby={undefined}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-[15px] font-bold tracking-tight">
              <FileText className="h-4 w-4 text-brand-600" strokeWidth={2.2} />New PPDL
            </DialogTitle>
          </DialogHeader>
          <div className="mt-1 max-h-[70vh] space-y-3 overflow-y-auto pr-1">
            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-1 space-y-1.5">
                <Label className="text-xs">PPDL Number *</Label>
                <Input value={number} onChange={(e) => setNumber(e.target.value)} placeholder="PPDL-001" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Issue Date *</Label>
                <Input type="date" value={issueDate} onChange={(e) => setIssueDate(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Expiry Date *</Label>
                <Input type="date" value={expiryDate} onChange={(e) => setExpiryDate(e.target.value)} />
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs">Products</Label>
                <Button
                  type="button" size="sm" variant="outline" className="h-6 gap-1 rounded-md text-xs"
                  onClick={productRows.add}
                >
                  <PlusCircle className="h-3 w-3" />Add Product
                </Button>
              </div>
              {productRows.rows.map((p, i) => (
                <DynamicRowCard key={i} className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <Label className="text-[10px] text-muted-foreground">Product Type</Label>
                    <Select value={p.product_type} onValueChange={(v) => productRows.update(i, { product_type: v })}>
                      <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Select…" /></SelectTrigger>
                      <SelectContent>
                        {PRODUCT_TYPES.map((pt) => <SelectItem key={pt} value={pt} className="text-xs">{pt}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[10px] text-muted-foreground">Quantity (L)</Label>
                    <div className="flex gap-1">
                      <Input
                        type="number" className="h-8 text-xs" value={p.quantity_litres}
                        onChange={(e) => productRows.update(i, { quantity_litres: e.target.value })}
                      />
                      {productRows.rows.length > 1 && (
                        <Button
                          type="button" size="icon" variant="ghost"
                          aria-label="Remove product line"
                          className="h-8 w-8 shrink-0 text-destructive"
                          onClick={() => productRows.remove(i)}
                        >
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
              Create PPDL
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Edit product quantity dialog ── */}
      <ReasonGatedDialog
        open={!!editTarget}
        onOpenChange={(v) => !v && setEditTarget(null)}
        title={`Edit ${editTarget?.label ?? ""} Quantity`}
        icon={Pencil}
        reason={editReason}
        onReasonChange={setEditReason}
        reasonLabel="Reason for change"
        confirmLabel="Save"
        pending={editMutation.isPending}
        confirmDisabled={!editQuantity}
        onConfirm={() => editMutation.mutate()}
      >
        <div className="space-y-1.5">
          <Label className="text-xs">Quantity (L)</Label>
          <Input type="number" value={editQuantity} onChange={(e) => setEditQuantity(e.target.value)} />
        </div>
      </ReasonGatedDialog>
    </DashboardShell>
  );
}
