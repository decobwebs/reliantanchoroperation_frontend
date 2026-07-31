"use client";

import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import {
  FileText,
  Download,
  X,
  Receipt,
  FileCheck2,
  FileBadge,
  UploadCloud,
} from "lucide-react";
import { api } from "@/lib/api";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { PanelCard } from "@/components/dashboard/PanelCard";
import { FilterBar, FilterSearch, FilterSelect } from "@/components/dashboard/FilterBar";
import { TablePagination } from "@/components/dashboard/TablePagination";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { cn, formatDateTime } from "@/lib/utils";

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
// Eight document types and five source types both exceed the five-tone
// AccentTone vocabulary, so — same call as Activity Log's entity badges —
// these stay their own constants rather than force-fitting tones.ts; only
// the raw colour values move to token-based equivalents.

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
  bdn:             "bg-brand-100 text-brand-800 border-brand-200 dark:bg-brand-500/15 dark:text-brand-300 dark:border-brand-500/30",
  invoice:         "bg-violet-100 text-violet-800 border-violet-200 dark:bg-violet-500/15 dark:text-violet-300 dark:border-violet-500/30",
  payment_voucher: "bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-300 dark:border-emerald-500/30",
  payment_receipt: "bg-teal-100 text-teal-800 border-teal-200 dark:bg-teal-500/15 dark:text-teal-300 dark:border-teal-500/30",
  pfi:             "bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-500/15 dark:text-amber-300 dark:border-amber-500/30",
  report:          "bg-brand-100 text-brand-800 border-brand-200 dark:bg-brand-500/15 dark:text-brand-300 dark:border-brand-500/30",
  clearance:       "bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-500/15 dark:text-amber-300 dark:border-amber-500/30",
  other:           "bg-muted text-muted-foreground border-border",
};

const SOURCE_LABELS: Record<string, string> = {
  upload:      "Upload",
  pfi:         "PFI Doc",
  pfi_receipt: "PFI Receipt",
  invoice:     "Invoice PDF",
  bdn:         "BDN PDF",
};

const SOURCE_COLORS: Record<string, string> = {
  upload:      "bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-500/15 dark:text-slate-300 dark:border-slate-500/30",
  pfi:         "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-500/15 dark:text-amber-300 dark:border-amber-500/30",
  pfi_receipt: "bg-teal-50 text-teal-700 border-teal-200 dark:bg-teal-500/15 dark:text-teal-300 dark:border-teal-500/30",
  invoice:     "bg-violet-50 text-violet-700 border-violet-200 dark:bg-violet-500/15 dark:text-violet-300 dark:border-violet-500/30",
  bdn:         "bg-brand-50 text-brand-700 border-brand-200 dark:bg-brand-500/15 dark:text-brand-300 dark:border-brand-500/30",
};

function SourceIcon({ type }: { type: string }) {
  const cls = "h-3.5 w-3.5 shrink-0";
  if (type === "invoice")     return <FileBadge className={cls} strokeWidth={2} />;
  if (type === "bdn")         return <FileCheck2 className={cls} strokeWidth={2} />;
  if (type === "pfi" || type === "pfi_receipt") return <Receipt className={cls} strokeWidth={2} />;
  return <UploadCloud className={cls} strokeWidth={2} />;
}

