"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, CalendarClock, CheckCircle2, Info, Pencil, PlayCircle, PlusCircle, Wrench } from "lucide-react";
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
import { cn, formatDate } from "@/lib/utils";
import { VesselRecordAttachments } from "./VesselRecordAttachments";
import type {
  VesselMaintenanceLog,
  VesselMaintenanceRecord,
  VesselMaintenanceStatus,
  VesselMaintenanceType,
} from "@/types";

export const MAINTENANCE_TYPE_LABEL: Record<VesselMaintenanceType, string> = {
  planned_service: "Planned service",
  breakdown_repair: "Breakdown repair",
  inspection: "Inspection",
  dry_dock: "Dry dock",
  certificate_renewal: "Certificate",
};

const STATUS_LABEL: Record<VesselMaintenanceStatus, string> = {
  planned: "Planned",
  in_progress: "In progress",
  done: "Done",
  cancelled: "Cancelled",
};

const STATUS_STYLE: Record<VesselMaintenanceStatus, string> = {
  planned: "bg-slate-100 text-slate-700 dark:bg-slate-500/15 dark:text-slate-300",
  in_progress: "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300",
  done: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300",
  cancelled: "bg-muted text-muted-foreground",
};

// Matches VESSEL_RECORD_ROLES in the API's permissions.py.
const RECORD_ROLES = ["bunker_manager", "ops_supervisor", "cargo_superintendent", "safety_officer"];

interface MaintenanceForm {
  maintenance_type: VesselMaintenanceType;
  title: string;
  description: string;
  status: VesselMaintenanceStatus;
  planned_date: string;
  completed_date: string;
  next_due_date: string;
  performed_by: string;
  cost: string;
  cost_currency: string;
}

const today = () => new Date().toISOString().slice(0, 10);

const emptyForm = (): MaintenanceForm => ({
  maintenance_type: "planned_service",
  title: "",
  description: "",
  status: "planned",
  planned_date: "",
  completed_date: "",
  next_due_date: "",
  performed_by: "",
  cost: "",
  cost_currency: "NGN",
});

function fromRecord(r: VesselMaintenanceRecord): MaintenanceForm {
  return {
    maintenance_type: r.maintenance_type,
    title: r.title,
    description: r.description ?? "",
    status: r.status,
    planned_date: r.planned_date ?? "",
    completed_date: r.completed_date ?? "",
    next_due_date: r.next_due_date ?? "",
    performed_by: r.performed_by ?? "",
    cost: r.cost ?? "",
    cost_currency: r.cost_currency ?? "NGN",
  };
}

