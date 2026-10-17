"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Anchor, Check, Plus, ShieldAlert, ShieldCheck, Shield, X } from "lucide-react";
import { toast } from "sonner";
import { api, getErrorMessage } from "@/lib/api";
import { formatDateTime } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import type {
  ApiResponse, OperationStatus, OperationType, StsCollection, StsHsePhase, StsStage,
} from "@/types";

/**
 * Ship-to-ship collections — the barge collecting product from another
 * vessel, as well as (or instead of) from trucks. A job may have any number.
 *
 * Each collection is its own trip (four stages), carries the ship-to-ship
 * HSE checks, and ends in a receipt BDN that the BM or Ops Supervisor
 * approves. Only approval adds the product to the barge's ROB and to Total
 * Loaded Quantity. Nothing here gates anything else — stages and checks are
 * recorded, never enforced, the same as the vessel runs.
 */

const STAGES: { key: StsStage; label: string; at: keyof StsCollection }[] = [
  { key: "cast_off", label: "Cast Off", at: "cast_off_at" },
  { key: "alongside", label: "Alongside", at: "alongside_at" },
  { key: "receiving_started", label: "Receiving Started", at: "receiving_started_at" },
  { key: "receiving_completed", label: "Receiving Completed", at: "receiving_completed_at" },
];

const STATUS_BADGE: Record<StsCollection["status"], { label: string; className: string }> = {
  in_progress: { label: "In progress", className: "bg-sky-100 text-sky-800 dark:bg-sky-500/15 dark:text-sky-300" },
  pending: { label: "Awaiting approval", className: "bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300" },
  approved: { label: "Approved", className: "bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300" },
  rejected: { label: "Rejected", className: "bg-rose-100 text-rose-800 dark:bg-rose-500/15 dark:text-rose-300" },
  cancelled: { label: "Cancelled", className: "bg-muted text-muted-foreground" },
};

// Once the barge has started delivering, its ROB snapshot is already taken.
const DELIVERY_STARTED: OperationStatus[] = [
  "vessel_operations", "pending_completion", "bdn_pending", "bdn_approved", "completed",
];

export type StsHsePhaseTemplate = {
  phase: StsHsePhase;
  label: string;
  items: { section: string; item: string }[];
};

type FigureKey = "gov" | "gsv" | "mt_vacuum" | "density" | "vcf" | "temperature";
const FIGURES: { key: FigureKey; label: string; step: string; required: boolean }[] = [
  { key: "gov", label: "GOV", step: "0.01", required: true },
  { key: "gsv", label: "GSV", step: "0.01", required: true },
  { key: "mt_vacuum", label: "MT(vac)", step: "0.001", required: true },
  { key: "density", label: "Density", step: "0.0001", required: true },
  { key: "vcf", label: "VCF", step: "0.0001", required: true },
  { key: "temperature", label: "Temperature", step: "0.1", required: false },
];
const emptyFigures = (): Record<FigureKey, string> =>
  ({ gov: "", gsv: "", mt_vacuum: "", density: "", vcf: "", temperature: "" });

// Absent values render blank, never a dash or zero (the BM's display rule).
const fmt = (v: string | null | undefined, dp: number) =>
  v == null || v === "" ? "" : parseFloat(v).toLocaleString(undefined, { minimumFractionDigits: dp, maximumFractionDigits: dp });

