"use client";

import { useState, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import {
  Search,
  FileText,
  Download,
  ChevronLeft,
  ChevronRight,
  Loader2,
  X,
  Filter,
  Receipt,
  FileCheck2,
  FileBadge,
  UploadCloud,
} from "lucide-react";
import { api } from "@/lib/api";
import { Header } from "@/components/layout/Header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatDateTime } from "@/lib/utils";

// ── Types ─────────────────────────────────────────────────────────────────────

interface UnifiedDocItem {
  id: string;
  source_type: "upload" | "pfi" | "pfi_receipt" | "invoice" | "bdn";
  source_id: string;
  operation_id: string | null;
  operation_number: string | null;
  document_type: string;
  file_name: string;
  file_url: string;
  file_size_bytes: number | null;
  mime_type: string | null;
  description: string | null;
  created_at: string;
  uploader_name: string | null;
  uploader_role: string | null;
  source_ref: string | null;
}

interface HubResponse {
  success: boolean;
  data: {
    items: UnifiedDocItem[];
    total: number;
    page: number;
    per_page: number;
    pages: number;
  };
}

// ── Constants ─────────────────────────────────────────────────────────────────

const DOC_TYPE_LABELS: Record<string, string> = {
  bdn:             "BDN",
  invoice:         "Invoice",
  payment_voucher: "Payment Voucher",
  payment_receipt: "Payment Receipt",
  pfi:             "PFI",
  report:          "Report",
  clearance:       "Port / Customs Clearance",
  other:           "Other",
};

const DOC_TYPE_COLORS: Record<string, string> = {
  bdn:             "bg-blue-100 text-blue-800 border-blue-200",
  invoice:         "bg-violet-100 text-violet-800 border-violet-200",
  payment_voucher: "bg-emerald-100 text-emerald-800 border-emerald-200",
  payment_receipt: "bg-teal-100 text-teal-800 border-teal-200",
  pfi:             "bg-amber-100 text-amber-800 border-amber-200",
  report:          "bg-sky-100 text-sky-800 border-sky-200",
  clearance:       "bg-orange-100 text-orange-800 border-orange-200",
  other:           "bg-muted text-muted-foreground border",
};

const SOURCE_LABELS: Record<string, string> = {
  upload:      "Upload",
  pfi:         "PFI Doc",
  pfi_receipt: "PFI Receipt",
  invoice:     "Invoice PDF",
  bdn:         "BDN PDF",
};

const SOURCE_COLORS: Record<string, string> = {
  upload:      "bg-slate-100 text-slate-700 border-slate-200",
  pfi:         "bg-amber-50 text-amber-700 border-amber-200",
  pfi_receipt: "bg-teal-50 text-teal-700 border-teal-200",
  invoice:     "bg-violet-50 text-violet-700 border-violet-200",
  bdn:         "bg-blue-50 text-blue-700 border-blue-200",
};

function SourceIcon({ type }: { type: string }) {
  const cls = "w-3.5 h-3.5 shrink-0";
  if (type === "invoice")     return <FileBadge className={cls} />;
  if (type === "bdn")         return <FileCheck2 className={cls} />;
  if (type === "pfi" || type === "pfi_receipt") return <Receipt className={cls} />;
  return <UploadCloud className={cls} />;
}

function formatBytes(bytes: number | null): string {
  if (!bytes) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function DocumentHubPage() {
  const [keyword,   setKeyword]   = useState("");
  const [docType,   setDocType]   = useState("all");
  const [dateFrom,  setDateFrom]  = useState("");
  const [dateTo,    setDateTo]    = useState("");
  const [page,      setPage]      = useState(1);
  const [search,    setSearch]    = useState("");

  const PER_PAGE = 25;

  const { data, isLoading } = useQuery({
    queryKey: ["doc-hub-unified", search, docType, dateFrom, dateTo, page],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.set("page",     String(page));
      params.set("per_page", String(PER_PAGE));
      if (search)           params.set("keyword",       search);
      if (docType !== "all") params.set("document_type", docType);
      if (dateFrom) params.set("date_from", new Date(dateFrom).toISOString());
      if (dateTo)   params.set("date_to",   new Date(dateTo + "T23:59:59").toISOString());

      const res = await api.get<HubResponse>(`/documents/hub?${params.toString()}`);
      return res.data.data;
    },
    staleTime: 0,
  });

  const docs  = data?.items ?? [];
  const total = data?.total ?? 0;
  const pages = data?.pages ?? 1;

  const commitSearch = useCallback(() => {
    setSearch(keyword);
    setPage(1);
  }, [keyword]);

  const clearFilters = () => {
    setKeyword(""); setSearch(""); setDocType("all");
    setDateFrom(""); setDateTo(""); setPage(1);
  };

  const hasFilters = search || docType !== "all" || dateFrom || dateTo;

  return (
    <div>
      <Header
        title="Document Hub"
        subtitle={`${total.toLocaleString()} document${total !== 1 ? "s" : ""} across all operations`}
      />

      <div className="p-6 space-y-5">
        {/* ── Search & Filters */}
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-3 pt-4 px-5">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Filter className="w-4 h-4 text-primary" />
              Search & Filter
            </CardTitle>
          </CardHeader>
          <CardContent className="px-5 pb-5 space-y-3">
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                <Input
                  className="pl-8 h-9 text-sm"
                  placeholder="Search by file name, reference number, or description…"
                  value={keyword}
                  onChange={(e) => setKeyword(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && commitSearch()}
                />
              </div>
              <Button size="sm" className="h-9 px-4" onClick={commitSearch}>
                Search
              </Button>
              {hasFilters && (
                <Button size="sm" variant="outline" className="h-9 gap-1.5" onClick={clearFilters}>
                  <X className="w-3.5 h-3.5" />Clear
                </Button>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Document Type</Label>
                <Select value={docType} onValueChange={(v) => { setDocType(v); setPage(1); }}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all" className="text-xs">All Types</SelectItem>
                    {Object.entries(DOC_TYPE_LABELS).map(([v, l]) => (
                      <SelectItem key={v} value={v} className="text-xs">{l}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">From Date</Label>
                <Input
                  type="date" className="h-8 text-xs"
                  value={dateFrom}
                  onChange={(e) => { setDateFrom(e.target.value); setPage(1); }}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">To Date</Label>
                <Input
                  type="date" className="h-8 text-xs"
                  value={dateTo}
                  onChange={(e) => { setDateTo(e.target.value); setPage(1); }}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* ── Source legend */}
        <div className="flex flex-wrap gap-2 px-1">
          {Object.entries(SOURCE_LABELS).map(([key, label]) => (
            <span
              key={key}
              className={`inline-flex items-center gap-1.5 text-[11px] px-2 py-1 rounded-full border ${SOURCE_COLORS[key]}`}
            >
              <SourceIcon type={key} />
              {label}
            </span>
          ))}
        </div>

        {/* ── Document Table */}
        <Card className="border-0 shadow-sm">
          <CardContent className="p-0">
            {isLoading ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
              </div>
            ) : docs.length === 0 ? (
              <div className="flex flex-col items-center py-16 text-muted-foreground gap-2">
                <FileText className="w-10 h-10 opacity-25" />
                <p className="text-sm">{hasFilters ? "No documents match your filters" : "No documents on the system yet"}</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/30 hover:bg-muted/30">
                    <TableHead className="text-xs">File / Description</TableHead>
                    <TableHead className="text-xs">Source</TableHead>
                    <TableHead className="text-xs">Type</TableHead>
                    <TableHead className="text-xs">Operation</TableHead>
                    <TableHead className="text-xs">Uploaded By</TableHead>
                    <TableHead className="text-xs">Size</TableHead>
                    <TableHead className="text-xs">Date &amp; Time</TableHead>
                    <TableHead className="w-12" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {docs.map((doc) => (
                    <TableRow key={doc.id} className="hover:bg-muted/20">
                      {/* File / description */}
                      <TableCell className="max-w-52">
                        <div className="flex items-center gap-2 min-w-0">
                          <FileText className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                          <div className="min-w-0">
                            <p className="text-xs font-medium truncate" title={doc.file_name}>
                              {doc.file_name}
                            </p>
                            {doc.description && (
                              <p className="text-[10px] text-muted-foreground truncate" title={doc.description}>
                                {doc.description}
                              </p>
                            )}
                            {doc.source_ref && (
                              <p className="text-[10px] font-mono text-primary/70">{doc.source_ref}</p>
                            )}
                          </div>
                        </div>
                      </TableCell>

                      {/* Source badge */}
                      <TableCell>
                        <span className={`inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded border ${SOURCE_COLORS[doc.source_type] ?? SOURCE_COLORS.upload}`}>
                          <SourceIcon type={doc.source_type} />
                          {SOURCE_LABELS[doc.source_type] ?? doc.source_type}
                        </span>
                      </TableCell>

                      {/* Doc type */}
                      <TableCell>
                        <Badge
                          className={`text-[10px] px-1.5 border capitalize ${DOC_TYPE_COLORS[doc.document_type] ?? DOC_TYPE_COLORS.other}`}
                        >
                          {DOC_TYPE_LABELS[doc.document_type] ?? doc.document_type}
                        </Badge>
                      </TableCell>

                      {/* Operation */}
                      <TableCell>
                        {doc.operation_id ? (
                          <Link
                            href={`/operations/${doc.operation_id}`}
                            className="text-xs font-mono text-primary hover:underline"
                          >
                            {doc.operation_number ?? doc.operation_id.slice(0, 8)}
                          </Link>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </TableCell>

                      {/* Uploader */}
                      <TableCell>
                        <div>
                          <p className="text-xs font-medium">{doc.uploader_name ?? "—"}</p>
                          {doc.uploader_role && (
                            <p className="text-[10px] text-muted-foreground capitalize">
                              {doc.uploader_role.replace(/_/g, " ")}
                            </p>
                          )}
                        </div>
                      </TableCell>

                      {/* Size */}
                      <TableCell className="text-xs text-muted-foreground">
                        {formatBytes(doc.file_size_bytes)}
                      </TableCell>

                      {/* Date */}
                      <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                        {formatDateTime(doc.created_at)}
                      </TableCell>

                      {/* Download */}
                      <TableCell>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 w-7 p-0"
                          title="Open document"
                          onClick={async () => {
                            if (doc.source_type === "upload") {
                              try {
                                const res = await api.get<{ success: boolean; data: { url: string } }>(
                                  `/documents/${doc.source_id}/download`
                                );
                                window.open(res.data.data.url, "_blank", "noopener,noreferrer");
                                return;
                              } catch {
                                // fall through to direct URL
                              }
                            }
                            window.open(doc.file_url, "_blank", "noopener,noreferrer");
                          }}
                        >
                          <Download className="w-3.5 h-3.5" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* ── Pagination */}
        {pages > 1 && (
          <div className="flex items-center justify-between px-1">
            <p className="text-xs text-muted-foreground">
              Showing {((page - 1) * PER_PAGE) + 1}–{Math.min(page * PER_PAGE, total)} of {total.toLocaleString()}
            </p>
            <div className="flex items-center gap-2">
              <Button
                size="sm" variant="outline" className="h-8 w-8 p-0"
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
              >
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <span className="text-xs font-medium">{page} / {pages}</span>
              <Button
                size="sm" variant="outline" className="h-8 w-8 p-0"
                disabled={page >= pages}
                onClick={() => setPage((p) => p + 1)}
              >
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
