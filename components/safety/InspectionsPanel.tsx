"use client";

import { useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, ClipboardCheck, Pencil, PlusCircle, RotateCcw, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { api, getErrorMessage } from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";
import { PanelCard } from "@/components/dashboard/PanelCard";
import { VesselRecordAttachments } from "@/components/vessels/VesselRecordAttachments";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { cn, formatDate } from "@/lib/utils";
import type {
  ApiResponse,
  Inspection,
  InspectionAction,
  InspectionResult,
  InspectionSubject,
  Truck,
  Vessel,
} from "@/types";

export const SUBJECT_LABEL: Record<InspectionSubject, string> = {
  vessel: "Vessel",
  truck: "Truck",
  operation: "Operation",
  site: "Site",
};

export const RESULT_LABEL: Record<InspectionResult, string> = {
  pass: "Passed",
  pass_with_findings: "Passed with findings",
  fail: "Failed",
};

const RESULT_STYLE: Record<InspectionResult, string> = {
  pass: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300",
  pass_with_findings: "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300",
  fail: "bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300",
};

// Matches INSPECTION_ROLES in the API's permissions.py.
const KEEPER_ROLES = ["bunker_manager", "safety_officer"];

const today = () => new Date().toISOString().slice(0, 10);

interface Owner {
  id: string;
  full_name: string;
  role: string;
}

interface ActionDraft {
  description: string;
  owner_id: string;
  due_date: string;
}

const emptyAction = (): ActionDraft => ({ description: "", owner_id: "", due_date: "" });
const actionReady = (a: ActionDraft) => a.description.trim() && a.owner_id && a.due_date;

interface InspectionForm {
  subject_type: InspectionSubject;
  vessel_id: string;
  truck_id: string;
  operation_number: string;
  site_name: string;
  inspected_on: string;
  title: string;
  result: InspectionResult;
  findings: string;
  actions: ActionDraft[];
}

const emptyForm = (): InspectionForm => ({
  subject_type: "vessel",
  vessel_id: "",
  truck_id: "",
  operation_number: "",
  site_name: "",
  inspected_on: today(),
  title: "",
  result: "pass",
  findings: "",
  actions: [],
});

function subjectOf(i: Inspection): string {
  return i.vessel_name ?? i.truck_number ?? i.operation_number ?? i.site_name ?? "";
}

function ActionFields({
  draft,
  setDraft,
  owners,
  idPrefix,
}: {
  draft: ActionDraft;
  setDraft: (a: ActionDraft) => void;
  owners: Owner[];
  idPrefix: string;
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <div className="space-y-1.5 sm:col-span-2">
        <Label htmlFor={`${idPrefix}-desc`}>What needs fixing</Label>
        <Input
          id={`${idPrefix}-desc`}
          value={draft.description}
          onChange={(e) => setDraft({ ...draft, description: e.target.value })}
          placeholder="Replace the two expired extinguishers"
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor={`${idPrefix}-owner`}>Who owns it</Label>
        <Select value={draft.owner_id} onValueChange={(v) => setDraft({ ...draft, owner_id: v })}>
          <SelectTrigger id={`${idPrefix}-owner`}>
            <SelectValue placeholder="Choose a person" />
          </SelectTrigger>
          <SelectContent>
            {owners.map((o) => (
              <SelectItem key={o.id} value={o.id}>
                {o.full_name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor={`${idPrefix}-due`}>Due by</Label>
        <Input
          id={`${idPrefix}-due`}
          type="date"
          value={draft.due_date}
          onChange={(e) => setDraft({ ...draft, due_date: e.target.value })}
        />
      </div>
    </div>
  );
}

type Pending =
  | { kind: "edit"; inspection: Inspection }
  | { kind: "add-action"; inspection: Inspection }
  | { kind: "edit-action"; action: InspectionAction }
  | { kind: "complete"; action: InspectionAction }
  | { kind: "reopen"; action: InspectionAction };

const PENDING_TITLE: Record<Pending["kind"], string> = {
  edit: "Edit Inspection",
  "add-action": "Add an Action",
  "edit-action": "Edit Action",
  complete: "Mark Action Done",
  reopen: "Reopen Action",
};

export function InspectionsPanel() {
  const qc = useQueryClient();
  const { effectiveRole, user } = useAuth();
  // A real Bunker Manager passes every check, whatever they are acting as.
  const canKeep = user?.role === "bunker_manager" || KEEPER_ROLES.includes(effectiveRole ?? "");

  const [filter, setFilter] = useState<InspectionSubject | "all" | "open">("all");
  const [logOpen, setLogOpen] = useState(false);
  const [form, setForm] = useState<InspectionForm>(emptyForm);
  const [pending, setPending] = useState<Pending | null>(null);
  const [reason, setReason] = useState("");
  const [note, setNote] = useState("");
  const [editForm, setEditForm] = useState({ inspected_on: "", title: "", result: "pass" as InspectionResult, findings: "" });
  const [actionDraft, setActionDraft] = useState<ActionDraft>(emptyAction);

  const { data: inspections, isLoading } = useQuery({
    queryKey: ["inspections"],
    queryFn: async () => (await api.get<ApiResponse<Inspection[]>>("/inspections")).data.data,
  });
  const { data: owners = [] } = useQuery({
    queryKey: ["inspection-owners"],
    enabled: canKeep,
    queryFn: async () => (await api.get<ApiResponse<Owner[]>>("/inspections/owners")).data.data,
  });
  const { data: vessels = [] } = useQuery({
    queryKey: ["vessels-list-all"],
    enabled: canKeep,
    queryFn: async () => {
      const d = (await api.get<ApiResponse<{ items: Vessel[] } | Vessel[]>>("/vessels?per_page=200")).data.data;
      return Array.isArray(d) ? d : d.items ?? [];
    },
  });
  const { data: trucks = [] } = useQuery({
    queryKey: ["fleet-trucks"],
    enabled: canKeep,
    queryFn: async () => (await api.get<ApiResponse<Truck[]>>("/trucks?active_only=true")).data.data,
  });

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["inspections"] });
    qc.invalidateQueries({ queryKey: ["safety-overview"] });
  };

  const startAction = (p: Pending) => {
    setPending(p);
    setReason("");
    setNote("");
    setActionDraft(emptyAction());
    if (p.kind === "edit") {
      const i = p.inspection;
      setEditForm({ inspected_on: i.inspected_on, title: i.title, result: i.result, findings: i.findings ?? "" });
    }
    if (p.kind === "edit-action") {
      const a = p.action;
      setActionDraft({ description: a.description, owner_id: a.owner_id, due_date: a.due_date });
    }
  };

  const log = useMutation({
    mutationFn: async () => {
      const f = form;
      await api.post("/inspections", {
        subject_type: f.subject_type,
        vessel_id: f.subject_type === "vessel" ? f.vessel_id : null,
        truck_id: f.subject_type === "truck" ? f.truck_id : null,
        operation_number: f.subject_type === "operation" ? f.operation_number : null,
        site_name: f.subject_type === "site" ? f.site_name : null,
        inspected_on: f.inspected_on,
        title: f.title,
        result: f.result,
        findings: f.findings || null,
        actions: f.actions.filter(actionReady),
      });
    },
    onSuccess: () => {
      toast.success("Inspection logged");
      setLogOpen(false);
      setForm(emptyForm());
      refresh();
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  const act = useMutation({
    mutationFn: async (p: Pending) => {
      if (p.kind === "edit") {
        const i = p.inspection;
        const body: Record<string, string | null> = { reason };
        if (editForm.inspected_on !== i.inspected_on) body.inspected_on = editForm.inspected_on;
        if (editForm.title !== i.title) body.title = editForm.title;
        if (editForm.result !== i.result) body.result = editForm.result;
        if (editForm.findings !== (i.findings ?? "")) body.findings = editForm.findings || null;
        await api.patch(`/inspections/${i.id}`, body);
      } else if (p.kind === "add-action") {
        await api.post(`/inspections/${p.inspection.id}/actions`, actionDraft);
      } else if (p.kind === "edit-action") {
        const a = p.action;
        const body: Record<string, string> = { reason };
        (["description", "owner_id", "due_date"] as const).forEach((k) => {
          if (actionDraft[k] !== a[k]) body[k] = actionDraft[k];
        });
        await api.patch(`/inspection-actions/${a.id}`, body);
      } else if (p.kind === "complete") {
        await api.post(`/inspection-actions/${p.action.id}/complete`, { note });
      } else {
        await api.post(`/inspection-actions/${p.action.id}/reopen`, { reason });
      }
    },
    onSuccess: (_, p) => {
      toast.success(
        {
          edit: "Inspection updated",
          "add-action": "Action added. The owner has been told.",
          "edit-action": "Action updated",
          complete: "Action marked done",
          reopen: "Action reopened",
        }[p.kind]
      );
      setPending(null);
      refresh();
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  const all = inspections ?? [];
  const shown = all.filter((i) =>
    filter === "all" ? true : filter === "open" ? i.actions.some((a) => a.status === "open") : i.subject_type === filter
  );
  const openActions = all.reduce((n, i) => n + i.actions.filter((a) => a.status === "open").length, 0);

  const subjectReady =
    (form.subject_type === "vessel" && form.vessel_id) ||
    (form.subject_type === "truck" && form.truck_id) ||
    (form.subject_type === "operation" && form.operation_number.trim()) ||
    (form.subject_type === "site" && form.site_name.trim());
  const logValid =
    subjectReady &&
    form.title.trim() &&
    form.inspected_on &&
    (form.result === "pass" || form.findings.trim()) &&
    form.actions.every((a) => actionReady(a) || (!a.description.trim() && !a.owner_id && !a.due_date));

  const pendingValid = (() => {
    if (!pending) return false;
    switch (pending.kind) {
      case "edit":
        return reason.trim() && editForm.title.trim() && (editForm.result === "pass" || editForm.findings.trim());
      case "add-action":
        return actionReady(actionDraft);
      case "edit-action":
        return reason.trim() && actionReady(actionDraft);
      case "complete":
        return note.trim();
      case "reopen":
        return reason.trim();
    }
  })();

  const chips: { key: typeof filter; label: string }[] = [
    { key: "all", label: `All (${all.length})` },
    { key: "open", label: `Open actions (${openActions})` },
    ...(Object.keys(SUBJECT_LABEL) as InspectionSubject[]).map((k) => ({ key: k, label: `${SUBJECT_LABEL[k]}s` })),
  ];

  return (
    <>
      <PanelCard
        icon={ClipboardCheck}
        tone={openActions > 0 ? "amber" : "blue"}
        title="Inspections and compliance checks"
        subtitle={openActions > 0 ? `${openActions} follow-up action${openActions === 1 ? "" : "s"} still open` : "No actions open"}
        action={
          canKeep ? (
            <Button
              size="sm"
              variant="outline"
              className="h-8 rounded-lg text-xs font-semibold"
              onClick={() => {
                setForm(emptyForm());
                setLogOpen(true);
              }}
            >
              <PlusCircle className="h-3.5 w-3.5" />
              Log Inspection
            </Button>
          ) : undefined
        }
        flush
      >
        <div className="flex flex-wrap gap-1.5 border-b border-border/70 px-4 py-3 lg:px-5">
          {chips.map((c) => (
            <button
              key={c.key}
              type="button"
              onClick={() => setFilter(c.key)}
              className={cn(
                "rounded-full border px-3 py-1 text-[11.5px] font-semibold transition-colors",
                filter === c.key
                  ? "border-brand-500 bg-brand-50 text-brand-700 dark:bg-brand-500/15 dark:text-brand-300"
                  : "border-border text-muted-foreground hover:text-foreground"
              )}
            >
              {c.label}
            </button>
          ))}
        </div>

        {isLoading ? (
          <div className="space-y-3 p-4">
            <Skeleton className="h-20 rounded-xl" />
            <Skeleton className="h-20 rounded-xl" />
          </div>
        ) : shown.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-16 text-center">
            <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-muted">
              <ClipboardCheck className="h-7 w-7 text-muted-foreground/40" />
            </span>
            <p className="text-sm font-medium text-foreground">No inspections here yet</p>
            <p className="text-xs text-muted-foreground">Inspections of vessels, trucks, operations and sites are kept here.</p>
          </div>
        ) : (
          <div className="divide-y divide-border/70">
            {shown.map((i) => (
              <div key={i.id} className="px-4 py-4 lg:px-5">
                <div className="mb-1.5 flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-[13.5px] font-semibold text-foreground">{i.title}</p>
                    <p className="text-[11.5px] text-muted-foreground">
                      {SUBJECT_LABEL[i.subject_type]}:{" "}
                      {i.subject_type === "vessel" && i.vessel_id ? (
                        <Link href={`/fleet/vessels/${i.vessel_id}`} className="font-semibold text-brand-600 hover:underline">
                          {subjectOf(i)}
                        </Link>
                      ) : i.subject_type === "truck" && i.truck_id ? (
                        <Link href={`/fleet/${i.truck_id}`} className="font-mono font-semibold text-brand-600 hover:underline">
                          {subjectOf(i)}
                        </Link>
                      ) : i.subject_type === "operation" && i.operation_id ? (
                        <Link href={`/operations/${i.operation_id}`} className="font-mono font-semibold text-brand-600 hover:underline">
                          {subjectOf(i)}
                        </Link>
                      ) : (
                        <span className="font-semibold text-foreground">{subjectOf(i)}</span>
                      )}
                      {" · "}
                      {formatDate(i.inspected_on)} · by {i.inspector_name ?? "Unknown"}
                    </p>
                  </div>
                  <span className={cn("shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-semibold", RESULT_STYLE[i.result])}>
                    {RESULT_LABEL[i.result]}
                  </span>
                </div>

                {i.findings && (
                  <p className="mb-2 whitespace-pre-line text-[12px] leading-relaxed text-muted-foreground">
                    <span className="font-semibold text-foreground">Found: </span>
                    {i.findings}
                  </p>
                )}

                {i.actions.length > 0 && (
                  <ul className="mb-2 space-y-1.5">
                    {i.actions.map((a) => (
                      <li
                        key={a.id}
                        className={cn(
                          "rounded-lg border px-3 py-2 text-[12px]",
                          a.status === "done"
                            ? "border-emerald-200 bg-emerald-50/60 dark:border-emerald-500/25 dark:bg-emerald-500/10"
                            : a.overdue
                              ? "border-rose-200 bg-rose-50/60 dark:border-rose-500/25 dark:bg-rose-500/10"
                              : "border-border"
                        )}
                      >
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="font-semibold text-foreground">{a.description}</p>
                            <p className="text-[11px] text-muted-foreground">
                              {a.owner_name ?? "Unknown"} ·{" "}
                              {a.status === "done"
                                ? `done ${a.done_at ? formatDate(a.done_at) : ""} by ${a.done_by_name ?? "Unknown"}`
                                : a.overdue
                                  ? `overdue since ${formatDate(a.due_date)}`
                                  : `due ${formatDate(a.due_date)}`}
                            </p>
                            {a.done_note && <p className="mt-0.5 text-[11px] text-emerald-800 dark:text-emerald-300">{a.done_note}</p>}
                          </div>
                          {canKeep && (
                            <div className="flex shrink-0 gap-1">
                              {a.status === "open" ? (
                                <>
                                  <Button size="sm" variant="ghost" className="h-7 rounded-lg text-xs" onClick={() => startAction({ kind: "edit-action", action: a })}>
                                    <Pencil className="h-3 w-3" />
                                    Edit
                                  </Button>
                                  <Button size="sm" variant="outline" className="h-7 rounded-lg text-xs" onClick={() => startAction({ kind: "complete", action: a })}>
                                    <CheckCircle2 className="h-3 w-3" />
                                    Done
                                  </Button>
                                </>
                              ) : (
                                <Button size="sm" variant="ghost" className="h-7 rounded-lg text-xs" onClick={() => startAction({ kind: "reopen", action: a })}>
                                  <RotateCcw className="h-3 w-3" />
                                  Reopen
                                </Button>
                              )}
                            </div>
                          )}
                        </div>
                      </li>
                    ))}
                  </ul>
                )}

                <div className="flex flex-wrap items-center justify-between gap-2">
                  <VesselRecordAttachments
                    basePath={`/inspections/${i.id}`}
                    attachments={i.attachments}
                    canUpload={canKeep}
                    onUploaded={refresh}
                  />
                  {canKeep && (
                    <div className="ml-auto flex flex-wrap gap-1.5">
                      <Button size="sm" variant="ghost" className="h-7 rounded-lg text-xs" onClick={() => startAction({ kind: "edit", inspection: i })}>
                        <Pencil className="h-3 w-3" />
                        Edit
                      </Button>
                      <Button size="sm" variant="outline" className="h-7 rounded-lg text-xs" onClick={() => startAction({ kind: "add-action", inspection: i })}>
                        <PlusCircle className="h-3 w-3" />
                        Add action
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </PanelCard>

      {/* Log a new inspection */}
      <Dialog open={logOpen} onOpenChange={setLogOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ClipboardCheck className="h-4 w-4 text-brand-600" />
              Log an Inspection
            </DialogTitle>
            <DialogDescription>
              What you inspected, what you found and what must be fixed. You can add photos after saving.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="ins-subject">What was inspected</Label>
              <Select value={form.subject_type} onValueChange={(v) => setForm({ ...form, subject_type: v as InspectionSubject })}>
                <SelectTrigger id="ins-subject">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(SUBJECT_LABEL) as InspectionSubject[]).map((k) => (
                    <SelectItem key={k} value={k}>
                      {SUBJECT_LABEL[k]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ins-which">Which one</Label>
              {form.subject_type === "vessel" ? (
                <Select value={form.vessel_id} onValueChange={(v) => setForm({ ...form, vessel_id: v })}>
                  <SelectTrigger id="ins-which">
                    <SelectValue placeholder="Choose a vessel" />
                  </SelectTrigger>
                  <SelectContent>
                    {vessels.map((v) => (
                      <SelectItem key={v.id} value={v.id}>
                        {v.vessel_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : form.subject_type === "truck" ? (
                <Select value={form.truck_id} onValueChange={(v) => setForm({ ...form, truck_id: v })}>
                  <SelectTrigger id="ins-which">
                    <SelectValue placeholder="Choose a truck" />
                  </SelectTrigger>
                  <SelectContent>
                    {trucks.map((t) => (
                      <SelectItem key={t.id} value={t.id}>
                        {t.truck_number}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : form.subject_type === "operation" ? (
                <Input
                  id="ins-which"
                  value={form.operation_number}
                  onChange={(e) => setForm({ ...form, operation_number: e.target.value })}
                  placeholder="RA-2026-0109"
                />
              ) : (
                <Input
                  id="ins-which"
                  value={form.site_name}
                  onChange={(e) => setForm({ ...form, site_name: e.target.value })}
                  placeholder="Apapa jetty, depot yard…"
                  maxLength={200}
                />
              )}
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="ins-title">Inspection</Label>
              <Input
                id="ins-title"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder="Fire equipment check"
                maxLength={200}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ins-date">Date</Label>
              <Input
                id="ins-date"
                type="date"
                value={form.inspected_on}
                max={today()}
                onChange={(e) => setForm({ ...form, inspected_on: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ins-result">Result</Label>
              <Select value={form.result} onValueChange={(v) => setForm({ ...form, result: v as InspectionResult })}>
                <SelectTrigger id="ins-result">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(RESULT_LABEL) as InspectionResult[]).map((k) => (
                    <SelectItem key={k} value={k}>
                      {RESULT_LABEL[k]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="ins-findings">What you found{form.result === "pass" ? " (optional)" : ""}</Label>
              <Textarea
                id="ins-findings"
                value={form.findings}
                onChange={(e) => setForm({ ...form, findings: e.target.value })}
                rows={3}
                placeholder="Two extinguishers past their service date…"
              />
            </div>
          </div>

          <div className="space-y-3">
            <p className="text-[13px] font-semibold text-foreground">Actions to fix</p>
            {form.actions.map((a, n) => (
              <div key={n} className="relative rounded-xl border border-border p-3">
                <Button
                  size="sm"
                  variant="ghost"
                  className="absolute right-1.5 top-1.5 h-7 w-7 p-0 text-muted-foreground"
                  aria-label="Remove this action"
                  onClick={() => setForm({ ...form, actions: form.actions.filter((_, k) => k !== n) })}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
                <ActionFields
                  draft={a}
                  setDraft={(d) => setForm({ ...form, actions: form.actions.map((x, k) => (k === n ? d : x)) })}
                  owners={owners}
                  idPrefix={`ins-act-${n}`}
                />
              </div>
            ))}
            <Button
              size="sm"
              variant="outline"
              className="h-8 rounded-lg text-xs"
              onClick={() => setForm({ ...form, actions: [...form.actions, emptyAction()] })}
            >
              <PlusCircle className="h-3.5 w-3.5" />
              Add an action
            </Button>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setLogOpen(false)}>
              Cancel
            </Button>
            <Button disabled={!logValid || log.isPending} onClick={() => log.mutate()}>
              {log.isPending && <Spinner size={14} />}
              Log Inspection
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit / add action / edit action / done / reopen */}
      <Dialog open={pending !== null} onOpenChange={(o) => !o && setPending(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{pending && PENDING_TITLE[pending.kind]}</DialogTitle>
            <DialogDescription>
              {pending && ("inspection" in pending ? pending.inspection.title : pending.action.description)}
            </DialogDescription>
          </DialogHeader>

          {pending?.kind === "edit" && (
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="ins-e-title">Inspection</Label>
                <Input id="ins-e-title" value={editForm.title} onChange={(e) => setEditForm({ ...editForm, title: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ins-e-date">Date</Label>
                <Input
                  id="ins-e-date"
                  type="date"
                  max={today()}
                  value={editForm.inspected_on}
                  onChange={(e) => setEditForm({ ...editForm, inspected_on: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ins-e-result">Result</Label>
                <Select value={editForm.result} onValueChange={(v) => setEditForm({ ...editForm, result: v as InspectionResult })}>
                  <SelectTrigger id="ins-e-result">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.keys(RESULT_LABEL) as InspectionResult[]).map((k) => (
                      <SelectItem key={k} value={k}>
                        {RESULT_LABEL[k]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="ins-e-findings">What you found</Label>
                <Textarea
                  id="ins-e-findings"
                  rows={3}
                  value={editForm.findings}
                  onChange={(e) => setEditForm({ ...editForm, findings: e.target.value })}
                />
              </div>
            </div>
          )}

          {(pending?.kind === "add-action" || pending?.kind === "edit-action") && (
            <ActionFields draft={actionDraft} setDraft={setActionDraft} owners={owners} idPrefix="ins-p" />
          )}

          {pending?.kind === "complete" && (
            <div className="space-y-1.5">
              <Label htmlFor="ins-note">What was done</Label>
              <Textarea id="ins-note" rows={3} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Both extinguishers replaced and tagged" />
            </div>
          )}

          {(pending?.kind === "edit" || pending?.kind === "edit-action" || pending?.kind === "reopen") && (
            <div className="space-y-1.5">
              <Label htmlFor="ins-reason">{pending.kind === "reopen" ? "Why reopen it?" : "Reason for the change"}</Label>
              <Textarea id="ins-reason" rows={2} value={reason} onChange={(e) => setReason(e.target.value)} />
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setPending(null)}>
              Cancel
            </Button>
            <Button disabled={!pendingValid || act.isPending} onClick={() => pending && act.mutate(pending)}>
              {act.isPending && <Spinner size={14} />}
              {pending &&
                { edit: "Save", "add-action": "Add action", "edit-action": "Save", complete: "Mark done", reopen: "Reopen" }[pending.kind]}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
