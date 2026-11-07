"use client";

import { useState } from "react";
import Link from "next/link";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { AlertOctagon, CheckCircle2, Pencil, PlusCircle, RotateCcw, Search, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { api, getErrorMessage } from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";
import { PanelCard } from "@/components/dashboard/PanelCard";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { cn, formatDateTime } from "@/lib/utils";
import { VesselRecordAttachments } from "./VesselRecordAttachments";
import type {
  VesselIncident,
  VesselIncidentSeverity,
  VesselIncidentStatus,
  VesselIncidentType,
} from "@/types";

export const INCIDENT_TYPE_LABEL: Record<VesselIncidentType, string> = {
  spill: "Spill",
  injury: "Injury",
  near_miss: "Near miss",
  equipment_failure: "Equipment failure",
  collision: "Collision or contact",
  fire: "Fire",
  pollution: "Pollution",
  security: "Security",
  other: "Other",
};

export const SEVERITY_LABEL: Record<VesselIncidentSeverity, string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
  critical: "Critical",
};

const SEVERITY_STYLE: Record<VesselIncidentSeverity, string> = {
  low: "border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-500/30 dark:bg-slate-500/15 dark:text-slate-300",
  medium: "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/15 dark:text-amber-300",
  high: "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/15 dark:text-rose-300",
  critical: "border-rose-600 bg-rose-600 text-white dark:border-rose-500 dark:bg-rose-600 dark:text-white",
};

const STATUS_LABEL: Record<VesselIncidentStatus, string> = {
  open: "Open",
  under_investigation: "Under investigation",
  closed: "Closed",
};

const STATUS_STYLE: Record<VesselIncidentStatus, string> = {
  open: "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300",
  under_investigation: "bg-brand-100 text-brand-700 dark:bg-brand-500/15 dark:text-brand-300",
  closed: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300",
};

// Matches VESSEL_RECORD_ROLES / INCIDENT_CLOSER_ROLES in the API's permissions.py.
const RECORD_ROLES = ["bunker_manager", "ops_supervisor", "cargo_superintendent", "safety_officer"];
const CLOSER_ROLES = ["bunker_manager", "safety_officer"];

