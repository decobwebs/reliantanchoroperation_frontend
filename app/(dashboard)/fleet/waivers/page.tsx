"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  PlusCircle,
  FileWarning,
  Pencil,
  Trash2,
  CheckCircle2,
  Link2,
} from "lucide-react";
import { Spinner } from "@/components/ui/spinner";
import { toast } from "sonner";
import { api, getErrorMessage } from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { PanelCard } from "@/components/dashboard/PanelCard";
import { KpiCard } from "@/components/dashboard/KpiCard";
import { ReasonGatedDialog } from "@/components/shared/ReasonGatedDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDateTime } from "@/lib/utils";
import type { ApiResponse, TruckWaiver } from "@/types";

export default function WaiversPage() {
  const { effectiveRole } = useAuth();
  const qc = useQueryClient();
  const canAdd = effectiveRole === "bunker_manager";
  const [bulkText, setBulkText] = useState("");

  const { data: waivers, isLoading } = useQuery({
    queryKey: ["truck-waivers"],
    queryFn: async () => {
      const res = await api.get<ApiResponse<TruckWaiver[]>>("/trucks/waivers");
      return res.data.data ?? [];
    },
  });

  const available = waivers?.filter((w) => w.status === "available").length ?? 0;
  const linked = waivers?.filter((w) => w.status === "linked").length ?? 0;

  const bulkAddMutation = useMutation({
    mutationFn: async () => {
      const numbers = bulkText
        .split(/[\n,]/)
        .map((n) => n.trim())
        .filter(Boolean);
      const res = await api.post<ApiResponse<{ created: string[]; skipped_duplicates: string[] }>>(
        "/trucks/waivers/bulk",
        { waybill_truck_numbers: numbers },
      );
      return res.data.data;
    },
    onSuccess: (data) => {
      toast.success(
        `${data.created.length} waiver number(s) added` +
          (data.skipped_duplicates.length ? `, ${data.skipped_duplicates.length} duplicate(s) skipped` : ""),
      );
      setBulkText("");
      qc.invalidateQueries({ queryKey: ["truck-waivers"] });
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  // ── Edit
  const [editId, setEditId] = useState<string | null>(null);
  const [editNumber, setEditNumber] = useState("");
  const [editReason, setEditReason] = useState("");

  const openEdit = (w: TruckWaiver) => {
    setEditId(w.id);
    setEditNumber(w.waybill_truck_number);
    setEditReason("");
  };

  const editMutation = useMutation({
    mutationFn: async () => {
      if (!editId) return;
      await api.put(`/trucks/waivers/${editId}`, {
        waybill_truck_number: editNumber.trim(),
        reason: editReason.trim(),
      });
    },
    onSuccess: () => {
      toast.success("Waiver number updated");
      setEditId(null);
      qc.invalidateQueries({ queryKey: ["truck-waivers"] });
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  // ── Remove
  const [removeId, setRemoveId] = useState<string | null>(null);
  const [removeReason, setRemoveReason] = useState("");

  const removeMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/trucks/waivers/${id}`, { data: { reason: removeReason.trim() } });
    },
    onSuccess: () => {
      toast.success("Waiver number removed");
      setRemoveId(null);
      setRemoveReason("");
      qc.invalidateQueries({ queryKey: ["truck-waivers"] });
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  const removingWaiver = waivers?.find((w) => w.id === removeId);

  return (
    <DashboardShell
      icon={FileWarning}
      iconTone="blue"
      showRole={false}
      title="Waiver Numbers"
      subtitle="Regulatory / BFL truck numbers — added in bulk before sourcing starts"
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <KpiCard variant="plain" tone="emerald" icon={CheckCircle2} title="Available" value={available} />
        <KpiCard variant="plain" tone="blue" icon={Link2} title="Linked to a truck" value={linked} />
      </div>

      {canAdd && (
        <PanelCard icon={PlusCircle} tone="blue" title="Add waiver numbers in bulk" className="animate-rise">
          <p className="mb-3 text-[12.5px] text-muted-foreground">
            Paste one number per line (or comma-separated) — e.g. 25 at a time. Duplicates are skipped automatically.
          </p>
          <Textarea
            rows={6}
            className="resize-none font-mono text-xs"
            placeholder={"MKA 442 ZD\nABJ 690 XB\nABC 245 XC\n…"}
            value={bulkText}
            onChange={(e) => setBulkText(e.target.value)}
          />
          <div className="mt-3 flex justify-end">
            <Button
              className="gap-1.5 rounded-lg"
              disabled={!bulkText.trim() || bulkAddMutation.isPending}
              onClick={() => bulkAddMutation.mutate()}
            >
              {bulkAddMutation.isPending
                ? <Spinner size={14} />
                : <PlusCircle className="h-3.5 w-3.5" />}
              Add Numbers
            </Button>
          </div>
        </PanelCard>
      )}

      {isLoading ? (
        <Skeleton className="h-72 w-full rounded-2xl" />
      ) : (
        <PanelCard icon={FileWarning} tone="blue" title="Registry" flush className="animate-rise">
          {waivers?.length ? (
            <div className="divide-y divide-border/70">
              {waivers.map((w) => (
                <div key={w.id} className="space-y-1.5 px-4 py-3.5 lg:px-5">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <span className="font-mono text-[13px] font-semibold text-foreground">{w.waybill_truck_number}</span>
                      <Badge
                        variant="outline"
                        className={w.status === "available"
                          ? "rounded-md border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/15 dark:text-emerald-300"
                          : "rounded-md border-border text-muted-foreground"}
                      >
                        {w.status}
                      </Badge>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <span className="text-[11px] tabular-nums text-muted-foreground">{formatDateTime(w.created_at)}</span>
                      {canAdd && (
                        <>
                          <Button
                            size="icon" variant="ghost"
                            aria-label="Edit waiver number"
                            className="h-7 w-7 text-muted-foreground hover:text-foreground"
                            onClick={() => openEdit(w)}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          {w.status === "available" && (
                            <Button
                              size="icon" variant="ghost"
                              aria-label="Remove waiver number"
                              className="h-7 w-7 text-destructive hover:text-destructive"
                              onClick={() => { setRemoveId(w.id); setRemoveReason(""); }}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                  {w.status === "linked" && (
                    <p className="text-[12px] text-muted-foreground">
                      Linked to truck <span className="font-mono font-medium text-foreground">{w.linked_truck_number ?? "—"}</span>
                      {w.linked_driver_name && <> · Driver: {w.linked_driver_name}</>}
                      {w.linked_operation_id && (
                        <>
                          {" · "}
                          <Link
                            href={`/operations/${w.linked_operation_id}`}
                            className="rounded font-semibold text-brand-600 underline underline-offset-2 hover:text-brand-700"
                          >
                            {w.linked_operation_number ?? "Operation"}
                          </Link>
                        </>
                      )}
                      {w.linked_at && <> · {formatDateTime(w.linked_at)}</>}
                    </p>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center py-12 text-center">
              <FileWarning className="h-8 w-8 text-muted-foreground/25" strokeWidth={1.5} />
              <p className="mt-2.5 text-sm font-medium text-foreground">No waiver numbers yet</p>
            </div>
          )}
        </PanelCard>
      )}

      {/* ── Edit dialog ── */}
      <ReasonGatedDialog
        open={!!editId}
        onOpenChange={(v) => !v && setEditId(null)}
        title="Edit Waiver Number"
        icon={Pencil}
        reason={editReason}
        onReasonChange={setEditReason}
        confirmLabel="Save Changes"
        pending={editMutation.isPending}
        confirmDisabled={!editNumber.trim()}
        onConfirm={() => editMutation.mutate()}
      >
        <div className="space-y-1.5">
          <Label className="text-xs">Waiver / Regulatory Number</Label>
          <Input
            className="font-mono"
            value={editNumber}
            onChange={(e) => setEditNumber(e.target.value.toUpperCase())}
          />
        </div>
      </ReasonGatedDialog>

      {/* ── Remove dialog ── */}
      <ReasonGatedDialog
        open={!!removeId}
        onOpenChange={(v) => !v && setRemoveId(null)}
        title="Remove Waiver Number"
        icon={Trash2}
        description={removingWaiver ? `${removingWaiver.waybill_truck_number} will no longer be available for sourcing.` : undefined}
        destructive
        reason={removeReason}
        onReasonChange={setRemoveReason}
        reasonLabel="Reason for removing"
        confirmLabel="Remove"
        pending={removeMutation.isPending}
        onConfirm={() => removeId && removeMutation.mutate(removeId)}
      />
    </DashboardShell>
  );
}
