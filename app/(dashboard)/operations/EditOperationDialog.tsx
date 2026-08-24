"use client";

import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { api, getErrorMessage } from "@/lib/api";
import { ReasonGatedDialog } from "@/components/shared/ReasonGatedDialog";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { CURRENCY_OPTIONS } from "@/lib/finance";
import { VESSEL_SOURCE_TYPE_LABELS } from "@/lib/utils";
import { PRODUCT_TYPE_LABELS } from "@/types";
import type {
  ApiResponse, Operation, User, Vessel, NavalClearance, PFI, ProductType, Task,
} from "@/types";

const PRODUCT_TYPES = Object.keys(PRODUCT_TYPE_LABELS) as ProductType[];

const TASK_TYPES = [
  { value: "truck_logistics", label: "Truck Logistics" },
  { value: "vessel_operations", label: "Vessel Operations" },
  { value: "marine_discharge", label: "Marine Discharge" },
];

const PRIORITIES = ["low", "normal", "high", "urgent"];

/**
 * Full-parity edit: every field CreateOperationDialog offers is editable here,
 * because a detail can change at any point during a live operation.
 *
 * Two things behave differently from Create, both deliberate:
 *
 *  - Operation Type is only editable while the operation is still in Draft.
 *    Type decides which pipeline the operation follows, and switching it after
 *    work has started would leave the operation in a status the new pipeline
 *    has no route out of. The backend refuses it too — this just doesn't offer
 *    what would be rejected.
 *
 *  - Assignments, PFI allocations and Naval Clearances are applied immediately
 *    through their own endpoints rather than being batched into Save. They are
 *    separate records with their own audit trails, and Create links them the
 *    same way (one call each after the operation exists).
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
  const isDraft = operation.status === "draft";

  const [opType, setOpType] = useState(operation.type);
  const [clientId, setClientId] = useState(operation.client_id ?? "");
  const [vesselId, setVesselId] = useState(operation.vessel_id ?? "");
  const [sourceType, setSourceType] = useState(operation.source_type ?? "");
  const [actualVolumeMt, setActualVolumeMt] = useState(operation.actual_volume_mt ?? "");
  const [loadingLocation, setLoadingLocation] = useState(operation.loading_location ?? "");
  const [dischargeLocation, setDischargeLocation] = useState(operation.discharge_location ?? "");
  const [currency, setCurrency] = useState(operation.currency ?? "NGN");
  const [notes, setNotes] = useState(operation.notes ?? "");
  const [reason, setReason] = useState("");
  const [products, setProducts] = useState<{ product_type: string; quantity_mt: string }[]>([]);

  // Re-sync from the current operation every time the dialog opens — this
  // is a shared, reusable dialog, not a fresh-mount-per-operation one.
  useEffect(() => {
    if (!open) return;
    setOpType(operation.type);
    setClientId(operation.client_id ?? "");
    setVesselId(operation.vessel_id ?? "");
    setSourceType(operation.source_type ?? "");
    setActualVolumeMt(operation.actual_volume_mt ?? "");
    setLoadingLocation(operation.loading_location ?? "");
    setDischargeLocation(operation.discharge_location ?? "");
    setCurrency(operation.currency ?? "NGN");
    setNotes(operation.notes ?? "");
    setReason("");
    setProducts(
      (operation.products ?? []).map((p) => ({
        product_type: p.product_type,
        quantity_mt: String(parseFloat(p.quantity_mt)),
      }))
    );
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

  const { data: staff } = useQuery({
    queryKey: ["users-staff"],
    queryFn: async () => {
      const res = await api.get<ApiResponse<User[]>>("/admin/users?per_page=100");
      const d = res.data.data;
      const all = Array.isArray(d) ? d : (d as unknown as { items: User[] }).items ?? [];
      return all.filter((u) => u.role !== "client" && u.is_active);
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
    enabled: open && opType !== "truck_only",
  });

  const { data: clearances } = useQuery({
    queryKey: ["naval-clearances-picker"],
    queryFn: async () => {
      const res = await api.get<ApiResponse<NavalClearance[]>>("/naval-clearances");
      return (res.data.data ?? []).filter((nc) => nc.is_valid);
    },
    enabled: open && opType !== "truck_only",
  });

  const { data: tasks } = useQuery({
    queryKey: ["operation-tasks", operation.id],
    queryFn: async () => {
      const res = await api.get<ApiResponse<Task[]>>(`/operations/${operation.id}/tasks`);
      return res.data.data ?? [];
    },
    enabled: open,
  });

  const { data: unlinkedPfis } = useQuery({
    queryKey: ["pfis-unlinked"],
    queryFn: async () => {
      const res = await api.get<ApiResponse<PFI[]>>("/pfis", { params: { unlinked_only: true } });
      return res.data.data ?? [];
    },
    enabled: open,
  });

  const { data: allocations } = useQuery({
    queryKey: ["operation-pfi-allocations", operation.id],
    queryFn: async () => {
      const res = await api.get<ApiResponse<{ id: string; pfi_number?: string; quantity_litres: string }[]>>(
        `/operations/${operation.id}/pfis/allocations`
      );
      return res.data.data ?? [];
    },
    enabled: open,
  });

  const refreshOperation = () => {
    qc.invalidateQueries({ queryKey: ["operation", operation.id] });
    qc.invalidateQueries({ queryKey: ["operations"] });
    qc.invalidateQueries({ queryKey: ["operation-activity", operation.id] });
  };

  const mutation = useMutation({
    mutationFn: async () => {
      await api.put(`/operations/${operation.id}`, {
        // Only sent when it actually changed and the operation is still in
        // draft — the backend rejects it otherwise.
        type: isDraft && opType !== operation.type ? opType : undefined,
        products: products
          .filter((p) => p.product_type && p.quantity_mt !== "")
          .map((p) => ({ product_type: p.product_type, quantity_mt: parseFloat(p.quantity_mt) })),
        client_id: clientId || undefined,
        vessel_id: vesselId || undefined,
        source_type: opType === "vessel_only" ? (sourceType || undefined) : undefined,
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
      refreshOperation();
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  // ── Applied immediately, each through its own endpoint ──────────────────
  const [addNcId, setAddNcId] = useState("");
  const linkNc = useMutation({
    mutationFn: async (ncId: string) => {
      await api.post(`/operations/${operation.id}/link-naval-clearance`, { naval_clearance_id: ncId });
    },
    onSuccess: () => { toast.success("Naval Clearance linked"); setAddNcId(""); refreshOperation(); },
    onError: (err) => toast.error(getErrorMessage(err)),
  });
  const unlinkNc = useMutation({
    mutationFn: async (ncId: string) => {
      await api.post(`/operations/${operation.id}/unlink-naval-clearance`, {
        naval_clearance_id: ncId,
        reason: reason.trim() || "Removed while editing the operation",
      });
    },
    onSuccess: () => { toast.success("Naval Clearance unlinked"); refreshOperation(); },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  const [newAssignee, setNewAssignee] = useState("");
  const [newTaskType, setNewTaskType] = useState("");
  const [newPriority, setNewPriority] = useState("normal");
  const addTask = useMutation({
    mutationFn: async () => {
      await api.post(`/operations/${operation.id}/tasks`, {
        assigned_to: newAssignee, task_type: newTaskType, priority: newPriority,
      });
    },
    onSuccess: () => {
      toast.success("Assignment added");
      setNewAssignee(""); setNewTaskType(""); setNewPriority("normal");
      qc.invalidateQueries({ queryKey: ["operation-tasks", operation.id] });
      refreshOperation();
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });
  const removeTask = useMutation({
    mutationFn: async (taskId: string) => { await api.delete(`/tasks/${taskId}`); },
    onSuccess: () => {
      toast.success("Assignment removed");
      qc.invalidateQueries({ queryKey: ["operation-tasks", operation.id] });
      refreshOperation();
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  const [newPfiId, setNewPfiId] = useState("");
  const [newPfiQty, setNewPfiQty] = useState("");
  const addAllocation = useMutation({
    mutationFn: async () => {
      await api.post(`/operations/${operation.id}/pfis/${newPfiId}/allocations`, {
        quantity_litres: parseFloat(newPfiQty),
      });
    },
    onSuccess: () => {
      toast.success("PFI allocated");
      setNewPfiId(""); setNewPfiQty("");
      qc.invalidateQueries({ queryKey: ["operation-pfi-allocations", operation.id] });
      qc.invalidateQueries({ queryKey: ["pfis-unlinked"] });
      refreshOperation();
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });
  const removeAllocation = useMutation({
    mutationFn: async (id: string) => { await api.delete(`/pfi-allocations/${id}`); },
    onSuccess: () => {
      toast.success("Allocation removed");
      qc.invalidateQueries({ queryKey: ["operation-pfi-allocations", operation.id] });
      qc.invalidateQueries({ queryKey: ["pfis-unlinked"] });
      refreshOperation();
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  const linkedNcIds = new Set((operation.naval_clearances ?? []).map((nc) => nc.id));

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
          <Label className="text-xs">Operation Type</Label>
          <Select value={opType} onValueChange={(v) => setOpType(v as Operation["type"])} disabled={!isDraft}>
            <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="full_operation">Full Operation (Trucks + Vessel)</SelectItem>
              <SelectItem value="vessel_only">Vessel Only</SelectItem>
              <SelectItem value="truck_only">Truck Only</SelectItem>
            </SelectContent>
          </Select>
          {!isDraft && (
            <p className="text-[11px] text-muted-foreground">
              Locked once past Draft — type decides which pipeline the operation follows.
            </p>
          )}
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

      {/* Products — replaced wholesale on save */}
      <div className="space-y-2 rounded-lg border p-3">
        <div className="flex items-center justify-between">
          <Label className="text-xs font-semibold">Products</Label>
          <Button
            type="button" size="sm" variant="outline" className="h-7 gap-1 text-[11px]"
            onClick={() => setProducts((p) => [...p, { product_type: "", quantity_mt: "" }])}
          >
            <Plus className="h-3 w-3" />Add Product
          </Button>
        </div>
        {products.length === 0 && (
          <p className="text-[11px] text-muted-foreground">
            At least one product is required.
          </p>
        )}
        {products.map((p, i) => (
          <div key={i} className="flex items-end gap-2">
            <div className="flex-1 space-y-1">
              <Label className="text-[10px] text-muted-foreground">Product Type</Label>
              <Select
                value={p.product_type}
                onValueChange={(v) => setProducts((rows) => rows.map((r, idx) => idx === i ? { ...r, product_type: v } : r))}
              >
                <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Select…" /></SelectTrigger>
                <SelectContent>
                  {PRODUCT_TYPES.map((pt) => (
                    <SelectItem key={pt} value={pt}>{PRODUCT_TYPE_LABELS[pt]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="w-32 space-y-1">
              <Label className="text-[10px] text-muted-foreground">Quantity</Label>
              <Input
                type="number" step="0.001" min="0" className="h-8 text-xs"
                value={p.quantity_mt}
                onChange={(e) => setProducts((rows) => rows.map((r, idx) => idx === i ? { ...r, quantity_mt: e.target.value } : r))}
              />
            </div>
            <Button
              type="button" size="icon" variant="ghost"
              className="h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive"
              onClick={() => setProducts((rows) => rows.filter((_, idx) => idx !== i))}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        ))}
      </div>

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
        {opType !== "truck_only" && (
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
        )}
      </div>

      {opType === "vessel_only" && (
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

      {/* Naval Clearances — applied immediately, not batched into Save */}
      {opType !== "truck_only" && (
        <div className="space-y-2 rounded-lg border p-3">
          <Label className="text-xs font-semibold">Naval Clearances</Label>
          {(operation.naval_clearances ?? []).length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {operation.naval_clearances?.map((nc) => (
                <span key={nc.id} className="inline-flex items-center gap-1 rounded-full border bg-muted/40 px-2.5 py-1 text-[11px]">
                  {nc.clearance_number}
                  <button
                    type="button"
                    className="text-muted-foreground hover:text-destructive"
                    disabled={unlinkNc.isPending}
                    onClick={() => unlinkNc.mutate(nc.id)}
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          )}
          <Select
            value={addNcId}
            onValueChange={(v) => { setAddNcId(v); linkNc.mutate(v); }}
          >
            <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Add a Naval Clearance…" /></SelectTrigger>
            <SelectContent>
              {clearances?.filter((nc) => !linkedNcIds.has(nc.id)).map((nc) => (
                <SelectItem key={nc.id} value={nc.id}>{nc.clearance_number}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-[11px] text-muted-foreground">Applied straight away — not held until Save.</p>
        </div>
      )}

      {/* Staff assignments — applied immediately */}
      <div className="space-y-2 rounded-lg border p-3">
        <Label className="text-xs font-semibold">Staff Assignments</Label>
        {tasks?.length ? (
          <div className="space-y-1">
            {tasks.map((t) => (
              <div key={t.id} className="flex items-center justify-between gap-2 rounded-md bg-muted/40 px-2.5 py-1.5 text-[11px]">
                <span>
                  <span className="font-medium">{t.assignee?.full_name ?? "—"}</span>
                  <span className="text-muted-foreground"> · {t.task_type.replace(/_/g, " ")} · {t.priority}</span>
                </span>
                <button
                  type="button"
                  className="shrink-0 text-muted-foreground hover:text-destructive"
                  disabled={removeTask.isPending}
                  onClick={() => removeTask.mutate(t.id)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-[11px] text-muted-foreground">No assignments yet.</p>
        )}
        <div className="flex items-end gap-2">
          <div className="flex-1 space-y-1">
            <Label className="text-[10px] text-muted-foreground">Person</Label>
            <Select value={newAssignee} onValueChange={setNewAssignee}>
              <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Select…" /></SelectTrigger>
              <SelectContent>
                {staff?.map((u) => (
                  <SelectItem key={u.id} value={u.id}>{u.full_name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex-1 space-y-1">
            <Label className="text-[10px] text-muted-foreground">Task Type</Label>
            <Select value={newTaskType} onValueChange={setNewTaskType}>
              <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Select…" /></SelectTrigger>
              <SelectContent>
                {TASK_TYPES.map((tt) => (
                  <SelectItem key={tt.value} value={tt.value}>{tt.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="w-24 space-y-1">
            <Label className="text-[10px] text-muted-foreground">Priority</Label>
            <Select value={newPriority} onValueChange={setNewPriority}>
              <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                {PRIORITIES.map((p) => (
                  <SelectItem key={p} value={p}>{p}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button
            type="button" size="sm" className="h-8 text-xs"
            disabled={!newAssignee || !newTaskType || addTask.isPending}
            onClick={() => addTask.mutate()}
          >
            Add
          </Button>
        </div>
      </div>

      {/* PFI allocations — applied immediately */}
      <div className="space-y-2 rounded-lg border p-3">
        <Label className="text-xs font-semibold">PFI Allocations</Label>
        {allocations?.length ? (
          <div className="space-y-1">
            {allocations.map((a) => (
              <div key={a.id} className="flex items-center justify-between gap-2 rounded-md bg-muted/40 px-2.5 py-1.5 text-[11px]">
                <span>
                  <span className="font-medium">{a.pfi_number ?? a.id.slice(0, 8)}</span>
                  <span className="text-muted-foreground"> · {parseFloat(a.quantity_litres).toLocaleString()} L</span>
                </span>
                <button
                  type="button"
                  className="shrink-0 text-muted-foreground hover:text-destructive"
                  disabled={removeAllocation.isPending}
                  onClick={() => removeAllocation.mutate(a.id)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-[11px] text-muted-foreground">No PFIs linked yet.</p>
        )}
        <div className="flex items-end gap-2">
          <div className="flex-1 space-y-1">
            <Label className="text-[10px] text-muted-foreground">PFI</Label>
            <Select value={newPfiId} onValueChange={setNewPfiId}>
              <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Select…" /></SelectTrigger>
              <SelectContent>
                {unlinkedPfis?.map((p) => (
                  <SelectItem key={p.id} value={p.id}>{p.pfi_number}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="w-36 space-y-1">
            <Label className="text-[10px] text-muted-foreground">Quantity (L)</Label>
            <Input
              type="number" step="0.01" min="0" className="h-8 text-xs"
              value={newPfiQty} onChange={(e) => setNewPfiQty(e.target.value)}
            />
          </div>
          <Button
            type="button" size="sm" className="h-8 text-xs"
            disabled={!newPfiId || !newPfiQty || addAllocation.isPending}
            onClick={() => addAllocation.mutate()}
          >
            Add
          </Button>
        </div>
      </div>

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
