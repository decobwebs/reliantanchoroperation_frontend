"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2, PlusCircle, FileWarning, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { api, getErrorMessage } from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";
import { Header } from "@/components/layout/Header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { formatDateTime } from "@/lib/utils";
import type { ApiResponse, TruckWaiver } from "@/types";

export default function WaiversPage() {
  const { user, effectiveRole } = useAuth();
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

  // ── Delete
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

  return (
    <div>
      <Header title="Waiver Numbers" subtitle="Regulatory / BFL truck numbers — added in bulk before sourcing starts" />

      <div className="p-4 md:p-6 space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Card className="border-0 shadow-sm">
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">Available</p>
              <p className="text-2xl font-bold text-emerald-700">{available}</p>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-sm">
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">Linked to a truck</p>
              <p className="text-2xl font-bold">{linked}</p>
            </CardContent>
          </Card>
        </div>

        {canAdd && (
          <Card className="border-0 shadow-sm">
            <CardContent className="p-4 space-y-3">
              <p className="text-sm font-semibold">Add waiver numbers in bulk</p>
              <p className="text-xs text-muted-foreground">
                Paste one number per line (or comma-separated) — e.g. 25 at a time. Duplicates are skipped automatically.
              </p>
              <Textarea
                rows={6}
                className="resize-none font-mono text-xs"
                placeholder={"MKA 442 ZD\nABJ 690 XB\nABC 245 XC\n…"}
                value={bulkText}
                onChange={(e) => setBulkText(e.target.value)}
              />
              <div className="flex justify-end">
                <Button
                  size="sm"
                  className="gap-1.5"
                  disabled={!bulkText.trim() || bulkAddMutation.isPending}
                  onClick={() => bulkAddMutation.mutate()}
                >
                  {bulkAddMutation.isPending
                    ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    : <PlusCircle className="w-3.5 h-3.5" />}
                  Add Numbers
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        <Card className="border-0 shadow-sm">
          <CardContent className="p-0">
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-7 h-7 animate-spin text-primary" />
              </div>
            ) : waivers?.length ? (
              <div className="divide-y">
                {waivers.map((w) => (
                  <div key={w.id} className="px-5 py-3 text-sm space-y-1.5">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="font-mono font-semibold">{w.waybill_truck_number}</span>
                        <Badge
                          variant="outline"
                          className={w.status === "available"
                            ? "border-emerald-300 text-emerald-700 bg-emerald-50"
                            : "border-muted text-muted-foreground"}
                        >
                          {w.status}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-xs text-muted-foreground">{formatDateTime(w.created_at)}</span>
                        {canAdd && (
                          <>
                            <Button
                              size="sm" variant="ghost"
                              className="h-6 px-1.5"
                              onClick={() => openEdit(w)}
                            >
                              <Pencil className="w-3 h-3" />
                            </Button>
                            {w.status === "available" && (
                              <Button
                                size="sm" variant="ghost"
                                className="h-6 px-1.5 text-destructive hover:text-destructive"
                                onClick={() => { setRemoveId(w.id); setRemoveReason(""); }}
                              >
                                <Trash2 className="w-3 h-3" />
                              </Button>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                    {w.status === "linked" && (
                      <p className="text-xs text-muted-foreground">
                        Linked to truck <span className="font-mono font-medium text-foreground">{w.linked_truck_number ?? "—"}</span>
                        {w.linked_driver_name && <> · Driver: {w.linked_driver_name}</>}
                        {w.linked_operation_id && (
                          <>
                            {" · "}
                            <Link href={`/operations/${w.linked_operation_id}`} className="underline">
                              {w.linked_operation_number ?? "Operation"}
                            </Link>
                          </>
                        )}
                        {w.linked_at && <> · {formatDateTime(w.linked_at)}</>}
                      </p>
                    )}
                    {removeId === w.id && (
                      <div className="flex items-center gap-1.5 pt-1">
                        <Input
                          className="h-7 text-xs"
                          placeholder="Reason for removing this waiver number…"
                          value={removeReason}
                          onChange={(e) => setRemoveReason(e.target.value)}
                        />
                        <Button
                          size="sm" variant="destructive"
                          className="h-7 px-2 text-xs shrink-0"
                          disabled={!removeReason.trim() || removeMutation.isPending}
                          onClick={() => removeMutation.mutate(w.id)}
                        >
                          {removeMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : "Confirm"}
                        </Button>
                        <Button
                          size="sm" variant="ghost"
                          className="h-7 px-2 text-xs shrink-0"
                          onClick={() => setRemoveId(null)}
                        >
                          Cancel
                        </Button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center py-12 text-muted-foreground gap-1">
                <FileWarning className="w-7 h-7 mb-1 opacity-25" />
                <p className="text-sm font-medium">No waiver numbers yet</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── Edit dialog */}
      <Dialog open={!!editId} onOpenChange={(v) => { if (!v) setEditId(null); }}>
        <DialogContent className="sm:max-w-sm" aria-describedby={undefined}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Pencil className="w-4 h-4 text-primary" />Edit Waiver Number</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 mt-1">
            <div className="space-y-1.5">
              <Label className="text-xs">Waiver / Regulatory Number</Label>
              <Input
                className="font-mono"
                value={editNumber}
                onChange={(e) => setEditNumber(e.target.value.toUpperCase())}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Reason for edit <span className="text-destructive">*</span></Label>
              <Textarea
                rows={2}
                className="resize-none text-sm"
                placeholder="Why is this being changed…"
                value={editReason}
                onChange={(e) => setEditReason(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setEditId(null)}>Cancel</Button>
            <Button
              disabled={!editNumber.trim() || !editReason.trim() || editMutation.isPending}
              onClick={() => editMutation.mutate()}
            >
              {editMutation.isPending && <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