export function StsCollectionsPanel({
  operationId,
  operationStatus,
  operationType,
  canRecord,
  canManage,
  hsePhases,
  onChanged,
}: {
  operationId: string;
  operationStatus: OperationStatus;
  operationType: OperationType;
  /** BM, Ops Supervisor, Marine Operations, Marine Operator */
  canRecord: boolean;
  /** BM and Ops Supervisor — approve, reject, correct, cancel */
  canManage: boolean;
  /** The ship-to-ship HSE form, split into its three checks. */
  hsePhases: StsHsePhaseTemplate[];
  /** Called after anything changes, so the page can refresh its totals. */
  onChanged: () => void;
}) {
  const qc = useQueryClient();
  const key = ["operation-sts-collections", operationId];
  const { data: collections, isLoading } = useQuery({
    queryKey: key,
    queryFn: async () => {
      const res = await api.get<ApiResponse<StsCollection[]>>(`/operations/${operationId}/sts-collections`);
      return res.data.data ?? [];
    },
  });

  const refresh = () => {
    qc.invalidateQueries({ queryKey: key });
    onChanged();
  };
  const run = <T,>(fn: (arg: T) => Promise<unknown>, success: string, after?: () => void) => ({
    mutationFn: fn,
    onSuccess: () => { toast.success(success); after?.(); refresh(); },
    onError: (err: unknown) => toast.error(getErrorMessage(err)),
  });

  const closed = operationStatus === "cancelled" || operationStatus === "archived";
  const deliveryStarted = DELIVERY_STARTED.includes(operationStatus);
  const live = (collections ?? []).filter((c) => c.status !== "cancelled");

  // ── Add collection
  const [showAdd, setShowAdd] = useState(false);
  const [addSource, setAddSource] = useState("");
  const [addImo, setAddImo] = useState("");
  const [addProduct, setAddProduct] = useState("");
  const [addLocation, setAddLocation] = useState("");
  const resetAdd = () => { setShowAdd(false); setAddSource(""); setAddImo(""); setAddProduct(""); setAddLocation(""); };
  const addMutation = useMutation(run(
    async () => api.post(`/operations/${operationId}/sts-collections`, {
      source_vessel_name: addSource.trim(),
      source_vessel_imo: addImo.trim() || undefined,
      product_type: addProduct.trim() || undefined,
      location: addLocation.trim() || undefined,
    }),
    "Ship-to-ship collection added", resetAdd,
  ));

  // ── Stage
  const [stageTarget, setStageTarget] = useState<{ c: StsCollection; stage: (typeof STAGES)[number] } | null>(null);
  const [stageAt, setStageAt] = useState("");
  const stageMutation = useMutation(run(
    async () => api.post(`/sts-collections/${stageTarget!.c.id}/stage`, {
      stage: stageTarget!.stage.key,
      occurred_at: stageAt ? new Date(stageAt).toISOString() : undefined,
    }),
    "Stage recorded", () => { setStageTarget(null); setStageAt(""); },
  ));

  // ── HSE
  const [hseTarget, setHseTarget] = useState<{ c: StsCollection; phase: StsHsePhaseTemplate; correcting: boolean } | null>(null);
  const [hseRows, setHseRows] = useState<{ section: string; item: string; passed: boolean; notes: string }[]>([]);
  const [hseOfficer, setHseOfficer] = useState("");
  const [hseNotes, setHseNotes] = useState("");
  const [hseReason, setHseReason] = useState("");
  const openHse = (c: StsCollection, phase: StsHsePhaseTemplate) => {
    const stored = c.hse?.[phase.phase];
    setHseTarget({ c, phase, correcting: !!stored });
    setHseRows(stored?.checklist?.length
      ? stored.checklist.map((r) => ({ section: r.section ?? "", item: r.item, passed: r.passed, notes: r.notes ?? "" }))
      : phase.items.map((t) => ({ ...t, passed: false, notes: "" })));
    setHseOfficer(stored?.safety_officer ?? "");
    setHseNotes(stored?.notes ?? "");
    setHseReason("");
  };
  const hseMutation = useMutation(run(
    async () => api.post(`/sts-collections/${hseTarget!.c.id}/hse`, {
      phase: hseTarget!.phase.phase,
      checklist: hseRows.map((r) => ({ section: r.section, item: r.item, passed: r.passed, notes: r.notes.trim() || undefined })),
      result: hseRows.every((r) => r.passed) ? "satisfactory" : "not_satisfactory",
      safety_officer: hseOfficer.trim() || undefined,
      notes: hseNotes.trim() || undefined,
      reason: hseTarget!.correcting ? hseReason.trim() : undefined,
    }),
    "HSE checklist recorded", () => setHseTarget(null),
  ));

  // ── Receipt figures (submit, or correct with a reason)
  const [figTarget, setFigTarget] = useState<{ c: StsCollection; correcting: boolean } | null>(null);
  const [figs, setFigs] = useState(emptyFigures());
  const [figReason, setFigReason] = useState("");
  const openFigures = (c: StsCollection, correcting: boolean) => {
    setFigTarget({ c, correcting });
    setFigs(correcting || c.status === "rejected"
      ? { gov: c.gov ?? "", gsv: c.gsv ?? "", mt_vacuum: c.mt_vacuum ?? "", density: c.density ?? "", vcf: c.vcf ?? "", temperature: c.temperature ?? "" }
      : emptyFigures());
    setFigReason("");
  };
  const figuresValid =
    FIGURES.every((f) => !f.required || parseFloat(figs[f.key]) > 0) &&
    (!figTarget?.correcting || figReason.trim().length >= 5);
  const figMutation = useMutation(run(
    async () => {
      const body: Record<string, number | string | undefined> = {};
      for (const f of FIGURES) body[f.key] = figs[f.key].trim() ? parseFloat(figs[f.key]) : undefined;
      if (figTarget!.correcting) {
        body.reason = figReason.trim();
        return api.put(`/sts-collections/${figTarget!.c.id}/receipt`, body);
      }
      return api.post(`/sts-collections/${figTarget!.c.id}/receipt`, body);
    },
    "Receipt saved", () => setFigTarget(null),
  ));

  // ── Approve / reject / cancel
  const approveMutation = useMutation(run(
    async (id: string) => api.post(`/sts-collections/${id}/approve`),
    "Receipt approved — barge ROB updated",
  ));
  const [reasonTarget, setReasonTarget] = useState<{ c: StsCollection; action: "reject" | "cancel" } | null>(null);
  const [reasonText, setReasonText] = useState("");
  const minReason = reasonTarget?.action === "reject" ? 10 : 5;
  const reasonMutation = useMutation(run(
    async () => api.post(`/sts-collections/${reasonTarget!.c.id}/${reasonTarget!.action}`, { reason: reasonText.trim() }),
    reasonTarget?.action === "reject" ? "Receipt rejected" : "Collection cancelled",
    () => { setReasonTarget(null); setReasonText(""); },
  ));

  if (operationType === "truck_only") return null;

  return (
    <section className="overflow-hidden rounded-2xl border border-navy-100 bg-card shadow-[0_1px_2px_rgb(16_36_71/0.04)] dark:border-border">
      <div className="flex flex-wrap items-start justify-between gap-3 px-4 pb-3 pt-4 lg:px-5 lg:pt-5">
        <div>
          <h2 className="text-[15px] font-bold tracking-tight text-foreground">Ship-to-Ship Collections</h2>
          <p className="mt-0.5 text-[12px] text-muted-foreground">
            Product the barge collects from another vessel. Approved collections are added to the barge&apos;s ROB
            and to Total Loaded Quantity.
          </p>
        </div>
        {canRecord && !closed && (
          <Button size="sm" className="gap-1.5" onClick={() => setShowAdd(true)}>
            <Plus className="h-3.5 w-3.5" /> Add Collection
          </Button>
        )}
      </div>

      {deliveryStarted && live.length > 0 && (
        <div className="mx-4 mb-3 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 dark:border-amber-500/30 dark:bg-amber-500/10 lg:mx-5">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-600" />
          <p className="text-xs text-amber-800 dark:text-amber-300">
            Delivery to the client has started. Record every collection before delivery starts — the barge&apos;s
            ROB snapshot taken then does not include collections recorded afterwards.
          </p>
        </div>
      )}

      <div className="space-y-3 border-t border-border/70 px-4 py-4 lg:px-5">
        {isLoading ? (
          <Spinner size={16} />
        ) : !collections?.length ? (
          <p className="text-xs text-muted-foreground">No ship-to-ship collections on this operation.</p>
        ) : (
          collections.map((c) => {
            const badge = STATUS_BADGE[c.status];
            const isLive = c.status !== "cancelled";
            const nextIdx = c.stage ? STAGES.findIndex((s) => s.key === c.stage) + 1 : 0;
            const next = STAGES[nextIdx];
            const submitted = c.status !== "in_progress";
            return (
              <div key={c.id} className={`rounded-xl border p-3.5 ${isLive ? "border-border" : "border-dashed border-border opacity-70"}`}>
                <div className="flex flex-wrap items-center gap-2">
                  <Anchor className="h-4 w-4 text-brand-600" />
                  <p className="text-sm font-semibold">From {c.source_vessel_name}</p>
                  {c.source_vessel_imo && <span className="text-[11px] text-muted-foreground">IMO {c.source_vessel_imo}</span>}
                  {c.receipt_number && <span className="font-mono text-[11px] text-muted-foreground">{c.receipt_number}</span>}
                  <Badge className={`ml-auto border-0 text-[10.5px] ${badge.className}`}>{badge.label}</Badge>
                </div>
                <p className="mt-1 text-[11px] text-muted-foreground">
                  Into {c.vessel_name}
                  {c.product_type && <> · {c.product_type}</>}
                  {c.location && <> · {c.location}</>}
                  {c.created_by_name && <> · added by {c.created_by_name}</>}
                </p>

                {c.recorded_after_delivery_started && isLive && (
                  <p className="mt-2 text-[11px] font-medium text-amber-700 dark:text-amber-300">
                    Recorded after delivery started — not in the ROB snapshot taken when delivery began.
                  </p>
                )}
                {c.status === "cancelled" && (
                  <p className="mt-2 text-[11px] text-muted-foreground">Cancelled: {c.cancel_reason}</p>
                )}
                {c.status === "rejected" && c.rejection_reason && (
                  <p className="mt-2 text-[11px] text-rose-700 dark:text-rose-300">
                    Rejected by {c.reviewed_by_name}: {c.rejection_reason}
                  </p>
                )}

                {/* Stages */}
                <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {STAGES.map((s, i) => {
                    const at = c[s.at] as string | null | undefined;
                    return (
                      <div key={s.key} className={`rounded-lg border px-2.5 py-2 text-[11px] ${at ? "border-emerald-200 bg-emerald-50/60 dark:border-emerald-500/30 dark:bg-emerald-500/10" : "border-border"}`}>
                        <p className="font-semibold">{i + 1}. {s.label}</p>
                        <p className="text-muted-foreground">{at ? formatDateTime(at) : ""}</p>
                      </div>
                    );
                  })}
                </div>
                {canRecord && isLive && next && (
                  <Button size="sm" variant="outline" className="mt-2 h-7 text-[11px]"
                    onClick={() => { setStageTarget({ c, stage: next }); setStageAt(""); }}>
                    Record {next.label}
                  </Button>
                )}

                {/* HSE */}
                <div className="mt-3 flex flex-wrap gap-2">
                  {hsePhases.map((p) => {
                    const rec = c.hse?.[p.phase];
                    const ok = rec?.result === "satisfactory";
                    const Icon = rec ? (ok ? ShieldCheck : ShieldAlert) : Shield;
                    const canOpen = isLive && (rec ? canManage : canRecord);
                    return (
                      <button
                        key={p.phase}
                        type="button"
                        disabled={!canOpen}
                        onClick={() => openHse(c, p)}
                        className={`flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-[11px] disabled:cursor-default ${
                          rec ? (ok ? "border-emerald-300 text-emerald-700 dark:text-emerald-300" : "border-rose-300 text-rose-700 dark:text-rose-300")
                            : "border-amber-300 text-amber-700 dark:text-amber-300"
                        }`}
                        title={rec ? `${rec.conducted_by_name ?? ""} · ${formatDateTime(rec.conducted_at)}` : undefined}
                      >
                        <Icon className="h-3.5 w-3.5" />
                        HSE {p.label}: {rec ? (ok ? "Passed" : "Issues") : "Not recorded"}
                      </button>
                    );
                  })}
                </div>

                {/* Receipt BDN */}
                {submitted && (
                  <div className="mt-3 grid grid-cols-3 gap-x-4 gap-y-1 rounded-md bg-sky-50 p-2.5 text-[11px] text-sky-900 dark:bg-sky-500/10 dark:text-sky-200 sm:grid-cols-6">
                    {FIGURES.map((f) => {
                      const v = fmt(c[f.key], f.key === "mt_vacuum" ? 3 : f.key === "density" || f.key === "vcf" ? 4 : f.key === "temperature" ? 1 : 2);
                      return v ? <span key={f.key}><span className="opacity-70">{f.label}</span> {v}</span> : null;
                    })}
                    {c.submitted_by_name && (
                      <span className="col-span-3 opacity-80 sm:col-span-6">
                        Submitted by {c.submitted_by_name} · {formatDateTime(c.submitted_at)}
                        {c.status === "approved" && c.reviewed_by_name && <> · approved by {c.reviewed_by_name}</>}
                      </span>
                    )}
                  </div>
                )}

                {isLive && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {canRecord && (c.status === "in_progress" || c.status === "rejected") && (
                      <Button size="sm" className="h-7 text-[11px]" onClick={() => openFigures(c, false)}>
                        {c.status === "rejected" ? "Resubmit Receipt" : "Submit Receipt"}
                      </Button>
                    )}
                    {canManage && c.status === "pending" && (
                      <>
                        <Button size="sm" className="h-7 gap-1 text-[11px]" disabled={approveMutation.isPending}
                          onClick={() => approveMutation.mutate(c.id)}>
                          {approveMutation.isPending ? <Spinner size={12} /> : <Check className="h-3 w-3" />} Approve
                        </Button>
                        <Button size="sm" variant="outline" className="h-7 gap-1 text-[11px] text-destructive"
                          onClick={() => { setReasonTarget({ c, action: "reject" }); setReasonText(""); }}>
                          <X className="h-3 w-3" /> Reject
                        </Button>
                      </>
                    )}
                    {canManage && submitted && (
                      <Button size="sm" variant="outline" className="h-7 text-[11px]" onClick={() => openFigures(c, true)}>
                        Correct Figures
                      </Button>
                    )}
                    {canManage && (
                      <Button size="sm" variant="ghost" className="h-7 text-[11px] text-destructive"
                        onClick={() => { setReasonTarget({ c, action: "cancel" }); setReasonText(""); }}>
                        Cancel Collection
                      </Button>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Add collection */}
      <Dialog open={showAdd} onOpenChange={(v) => !v && resetAdd()}>
        <DialogContent className="sm:max-w-md" aria-describedby={undefined}>
          <DialogHeader><DialogTitle>Add Ship-to-Ship Collection</DialogTitle></DialogHeader>
          <div className="mt-1 space-y-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Source Vessel *</Label>
              <Input value={addSource} onChange={(e) => setAddSource(e.target.value)} placeholder="The vessel the product comes from" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">IMO Number</Label>
                <Input value={addImo} onChange={(e) => setAddImo(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Product</Label>
                <Input value={addProduct} onChange={(e) => setAddProduct(e.target.value)} placeholder="e.g. HFO" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Location</Label>
              <Input value={addLocation} onChange={(e) => setAddLocation(e.target.value)} />
            </div>
          </div>
          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={resetAdd}>Cancel</Button>
            <Button disabled={!addSource.trim() || addMutation.isPending} onClick={() => addMutation.mutate(undefined)}>
              {addMutation.isPending && <Spinner size={14} className="mr-1.5" />} Add
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Stage */}
      <Dialog open={!!stageTarget} onOpenChange={(v) => !v && setStageTarget(null)}>
        <DialogContent className="sm:max-w-sm" aria-describedby={undefined}>
          <DialogHeader><DialogTitle>Record {stageTarget?.stage.label}</DialogTitle></DialogHeader>
          <div className="mt-1 space-y-1.5">
            <Label className="text-xs">When it happened <span className="font-normal text-muted-foreground">(leave blank for now)</span></Label>
            <Input type="datetime-local" value={stageAt} onChange={(e) => setStageAt(e.target.value)} />
          </div>
          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setStageTarget(null)}>Cancel</Button>
            <Button disabled={stageMutation.isPending} onClick={() => stageMutation.mutate(undefined)}>
              {stageMutation.isPending && <Spinner size={14} className="mr-1.5" />} Record
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* HSE */}
      <Dialog open={!!hseTarget} onOpenChange={(v) => !v && setHseTarget(null)}>
        <DialogContent className="sm:max-w-lg" aria-describedby={undefined}>
          <DialogHeader>
            <DialogTitle>HSE — {hseTarget?.phase.label}{hseTarget?.correcting ? " (correction)" : ""}</DialogTitle>
          </DialogHeader>
          <div className="mt-1 max-h-[65vh] space-y-3 overflow-y-auto pr-1">
            <div className="space-y-1.5">
              <Label className="text-xs">Safety Officer</Label>
              <Input value={hseOfficer} onChange={(e) => setHseOfficer(e.target.value)} />
            </div>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Tick each item that passes</p>
            {hseRows.map((r, i) => (
              <div key={`${r.section}-${r.item}`}>
                {(i === 0 || hseRows[i - 1].section !== r.section) && r.section && (
                  <p className="mb-1 mt-2 text-[11px] font-semibold">{r.section}</p>
                )}
                <label className={`flex cursor-pointer items-center gap-3 rounded-lg border px-3 py-2 text-sm ${r.passed ? "border-emerald-300 bg-emerald-50 dark:bg-emerald-500/10" : "border-border"}`}>
                  <input type="checkbox" className="h-4 w-4 accent-emerald-600" checked={r.passed}
                    onChange={(e) => setHseRows((rows) => rows.map((x, j) => j === i ? { ...x, passed: e.target.checked } : x))} />
                  <span className="flex-1">{r.item}</span>
                </label>
              </div>
            ))}
            <div className="space-y-1.5">
              <Label className="text-xs">Notes</Label>
              <Textarea rows={2} className="resize-none text-sm" value={hseNotes} onChange={(e) => setHseNotes(e.target.value)} />
            </div>
            {hseTarget?.correcting && (
              <div className="space-y-1.5">
                <Label className="text-xs">Reason for correction *</Label>
                <Textarea rows={2} className="resize-none text-sm" value={hseReason} onChange={(e) => setHseReason(e.target.value)} />
              </div>
            )}
          </div>
          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setHseTarget(null)}>Cancel</Button>
            <Button
              disabled={hseMutation.isPending || (!!hseTarget?.correcting && hseReason.trim().length < 5)}
              onClick={() => hseMutation.mutate(undefined)}
            >
              {hseMutation.isPending && <Spinner size={14} className="mr-1.5" />} Save Checklist
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Receipt figures */}
      <Dialog open={!!figTarget} onOpenChange={(v) => !v && setFigTarget(null)}>
        <DialogContent className="sm:max-w-md" aria-describedby={undefined}>
          <DialogHeader>
            <DialogTitle>{figTarget?.correcting ? "Correct Receipt Figures" : "Ship-to-Ship Receipt"}</DialogTitle>
          </DialogHeader>
          <p className="text-xs text-muted-foreground">
            What the barge took on from {figTarget?.c.source_vessel_name}. MT(vac) is what is added to the barge
            once approved.
          </p>
          <div className="mt-2 grid grid-cols-2 gap-3 sm:grid-cols-3">
            {FIGURES.map((f) => (
              <div key={f.key} className="space-y-1.5">
                <Label className="text-xs">{f.label}{f.required ? " *" : ""}</Label>
                <Input type="number" step={f.step} min="0" className="h-8 text-xs" value={figs[f.key]}
                  onChange={(e) => setFigs((x) => ({ ...x, [f.key]: e.target.value }))} />
              </div>
            ))}
          </div>
          {figTarget?.correcting && (
            <div className="mt-3 space-y-1.5">
              <Label className="text-xs">Reason for correction *</Label>
              <Textarea rows={2} className="resize-none text-sm" value={figReason} onChange={(e) => setFigReason(e.target.value)} />
              {figTarget.c.status === "approved" && (
                <p className="text-[11px] text-muted-foreground">
                  Already approved — the barge&apos;s ROB is adjusted to the corrected MT(vac).
                </p>
              )}
            </div>
          )}
          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setFigTarget(null)}>Cancel</Button>
            <Button disabled={!figuresValid || figMutation.isPending} onClick={() => figMutation.mutate(undefined)}>
              {figMutation.isPending && <Spinner size={14} className="mr-1.5" />}
              {figTarget?.correcting ? "Save Correction" : "Submit for Approval"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reject / cancel */}
      <Dialog open={!!reasonTarget} onOpenChange={(v) => !v && setReasonTarget(null)}>
        <DialogContent className="sm:max-w-sm" aria-describedby={undefined}>
          <DialogHeader>
            <DialogTitle>{reasonTarget?.action === "reject" ? "Reject Receipt" : "Cancel Collection"}</DialogTitle>
          </DialogHeader>
          {reasonTarget?.action === "cancel" && reasonTarget.c.status === "approved" && (
            <p className="text-xs text-muted-foreground">
              This collection is approved — cancelling takes its MT(vac) back off the barge&apos;s ROB.
            </p>
          )}
          <div className="mt-1 space-y-1.5">
            <Label className="text-xs">Reason * <span className="font-normal text-muted-foreground">(at least {minReason} characters)</span></Label>
            <Textarea rows={3} className="resize-none text-sm" value={reasonText} onChange={(e) => setReasonText(e.target.value)} />
          </div>
          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setReasonTarget(null)}>Back</Button>
            <Button variant="destructive" disabled={reasonText.trim().length < minReason || reasonMutation.isPending}
              onClick={() => reasonMutation.mutate(undefined)}>
              {reasonMutation.isPending && <Spinner size={14} className="mr-1.5" />}
              {reasonTarget?.action === "reject" ? "Reject" : "Cancel Collection"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
