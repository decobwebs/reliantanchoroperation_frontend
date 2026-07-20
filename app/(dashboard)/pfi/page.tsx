"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2, PlusCircle, Pencil, FileText, BadgeCheck, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { api, getErrorMessage } from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";
import { Header } from "@/components/layout/Header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from "@/components/ui/select";
import { formatDateTime } from "@/lib/utils";
import type { ApiResponse, PFI } from "@/types";

const STATUS_COLOR: Record<string, string> = {
  pending: "bg-amber-100 text-amber-800 border-amber-200",
  confirmed: "bg-amber-100 text-amber-800 border-amber-200",
  payment_initiated: "bg-amber-100 text-amber-800 border-amber-200",
  paid: "bg-emerald-100 text-emerald-800 border-emerald-200",
  linked: "bg-emerald-100 text-emerald-800 border-emerald-200",
  completed: "bg-emerald-100 text-emerald-800 border-emerald-200",
  cancelled: "bg-muted text-muted-foreground border",
};

export default function PfiPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const isBM = user?.role === "bunker_manager";
  const isFM = user?.role === "finance_manager";
  const canManage = isBM || isFM;

  const { data: pfis, isLoading } = useQuery({
    queryKey: ["pfis-all"],
    queryFn: async () => {
      const res = await api.get<ApiResponse<PFI[]>>("/pfis");
      return res.data.data ?? [];
    },
    enabled: canManage,
  });

  // ── Create
  const [showCreate, setShowCreate] = useState(false);
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState("NGN");
  const [quantity, setQuantity] = useState("");
  const [supplier, setSupplier] = useState("");
  const [description, setDescription] = useState("");
  const [clientRef, setClientRef] = useState("");

  const resetCreateForm = () => {
    setAmount(""); setCurrency("NGN"); setQuantity("");
    setSupplier(""); setDescription(""); setClientRef("");
  };

  const createMutation = useMutation({
    mutationFn: async () => {
      await api.post("/pfis", {
        amount: parseFloat(amount),
        currency,
        quantity_litres: quantity ? parseFloat(quantity) : undefined,
        supplier_name: supplier.trim() || undefined,
        description: description.trim() || undefined,
        client_ref: clientRef.trim() || undefined,
      });
    },
    onSuccess: () => {
      toast.success("PFI created");
      setShowCreate(false);
      resetCreateForm();
      qc.invalidateQueries({ queryKey: ["pfis-all"] });
      qc.invalidateQueries({ queryKey: ["pfis-unlinked"] });
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  // ── Edit
  const [editId, setEditId] = useState<string | null>(null);
  const [editAmount, setEditAmount] = useState("");
  const [editCurrency, setEditCurrency] = useState("NGN");
  const [editQuantity, setEditQuantity] = useState("");
  const [editSupplier, setEditSupplier] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editReason, setEditReason] = useState("");

  const openEdit = (pfi: PFI) => {
    setEditId(pfi.id);
    setEditAmount(pfi.amount ?? "");
    setEditCurrency(pfi.currency ?? "NGN");
    setEditQuantity(pfi.quantity_litres ?? "");
    setEditSupplier(pfi.supplier_name ?? "");
    setEditDescription(pfi.description ?? "");
    setEditReason("");
  };

  const editMutation = useMutation({
    mutationFn: async () => {
      if (!editId) return;
      await api.put(`/pfis/${editId}`, {
        amount: editAmount ? parseFloat(editAmount) : undefined,
        currency: editCurrency || undefined,
        quantity_litres: editQuantity ? parseFloat(editQuantity) : undefined,
        supplier_name: editSupplier.trim() || undefined,
        description: editDescription.trim() || undefined,
        reason: editReason.trim(),
      });
    },
    onSuccess: () => {
      toast.success("PFI updated");
      setEditId(null);
      qc.invalidateQueries({ queryKey: ["pfis-all"] });
      qc.invalidateQueries({ queryKey: ["pfis-unlinked"] });
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  // ── Confirm payment (FM)
  const confirmPaymentMutation = useMutation({
    mutationFn: async (pfiId: string) => {
      await api.post(`/pfis/${pfiId}/confirm-payment`, {});
    },
    onSuccess: () => {
      toast.success("PFI payment confirmed");
      qc.invalidateQueries({ queryKey: ["pfis-all"] });
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  return (
    <div>
      <Header
        title="Proforma Invoices"
        subtitle="Create and manage PFIs — link them to operations from the operation's Finance tab"
        actions={
          canManage ? (
            <Button size="sm" onClick={() => setShowCreate(true)}>
              <PlusCircle className="w-4 h-4 mr-1.5" />
              Create PFI
            </Button>
          ) : undefined
        }
      />

      <div className="p-4 md:p-6 space-y-4">
        <Card className="border-0 shadow-sm">
          <CardContent className="p-0">
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-7 h-7 animate-spin text-primary" />
              </div>
            ) : pfis?.length ? (
              <div className="divide-y">
                {pfis.map((pfi) => (
                  <div key={pfi.id} className="px-5 py-3.5 flex items-center justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-mono font-semibold">{pfi.pfi_number}</span>
                        <Badge className={`text-[10px] h-4 px-1.5 capitalize border ${STATUS_COLOR[pfi.status] ?? "border"}`}>
                          {pfi.status.replace(/_/g, " ")}
                        </Badge>
                        {pfi.operation_id && (
                          <Link href={`/operations/${pfi.operation_id}`} className="text-[10px] text-primary underline flex items-center gap-0.5">
                            Linked <ExternalLink className="w-2.5 h-2.5" />
                          </Link>
                        )}
                        {pfi.quantity_litres ? (
                          parseFloat(pfi.remaining_litres ?? pfi.quantity_litres) > 0 ? (
                            <Badge variant="outline" className="text-[10px] h-4 px-1.5 border-emerald-300 text-emerald-700 bg-emerald-50">
                              {parseFloat(pfi.remaining_litres ?? pfi.quantity_litres).toLocaleString()} L available
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-[10px] h-4 px-1.5">Fully allocated</Badge>
                          )
                        ) : !pfi.operation_id ? (
                          <Badge variant="outline" className="text-[10px] h-4 px-1.5">No volume set</Badge>
                        ) : null}
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        <span className="font-semibold">{pfi.currency} {parseFloat(pfi.amount).toLocaleString("en-US", { minimumFractionDigits: 2 })}</span>
                        {pfi.supplier_name && <span className="ml-2">· {pfi.supplier_name}</span>}
                        {pfi.quantity_litres && (
                          <span className="ml-2">· {parseFloat(pfi.allocated_litres || "0").toLocaleString()} / {parseFloat(pfi.quantity_litres).toLocaleString()} L allocated</span>
                        )}
                      </p>
                      <p className="text-[10px] text-muted-foreground/60 mt-0.5">{formatDateTime(pfi.created_at)}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {isFM && !["paid", "linked", "completed", "cancelled"].includes(pfi.status) && (
                        <Button
                          size="sm" className="h-7 text-xs gap-1 bg-emerald-600 hover:bg-emerald-700"
                          disabled={confirmPaymentMutation.isPending}
                          onClick={() => confirmPaymentMutation.mutate(pfi.id)}
                        >
                          <BadgeCheck className="w-3 h-3" />Confirm Paid
                        </Button>
                      )}
                      {pfi.document_url && (
                        <a href={pfi.document_url} target="_blank" rel="noopener noreferrer">
                          <Button size="sm" variant="outline" className="h-7 text-xs gap-1"><FileText className="w-3 h-3" />PDF</Button>
                        </a>
                      )}
                      {canManage && (
                        <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={() => openEdit(pfi)}>
                          <Pencil className="w-3 h-3" />Edit
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center py-14 text-muted-foreground gap-1">
                <FileText className="w-8 h-8 mb-1 opacity-25" />
                <p className="text-sm font-medium">No PFIs yet</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── Create dialog */}
      <Dialog open={showCreate} onOpenChange={(v) => { if (!v) { setShowCreate(false); resetCreateForm(); } }}>
        <DialogContent className="sm:max-w-md" aria-describedby={undefined}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><FileText className="w-4 h-4 text-primary" />Create PFI</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 mt-1">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Amount <span className="text-destructive">*</span></Label>
                <Input type="number" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Currency</Label>
                <Select value={currency} onValueChange={setCurrency}>
                  <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="NGN">NGN</SelectItem>
                    <SelectItem value="USD">USD</SelectItem>
                    <SelectItem value="EUR">EUR</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Quantity (litres) <span className="text-muted-foreground font-normal">optional</span></Label>
              <Input type="number" step="0.01" value={quantity} onChange={(e) => setQuantity(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Supplier Name</Label>
              <Input value={supplier} onChange={(e) => setSupplier(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Client Reference <span className="text-muted-foreground font-normal">optional</span></Label>
              <Input value={clientRef} onChange={(e) => setClientRef(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Description</Label>
              <Textarea rows={2} className="resize-none text-sm" value={description} onChange={(e) => setDescription(e.target.value)} />
            </div>
          </div>
          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => { setShowCreate(false); resetCreateForm(); }}>Cancel</Button>
            <Button
              disabled={!amount || parseFloat(amount) <= 0 || createMutation.isPending}
              onClick={() => createMutation.mutate()}
            >
              {createMutation.isPending && <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />}
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Edit dialog */}
      <Dialog open={!!editId} onOpenChange={(v) => { if (!v) setEditId(null); }}>
        <DialogContent className="sm:max-w-md" aria-describedby={undefined}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Pencil className="w-4 h-4 text-primary" />Edit PFI</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 mt-1">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Amount</Label>
                <Input type="number" step="0.01" value={editAmount} onChange={(e) => setEditAmount(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Currency</Label>
                <Select value={editCurrency} onValueChange={setEditCurrency}>
                  <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="NGN">NGN</SelectItem>
                    <SelectItem value="USD">USD</SelectItem>
                    <SelectItem value="EUR">EUR</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Quantity (litres)</Label>
              <Input type="number" step="0.01" value={editQuantity} onChange={(e) => setEditQuantity(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Supplier Name</Label>
              <Input value={editSupplier} onChange={(e) => setEditSupplier(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Description</Label>
              <Textarea rows={2} className="resize-none text-sm" value={editDescription} onChange={(e) => setEditDescription(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Reason for edit <span className="text-destructive">*</span></Label>
              <Textarea rows={2} className="resize-none text-sm" placeholder="Why is this PFI being edited…"
                value={editReason} onChange={(e) => setEditReason(e.target.value)} />
            </div>
          </div>
          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setEditId(null)}>Cancel</Button>
            <Button
              disabled={!editReason.trim() || editMutation.isPending}
              onClick={() => editMutation.mutate()}
            >
              {editMutation.isPending && <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