/** `<input type="datetime-local">` value for a moment, in the viewer's local time. */
function toLocalInput(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

interface IncidentForm {
  occurred_at: string;
  incident_type: VesselIncidentType;
  severity: VesselIncidentSeverity;
  title: string;
  location: string;
  description: string;
  immediate_action: string;
  operation_number: string;
}

const emptyForm = (): IncidentForm => ({
  occurred_at: toLocalInput(new Date()),
  incident_type: "spill",
  severity: "medium",
  title: "",
  location: "",
  description: "",
  immediate_action: "",
  operation_number: "",
});

function fromIncident(i: VesselIncident): IncidentForm {
  return {
    occurred_at: toLocalInput(new Date(i.occurred_at)),
    incident_type: i.incident_type,
    severity: i.severity,
    title: i.title,
    location: i.location ?? "",
    description: i.description ?? "",
    immediate_action: i.immediate_action ?? "",
    operation_number: i.operation_number ?? "",
  };
}

function IncidentFields({
  form,
  setForm,
  withReferences,
}: {
  form: IncidentForm;
  setForm: (f: IncidentForm) => void;
  withReferences: boolean;
}) {
  const set = <K extends keyof IncidentForm>(k: K, v: IncidentForm[K]) => setForm({ ...form, [k]: v });
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <div className="space-y-1.5 sm:col-span-2">
        <Label htmlFor="inc-title">What happened?</Label>
        <Input
          id="inc-title"
          value={form.title}
          onChange={(e) => set("title", e.target.value)}
          placeholder="Hose leak at the manifold"
          maxLength={200}
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="inc-type">Type</Label>
        <Select value={form.incident_type} onValueChange={(v) => set("incident_type", v as VesselIncidentType)}>
          <SelectTrigger id="inc-type">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(INCIDENT_TYPE_LABEL).map(([k, label]) => (
              <SelectItem key={k} value={k}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="inc-severity">Severity</Label>
        <Select value={form.severity} onValueChange={(v) => set("severity", v as VesselIncidentSeverity)}>
          <SelectTrigger id="inc-severity">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="low">Low — no harm, note it</SelectItem>
            <SelectItem value="medium">Medium — minor harm or damage</SelectItem>
            <SelectItem value="high">High — injury, spill or real damage</SelectItem>
            <SelectItem value="critical">Critical — serious injury or major spill</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="inc-when">When</Label>
        <Input
          id="inc-when"
          type="datetime-local"
          value={form.occurred_at}
          max={toLocalInput(new Date())}
          onChange={(e) => set("occurred_at", e.target.value)}
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="inc-where">Where (optional)</Label>
        <Input
          id="inc-where"
          value={form.location}
          onChange={(e) => set("location", e.target.value)}
          placeholder="Jetty 2, alongside MV Example"
        />
      </div>
      {withReferences && (
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="inc-op">Operation number (optional)</Label>
          <Input
            id="inc-op"
            value={form.operation_number}
            onChange={(e) => set("operation_number", e.target.value)}
            placeholder="If it happened during an operation"
          />
        </div>
      )}
      <div className="space-y-1.5 sm:col-span-2">
        <Label htmlFor="inc-desc">Details (optional)</Label>
        <Textarea
          id="inc-desc"
          value={form.description}
          onChange={(e) => set("description", e.target.value)}
          placeholder="What happened, who was involved, what was seen…"
          rows={3}
        />
      </div>
      <div className="space-y-1.5 sm:col-span-2">
        <Label htmlFor="inc-action">Action taken straight away (optional)</Label>
        <Textarea
          id="inc-action"
          value={form.immediate_action}
          onChange={(e) => set("immediate_action", e.target.value)}
          placeholder="Valve shut, spill kit used, area cleared…"
          rows={2}
        />
      </div>
    </div>
  );
}

type Pending =
  | { kind: "edit"; incident: VesselIncident }
  | { kind: "investigate"; incident: VesselIncident }
  | { kind: "close"; incident: VesselIncident }
  | { kind: "reopen"; incident: VesselIncident };

export function VesselIncidentsPanel({
  vesselId,
  vesselName,
  incidents,
}: {
  vesselId: string;
  vesselName: string;
  incidents: VesselIncident[];
}) {
  const qc = useQueryClient();
  const { effectiveRole, user } = useAuth();
  // A real Bunker Manager passes every check, whatever they are acting as.
  const isBM = user?.role === "bunker_manager";
  const canReport = isBM || RECORD_ROLES.includes(effectiveRole ?? "");
  const canClose = isBM || CLOSER_ROLES.includes(effectiveRole ?? "");

  const [reportOpen, setReportOpen] = useState(false);
  const [form, setForm] = useState<IncidentForm>(emptyForm);
  const [pending, setPending] = useState<Pending | null>(null);
  const [editForm, setEditForm] = useState<IncidentForm>(emptyForm);
  const [reason, setReason] = useState("");
  const [rootCause, setRootCause] = useState("");
  const [fix, setFix] = useState("");

  const refresh = () => qc.invalidateQueries({ queryKey: ["vessel-incidents", vesselId] });

  const startAction = (p: Pending) => {
    setPending(p);
    setReason("");
    setRootCause("");
    setFix("");
    if (p.kind === "edit") setEditForm(fromIncident(p.incident));
  };

  const report = useMutation({
    mutationFn: async () => {
      await api.post(`/vessels/${vesselId}/incidents`, {
        occurred_at: new Date(form.occurred_at).toISOString(),
        incident_type: form.incident_type,
        severity: form.severity,
        title: form.title,
        location: form.location || null,
        description: form.description || null,
        immediate_action: form.immediate_action || null,
        operation_number: form.operation_number || null,
      });
    },
    onSuccess: () => {
      toast.success("Incident logged. The Bunker Manager and Safety Officer have been alerted.");
      setReportOpen(false);
      setForm(emptyForm());
      refresh();
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  const act = useMutation({
    mutationFn: async (p: Pending) => {
      const id = p.incident.id;
      if (p.kind === "edit") {
        const orig = fromIncident(p.incident);
        const body: Record<string, string | null> = { reason };
        (["incident_type", "severity", "title", "location", "description", "immediate_action"] as const).forEach((k) => {
          if (editForm[k] !== orig[k]) body[k] = editForm[k] || null;
        });
        if (editForm.occurred_at !== orig.occurred_at) body.occurred_at = new Date(editForm.occurred_at).toISOString();
        await api.patch(`/vessel-incidents/${id}`, body);
      } else if (p.kind === "investigate") {
        await api.post(`/vessel-incidents/${id}/investigate`, { note: reason || null });
      } else if (p.kind === "close") {
        await api.post(`/vessel-incidents/${id}/close`, { root_cause: rootCause, corrective_action: fix });
      } else {
        await api.post(`/vessel-incidents/${id}/reopen`, { reason });
      }
    },
    onSuccess: (_, p) => {
      toast.success(
        { edit: "Incident updated", investigate: "Investigation started", close: "Incident closed", reopen: "Incident reopened" }[p.kind]
      );
      setPending(null);
      refresh();
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  const order: Record<VesselIncidentStatus, number> = { open: 0, under_investigation: 1, closed: 2 };
  const sorted = [...incidents].sort((a, b) => order[a.status] - order[b.status]);
  const live = incidents.filter((i) => i.status !== "closed").length;

  const actionValid =
    pending?.kind === "close"
      ? rootCause.trim() && fix.trim()
      : pending?.kind === "reopen" || pending?.kind === "edit"
        ? reason.trim() && (pending.kind !== "edit" || editForm.title.trim())
        : true;

  return (
    <>
      <PanelCard
        icon={AlertOctagon}
        tone={live > 0 ? "amber" : "blue"}
        title={`Incidents (${incidents.length})`}
        subtitle={live > 0 ? `${live} not closed` : "Nothing open on this vessel"}
        action={
          canReport ? (
            <Button
              size="sm"
              variant="outline"
              className="h-8 rounded-lg text-xs font-semibold"
              onClick={() => {
                setForm(emptyForm());
                setReportOpen(true);
              }}
            >
              <PlusCircle className="h-3.5 w-3.5" />
              Log Incident
            </Button>
          ) : undefined
        }
        flush
      >
        {incidents.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-16 text-center">
            <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-muted">
              <ShieldCheck className="h-7 w-7 text-muted-foreground/40" />
            </span>
            <p className="text-sm font-medium text-foreground">No incidents logged</p>
            <p className="text-xs text-muted-foreground">Spills, injuries and near misses on this vessel are kept here.</p>
          </div>
        ) : (
          <div className="divide-y divide-border/70">
            {sorted.map((i) => (
              <div key={i.id} className={cn("px-4 py-4 lg:px-5", i.status === "closed" && "opacity-75")}>
                <div className="mb-1.5 flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-[13.5px] font-semibold text-foreground">{i.title}</p>
                    <p className="text-[11.5px] text-muted-foreground">
                      {INCIDENT_TYPE_LABEL[i.incident_type]} · {formatDateTime(i.occurred_at)}
                      {i.location && ` · ${i.location}`}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <span className={cn("rounded-full border px-2 py-0.5 text-[10px] font-semibold", SEVERITY_STYLE[i.severity])}>
                      {SEVERITY_LABEL[i.severity]}
                    </span>
                    <span className={cn("rounded-full px-2.5 py-0.5 text-[11px] font-semibold", STATUS_STYLE[i.status])}>
                      {STATUS_LABEL[i.status]}
                    </span>
                  </div>
                </div>

                {i.description && (
                  <p className="mb-1.5 whitespace-pre-line text-[12px] leading-relaxed text-muted-foreground">{i.description}</p>
                )}
                {i.immediate_action && (
                  <p className="mb-1.5 text-[12px] text-muted-foreground">
                    <span className="font-semibold text-foreground">Action taken: </span>
                    {i.immediate_action}
                  </p>
                )}

                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
                  <span>
                    Logged by <span className="font-semibold text-foreground">{i.reported_by_name ?? "Unknown"}</span> ·{" "}
                    {formatDateTime(i.created_at)}
                  </span>
                  {i.operation_id && i.operation_number && (
                    <Link href={`/operations/${i.operation_id}`} className="font-mono font-semibold text-brand-600 hover:underline">
                      {i.operation_number}
                    </Link>
                  )}
                  {i.activity_number && <span className="font-mono">{i.activity_number}</span>}
                </div>

                {i.status === "closed" && (
                  <div className="mt-2 rounded bg-emerald-50 px-2.5 py-1.5 text-[11px] text-emerald-800 dark:bg-emerald-500/10 dark:text-emerald-300">
                    <p>
                      Closed by <span className="font-semibold">{i.closed_by_name ?? "Unknown"}</span>
                      {i.closed_at && ` · ${formatDateTime(i.closed_at)}`}
                    </p>
                    <p className="mt-0.5">
                      <span className="font-semibold">Root cause:</span> {i.root_cause}
                    </p>
                    <p>
                      <span className="font-semibold">Fix:</span> {i.corrective_action}
                    </p>
                  </div>
                )}

                <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                  <VesselRecordAttachments
                    basePath={`/vessel-incidents/${i.id}`}
                    attachments={i.attachments}
                    canUpload={canReport}
                    onUploaded={refresh}
                  />
                  <div className="ml-auto flex flex-wrap gap-1.5">
                    {canReport && i.status !== "closed" && (
                      <Button size="sm" variant="ghost" className="h-7 rounded-lg text-xs" onClick={() => startAction({ kind: "edit", incident: i })}>
                        <Pencil className="h-3 w-3" />
                        Edit
                      </Button>
                    )}
                    {canClose && i.status === "open" && (
                      <Button size="sm" variant="outline" className="h-7 rounded-lg text-xs" onClick={() => startAction({ kind: "investigate", incident: i })}>
                        <Search className="h-3 w-3" />
                        Start investigation
                      </Button>
                    )}
                    {canClose && i.status !== "closed" && (
                      <Button size="sm" variant="outline" className="h-7 rounded-lg text-xs" onClick={() => startAction({ kind: "close", incident: i })}>
                        <CheckCircle2 className="h-3 w-3" />
                        Close
                      </Button>
                    )}
                    {canClose && i.status === "closed" && (
                      <Button size="sm" variant="ghost" className="h-7 rounded-lg text-xs" onClick={() => startAction({ kind: "reopen", incident: i })}>
                        <RotateCcw className="h-3 w-3" />
                        Reopen
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </PanelCard>

      {/* Log a new incident */}
      <Dialog open={reportOpen} onOpenChange={setReportOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertOctagon className="h-4 w-4 text-rose-600" />
              Log an Incident
            </DialogTitle>
            <DialogDescription>
              On {vesselName}. The Bunker Manager and Safety Officer are alerted straight away. You can add photos
              after saving.
            </DialogDescription>
          </DialogHeader>
          <IncidentFields form={form} setForm={setForm} withReferences />
          <DialogFooter>
            <Button variant="outline" onClick={() => setReportOpen(false)}>
              Cancel
            </Button>
            <Button disabled={!form.title.trim() || !form.occurred_at || report.isPending} onClick={() => report.mutate()}>
              {report.isPending && <Spinner size={14} />}
              Log Incident
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit / investigate / close / reopen */}
      <Dialog open={pending !== null} onOpenChange={(o) => !o && setPending(null)}>
        <DialogContent className={cn(pending?.kind === "edit" && "max-h-[90vh] overflow-y-auto sm:max-w-xl")}>
          <DialogHeader>
            <DialogTitle>
              {pending &&
                { edit: "Edit Incident", investigate: "Start Investigation", close: "Close Incident", reopen: "Reopen Incident" }[pending.kind]}
            </DialogTitle>
            <DialogDescription>{pending?.incident.title}</DialogDescription>
          </DialogHeader>

          {pending?.kind === "edit" && <IncidentFields form={editForm} setForm={setEditForm} withReferences={false} />}

          {pending?.kind === "close" ? (
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="inc-root">Root cause</Label>
                <Textarea id="inc-root" value={rootCause} onChange={(e) => setRootCause(e.target.value)} rows={3} placeholder="Why it happened" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="inc-fix">Corrective action</Label>
                <Textarea id="inc-fix" value={fix} onChange={(e) => setFix(e.target.value)} rows={3} placeholder="What was done so it does not happen again" />
              </div>
            </div>
          ) : (
            pending && (
              <div className="space-y-1.5">
                <Label htmlFor="inc-reason">
                  {pending.kind === "investigate" ? "Note (optional)" : pending.kind === "edit" ? "Reason for the change" : "Why reopen it?"}
                </Label>
                <Textarea id="inc-reason" value={reason} onChange={(e) => setReason(e.target.value)} rows={2} />
              </div>
            )
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setPending(null)}>
              Cancel
            </Button>
            <Button disabled={!actionValid || act.isPending} onClick={() => pending && act.mutate(pending)}>
              {act.isPending && <Spinner size={14} />}
              {pending && { edit: "Save", investigate: "Start investigation", close: "Close incident", reopen: "Reopen" }[pending.kind]}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
