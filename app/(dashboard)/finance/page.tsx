"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import Link from "next/link";
import {
  DollarSign,
  FileText,
  CheckCircle2,
  Clock,
  TrendingUp,
  ExternalLink,
  PlusCircle,
  Receipt,
  UserPlus,
  Phone,
} from "lucide-react";
import { Spinner } from "@/components/ui/spinner";
import { toast } from "sonner";
import { api, getErrorMessage } from "@/lib/api";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { PanelCard } from "@/components/dashboard/PanelCard";
import { StatCard } from "@/components/shared/StatCard";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn, formatCurrency, formatDate } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { canManageFinance } from "@/lib/auth";
import { QueryError } from "@/components/shared/QueryError";
import { Button } from "@/components/ui/button";
import {
  INVOICE_STATUS_CLASS,
  VOUCHER_STATUS_CLASS,
  VOUCHER_CATEGORY_LABELS,
} from "@/lib/finance";
import { StandaloneInvoiceDialog } from "./StandaloneInvoiceDialog";
import { StandaloneVoucherDialog } from "./StandaloneVoucherDialog";
import type {
  ApiResponse,
  PaginatedData,
  Operation,
  OperationStatus,
  Invoice,
  Voucher,
} from "@/types";

// ── Create Client (Finance's own standalone profile creation — role is
// always "client", unlike the Admin page's create-user dialog which picks
// any staff role) ───────────────────────────────────────────────────────────

const createClientSchema = z.object({
  full_name: z.string().min(2, "Name must be at least 2 characters"),
  email: z.string().email("Invalid email"),
});
type CreateClientForm = z.infer<typeof createClientSchema>;

