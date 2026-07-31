"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2, PlusCircle, Pencil, FileText, BadgeCheck, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { api, getErrorMessage } from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { PanelCard } from "@/components/dashboard/PanelCard";
import { ReasonGatedDialog } from "@/components/shared/ReasonGatedDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from "@/components/ui/select";
import { cn, formatDateTime } from "@/lib/utils";
import type { ApiResponse, PFI } from "@/types";

const STATUS_COLOR: Record<string, string> = {
  pending:            "bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-500/15 dark:text-amber-300 dark:border-amber-500/30",
  confirmed:          "bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-500/15 dark:text-amber-300 dark:border-amber-500/30",
  payment_initiated:  "bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-500/15 dark:text-amber-300 dark:border-amber-500/30",
  paid:               "bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-300 dark:border-emerald-500/30",
  linked:             "bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-300 dark:border-emerald-500/30",
  completed:          "bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-300 dark:border-emerald-500/30",
  cancelled:          "bg-muted text-muted-foreground border-border",
};

export default function PfiPage() {
  const { effectiveRole } = useAuth();
  const qc = useQueryClient();
  const isBM = effectiveRole === "bunker_manager";
  const isFM = effectiveRole === "finance_manager";
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
  const [pfiNumber, setPfiNumber] = useState("");
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState("NGN");
  const [quantity, setQuantity] = useState("");
  const [supplier, setSupplier] = useState("");
  const [description, setDescription] = useState("");
  const [clientRef, setClientRef] = useState("");

  const resetCreateForm = () => {
    setPfiNumber(""); setAmount(""); setCurrency("NGN"); setQuantity("");
    setSupplier(""); setDescription(""); setClientRef("");
  };

  const createMutation = useMutation({
    mutationFn: async () => {
      await api.post("/pfis", {
        pfi_number: pfiNumber.trim() || undefined,
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
  const [editPfiNumber, setEditPfiNumber] = useState("");
  const [editAmount, setEditAmount] = useState("");
  const [editCurrency, setEditCurrency] = useState("NGN");
  const [editQuantity, setEditQuantity] = useState("");
  const [editSupplier, setEditSupplier] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editReason, setEditReason] = useState("");

  const openEdit = (pfi: PFI) => {
    setEditId(pfi.id);
    setEditPfiNumber(pfi.pfi_number ?? "");
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
        pfi_number: editPfiNumber.trim() || undefined,
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

  // ── Confirm payment (FM) — a plain status flip, no reason required.
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
    <DashboardShell
      icon={FileText}
      iconTone="blue"
      showRole={false}
      title="Proforma Invoices"
      subtitle="Create and manage PFIs — link them to operations from the operation's Finance tab"
      actions={
        canManage ? (
          <Button
            className="h-10.5 gap-2 rounded-xl px-4 text-[13px] font-semibold"
            onClick={() => setShowCreate(true)}
          >
            <PlusCircle className="h-4 w-4" strokeWidth={2.5} />
            Create PFI
          </Button>
        ) : undefined
      }
    >
      {isLoading ? (
        <Skeleton className="h-96 w-full rounded-2xl" />
      ) : (
        <PanelCard icon={FileText} tone="blue" title="Registry" flush className="animate-rise">
          {pfis?.length ? (
            <div className="divide-y divide-border/70">
              {pfis.map((pfi) => (
                <div key={pfi.id} className="flex flex-wrap items-center justify-between gap-4 px-4 py-3.5 lg:px-5">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-[13px] font-semibold text-foreground">{pfi.pfi_number}</span>
                      <Badge className={cn("h-4.5 rounded-md border px-1.5 text-[10px] capitalize", STATUS_COLOR[pfi.status] ?? "border-border")}>
                        {pfi.status.replace(/_/g, " ")}
                      </Badge>
                      {pfi.operation_id && (
                        <Link
                          href={`/operations/${pfi.operation_id}`}
                          className="flex items-center gap-0.5 rounded text-[10.5px] font-semibold text-brand-600 underline underline-offset-2 hover:text-brand-700"
                        >
                          Linked <ExternalLink className="h-2.5 w-2.5" />
                        </Link>
                      )}
                      {pfi.quantity_litres ? (
                        parseFloat(pfi.remaining_litres ?? pfi.quantity_litres) > 0 ? (
                          <Badge variant="outline" className="h-4.5 rounded-md border-emerald-300 bg-emerald-50 px-1.5 text-[10px] text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/15 dark:text-emerald-300">
                            {parseFloat(pfi.remaining_litres ?? pfi.quantity_litres).toLocaleString()} L available
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="h-4.5 rounded-md px-1.5 text-[10px]">Fully allocated</Badge>
                        )
                      ) : !pfi.operation_id ? (
                        <Badge variant="outline" className="h-4.5 rounded-md px-1.5 text-[10px]">No volume set</Badge>
                      ) : null}
                    </div>
                    <p className="mt-0.5 text-[12.5px] text-muted-foreground">
                      <span className="font-semibold text-foreground">{pfi.currency} {parseFloat(pfi.amount).toLocaleString("en-US", { minimumFractionDigits: 2 })}</span>
                      {pfi.supplier_name && <span className="ml-2">· {pfi.supplier_name}</span>}
                      {pfi.quantity_litres && (
                        <span className="ml-2 tabular-nums">· {parseFloat(pfi.allocated_litres || "0").toLocaleString()} / {parseFloat(pfi.quantity_litres).toLocaleString()} L allocated</span>
                      )}
                    </p>
                    <p className="mt-0.5 text-[11px] tabular-nums text-muted-foreground/70">{formatDateTime(pfi.created_at)}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    {isFM && !["paid", "linked", "completed", "cancelled"].includes(pfi.status) && (
                      <Button
                        size="sm"
                        className="h-8 gap-1 rounded-lg bg-emerald-600 text-xs font-semibold hover:bg-emerald-700"
                        disabled={confirmPaymentMutation.isPending}
                        onClick={() => confirmPaymentMutation.mutate(pfi.id)}
                      >
                        <BadgeCheck className="h-3 w-3" />Confirm Paid
                      </Button>
                    )}
                    {pfi.document_url && (
                      <a href={pfi.document_url} target="_blank" rel="noopener noreferrer">
                        <Button size="sm" variant="outline" className="h-8 gap-1 rounded-lg text-xs font-semibold"><FileText className="h-3 w-3" />PDF</Button>
                      </a>
                    )}
                    {canManage && (
                      <Button size="sm" variant="outline" className="h-8 gap-1 rounded-lg text-xs font-semibold" onClick={() => openEdit(pfi)}>
                        <Pencil className="h-3 w-3" />Edit
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center py-14 text-center">
              <FileText className="h-8 w-8 text-muted-foreground/25" strokeWidth={1.5} />
              <p className="mt-2.5 text-sm font-medium text-foreground">No PFIs yet</p>
            </div>
          )}
        </PanelCard>
      )}

      {/* ── Create dialog */}
      <Dialog open={showCreate} onOpenChange={(v) => { if (!v) { setShowCreate(false); resetCreateForm(); } }}>
        <DialogContent className="sm:max-w-md" aria-describedby={undefined}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-[15px] font-bold tracking-tight">
              <FileText className="h-4 w-4 text-brand-600" strokeWidth={2.2} />Create PFI
            </DialogTitle>
          </DialogHeader>
          <div className="mt-1 space-y-3">
            <div className="space-y-1.5">
              <Label className="text-xs">PFI Number / Title <span className="font-normal text-muted-foreground">optional — auto-generated (e.g. PFI-2026-0080) if left blank</span></Label>
              <Input value={pfiNumber} onChange={(e) => setPfiNumber(e.target.value)} placeholder="e.g. PFI-2026-0080 or a custom title" />
            </div>
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
              <Label className="text-xs">Quantity (litres) <span className="font-normal text-muted-foreground">optional</span></Label>
              <Input type="number" step="0.01" value={quantity} onChange={(e) => setQuantity(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Supplier Name</Label>
              <Input value={supplier} onChange={(e) => setSupplier(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Client Reference <span className="font-normal text-muted-foreground">optional</span></Label>
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
              {createMutation.isPending && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Edit dialog */}
      <ReasonGatedDialog
        open={!!editId}
        onOpenChange={(v) => !v && setEditId(null)}
        title="Edit PFI"
        icon={Pencil}
        reason={editReason}
        onReasonChange={setEditReason}
        reasonPlaceholder="Why is this PFI being edited…"
        confirmLabel="Save Changes"
        pending={editMutation.isPending}
        onConfirm={() => editMutation.mutate()}
      >
        <div className="space-y-1.5">
          <Label className="text-xs">PFI Number / Title</Label>
          <Input value={editPfiNumber} onChange={(e) => setEditPfiNumber(e.target.value)} />
        </div>
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
      </ReasonGatedDialog>
    </DashboardShell>
  );
}