function MaintenanceFields({ form, setForm }: { form: MaintenanceForm; setForm: (f: MaintenanceForm) => void }) {
  const set = <K extends keyof MaintenanceForm>(k: K, v: MaintenanceForm[K]) => setForm({ ...form, [k]: v });
  const isCert = form.maintenance_type === "certificate_renewal";
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <div className="space-y-1.5">
        <Label htmlFor="mt-type">Type</Label>
        <Select value={form.maintenance_type} onValueChange={(v) => set("maintenance_type", v as VesselMaintenanceType)}>
          <SelectTrigger id="mt-type">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(MAINTENANCE_TYPE_LABEL).map(([k, label]) => (
              <SelectItem key={k} value={k}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="mt-status">Status</Label>
        <Select value={form.status} onValueChange={(v) => set("status", v as VesselMaintenanceStatus)}>
          <SelectTrigger id="mt-status">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(STATUS_LABEL).map(([k, label]) => (
              <SelectItem key={k} value={k}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1.5 sm:col-span-2">
        <Label htmlFor="mt-title">{isCert ? "Certificate name" : "What is it for?"}</Label>
        <Input
          id="mt-title"
          value={form.title}
          onChange={(e) => set("title", e.target.value)}
          placeholder={isCert ? "Class certificate" : "Main engine service"}
          maxLength={200}
        />
        <p className="text-[11px] text-muted-foreground">
          Use the same name each time. The newest record with this name sets when the next one is due.
        </p>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="mt-planned">Planned date</Label>
        <Input id="mt-planned" type="date" value={form.planned_date} onChange={(e) => set("planned_date", e.target.value)} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="mt-done">Date done{form.status === "done" ? "" : " (when done)"}</Label>
        <Input
          id="mt-done"
          type="date"
          max={today()}
          value={form.completed_date}
          onChange={(e) => set("completed_date", e.target.value)}
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="mt-next">{isCert ? "Expiry date" : "Next due (optional)"}</Label>
        <Input id="mt-next" type="date" value={form.next_due_date} onChange={(e) => set("next_due_date", e.target.value)} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="mt-by">Done by or vendor (optional)</Label>
        <Input id="mt-by" value={form.performed_by} onChange={(e) => set("performed_by", e.target.value)} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="mt-cost">Cost (optional)</Label>
        <div className="flex gap-2">
          <Input
            id="mt-cost"
            type="number"
            min="0"
            step="0.01"
            value={form.cost}
            onChange={(e) => set("cost", e.target.value)}
          />
          <Select value={form.cost_currency} onValueChange={(v) => set("cost_currency", v)}>
            <SelectTrigger className="w-24" aria-label="Currency">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="NGN">NGN</SelectItem>
              <SelectItem value="USD">USD</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="space-y-1.5 sm:col-span-2">
        <Label htmlFor="mt-desc">Details (optional)</Label>
        <Textarea id="mt-desc" value={form.description} onChange={(e) => set("description", e.target.value)} rows={3} />
      </div>
    </div>
  );
}

/** Form values as the API wants them: blanks become null, cost only with its currency. */
function toBody(f: MaintenanceForm) {
  return {
    maintenance_type: f.maintenance_type,
    title: f.title,
    description: f.description || null,
    status: f.status,
    planned_date: f.planned_date || null,
    completed_date: f.completed_date || null,
    next_due_date: f.next_due_date || null,
    performed_by: f.performed_by || null,
    cost: f.cost || null,
    cost_currency: f.cost ? f.cost_currency : null,
  };
}

export function VesselMaintenancePanel({
  vesselId,
  vesselName,
  vesselStatus,
  log,
}: {
  vesselId: string;
  vesselName: string;
  vesselStatus: string;
  log: VesselMaintenanceLog;
}) {
  const qc = useQueryClient();
  const { effectiveRole, user } = useAuth();
  const canKeep = user?.role === "bunker_manager" || RECORD_ROLES.includes(effectiveRole ?? "");

  const [logOpen, setLogOpen] = useState(false);
  const [form, setForm] = useState<MaintenanceForm>(emptyForm);
  const [editing, setEditing] = useState<VesselMaintenanceRecord | null>(null);
  const [editForm, setEditForm] = useState<MaintenanceForm>(emptyForm);
  const [reason, setReason] = useState("");

  const refresh = () => qc.invalidateQueries({ queryKey: ["vessel-maintenance", vesselId] });

  const startEdit = (r: VesselMaintenanceRecord, status?: VesselMaintenanceStatus) => {
    const f = fromRecord(r);
    if (status) {
      f.status = status;
      if (status === "done" && !f.completed_date) f.completed_date = today();
    }
    setEditForm(f);
    setReason(status === "in_progress" ? "Work started" : status === "done" ? "Work finished" : "");
    setEditing(r);
  };

  const create = useMutation({
    mutationFn: async () => {
      await api.post(`/vessels/${vesselId}/maintenance`, toBody(form));
    },
    onSuccess: () => {
      toast.success("Maintenance logged");
      setLogOpen(false);
      setForm(emptyForm());
      refresh();
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  const update = useMutation({
    mutationFn: async () => {
      if (!editing) return;
      const before = toBody(fromRecord(editing));
      const after = toBody(editForm);
      const body: Record<string, unknown> = { reason };
      (Object.keys(after) as (keyof typeof after)[]).forEach((k) => {
        if (after[k] !== before[k]) body[k] = after[k];
      });
      await api.patch(`/vessel-maintenance/${editing.id}`, body);
    },
    onSuccess: () => {
      toast.success("Maintenance updated");
      setEditing(null);
      refresh();
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  const { records, due } = log;
  const overdue = due.filter((d) => d.state === "overdue");
  const dueSoon = due.filter((d) => d.state === "due_soon");
  const inProgress = records.some((r) => r.status === "in_progress");

  const formValid = (f: MaintenanceForm) => f.title.trim() && (f.status !== "done" || f.completed_date);

  return (
    <>
      {(overdue.length > 0 || dueSoon.length > 0) && (
        <section
          className={cn(
            "rounded-2xl border px-4 py-3.5",
            overdue.length > 0
              ? "border-rose-200 bg-rose-50/70 dark:border-rose-500/25 dark:bg-rose-500/10"
              : "border-amber-200 bg-amber-50/70 dark:border-amber-500/25 dark:bg-amber-500/10"
          )}
        >
          <p className="mb-1.5 flex items-center gap-2 text-[13px] font-bold text-foreground">
            <CalendarClock className="h-4 w-4" />
            {overdue.length > 0 ? `${overdue.length} overdue` : ""}
            {overdue.length > 0 && dueSoon.length > 0 ? " · " : ""}
            {dueSoon.length > 0 ? `${dueSoon.length} due in the next 30 days` : ""}
          </p>
          <ul className="space-y-0.5 text-[12px]">
            {due.map((d) => (
              <li key={d.record_id} className={d.state === "overdue" ? "text-rose-700 dark:text-rose-300" : "text-amber-800 dark:text-amber-300"}>
                <span className="font-semibold">{d.title}</span> ({MAINTENANCE_TYPE_LABEL[d.maintenance_type].toLowerCase()}) —{" "}
                {d.state === "overdue"
                  ? `${Math.abs(d.days)} day${Math.abs(d.days) === 1 ? "" : "s"} overdue (${formatDate(d.due_date)})`
                  : d.days === 0
                    ? "due today"
                    : `due in ${d.days} day${d.days === 1 ? "" : "s"} (${formatDate(d.due_date)})`}
              </li>
            ))}
          </ul>
        </section>
      )}

      {inProgress && vesselStatus !== "maintenance" && vesselStatus !== "out_of_service" && (
        <section className="flex items-start gap-2.5 rounded-2xl border border-brand-200 bg-brand-50/60 px-4 py-3 text-[12px] text-brand-900 dark:border-brand-500/25 dark:bg-brand-500/10 dark:text-brand-200">
          <Info className="mt-0.5 h-4 w-4 shrink-0" />
          <p>
            Work is in progress, but {vesselName} still shows as available. If the vessel cannot be used, ask the Bunker
            Manager to set its status to Maintenance on the Vessels page. This is not changed automatically.
          </p>
        </section>
      )}

      <PanelCard
        icon={Wrench}
        tone={overdue.length > 0 ? "amber" : "blue"}
        title={`Maintenance (${records.length})`}
        subtitle="Services, repairs, inspections, dry docks and certificates"
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
              Log Maintenance
            </Button>
          ) : undefined
        }
        flush
      >
        {records.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-16 text-center">
            <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-muted">
              <Wrench className="h-7 w-7 text-muted-foreground/40" />
            </span>
            <p className="text-sm font-medium text-foreground">No maintenance logged</p>
            <p className="text-xs text-muted-foreground">Log services and certificates to get due-date warnings.</p>
          </div>
        ) : (
          <div className="divide-y divide-border/70">
            {records.map((r) => (
              <div key={r.id} className={cn("px-4 py-4 lg:px-5", r.status === "cancelled" && "opacity-60")}>
                <div className="mb-1 flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-[13.5px] font-semibold text-foreground">{r.title}</p>
                    <p className="text-[11.5px] text-muted-foreground">{MAINTENANCE_TYPE_LABEL[r.maintenance_type]}</p>
                  </div>
                  <span className={cn("rounded-full px-2.5 py-0.5 text-[11px] font-semibold", STATUS_STYLE[r.status])}>
                    {STATUS_LABEL[r.status]}
                  </span>
                </div>
                <div className="mb-1.5 flex flex-wrap gap-x-4 gap-y-0.5 text-[12px] text-muted-foreground">
                  {r.planned_date && <span>Planned: <span className="text-foreground">{formatDate(r.planned_date)}</span></span>}
                  {r.completed_date && <span>Done: <span className="text-foreground">{formatDate(r.completed_date)}</span></span>}
                  {r.next_due_date && (
                    <span>
                      {r.maintenance_type === "certificate_renewal" ? "Expires" : "Next due"}:{" "}
                      <span className="text-foreground">{formatDate(r.next_due_date)}</span>
                    </span>
                  )}
                  {r.performed_by && <span>By: <span className="text-foreground">{r.performed_by}</span></span>}
                  {r.cost && (
                    <span>
                      Cost: <span className="text-foreground">{r.cost_currency} {Number(r.cost).toLocaleString()}</span>
                    </span>
                  )}
                </div>
                {r.description && <p className="mb-1.5 whitespace-pre-line text-[12px] text-muted-foreground">{r.description}</p>}
                <p className="text-[11px] text-muted-foreground">
                  Logged by <span className="font-semibold text-foreground">{r.created_by_name ?? "Unknown"}</span>
                </p>
                <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                  <VesselRecordAttachments
                    basePath={`/vessel-maintenance/${r.id}`}
                    attachments={r.attachments}
                    canUpload={canKeep}
                    onUploaded={refresh}
                  />
                  {canKeep && (
                    <div className="ml-auto flex flex-wrap gap-1.5">
                      {r.status === "planned" && (
                        <Button size="sm" variant="outline" className="h-7 rounded-lg text-xs" onClick={() => startEdit(r, "in_progress")}>
                          <PlayCircle className="h-3 w-3" />
                          Start
                        </Button>
                      )}
                      {(r.status === "planned" || r.status === "in_progress") && (
                        <Button size="sm" variant="outline" className="h-7 rounded-lg text-xs" onClick={() => startEdit(r, "done")}>
                          <CheckCircle2 className="h-3 w-3" />
                          Mark done
                        </Button>
                      )}
                      <Button size="sm" variant="ghost" className="h-7 rounded-lg text-xs" onClick={() => startEdit(r)}>
                        <Pencil className="h-3 w-3" />
                        Edit
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </PanelCard>

      <Dialog open={logOpen} onOpenChange={setLogOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Wrench className="h-4 w-4 text-brand-600" />
              Log Maintenance
            </DialogTitle>
            <DialogDescription>On {vesselName}. You can add files after saving.</DialogDescription>
          </DialogHeader>
          <MaintenanceFields form={form} setForm={setForm} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setLogOpen(false)}>
              Cancel
            </Button>
            <Button disabled={!formValid(form) || create.isPending} onClick={() => create.mutate()}>
              {create.isPending && <Spinner size={14} />}
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={editing !== null} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Update Maintenance</DialogTitle>
            <DialogDescription>{editing?.title}</DialogDescription>
          </DialogHeader>
          <MaintenanceFields form={editForm} setForm={setEditForm} />
          <div className="space-y-1.5">
            <Label htmlFor="mt-reason">Reason for the change</Label>
            <Textarea id="mt-reason" value={reason} onChange={(e) => setReason(e.target.value)} rows={2} />
          </div>
          {editForm.status === "done" && !editForm.completed_date && (
            <p className="flex items-center gap-1.5 text-[11.5px] text-rose-600">
              <AlertTriangle className="h-3.5 w-3.5" /> Give the date the work was done.
            </p>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>
              Cancel
            </Button>
            <Button disabled={!formValid(editForm) || !reason.trim() || update.isPending} onClick={() => update.mutate()}>
              {update.isPending && <Spinner size={14} />}
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
