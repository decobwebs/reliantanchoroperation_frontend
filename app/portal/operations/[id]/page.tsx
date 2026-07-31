"use client";

import { use } from "react";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { ArrowLeft, FileText, Files, Receipt } from "lucide-react";
import { api } from "@/lib/api";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { PanelCard } from "@/components/dashboard/PanelCard";
import { MilestoneTimeline } from "@/components/shared/MilestoneTimeline";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn, formatDate, OP_TYPE_LABELS } from "@/lib/utils";
import type {
  ApiResponse,
  Operation,
  BDN,
  Document,
  Milestone,
  Invoice,
  OperationStatus,
} from "@/types";

export default function PortalOperationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);

  const { data: op, isLoading } = useQuery({
    queryKey: ["portal-op", id],
    queryFn: async () => {
      const res = await api.get<ApiResponse<Operation>>(`/portal/operations/${id}`);
      return res.data.data;
    },
  });

  const { data: milestones } = useQuery({
    queryKey: ["portal-milestones", id],
    queryFn: async () => {
      const res = await api.get<ApiResponse<Milestone[]>>(
        `/portal/operations/${id}/milestones`
      );
      return res.data.data;
    },
  });

  const { data: bdns } = useQuery({
    queryKey: ["portal-bdns", id],
    queryFn: async () => {
      const res = await api.get<ApiResponse<BDN[]>>(
        `/portal/operations/${id}/bdns`
      );
      return res.data.data;
    },
  });

  const { data: docs } = useQuery({
    queryKey: ["portal-docs", id],
    queryFn: async () => {
      const res = await api.get<ApiResponse<Document[]>>(
        `/portal/operations/${id}/documents`
      );
      return res.data.data;
    },
  });

  const { data: invoices } = useQuery({
    queryKey: ["portal-invoices", id],
    queryFn: async () => {
      const res = await api.get<ApiResponse<Invoice[]>>(
        `/portal/operations/${id}/invoices`
      );
      return res.data.data;
    },
  });

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-9 w-64" />
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <div className="space-y-4 lg:col-span-2">
            <Skeleton className="h-56 w-full rounded-2xl" />
          </div>
          <Skeleton className="h-72 w-full rounded-2xl" />
        </div>
      </div>
    );
  }

  if (!op) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-24 text-center">
        <p className="text-sm font-semibold text-foreground">Operation not found</p>
        <p className="max-w-sm text-xs text-muted-foreground">
          This operation may not exist, or you don&rsquo;t have access to it.
        </p>
        <Button variant="outline" size="sm" className="rounded-lg" asChild>
          <Link href="/portal/operations">
            <ArrowLeft className="h-4 w-4" strokeWidth={2.5} />
            Back to operations
          </Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="animate-rise space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <Link
          href="/portal/operations"
          className="inline-flex items-center gap-1.5 rounded text-[13px] font-medium text-brand-600 transition-colors hover:text-brand-700"
        >
          <ArrowLeft className="h-3.5 w-3.5" strokeWidth={2.5} />
          Back
        </Link>
        <div className="min-w-0">
          <h1 className="font-mono text-[22px] font-extrabold leading-none tracking-tight text-foreground">{op.operation_number}</h1>
          <p className="mt-1.5 text-[12.5px] text-muted-foreground">
            {OP_TYPE_LABELS[op.type]}
          </p>
        </div>
        <StatusBadge status={op.status as OperationStatus} className="ml-auto" />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <PanelCard icon={FileText} tone="blue" title="Details">
            <dl className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <dt className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Type</dt>
                <dd className="mt-0.5 text-[13px] font-semibold text-foreground">{OP_TYPE_LABELS[op.type]}</dd>
              </div>
              <div>
                <dt className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Currency</dt>
                <dd className="mt-0.5 text-[13px] font-semibold text-foreground">{op.currency}</dd>
              </div>
              <div>
                <dt className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Expected Volume</dt>
                <dd className="mt-0.5 text-[13px] font-semibold tabular-nums text-foreground">
                  {op.expected_volume_mt
                    ? `${parseFloat(op.expected_volume_mt).toLocaleString()} L`
                    : "—"}
                </dd>
              </div>
              <div>
                <dt className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Actual Volume</dt>
                <dd className="mt-0.5 text-[13px] font-semibold tabular-nums text-foreground">
                  {op.actual_volume_mt
                    ? `${parseFloat(op.actual_volume_mt).toLocaleString()} L`
                    : "—"}
                </dd>
              </div>
              <div>
                <dt className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Created</dt>
                <dd className="mt-0.5 text-[13px] font-semibold text-foreground">{formatDate(op.created_at)}</dd>
              </div>
              <div>
                <dt className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Completed</dt>
                <dd className="mt-0.5 text-[13px] font-semibold text-foreground">{op.completed_at ? formatDate(op.completed_at) : "—"}</dd>
              </div>
              {op.notes && (
                <div className="col-span-2">
                  <dt className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Notes</dt>
                  <dd className="mt-0.5 text-[13px] text-foreground">{op.notes}</dd>
                </div>
              )}
            </dl>
          </PanelCard>

          {bdns && bdns.length > 0 && (
            <PanelCard icon={Receipt} tone="blue" title="Bunker Delivery Notes" flush>
              <div className="divide-y divide-border/70">
                {bdns.map((bdn) => (
                  <div
                    key={bdn.id}
                    className="flex items-center justify-between px-4 py-3 lg:px-5"
                  >
                    <div>
                      <p className="font-mono text-[13px] font-semibold text-foreground">{bdn.bdn_number}</p>
                      <p className="mt-0.5 text-[12px] text-muted-foreground">
                        {parseFloat(bdn.quantity_delivered_mt).toLocaleString()} L
                        {bdn.product_type ? ` · ${bdn.product_type}` : ""}
                        {" · "}{formatDate(bdn.delivery_date)}
                      </p>
                    </div>
                    <Badge
                      variant={bdn.status === "approved" ? "default" : "secondary"}
                      className="rounded-md text-[11px] capitalize"
                    >
                      {bdn.status}
                    </Badge>
                  </div>
                ))}
              </div>
            </PanelCard>
          )}

          {invoices && invoices.length > 0 && (
            <PanelCard icon={FileText} tone="blue" title="Invoices" flush>
              <div className="divide-y divide-border/70">
                {invoices.map((inv) => (
                  <div
                    key={inv.id}
                    className="flex items-center justify-between px-4 py-3 lg:px-5"
                  >
                    <div>
                      <p className="font-mono text-[13px] font-semibold text-foreground">{inv.invoice_number}</p>
                      <p className="mt-0.5 text-[12px] tabular-nums text-muted-foreground">
                        {inv.currency} {parseFloat(inv.total_amount).toLocaleString()}
                        {inv.due_date ? ` · Due ${formatDate(inv.due_date)}` : ""}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {inv.pdf_url && (
                        <a
                          href={inv.pdf_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1 rounded text-[12px] font-semibold text-brand-600 hover:underline"
                        >
                          <FileText className="h-3.5 w-3.5" />
                          PDF
                        </a>
                      )}
                      <Badge
                        variant={
                          inv.status === "paid"
                            ? "default"
                            : inv.status === "overdue"
                            ? "destructive"
                            : "secondary"
                        }
                        className="rounded-md text-[11px] capitalize"
                      >
                        {inv.status}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            </PanelCard>
          )}

          {docs && docs.length > 0 && (
            <PanelCard icon={Files} tone="blue" title="Documents" flush>
              <div className="divide-y divide-border/70">
                {docs.map((doc) => (
                  <a
                    key={doc.id}
                    href={doc.file_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={cn(
                      "flex items-center gap-3 px-4 py-3 transition-colors hover:bg-muted/40 lg:px-5"
                    )}
                  >
                    <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <div className="min-w-0">
                      <p className="truncate text-[13px] font-medium text-brand-600">{doc.file_name}</p>
                      <p className="text-[11.5px] text-muted-foreground">
                        {doc.document_type} · {formatDate(doc.created_at)}
                      </p>
                    </div>
                  </a>
                ))}
              </div>
            </PanelCard>
          )}
        </div>

        <div>
          <MilestoneTimeline milestones={milestones ?? []} />
        </div>
      </div>
    </div>
  );
}
