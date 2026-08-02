"use client";

import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { api, getErrorMessage } from "@/lib/api";
import { ReasonGatedDialog } from "@/components/shared/ReasonGatedDialog";
import { Pencil } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { CURRENCY_OPTIONS } from "@/lib/finance";
import { VESSEL_SOURCE_TYPE_LABELS } from "@/lib/utils";
import type { ApiResponse, Operation, User, Vessel } from "@/types";

/**
 * Edits the fields UpdateOperationRequest already supports on the backend —
 * no status restriction, editable even after completed/archived/cancelled
 * (31 Jul 2026 decision 7). Deliberately a sibling to CreateOperationDialog
 * rather than an extension of it: this field set is meaningfully smaller,
 * and conditionally hiding half of Create's fields would add more
 * complexity than a separate file.
 */
export function EditOperationDialog({
  open,
  onOpenChange,
  operation,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  operation: Operation;
}) {
  const qc = useQueryClient();

  const [clientId, setClientId] = useState(operation.client_id ?? "");
  const [vesselId, setVesselId] = useState(operation.vessel_id ?? "");
  const [sourceType, setSourceType] = useState(operation.source_type ?? "");
  const [actualVolumeMt, setActualVolumeMt] = useState(operation.actual_volume_mt ?? "");
  const [loadingLocation, setLoadingLocation] = useState(operation.loading_location ?? "");
  const [dischargeLocation, setDischargeLocation] = useState(operation.discharge_location ?? "");
  const [currency, setCurrency] = useState(operation.currency ?? "NGN");
  const [notes, setNotes] = useState(operation.notes ?? "");
  const [reason, setReason] = useState("");

  // Re-sync from the current operation every time the dialog opens — this
  // is a shared, reusable dialog, not a fresh-mount-per-operation one.
  useEffect(() => {
    if (!open) return;
    setClientId(operation.client_id ?? "");
    setVesselId(operation.vessel_id ?? "");
    setSourceType(operation.source_type ?? "");
    setActualVolumeMt(operation.actual_volume_mt ?? "");
    setLoadingLocation(operation.loading_location ?? "");
    setDischargeLocation(operation.discharge_location ?? "");
    setCurrency(operation.currency ?? "NGN");
    setNotes(operation.notes ?? "");
    setReason("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, operation.id]);

  const { data: clients } = useQuery({
    queryKey: ["users-clients"],
    queryFn: async () => {
      const res = await api.get<ApiResponse<User[]>>("/admin/users?role=client&per_page=100");
      const d = res.data.data;
      return Array.isArray(d) ? d : (d as unknown as { items: User[] }).items ?? [];
    },
    enabled: open,
  });

  const { data: vessels } = useQuery({
    queryKey: ["vessels-list"],
    queryFn: async () => {
      const res = await api.get<ApiResponse<{ items: Vessel[] }>>("/vessels?per_page=100");
      const d = res.data.data;
      return Array.isArray(d) ? d : (d as { items: Vessel[] }).items ?? [];
    },
    enabled: open && operation.type !== "truck_only",
  });

  const mutation = useMutation({
    mutationFn: async () => {
      await api.put(`/operations/${operation.id}`, {
        client_id: clientId || undefined,
        vessel_id: vesselId || undefined,
        source_type: operation.type === "vessel_only" ? (sourceType || undefined) : undefined,
        actual_volume_mt: actualVolumeMt !== "" ? parseFloat(String(actualVolumeMt)) : undefined,
        loading_location: loadingLocation.trim() || undefined,
        discharge_location: dischargeLocation.trim() || undefined,
        currency: currency || undefined,
        notes: notes.trim() || undefined,
        reason: reason.trim(),
      });
    },
    onSuccess: () => {
      toast.success("Operation updated");
      onOpenChange(false);
      qc.invalidateQueries({ queryKey: ["operation", operation.id] });
      qc.invalidateQueries({ queryKey: ["operations"] });
      qc.invalidateQueries({ queryKey: ["operation-activity", operation.id] });
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  return (
    <ReasonGatedDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Edit Operation"
      icon={Pencil}
      description="Editable at any phase, including after completion — every change is logged with this reason."
      reason={reason}
      onReasonChange={setReason}
      reasonLabel="Reason for this edit"
      confirmLabel="Save Changes"
      pending={mutation.isPending}
      onConfirm={() => mutation.mutate()}
    >
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label className="text-xs">Client</Label>
          <Select value={clientId} onValueChange={setClientId}>
            <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Select…" /></SelectTrigger>
            <SelectContent>
              {clients?.map((c) => (
                <SelectItem key={c.id} value={c.id}>{c.full_name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Currency</Label>
          <Select value={currency} onValueChange={setCurrency}>
            <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
            <SelectContent>
              {CURRENCY_OPTIONS.map((c) => (
                <SelectItem key={c} value={c}>{c}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {operation.type !== "truck_only" && (
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Vessel</Label>
            <Select value={vesselId} onValueChange={setVesselId}>
              <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Select…" /></SelectTrigger>
              <SelectContent>
                {vessels?.map((v) => (
                  <SelectItem key={v.id} value={v.id}>{v.vessel_name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {operation.type === "vessel_only" && (
            <div className="space-y-1.5">
              <Label className="text-xs">Source Type</Label>
              <Select value={sourceType} onValueChange={setSourceType}>
                <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Select…" /></SelectTrigger>
                <SelectContent>
                  {Object.entries(VESSEL_SOURCE_TYPE_LABELS).map(([v, label]) => (
                    <SelectItem key={v} value={v}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>
      )}

      <div className="space-y-1.5">
        <Label className="text-xs">Actual Volume (MT)</Label>
        <Input
          type="number" step="0.001" min="0" className="h-9 text-sm"
          value={actualVolumeMt} onChange={(e) => setActualVolumeMt(e.target.value)}
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label className="text-xs">Loading Location</Label>
          <Input className="h-9 text-sm" value={loadingLocation} onChange={(e) => setLoadingLocation(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Discharge Location</Label>
          <Input className="h-9 text-sm" value={dischargeLocation} onChange={(e) => setDischargeLocation(e.target.value)} />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs">Notes</Label>
        <Textarea rows={3} className="resize-none text-sm" value={notes} onChange={(e) => setNotes(e.target.value)} />
      </div>
    </ReasonGatedDialog>
  );
}