function formatBytes(bytes: number | null): string {
  if (!bytes) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const DOC_TYPE_OPTIONS = [
  { value: "all", label: "All Types" },
  ...Object.entries(DOC_TYPE_LABELS).map(([value, label]) => ({ value, label })),
];

// ── Page ──────────────────────────────────────────────────────────────────────

export default function DocumentHubPage() {
  const [keywordInput, setKeywordInput] = useState("");
  const [search,        setSearch]      = useState("");
  const [docType,       setDocType]     = useState("all");
  const [dateFrom,      setDateFrom]    = useState("");
  const [dateTo,        setDateTo]      = useState("");
  const [page,          setPage]        = useState(1);

  const PER_PAGE = 25;

  // Debounce the keyword search — matches the operations list's convention.
  useEffect(() => {
    const t = setTimeout(() => {
      setSearch(keywordInput);
      setPage(1);
    }, 350);
    return () => clearTimeout(t);
  }, [keywordInput]);

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

  const clearFilters = () => {
    setKeywordInput(""); setSearch(""); setDocType("all");
    setDateFrom(""); setDateTo(""); setPage(1);
  };

  const hasFilters = search || docType !== "all" || dateFrom || dateTo;

  return (
    <DashboardShell
      icon={FileText}
      iconTone="blue"
      showRole={false}
      title="Document Hub"
      subtitle={`${total.toLocaleString()} document${total !== 1 ? "s" : ""} across all operations`}
    >
      <FilterBar className="animate-rise">
        <FilterSearch
          value={keywordInput}
          onChange={setKeywordInput}
          placeholder="Search by file name, reference number, or description…"
        />
        <FilterSelect
          value={docType}
          onChange={(v) => { setDocType(v); setPage(1); }}
          options={DOC_TYPE_OPTIONS}
          label="Document type"
          className="w-full sm:w-48"
        />
        <div className="flex items-center gap-2">
          <Label className="sr-only" htmlFor="doc-date-from">From date</Label>
          <Input
            id="doc-date-from"
            type="date"
            className="h-11 w-36 rounded-xl border-navy-100 text-[13px] dark:border-border"
            value={dateFrom}
            onChange={(e) => { setDateFrom(e.target.value); setPage(1); }}
          />
          <span className="text-xs text-muted-foreground">to</span>
          <Label className="sr-only" htmlFor="doc-date-to">To date</Label>
          <Input
            id="doc-date-to"
            type="date"
            className="h-11 w-36 rounded-xl border-navy-100 text-[13px] dark:border-border"
            value={dateTo}
            onChange={(e) => { setDateTo(e.target.value); setPage(1); }}
          />
        </div>
        {hasFilters && (
          <Button
            variant="outline"
            className="h-11 gap-1.5 rounded-xl border-navy-100 text-[13px] font-semibold dark:border-border"
            onClick={clearFilters}
          >
            <X className="h-3.5 w-3.5" />
            Clear
          </Button>
        )}
      </FilterBar>

      <div className="flex flex-wrap gap-2">
        {Object.entries(SOURCE_LABELS).map(([key, label]) => (
          <span
            key={key}
            className={cn("inline-flex items-center gap-1.5 rounded-full border px-2 py-1 text-[11px] font-medium", SOURCE_COLORS[key])}
          >
            <SourceIcon type={key} />
            {label}
          </span>
        ))}
      </div>

      {isLoading ? (
        <Skeleton className="h-96 w-full rounded-2xl" />
      ) : (
        <PanelCard icon={FileText} tone="blue" title="Documents" flush className="animate-rise overflow-hidden">
          {docs.length === 0 ? (
            <div className="flex flex-col items-center py-16 text-center">
              <FileText className="h-9 w-9 text-muted-foreground/25" strokeWidth={1.5} />
              <p className="mt-3 text-sm font-medium text-foreground">
                {hasFilters ? "No documents match your filters" : "No documents on the system yet"}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50 hover:bg-muted/50">
                    <TableHead className="text-[11px] font-semibold uppercase tracking-wide">File / Description</TableHead>
                    <TableHead className="text-[11px] font-semibold uppercase tracking-wide">Source</TableHead>
                    <TableHead className="text-[11px] font-semibold uppercase tracking-wide">Type</TableHead>
                    <TableHead className="text-[11px] font-semibold uppercase tracking-wide">Operation</TableHead>
                    <TableHead className="text-[11px] font-semibold uppercase tracking-wide">Uploaded By</TableHead>
                    <TableHead className="text-[11px] font-semibold uppercase tracking-wide">Size</TableHead>
                    <TableHead className="text-[11px] font-semibold uppercase tracking-wide">Date &amp; Time</TableHead>
                    <TableHead className="w-12" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {docs.map((doc) => (
                    <TableRow key={doc.id} className="hover:bg-muted/40">
                      <TableCell className="max-w-52">
                        <div className="flex min-w-0 items-center gap-2">
                          <FileText className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                          <div className="min-w-0">
                            <p className="truncate text-[12.5px] font-medium text-foreground" title={doc.file_name}>
                              {doc.file_name}
                            </p>
                            {doc.description && (
                              <p className="truncate text-[11px] text-muted-foreground" title={doc.description}>
                                {doc.description}
                              </p>
                            )}
                            {doc.source_ref && (
                              <p className="font-mono text-[11px] text-brand-600/80">{doc.source_ref}</p>
                            )}
                          </div>
                        </div>
                      </TableCell>

                      <TableCell>
                        <span className={cn("inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[10px]", SOURCE_COLORS[doc.source_type] ?? SOURCE_COLORS.upload)}>
                          <SourceIcon type={doc.source_type} />
                          {SOURCE_LABELS[doc.source_type] ?? doc.source_type}
                        </span>
                      </TableCell>

                      <TableCell>
                        <Badge
                          className={cn("rounded-md border px-1.5 text-[10px] capitalize", DOC_TYPE_COLORS[doc.document_type] ?? DOC_TYPE_COLORS.other)}
                        >
                          {DOC_TYPE_LABELS[doc.document_type] ?? doc.document_type}
                        </Badge>
                      </TableCell>

                      <TableCell>
                        {doc.operation_id ? (
                          <Link
                            href={`/operations/${doc.operation_id}`}
                            className="rounded font-mono text-[12px] font-semibold text-brand-600 hover:underline"
                          >
                            {doc.operation_number ?? doc.operation_id.slice(0, 8)}
                          </Link>
                        ) : (
                          <span className="text-[12px] text-muted-foreground">—</span>
                        )}
                      </TableCell>

                      <TableCell>
                        <div>
                          <p className="text-[12.5px] font-medium text-foreground">{doc.uploader_name ?? "—"}</p>
                          {doc.uploader_role && (
                            <p className="text-[10.5px] capitalize text-muted-foreground">
                              {doc.uploader_role.replace(/_/g, " ")}
                            </p>
                          )}
                        </div>
                      </TableCell>

                      <TableCell className="text-[12px] tabular-nums text-muted-foreground">
                        {formatBytes(doc.file_size_bytes)}
                      </TableCell>

                      <TableCell className="whitespace-nowrap text-[12px] tabular-nums text-muted-foreground">
                        {formatDateTime(doc.created_at)}
                      </TableCell>

                      <TableCell>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7 text-muted-foreground hover:text-foreground"
                          aria-label="Open document"
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
                          <Download className="h-3.5 w-3.5" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          <TablePagination
            page={page}
            totalPages={pages}
            from={total === 0 ? 0 : (page - 1) * PER_PAGE + 1}
            to={Math.min(page * PER_PAGE, total)}
            total={total}
            noun="documents"
            onPageChange={setPage}
          />
        </PanelCard>
      )}
    </DashboardShell>
  );
}
