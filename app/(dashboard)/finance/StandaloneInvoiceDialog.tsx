"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2, FileText } from "lucide-react";
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
import { CURRENCY_OPTIONS } from "@/lib/finance";
import { formatCurrency } from "@/lib/utils";

interface ClientOption {
  id: string;
  full_name: string;
  email: string;
}

/**
 * Create an invoice that isn't tied to any operation (ad-hoc Finance billing).
 * Unlike the operation Finance tab, the client and the line-item description
 * must be supplied explicitly — there's no operation to derive them from.
 */
export function StandaloneInvoiceDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const qc = useQueryClient();
  const [clientId, setClientId] = useState("");
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState("USD");
  const [tax, setTax] = useState("0");
  const [dueDate, setDueDate] = useState("");
  const [notes, setNotes] = useState("");

  // Narrow endpoint (BM+FM) — /admin/users is BM-only and would 403 for Finance.
  const { data: clients } = useQuery({
    queryKey: ["finance-clients"],
    enabled: open,
    queryFn: async () => {
      const res = await api.get("/admin/clients");
      return (res.data?.data ?? []) as ClientOption[];
    },
  });

  const reset = () => {
    setClientId(""); setDescription(""); setAmount("");
    setCurrency("USD"); setTax("0"); setDueDate(""); setNotes("");
  };

  const mutation = useMutation({
    mutationFn: async () => {
      await api.post("/invoices", {
        client_id: clientId,
        description: description.trim(),
        amount: parseFloat(amount),
        currency,
        tax_amount: parseFloat(tax) || 0,
        due_date: dueDate || undefined,
        notes: notes.trim() || undefined,
      });
    },
    onSuccess: () => {
      toast.success("Invoice created");
      reset();
      onOpenChange(false);
      qc.invalidateQueries({ queryKey: ["all-invoices"] });
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  const amt = parseFloat(amount) || 0;
  const taxAmt = parseFloat(tax) || 0;
  const total = amt + taxAmt;
  const canSubmit =
    !!clientId && description.trim().length > 0 && amt > 0 && !mutation.isPending;

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) reset(); onOpenChange(v); }}>
      <DialogContent className="sm:max-w-lg" aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-primary" />
            New Invoice (no operation)
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3 mt-1">
          <div className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2.5 text-xs text-blue-800">
            For ad-hoc billing that isn&rsquo;t tied to an operation (e.g. demurrage,
            agency fees). A branded PDF is generated using the description below.
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Client <span className="text-destructive">*</span></Label>
            <Select value={clientId} onValueChange={setClientId}>
              <SelectTrigger><SelectValue placeholder="Select client…" /></SelectTrigger>
              <SelectContent>
                {clients?.length ? (
                  clients.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.full_name}
                      <span className="ml-1.5 text-xs text-muted-foreground">({c.email})</span>
                    </SelectItem>
                  ))
                ) : (
                  <div className="px-3 py-2 text-xs text-muted-foreground">No clients found</div>
                )}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Description <span className="text-destructive">*</span></Label>
            <Input
              placeholder="e.g. Demurrage — June 2026"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
            <p className="text-[11px] text-muted-foreground">Appears as the line item on the invoice PDF.</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
            <div className="space-y-1.5">
              <Label className="text-xs">Tax Amount</Label>
              <Input type="number" step="0.01" placeholder="0.00"
                value={tax} onChange={(e) => setTax(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Due Date</Label>
              <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
            </div>
          </div>

          <div className="rounded-lg bg-muted/50 px-3 py-2 flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">Total Due</span>
            <span className="text-sm font-bold tabular-nums">{formatCurrency(total, currency)}</span>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Notes <span className="text-muted-foreground font-normal">(optional)</span></Label>
            <Textarea rows={2} className="resize-none" placeholder="Payment terms, context…"
              value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => { reset(); onOpenChange(false); }}>Cancel</Button>
          <Button disabled={!canSubmit} onClick={() => mutation.mutate()}>
            {mutation.isPending && <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />}
            Create Invoice
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
