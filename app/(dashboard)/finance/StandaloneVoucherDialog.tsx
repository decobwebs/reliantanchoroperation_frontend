"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Receipt,
} from "lucide-react";
import { Spinner } from "@/components/ui/spinner";
import { api, getErrorMessage } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CURRENCY_OPTIONS, VOUCHER_CATEGORY_OPTIONS } from "@/lib/finance";

/**
 * Create an expense voucher with no operation. The backend already supported
 * this (POST /vouchers) — it just had no UI. Note the standalone endpoint is
 * singular, unlike the operation tab's /vouchers/bulk.
 */
export function StandaloneVoucherDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const qc = useQueryClient();
  const [category, setCategory] = useState("port_fees");
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState("NGN");
  const [supplier, setSupplier] = useState("");
  const [description, setDescription] = useState("");
  const [paymentDate, setPaymentDate] = useState("");
  const [notes, setNotes] = useState("");

  const reset = () => {
    setCategory("port_fees"); setAmount(""); setCurrency("NGN");
    setSupplier(""); setDescription(""); setPaymentDate(""); setNotes("");
  };

  const mutation = useMutation({
    mutationFn: async () => {
      await api.post("/vouchers", {
        category,
        amount: parseFloat(amount),
        currency,
        supplier_name: supplier.trim() || undefined,
        description: description.trim() || undefined,
        payment_date: paymentDate ? new Date(paymentDate).toISOString() : undefined,
        notes: notes.trim() || undefined,
      });
    },
    onSuccess: () => {
      toast.success("Voucher created");
      reset();
      onOpenChange(false);
      qc.invalidateQueries({ queryKey: ["all-vouchers"] });
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  const canSubmit = (parseFloat(amount) || 0) > 0 && !mutation.isPending;

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) reset(); onOpenChange(v); }}>
      <DialogContent className="sm:max-w-lg" aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-[15px] font-bold tracking-tight">
            <Receipt className="h-4 w-4 text-brand-600" strokeWidth={2.2} />
            New Voucher (no operation)
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3 mt-1">
          <div className="rounded-lg border border-brand-200 bg-brand-50 px-3 py-2.5 text-xs text-brand-800 dark:border-brand-500/30 dark:bg-brand-500/10 dark:text-brand-300">
            For expenses not tied to an operation. Created as a draft — submit it for
            Bunker Manager approval once recorded.
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Category <span className="text-destructive">*</span></Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {VOUCHER_CATEGORY_OPTIONS.map(([v, l]) => (
                    <SelectItem key={v} value={v}>{l}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Supplier <span className="text-muted-foreground font-normal">(optional)</span></Label>
              <Input placeholder="e.g. NPA" value={supplier} onChange={(e) => setSupplier(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Amount <span className="text-destructive">*</span></Label>
              <Input type="number" step="0.01" placeholder="0.00"
                value={amount} onChange={(e) => setAmount(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Currency</Label>
              <Select value={currency} onValueChange={setCurrency}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CURRENCY_OPTIONS.map((c) => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Payment Date <span className="text-muted-foreground font-normal">(optional)</span></Label>
            <Input type="date" value={paymentDate} onChange={(e) => setPaymentDate(e.target.value)} />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Description <span className="text-muted-foreground font-normal">(optional)</span></Label>
            <Input placeholder="What was this for?" value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Notes <span className="text-muted-foreground font-normal">(optional)</span></Label>
            <Textarea rows={2} className="resize-none" value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => { reset(); onOpenChange(false); }}>Cancel</Button>
          <Button disabled={!canSubmit} onClick={() => mutation.mutate()}>
            {mutation.isPending && <Spinner size={14} className="mr-1.5" />}
            Create Voucher
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
