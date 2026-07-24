"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2, PlusCircle, FileText, Pencil, Trash2, ShieldCheck } from "lucide-react";
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
import { PRODUCT_TYPE_LABELS, type ApiResponse, type Ppdl } from "@/types";

const PRODUCT_TYPES = Object.keys(PRODUCT_TYPE_LABELS);

type ProductRow = { product_type: string; quantity_litres: string };

export default function PpdlPage() {
  const { effectiveRole } = useAuth();
  const qc = useQueryClient();
  const canAdd = effectiveRole === "marine_manager";
  const canView = canAdd || effectiveRole === "bunker_manager";

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
  const [products, setProducts] = useState<ProductRow[]>([{ product_type: "", quantity_litres: "" }]);

  const resetCreate = () => {
    setNumber(""); setIssueDate(""); setExpiryDate("");
    setProducts([{ product_type: "", quantity_litres: "" }]);
  };

  const productsValid = products.length > 0 && products.every((p) => p.product_type && parseFloat(p.quantity_litres) > 0);
  const createValid = number.trim() && issueDate && expiryDate && productsValid;

  const createMutation = useMutation({
    mutationFn: async () => {
      await api.post("/ppdls", {
        ppdl_number: number.trim(),
        issue_date: issueDate,
        expiry_date: expiryDate,
        products: products.map((p) => ({ product_type: p.product_type, quantity_litres: parseFloat(p.quantity_litres) })),
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
    <div>
      <Header
        title="PPDL"
        subtitle="Top of the licence chain — every operation carries whichever PPDL is current"
        actions={canAdd ? (
          <Button size="sm" onClick={() => setShowCreate(true)} className="gap-1.5">
            <PlusCircle className="w-3.5 h-3.5" />New PPDL
          </Button>
        ) : undefined}
      />

      <div className="p-4 md:p-6 space-y-4">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-7 h-7 animate-spin text-primary" />
          </div>
        ) : ppdls?.length ? (
          ppdls.map((ppdl) => (
            <Card key={ppdl.id} className="border-0 shadow-sm">
              <CardContent className="p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-mono font-semibold">{ppdl.ppdl_number}</p>
                    {ppdl.is_current && (
                      <Badge className="gap-1 text-[10px]"><ShieldCheck className="w-3 h-3" />Current</Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Issued {formatDate(ppdl.issue_date)} · Expires {formatDate(ppdl.expiry_date)}
                  </p>
                </div>

                <div className="space-y-2.5">
                  {ppdl.products.map((p) => {
                    const total = parseFloat(p.quantity_litres) || 0;
                    const remaining = p.remaining_litres !== undefined ? parseFloat(p.remaining_litres) : total;
                    const pct = total > 0 ? Math.max(0, Math.min(100, (remaining / total) * 100)) : 0;
                    return (
                      <div key={p.id} className="space-y-1">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-medium">{p.product_type}</span>
                          <div className="flex items-center gap-2">
                            <span className="text-muted-foreground">
                              {remaining.toLocaleString()} / {total.toLocaleString()} L remaining
                            </span>
                            {canAdd && (
                              <Button
                                size="sm" variant="ghost" className="h-5 px-1"
                                onClick={() => {
                                  setEditTarget({ ppdlId: ppdl.id, productId: p.id, current: p.quantity_litres, label: p.product_type });
                                  setEditQuantity(p.quantity_litres);
                                  setEditReason("");
                                }}
                              >
                                <Pencil className="w-3 h-3" />
                              </Button>
                            )}
                          </div>
                        </div>
                        <div className="h-2 rounded-full bg-muted overflow-hidden">
                          <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          ))
        ) : (
          <div className="flex flex-col items-center py-12 text-muted-foreground gap-1">
            <FileText className="w-7 h-7 mb-1 opacity-25" />
            <p className="text-sm font-medium">No PPDLs yet</p>
          </div>
        )}
      </div>

      {/* ── Create dialog ── */}
      <Dialog open={showCreate} onOpenChange={(v) => { setShowCreate(v); if (!v) resetCreate(); }}>
        <DialogContent className="sm:max-w-lg" aria-describedby={undefined}>
          <DialogHeader>
            <DialogTitle>New PPDL</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 mt-1 max-h-[70vh] overflow-y-auto pr-1">
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5 col-span-1">
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
                  type="button" size="sm" variant="outline" className="h-6 text-xs gap-1"
                  onClick={() => setProducts((p) => [...p, { product_type: "", quantity_litres: "" }])}
                >
                  <PlusCircle className="w-3 h-3" />Add Product
                </Button>
              </div>
              {products.map((p, i) => (
                <div key={i} className="rounded-lg border bg-muted/30 p-3 grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <Label className="text-[10px] text-muted-foreground">Product Type</Label>
                    <Select value={p.product_type} onValueChange={(v) => setProducts((rows) => rows.map((r, idx) => idx === i ? { ...r, product_type: v } : r))}>
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
                        onChange={(e) => setProducts((rows) => rows.map((r, idx) => idx === i ? { ...r, quantity_litres: e.target.value } : r))}
                      />
                      {products.length > 1 && (
                        <Button type="button" size="icon" variant="ghost" className="h-8 w-8 shrink-0 text-destructive" onClick={() => setProducts((rows) => rows.filter((_, idx) => idx !== i))}>
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
              Create PPDL
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Edit product quantity dialog ── */}
      <Dialog open={!!editTarget} onOpenChange={(v) => { if (!v) setEditTarget(null); }}>
        <DialogContent className="sm:max-w-sm" aria-describedby={undefined}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Pencil className="w-4 h-4 text-primary" />Edit {editTarget?.label} Quantity</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 mt-1">
            <div className="space-y-1.5">
              <Label className="text-xs">Quantity (L)</Label>
              <Input type="number" value={editQuantity} onChange={(e) => setEditQuantity(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Reason for change <span className="text-destructive">*</span></Label>
              <Input placeholder="Why is this being changed…" value={editReason} onChange={(e) => setEditReason(e.target.value)} />
            </div>
          </div>
          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setEditTarget(null)}>Cancel</Button>
            <Button
              disabled={!editQuantity || !editReason.trim() || editMutation.isPending}
              onClick={() => editMutation.mutate()}
            >
              {editMutation.isPending && <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />}
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