function CreateClientDialog() {
  const [open, setOpen] = useState(false);
  const [phone, setPhone] = useState("");
  const qc = useQueryClient();
  const {
    register, handleSubmit, reset, formState: { errors },
  } = useForm<CreateClientForm>({ resolver: zodResolver(createClientSchema) });

  const mutation = useMutation({
    mutationFn: async (data: CreateClientForm) => {
      const res = await api.post("/admin/users", {
        ...data,
        role: "client",
        phone: phone.trim() || undefined,
      });
      return res.data;
    },
    onSuccess: (res) => {
      const emailSent = res?.data?.email_sent;
      if (emailSent === false) {
        toast.warning(
          "Client created, but the password-setup email could not be sent. " +
          "Check email configuration and ask them to use “Forgot password” instead."
        );
      } else {
        toast.success("Client profile created — a password-setup email has been sent");
      }
      qc.invalidateQueries({ queryKey: ["users-clients"] });
      reset();
      setPhone("");
      setOpen(false);
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          <UserPlus className="w-4 h-4 sm:mr-1.5" />
          <span className="hidden sm:inline">New Client</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md" aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-[15px] font-bold tracking-tight">
            <UserPlus className="h-4 w-4 text-brand-600" strokeWidth={2.2} />
            Create Client Profile
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit((d) => mutation.mutate(d))} className="space-y-4 mt-2">
          <div className="space-y-1.5">
            <Label htmlFor="client_full_name">Full Name</Label>
            <Input id="client_full_name" placeholder="Client company or contact name" {...register("full_name")} />
            {errors.full_name && <p className="text-xs text-destructive">{errors.full_name.message}</p>}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="client_email">Email</Label>
            <Input id="client_email" type="email" placeholder="client@company.com" {...register("email")} />
            {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="client_phone">
              WhatsApp Phone <span className="text-muted-foreground font-normal">(optional)</span>
            </Label>
            <div className="relative">
              <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <Input
                id="client_phone" type="tel" placeholder="+2348012345678" className="pl-9"
                value={phone} onChange={(e) => setPhone(e.target.value)}
              />
            </div>
          </div>
          <div className="rounded-md border border-primary/20 bg-primary/5 px-3 py-2.5 text-[11px] text-muted-foreground">
            No password is set here. The client receives an email with a secure link to choose their own.
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending && <Spinner size={16} className="mr-1.5" />}
              Create Client
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// Finance-relevant statuses — ordered per new commercial flow:
// PFI (advance) → payment confirmed → ops → BDN → invoice → complete
const FINANCE_STATUSES: OperationStatus[] = [
  "active",
  "pfi_linked",
  "payment_processing",
  "payment_confirmed",
  "vessel_operations",
  "bdn_pending",
  "bdn_approved",
  "invoiced",
  "completed",
];

interface AnalyticsDashboard {
  operations: {
    total_operations: number;
    total_pfis: number;
    total_bdns_approved: number;
    active_operations: number;
    completed_this_month: number;
  };
  revenue: { currency: string; total_amount: string; payment_count: number }[];
}

export default function FinancePage() {
  const { user, effectiveRole } = useAuth();
  const canSee = user && effectiveRole ? canManageFinance(effectiveRole) : true;
  // Page is BM+FM, but the create endpoints are FM-only — don't show a BM
  // buttons that would 403.
  const isFM = effectiveRole === "finance_manager";
  const [showInvoice, setShowInvoice] = useState(false);
  const [showVoucher, setShowVoucher] = useState(false);

  const invoicesQuery = useQuery({
    queryKey: ["all-invoices"],
    enabled: canSee,
    queryFn: async () => {
      const res = await api.get<ApiResponse<Invoice[]>>("/invoices");
      return (res.data.data ?? []) as Invoice[];
    },
  });

  const vouchersQuery = useQuery({
    queryKey: ["all-vouchers"],
    enabled: canSee,
    queryFn: async () => {
      const res = await api.get<ApiResponse<Voucher[]>>("/vouchers");
      const d = res.data.data as unknown;
      return (Array.isArray(d) ? d : ((d as { items?: Voucher[] })?.items ?? [])) as Voucher[];
    },
  });

  const { data: analytics } = useQuery<AnalyticsDashboard>({
    queryKey: ["analytics-dashboard"],
    enabled: canSee,
    queryFn: async () => {
      const res = await api.get("/analytics/dashboard");
      return res.data.data;
    },
  });

  // Fetch ALL finance-stage operations by paging through the list (the previous
  // single per_page=50 call silently dropped finance ops beyond row 50).
  const { data: opsData, isLoading: opsLoading, isError, error, refetch } = useQuery({
    queryKey: ["finance-operations"],
    enabled: canSee,
    queryFn: async () => {
      const perPage = 100;
      let page = 1;
      let all: Operation[] = [];
      let total = Infinity;
      while (all.length < total && page <= 20) {
        const res = await api.get<ApiResponse<PaginatedData<Operation>>>(
          `/operations?page=${page}&per_page=${perPage}`
        );
        const data = res.data.data;
        all = all.concat(data.items);
        total = data.total ?? all.length;
        if (data.items.length < perPage) break;
        page += 1;
      }
      return all.filter((op) =>
        FINANCE_STATUSES.includes(op.status as OperationStatus)
      );
    },
  });

  if (user && !canSee) {
    return (
      <DashboardShell icon={DollarSign} iconTone="blue" showRole={false} title="Finance" subtitle="Restricted">
        <QueryError error={{ isAxiosError: true, response: { status: 403 } }} />
      </DashboardShell>
    );
  }

  const revenue = analytics?.revenue ?? [];
  const totalPayments = revenue.reduce(
    (sum, r) => sum + r.payment_count,
    0
  );

  return (
    <DashboardShell
      icon={DollarSign}
      iconTone="blue"
      showRole={false}
      title="Finance"
      subtitle="Revenue, PFIs and payment tracking"
      actions={
        isFM ? (
          <div className="flex gap-2">
            <CreateClientDialog />
            <Button variant="outline" className="h-10.5 gap-2 rounded-xl text-[13px] font-semibold" onClick={() => setShowVoucher(true)}>
              <Receipt className="h-4 w-4" strokeWidth={2.5} />
              <span className="hidden sm:inline">New Voucher</span>
            </Button>
            <Button className="h-10.5 gap-2 rounded-xl text-[13px] font-semibold" onClick={() => setShowInvoice(true)}>
              <PlusCircle className="h-4 w-4" strokeWidth={2.5} />
              <span className="hidden sm:inline">New Invoice</span>
            </Button>
          </div>
        ) : undefined
      }
    >
      <StandaloneInvoiceDialog open={showInvoice} onOpenChange={setShowInvoice} />
      <StandaloneVoucherDialog open={showVoucher} onOpenChange={setShowVoucher} />

      {/* Revenue stat cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {revenue.map((r) => (
          <StatCard
            key={r.currency}
            title={`Revenue (${r.currency})`}
            value={formatCurrency(parseFloat(r.total_amount), r.currency)}
            subtitle={`${r.payment_count} payment${r.payment_count !== 1 ? "s" : ""}`}
            icon={DollarSign}
            color="emerald"
          />
        ))}
        {revenue.length === 0 && (
          <StatCard
            title="Total Revenue"
            value="—"
            subtitle="No payments recorded"
            icon={DollarSign}
            color="emerald"
          />
        )}
        <StatCard
          title="PFIs Linked"
          value={String(analytics?.operations.total_pfis ?? "—")}
          subtitle="Pro-forma invoices"
          icon={FileText}
          color="blue"
        />
        <StatCard
          title="BDNs Approved"
          value={String(analytics?.operations.total_bdns_approved ?? "—")}
          subtitle="Bunker delivery notes"
          icon={CheckCircle2}
          color="amber"
        />
        <StatCard
          title="Payments Confirmed"
          value={String(totalPayments || "—")}
          subtitle="Across all currencies"
          icon={TrendingUp}
          color="purple"
        />
      </div>

      {/* Finance-stage operations table */}
      <PanelCard icon={Clock} tone="blue" title="Operations in Finance Pipeline" flush className="animate-rise">
        {isError ? (
          <div className="p-4 lg:p-5"><QueryError error={error} onRetry={() => refetch()} /></div>
        ) : opsLoading ? (
          <div className="space-y-2 p-4 lg:p-5">
            {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-14 rounded-lg" />)}
          </div>
        ) : opsData?.length === 0 ? (
          <div className="flex flex-col items-center py-12 text-center">
            <FileText className="h-9 w-9 text-muted-foreground/25" strokeWidth={1.5} />
            <p className="mt-3 text-sm font-medium text-foreground">No operations currently in finance stage</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50 hover:bg-muted/50">
                  <TableHead className="text-[11px] font-semibold uppercase tracking-wide">Operation</TableHead>
                  <TableHead className="text-[11px] font-semibold uppercase tracking-wide">Type</TableHead>
                  <TableHead className="text-[11px] font-semibold uppercase tracking-wide">Status</TableHead>
                  <TableHead className="text-[11px] font-semibold uppercase tracking-wide">Currency</TableHead>
                  <TableHead className="text-[11px] font-semibold uppercase tracking-wide">Created</TableHead>
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {opsData?.map((op) => (
                  <TableRow key={op.id} className="hover:bg-muted/40">
                    <TableCell className="font-mono text-[12.5px] font-semibold text-brand-600">
                      {op.operation_number}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="rounded-md text-[11px] capitalize">
                        {op.type.replace(/_/g, " ")}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={op.status as OperationStatus} />
                    </TableCell>
                    <TableCell className="text-[12px] text-muted-foreground">
                      {op.currency}
                    </TableCell>
                    <TableCell className="text-[12px] tabular-nums text-muted-foreground">
                      {formatDate(op.created_at)}
                    </TableCell>
                    <TableCell>
                      <Link
                        href={`/operations/${op.id}`}
                        className="inline-flex items-center gap-1 rounded text-[12px] font-semibold text-brand-600 hover:underline"
                      >
                        <ExternalLink className="h-3 w-3" />
                      </Link>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </PanelCard>

      {/* ── Invoices (incl. standalone) ─────────────────────────────────── */}
      <PanelCard icon={FileText} tone="blue" title="Invoices" flush className="animate-rise">
        {invoicesQuery.isError ? (
          <div className="p-4 lg:p-5">
            <QueryError error={invoicesQuery.error} onRetry={() => invoicesQuery.refetch()} />
          </div>
        ) : invoicesQuery.isLoading ? (
          <Skeleton className="m-4 h-40 rounded-lg lg:m-5" />
        ) : !invoicesQuery.data?.length ? (
          <div className="flex flex-col items-center py-10 text-center">
            <FileText className="h-8 w-8 text-muted-foreground/25" strokeWidth={1.5} />
            <p className="mt-2.5 text-sm font-medium text-foreground">No invoices yet</p>
          </div>
        ) : (
          <div className="divide-y divide-border/70">
            {invoicesQuery.data.map((inv) => (
              <div key={inv.id} className="flex items-center justify-between gap-3 px-4 py-3 lg:px-5">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-[12.5px] font-semibold text-brand-600">
                      {inv.invoice_number}
                    </span>
                    <Badge className={cn("rounded-md text-[10px]", INVOICE_STATUS_CLASS[inv.status] ?? "")} variant="secondary">
                      {inv.status}
                    </Badge>
                    {!inv.operation_id && (
                      <Badge variant="outline" className="rounded-md text-[10px]">Standalone</Badge>
                    )}
                  </div>
                  <p className="mt-0.5 truncate text-[12px] text-muted-foreground">
                    {inv.client_name ? `${inv.client_name} · ` : ""}
                    {inv.description || "Operation invoice"} · {formatDate(inv.created_at)}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  <span className="text-[13px] font-semibold tabular-nums text-foreground">
                    {formatCurrency(inv.total_amount, inv.currency)}
                  </span>
                  {inv.operation_id && (
                    <Link
                      href={`/operations/${inv.operation_id}`}
                      className="text-brand-600 hover:text-brand-700"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                    </Link>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </PanelCard>

      {/* ── Vouchers (incl. standalone) ─────────────────────────────────── */}
      <PanelCard icon={Receipt} tone="blue" title="Expense Vouchers" flush className="animate-rise">
        {vouchersQuery.isError ? (
          <div className="p-4 lg:p-5">
            <QueryError error={vouchersQuery.error} onRetry={() => vouchersQuery.refetch()} />
          </div>
        ) : vouchersQuery.isLoading ? (
          <Skeleton className="m-4 h-40 rounded-lg lg:m-5" />
        ) : !vouchersQuery.data?.length ? (
          <div className="flex flex-col items-center py-10 text-center">
            <Receipt className="h-8 w-8 text-muted-foreground/25" strokeWidth={1.5} />
            <p className="mt-2.5 text-sm font-medium text-foreground">No vouchers yet</p>
          </div>
        ) : (
          <div className="divide-y divide-border/70">
            {vouchersQuery.data.map((v) => (
              <div key={v.id} className="flex items-center justify-between gap-3 px-4 py-3 lg:px-5">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-[12.5px] font-semibold text-brand-600">
                      {v.voucher_number}
                    </span>
                    <Badge className={cn("rounded-md text-[10px]", VOUCHER_STATUS_CLASS[v.status] ?? "")} variant="secondary">
                      {v.status}
                    </Badge>
                    {!v.operation_id && (
                      <Badge variant="outline" className="rounded-md text-[10px]">Standalone</Badge>
                    )}
                  </div>
                  <p className="mt-0.5 truncate text-[12px] text-muted-foreground">
                    {VOUCHER_CATEGORY_LABELS[v.category] ?? v.category}
                    {v.supplier_name ? ` · ${v.supplier_name}` : ""} · {formatDate(v.created_at)}
                  </p>
                </div>
                <span className="shrink-0 text-[13px] font-semibold tabular-nums text-foreground">
                  {formatCurrency(v.amount, v.currency)}
                </span>
              </div>
            ))}
          </div>
        )}
      </PanelCard>
    </DashboardShell>
  );
}
