"use client";

import { use } from "react";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { ArrowLeft, Loader2, FileText, CheckCircle2, Clock } from "lucide-react";
import { api } from "@/lib/api";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { formatDate, formatDateTime, OP_TYPE_LABELS } from "@/lib/utils";
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
      <div className="flex items-center justify-center py-24">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!op) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center gap-3">
        <p className="text-sm font-semibold">Operation not found</p>
        <p className="max-w-sm text-xs text-muted-foreground">
          This operation may not exist, or you don&rsquo;t have access to it.
        </p>
        <Button variant="outline" size="sm" asChild>
          <Link href="/portal/operations">
            <ArrowLeft className="w-4 h-4 mr-1.5" />
            Back to operations
          </Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Back + header */}
      <div className="flex items-center gap-3">
        <Button variant="outline" size="sm" asChild>
          <Link href="/portal/operations">
            <ArrowLeft className="w-4 h-4 mr-1.5" />
            Back
          </Link>
        </Button>
        <div>
          <h2 className="text-xl font-bold">{op.operation_number}</h2>
          <p className="text-sm text-muted-foreground">
            {OP_TYPE_LABELS[op.type]}
          </p>
        </div>
        <StatusBadge
          status={op.status as OperationStatus}
          className="ml-auto text-sm px-3 py-1"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left column */}
        <div className="lg:col-span-2 space-y-6">
          {/* Details */}
          <Card className="border-0 shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold">Details</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">Type</p>
                <p className="mt-0.5">{OP_TYPE_LABELS[op.type]}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">Currency</p>
                <p className="mt-0.5">{op.currency}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">Expected Volume</p>
                <p className="mt-0.5">
                  {op.expected_volume_mt
                    ? `${parseFloat(op.expected_volume_mt).toLocaleString()} MT`
                    : "—"}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">Actual Volume</p>
                <p className="mt-0.5">
                  {op.actual_volume_mt
                    ? `${parseFloat(op.actual_volume_mt).toLocaleString()} MT`
                    : "—"}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">Created</p>
                <p className="mt-0.5">{formatDate(op.created_at)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">Completed</p>
                <p className="mt-0.5">{op.completed_at ? formatDate(op.completed_at) : "—"}</p>
              </div>
              {op.notes && (
                <div className="col-span-2">
                  <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">Notes</p>
                  <p className="mt-0.5">{op.notes}</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* BDNs */}
          {bdns && bdns.length > 0 && (
            <Card className="border-0 shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold">
                  Bunker Delivery Notes
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0 pb-2">
                {bdns.map((bdn) => (
                  <div
                    key={bdn.id}
                    className="flex items-center justify-between px-5 py-3 border-b last:border-0"
                  >
                    <div>
                      <p className="text-sm font-mono font-semibold">{bdn.bdn_number}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {parseFloat(bdn.quantity_delivered_mt).toLocaleString()} MT
                        {bdn.product_type ? ` · ${bdn.product_type}` : ""}
                        {" · "}{formatDate(bdn.delivery_date)}
                      </p>
                    </div>
                    <Badge
                      variant={bdn.status === "approved" ? "default" : "secondary"}
                      className="text-xs"
                    >
                      {bdn.status}
                    </Badge>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Invoices */}
          {invoices && invoices.length > 0 && (
            <Card className="border-0 shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold">Invoices</CardTitle>
              </CardHeader>
              <CardContent className="p-0 pb-2">
                {invoices.map((inv) => (
                  <div
                    key={inv.id}
                    className="flex items-center justify-between px-5 py-3 border-b last:border-0"
                  >
                    <div>
                      <p className="text-sm font-mono font-semibold">{inv.invoice_number}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
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
                          className="text-xs text-primary hover:underline flex items-center gap-1"
                        >
                          <FileText className="w-3.5 h-3.5" />
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
                        className="text-xs"
                      >
                        {inv.status}
                      </Badge>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Documents */}
          {docs && docs.length > 0 && (
            <Card className="border-0 shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold">Documents</CardTitle>
              </CardHeader>
              <CardContent className="p-0 pb-2">
                {docs.map((doc) => (
                  <a
                    key={doc.id}
                    href={doc.file_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-3 px-5 py-3 border-b last:border-0 hover:bg-muted/50 transition-colors"
                  >
                    <FileText className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-primary truncate">{doc.file_name}</p>
                      <p className="text-xs text-muted-foreground">
                        {doc.document_type} · {formatDate(doc.created_at)}
                      </p>
                    </div>
                  </a>
                ))}
              </CardContent>
            </Card>
          )}
        </div>

        {/* Right: milestones */}
        <div>
          <Card className="border-0 shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Clock className="w-4 h-4 text-primary" />
                Progress Milestones
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0 pb-4">
              {milestones?.length ? (
                <ol className="px-5 space-y-0">
                  {milestones.map((m, i) => (
                    <li key={i} className="relative pb-5 pl-6">
                      {i < milestones.length - 1 && (
                        <div className="absolute left-0 top-3 bottom-0 w-px bg-border ml-[5px]" />
                      )}
                      <div className="absolute left-0 top-1.5 w-3 h-3 rounded-full bg-primary flex items-center justify-center">
                        <CheckCircle2 className="w-2.5 h-2.5 text-primary-foreground" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold">{m.title}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {m.description}
                        </p>
                        <p className="text-[10px] text-muted-foreground/60 mt-1">
                          {formatDateTime(m.reached_at)}
                        </p>
                      </div>
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-6">
                  No milestones yet
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
