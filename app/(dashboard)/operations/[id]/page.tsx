"use client";

import { use, useState, useRef, useMemo } from "react";
import type { Dispatch, SetStateAction } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Clock,
  FileText,
  Loader2,
  ChevronRight,
  PlusCircle,
  Trash2,
  CheckCircle2,
  XCircle,
  Truck,
  AlertTriangle,
  Ship,
  RefreshCw,
  ClipboardCheck,
  Tag,
  GitBranch,
  Lock,
  ClipboardList,
  UploadCloud,
  ShieldCheck,
  ShieldAlert,
  Bell,
  Shield,
  Activity,
  Download,
  User as UserIcon,
  Wallet,
  Receipt,
  TrendingUp,
  TrendingDown,
  BadgeCheck,
  Banknote,
  Anchor,
  PlayCircle,
  Pencil,
  Gauge,
  CalendarDays,
  MoreHorizontal,
  Palette,
  Droplets,
  Users,
} from "lucide-react";
import { Spinner } from "@/components/ui/spinner";
import { toast } from "sonner";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { api, getErrorMessage, extractData } from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { ReasonGatedDialog } from "@/components/shared/ReasonGatedDialog";
import { CreateNavalClearanceDialog } from "@/components/operations/CreateNavalClearanceDialog";
import { EditOperationDialog } from "../EditOperationDialog";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { PanelCard } from "@/components/dashboard/PanelCard";
import { DetailHeader, MetaChip } from "@/components/operations/DetailHeader";
import { JourneyStepper, type JourneyStep } from "@/components/operations/JourneyStepper";
import { OperationSummaryCard } from "@/components/operations/OperationSummaryCard";
import { StatusTimeline } from "@/components/operations/StatusTimeline";
import { StatTile, StatTileRow } from "@/components/operations/StatTile";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  cn,
  formatDate,
  formatDateTime,
  formatDayTime,
  OP_TYPE_LABELS,
  OPERATION_COLOR_SWATCHES,
  VESSEL_SOURCE_TYPE_LABELS,
} from "@/lib/utils";
import type {
  ApiResponse,
  Operation,
  OperationStatus,
  StatusHistory,
  Task,
  BDN,
  TruckBdn,
  Document,
  TruckFeedback,
  TruckOperation,
  Truck as TruckRecord,
  PFI,
  PfiAllocation,
  Voucher,
  Payment,
  Invoice,
  User,
  Vessel,
  VesselActivity,
  VesselActivityLeg,
  VesselActivityUpdate,
  TruckSafetyAudit,
  AuditResult,
  AuditPhase,
  AuditLogEntry,
  AuditWaiver,
  TruckWaiver,
  NavalClearance,
  VesselBdn,
  TerminalLoadingReceipt,
  QuantitySummary,
  OperationTotals,
  ClientNotificationRecipient,
  ClientNotificationLog,
  OperationKpi,
  RoleStageDurations,
} from "@/types";
import { PRODUCT_TYPE_LABELS, LEG_STAGES } from "@/types";
import { STATUS_PIPELINE, PIPELINE_LABELS, resolveExpectedVolumeMt } from "@/lib/operations";

// ─── Constants ───────────────────────────────────────────────────────────────
// STATUS_PIPELINE / PIPELINE_LABELS live in lib/operations so the dashboard can
// derive per-operation progress from the same source of truth.

const ROLE_LABELS: Record<string, string> = {
  ops_supervisor:       "Ops Supervisor",
  logistics_officer:    "Logistics Officer",
  cargo_superintendent: "Marine Manager",
  finance_manager:      "Finance Manager",
};

const PRIORITY_OPTIONS = [
  { value: "low",    label: "Low" },
  { value: "normal", label: "Normal" },
  { value: "high",   label: "High" },
  { value: "urgent", label: "Urgent" },
];

const ELIGIBLE_ROLES: Record<string, string[]> = {
  truck_only:     ["ops_supervisor", "logistics_officer"],
  vessel_only:    ["ops_supervisor", "cargo_superintendent"],
  full_operation: ["ops_supervisor", "logistics_officer", "cargo_superintendent"],
};

// The small underlined text actions that sit inside marine panels — Edit,
// Correct a timing, Restore, Cancel. Declared once so the whole tab reads as
// one family rather than a dozen slightly different links.
const INLINE_LINK =
  "rounded text-[11px] font-semibold text-brand-600 underline underline-offset-2 transition-colors hover:text-brand-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";
const INLINE_LINK_DANGER =
  "rounded text-[11px] font-semibold text-destructive underline underline-offset-2 transition-colors hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

// Operation document categories — the upload picker and the Overview card's
// document list read from the same list so their labels can't drift apart.
const DOC_TYPES: { value: string; label: string }[] = [
  { value: "bdn",             label: "BDN" },
  { value: "invoice",         label: "Invoice" },
  { value: "payment_voucher", label: "Payment Voucher" },
  { value: "pfi",             label: "PFI" },
  { value: "report",          label: "Report" },
  { value: "clearance",       label: "Port / Customs Clearance" },
  { value: "other",           label: "Other" },
];

const DOC_TYPE_LABELS: Record<string, string> = Object.fromEntries(
  DOC_TYPES.map((d) => [d.value, d.label])
);

const ELIGIBLE_TASK_TYPES: Record<string, { value: string; label: string }[]> = {
  truck_only:     [{ value: "truck_logistics",  label: "Truck Logistics" }],
  vessel_only:    [
    { value: "vessel_operations", label: "Vessel Operations" },
    { value: "marine_discharge",  label: "Marine Discharge" },
  ],
  full_operation: [
    { value: "truck_logistics",   label: "Truck Logistics" },
    { value: "vessel_operations", label: "Vessel Operations" },
    { value: "marine_discharge",  label: "Marine Discharge" },
  ],
};

// ─── Transition logic ────────────────────────────────────────────────────────

// BM-actionable milestones only. Finance (PFI/payment/invoicing) is a fully
// standalone concern now — it never gates or appears in this pipeline. For
// states not actioned directly by BM, see getNextStepHint below.
function getAvailableTransitions(
  op: Operation
): { to: OperationStatus; label: string; destructive?: boolean }[] {
  switch (op.status) {
    case "draft":
      return [{ to: "tasks_assigned", label: "Confirm Tasks Assigned" }];
    case "tasks_assigned":
      return op.type === "vessel_only"
        ? [{ to: "active", label: "Activate Operation" }]
        : [{ to: "awaiting_feedback", label: "Request Feedback" }];
    case "feedback_submitted":
      return [
        { to: "active",             label: "Approve & Activate" },
        { to: "feedback_rejected",  label: "Reject Feedback", destructive: true },
      ];
    case "feedback_approved":
      return [{ to: "active", label: "Activate Operation" }];
    case "active":
      // Truck-only: delivery completion is submitted by LO/OS in the Truck
      // Reports tab, not a BM button. Vessel/Full: BM starts vessel ops directly.
      return op.type !== "truck_only"
        ? [{ to: "vessel_operations", label: "Start Vessel Ops" }]
        : [];
    // Legacy compat only — no operation reaches payment_confirmed going forward,
    // but one created under the old flow may still be sitting here.
    case "payment_confirmed":
      return op.type === "truck_only"
        ? []
        : [{ to: "vessel_operations", label: "Start Vessel Ops" }];
    case "pending_completion":
      // Delivery done — completion no longer happens directly from here.
      // Ops Supervisor / Logistics Officer must submit the Truck BDN (Truck
      // BDN tab); BM's only direct action at this stage is to bounce it back
      // to Active.
      return [
        { to: "active", label: "Return to Active", destructive: true },
      ];
    case "bdn_approved":
      // Serves both vessel/full (approved via the BDN tab) and, now,
      // truck-only (approved via the Truck BDN tab).
      return [{ to: "completed", label: "Complete Operation" }];
    // Legacy compat only — no operation reaches "invoiced" going forward,
    // but one already sitting there (pre-redesign) can still be completed.
    case "invoiced":
      return [{ to: "completed", label: "Complete Operation" }];
    default:
      // pfi_linked, payment_processing, vessel_operations, bdn_pending →
      // driven by their own tabs / Finance's standalone portal. No BM stage button.
      return [];
  }
}

// Role-aware "what happens next" for states the BM does not action directly.
// Keeps the operation moving without showing buttons that would fail permission.
function getNextStepHint(op: Operation): { who: string; text: string } | null {
  switch (op.status) {
    case "active":
      return op.type === "truck_only"
        ? { who: "Logistics", text: "Logistics/Ops Supervisor records deliveries in the Truck Reports tab, then submits completion." }
        : null; // vessel/full gets a direct "Start Vessel Ops" button instead
    // Legacy compat only — these two hints only apply to an operation that was
    // already mid-flow under the old payment-gated pipeline before this change.
    case "pfi_linked":
      return { who: "Finance", text: "PFI linked. Finance records the client's payment from the Finance portal." };
    case "payment_processing":
      return { who: "Finance", text: "Payment recorded. Finance confirms it from the Finance portal." };
    case "payment_confirmed":
      return op.type === "truck_only"
        ? { who: "Logistics", text: "Payment confirmed. Logistics records the deliveries in the Truck Reports tab, then submits completion." }
        : null; // vessel/full has a Start Vessel Ops button instead
    case "vessel_operations":
      return op.type === "vessel_only"
        ? { who: "Marine", text: "Log the six journey stages in the Marine tab — Loading Commenced/Completed, then Cast Off → Alongside → Discharge Commenced → Discharge Completed for each receiving vessel. Raise a Vessel BDN per receiving vessel once it finishes." }
        : { who: "Marine", text: "Vessel operations underway. Record the delivery, then raise the BDN in the BDN tab." };
    case "bdn_pending":
      return { who: "Bunker Manager", text: "A BDN has been submitted. Review it in the BDN tab — approve or reject." };
    default:
      return null;
  }
}

const REOPENABLE_STATUSES: OperationStatus[] = ["completed", "archived", "cancelled"];


type StageExtra = { k: string; label: string; type: "number" | "text"; optional?: boolean };
interface TruckStage { key: string; label: string; description: string; extras: StageExtra[] }

const TRUCK_STAGES: TruckStage[] = [
  { key: "departed_parking_at",  label: "Departed Parking",             description: "Truck left parking/depot",
    extras: [] },
  { key: "arrived_loading_at",   label: "Arrived at Loading Point",     description: "Truck reached loading facility",
    extras: [{ k: "loading_location", label: "Loading Location", type: "text", optional: true }] },
  { key: "transit_start_at",     label: "Loading Started",              description: "Product loading commenced",
    extras: [{ k: "temperature_celsius", label: "Temperature (°C)", type: "number", optional: true }] },
  { key: "departed_loading_at",  label: "Loading Completed / Departed", description: "Loading done, truck departed",
    extras: [
      { k: "quantity_loaded_mt", label: "Quantity Loaded (L)", type: "number" },
      { k: "waybill_number",     label: "Waybill Number",       type: "text",   optional: true },
    ]},
  { key: "arrived_discharge_at", label: "Arrived at Discharge Point",   description: "Truck reached discharge location",
    extras: [{ k: "discharge_location", label: "Discharge Location", type: "text", optional: true }] },
  { key: "discharge_start_at",   label: "Discharge Started",            description: "Product discharge commenced",
    extras: [{ k: "temperature_celsius", label: "Temperature (°C)", type: "number", optional: true }] },
  { key: "discharge_end_at",     label: "Discharge Completed",          description: "All product delivered",
    extras: [
      { k: "quantity_discharged_mt", label: "Quantity Discharged (L)", type: "number"               },
      { k: "temperature_celsius",    label: "Temperature (°C)",         type: "number", optional: true },
      { k: "spillage_mt",            label: "Spillage (L)",            type: "number", optional: true },
    ]},
];

// ─── Sub-components ──────────────────────────────────────────────────────────

const assignTaskSchema = z.object({
  assigned_to:  z.string().min(1, "Select a staff member"),
  task_type:    z.string().min(1, "Select a task type"),
  priority:     z.string().min(1),
  instructions: z.string().optional(),
});
type AssignTaskForm = z.infer<typeof assignTaskSchema>;

function AssignTaskDialog({
  operationId,
  operationType,
  open,
  onClose,
  onCreated,
}: {
  operationId: string;
  operationType: string;
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}) {
  const { register, handleSubmit, setValue, watch, reset, formState: { errors } } =
    useForm<AssignTaskForm>({ resolver: zodResolver(assignTaskSchema), defaultValues: { priority: "normal" } });

  const eligibleRoles    = ELIGIBLE_ROLES[operationType] ?? [];
  const eligibleTaskTypes = ELIGIBLE_TASK_TYPES[operationType] ?? [];

  const { data: staffUsers } = useQuery({
    queryKey: ["staff-users"],
    queryFn: async () => {
      const res = await api.get<ApiResponse<{ items: User[] }>>("/admin/users?per_page=100");
      const items = (res.data.data as { items: User[] }).items ?? [];
      return items.filter((u) => u.is_active && eligibleRoles.includes(u.role));
    },
    enabled: open,
  });

  const mutation = useMutation({
    mutationFn: async (data: AssignTaskForm) => {
      const res = await api.post(`/operations/${operationId}/tasks`, {
        assigned_to:  data.assigned_to,
        task_type:    data.task_type,
        priority:     data.priority,
        instructions: data.instructions?.trim() || undefined,
      });
      return res.data;
    },
    onSuccess: () => { toast.success("Task assigned"); reset(); onCreated(); },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) { reset(); onClose(); } }}>
      <DialogContent className="sm:max-w-md" aria-describedby={undefined}>
        <DialogHeader><DialogTitle>Assign Task</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit((d) => mutation.mutate(d))} className="space-y-4 mt-2">
          <div className="space-y-1.5">
            <Label>Assign To</Label>
            <Select value={watch("assigned_to")} onValueChange={(v) => setValue("assigned_to", v)}>
              <SelectTrigger><SelectValue placeholder="Select staff member…" /></SelectTrigger>
              <SelectContent>
                {staffUsers?.map((u) => (
                  <SelectItem key={u.id} value={u.id}>
                    <span className="font-medium">{u.full_name}</span>
                    <span className="ml-2 text-xs text-muted-foreground">({ROLE_LABELS[u.role] ?? u.role})</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.assigned_to && <p className="text-xs text-destructive">{errors.assigned_to.message}</p>}
          </div>

          <div className="space-y-1.5">
            <Label>Task Type</Label>
            <Select value={watch("task_type")} onValueChange={(v) => setValue("task_type", v)}>
              <SelectTrigger><SelectValue placeholder="Select task type…" /></SelectTrigger>
              <SelectContent>
                {eligibleTaskTypes.map((t) => (
                  <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.task_type && <p className="text-xs text-destructive">{errors.task_type.message}</p>}
          </div>

          <div className="space-y-1.5">
            <Label>Priority</Label>
            <Select value={watch("priority")} onValueChange={(v) => setValue("priority", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {PRIORITY_OPTIONS.map((p) => (
                  <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>Instructions <span className="text-muted-foreground font-normal">(optional)</span></Label>
            <Textarea placeholder="Specific instructions…" className="resize-none" rows={3} {...register("instructions")} />
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="outline" onClick={() => { reset(); onClose(); }}>Cancel</Button>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending && <Spinner size={16} className="mr-1.5" />}
              Assign Task
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ─── Vessel-only six-stage journey ───────────────────────────────────────────
// The spec's journey is six numbered stages: Loading Commenced/Completed
// happen ONCE on the barge run, then Cast Off -> Alongside -> Discharge
// Commenced -> Discharge Completed repeat per receiving vessel. Every stage
// stores both a system timestamp and the user's own stated time — both are
// always shown together, side by side, and neither overwrites the other.

/** One stage in the journey: a numbered node, its label, and its two times. */
/**
 * The count pill beside a tab label. Renders nothing at zero so empty tabs
 * stay quiet; `accent` marks a tab that wants attention (pending feedback, a
 * live vessel activity).
 */
function TabCount({ value, accent }: { value?: number; accent?: boolean }) {
  if (!value) return null;
  return (
    <span
      className={cn(
        "inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5",
        "text-[10px] font-semibold tabular-nums",
        accent ? "bg-brand-500 text-white" : "bg-muted text-muted-foreground"
      )}
    >
      {value}
    </span>
  );
}

/** Title / subtitle / action row that opens each block inside the Marine tab. */
function SectionHead({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-2 flex flex-wrap items-start justify-between gap-x-3 gap-y-1">
      <div className="min-w-0">
        <p className="text-[13px] font-bold tracking-tight text-foreground">{title}</p>
        {subtitle && (
          <p className="mt-0.5 text-[11px] text-muted-foreground">{subtitle}</p>
        )}
      </div>
      {action && <div className="flex shrink-0 items-center gap-2">{action}</div>}
    </div>
  );
}

/**
 * The recorded-quantity readout used by both Loading Received Quantity and a
 * receiving vessel's Discharge Quantity: a bordered strip of mono figures with
 * an optional description line beneath.
 */
function QuantityReadout({
  columns,
  note,
}: {
  columns: [string, string][];
  note?: string;
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-navy-100 bg-card dark:border-border">
      <div className="grid grid-cols-1 divide-y divide-border/70 sm:grid-cols-3 sm:divide-x sm:divide-y-0">
        {columns.map(([label, value]) => (
          <div key={label} className="px-3.5 py-2.5">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              {label}
            </p>
            <p className="mt-0.5 font-mono text-[13px] font-semibold tabular-nums text-foreground">
              {value}
            </p>
          </div>
        ))}
      </div>
      {note && (
        <p className="border-t border-border/70 px-3.5 py-2 text-[11px] italic text-muted-foreground">
          {note}
        </p>
      )}
    </div>
  );
}

function JourneyStage({
  number,
  label,
  systemAt,
  userAt,
  done,
  current,
  last,
}: {
  number: number;
  label: string;
  systemAt?: string | null;
  userAt?: string | null;
  done: boolean;
  current: boolean;
  last?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex items-start gap-3 py-2.5",
        !last && "border-b border-border/70"
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold",
          done
            ? "bg-emerald-500 text-white"
            : current
              ? "bg-brand-500 text-white"
              : "bg-muted text-muted-foreground"
        )}
      >
        {done ? <CheckCircle2 className="h-3.5 w-3.5" strokeWidth={3} /> : number}
      </span>

      <div className="flex min-w-0 flex-1 flex-wrap items-start justify-between gap-x-4 gap-y-1">
        <div className="min-w-0">
          <p
            className={cn(
              "text-[13px] font-semibold leading-tight",
              done || current ? "text-foreground" : "text-muted-foreground"
            )}
          >
            {label}
            {current && (
              <span className="ml-2 text-[10px] font-medium text-brand-600">← next</span>
            )}
          </p>
          {done && (
            <p className="mt-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
              System recorded
              <span className="ml-1.5 font-mono normal-case tracking-normal tabular-nums">
                {formatDateTime(systemAt)}
              </span>
            </p>
          )}
        </div>

        {done && (
          <div className="shrink-0 text-right">
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">You entered</p>
            <p className="font-mono text-[12px] font-semibold tabular-nums text-foreground">
              {userAt ? formatDateTime(userAt) : "—"}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Main page ───────────────────────────────────────────────────────────────

export default function OperationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { user, effectiveRole } = useAuth();
  const router   = useRouter();
  const qc       = useQueryClient();

  // The Bunker Manager has full access to every role's actions at all times.
  // "Acting as" switches which role's view is presented — it never removes
  // the BM's own authority, and the BM is never blocked by whether a task or
  // vessel activity happens to be assigned to them. Mirrors the backend
  // (require_roles / acting_role both let a real BM through unconditionally).
  const isRealBM = user?.role === "bunker_manager";
  const isBM = isRealBM || effectiveRole === "bunker_manager";
  const isFM = isRealBM || effectiveRole === "finance_manager";
  const isLO = isRealBM || effectiveRole === "logistics_officer";
  const isMM = isRealBM || effectiveRole === "cargo_superintendent";
  const isOS = isRealBM || effectiveRole === "ops_supervisor";

  const canSeeTasks            = isBM || isOS || isLO || isMM;
  const canSeeBDN              = isBM || isMM;
  const canSeeTruckBdn         = isBM || isOS || isLO;
  const canSeeVesselBdn        = isBM || isMM || isOS || isFM;
  const canSeeFeedback         = isBM || isLO;
  const canSeeFinance          = isBM || isFM;
  const canSeeMarine           = isBM || isMM;
  const canSeeTruckOps         = isBM || isOS || isLO || isMM;

  // ── UI state
  const [showAssignTask,   setShowAssignTask]   = useState(false);
  const [rejectFeedbackId, setRejectFeedbackId] = useState<string | null>(null);
  const [rejectReason,     setRejectReason]     = useState("");
  const [completionReport, setCompletionReport] = useState("");
  const [transitionNotes,  setTransitionNotes]  = useState("");
  const [showTransitionConfirm, setShowTransitionConfirm] = useState<{
    to: OperationStatus; label: string; destructive?: boolean;
  } | null>(null);
  const [showReopenDialog, setShowReopenDialog] = useState(false);
  const [reopenNotes,      setReopenNotes]      = useState("");
  const [approvingFeedbackId, setApprovingFeedbackId] = useState<string | null>(null);
  const [approveComment,      setApproveComment]       = useState("");

  // LO feedback
  const [loSelectedTrucks, setLoSelectedTrucks] = useState<string[]>([]);
  const [loSummary,         setLoSummary]         = useState("");
  const [loNotes,           setLoNotes]           = useState("");
  // Per-truck driver/vendor captured at sourcing time (keyed by truck id), carried
  // in the feedback's truck_details and applied when TruckOperation rows get
  // created at approval time.
  const [loTruckDetails, setLoTruckDetails] = useState<Record<string, { driver_name: string; driver_phone: string; vendor_name: string }>>({});
  const [plateSearch, setPlateSearch] = useState("");
  const [showCreateTruckDialog, setShowCreateTruckDialog] = useState(false);

  const setLoTruckDetail = (truckId: string, field: "driver_name" | "driver_phone" | "vendor_name", value: string) =>
    setLoTruckDetails((prev) => {
      const existing = prev[truckId] ?? { driver_name: "", driver_phone: "", vendor_name: "" };
      return { ...prev, [truckId]: { ...existing, [field]: value } };
    });

  // ── Marine Supervisor state
  const [showAssignActivityForm, setShowAssignActivityForm] = useState(false);
  const [actVesselId,   setActVesselId]   = useState("");
  const [actAssignedTo, setActAssignedTo] = useState("");
  const [actNotes,      setActNotes]      = useState("");

  // BM edit Initial ROB
  const [editingRobActivityId, setEditingRobActivityId] = useState<string | null>(null);
  const [editRobValue,         setEditRobValue]         = useState("");

  // Controlled so cross-tab links (Overview → Docs) can switch tabs.
  const [activeTab, setActiveTab] = useState("overview");

  // ── Queries
  const { data: op, isLoading } = useQuery({
    queryKey: ["operation", id],
    queryFn: async () => {
      const res = await api.get<ApiResponse<Operation>>(`/operations/${id}`);
      return res.data.data;
    },
  });

  const { data: timeline, isLoading: timelineLoading } = useQuery({
    queryKey: ["operation-timeline", id],
    queryFn: async () => {
      const res = await api.get<ApiResponse<StatusHistory[]>>(`/operations/${id}/timeline`);
      return res.data.data;
    },
  });

  const { data: tasks } = useQuery({
    queryKey: ["operation-tasks", id],
    queryFn: async () => {
      const res = await api.get<ApiResponse<Task[]>>(`/operations/${id}/tasks`);
      return res.data.data;
    },
    enabled: canSeeTasks,
  });

  const { data: bdns } = useQuery({
    queryKey: ["operation-bdns", id],
    queryFn: async () => {
      const res = await api.get<ApiResponse<BDN[]>>(`/operations/${id}/bdns`);
      return res.data.data;
    },
    enabled: canSeeBDN || isFM,  // FM needs approved BDNs to create invoices
    staleTime: 0,
  });

  const { data: truckBdns } = useQuery({
    queryKey: ["operation-truck-bdns", id],
    queryFn: async () => {
      const res = await api.get<ApiResponse<TruckBdn[]>>(`/operations/${id}/truck-bdns`);
      return res.data.data;
    },
    enabled: canSeeTruckBdn || isFM,  // FM needs approved Truck BDNs to create invoices
    staleTime: 0,
  });

  const { data: vesselBdns, isLoading: vesselBdnsLoading, isError: vesselBdnsErrored, refetch: refetchVesselBdns } = useQuery({
    queryKey: ["operation-vessel-bdns", id],
    queryFn: async () => {
      const res = await api.get<ApiResponse<VesselBdn[]>>(`/operations/${id}/vessel-bdns`);
      return res.data.data;
    },
    enabled: (canSeeVesselBdn || isFM) && op?.type !== "truck_only",
    staleTime: 0,
  });

  const { data: quantitySummary } = useQuery({
    queryKey: ["operation-quantity-summary", id],
    queryFn: async () => {
      const res = await api.get<ApiResponse<QuantitySummary>>(`/operations/${id}/quantity-summary`);
      return res.data.data;
    },
    enabled: canSeeMarine,
    staleTime: 0,
  });

  const { data: operationTotals } = useQuery({
    queryKey: ["operation-totals", id],
    queryFn: async () => {
      const res = await api.get<ApiResponse<OperationTotals>>(`/operations/${id}/totals`);
      return res.data.data;
    },
    enabled: canSeeMarine,
    staleTime: 0,
  });

  const { data: terminalReceipts, refetch: refetchTerminalReceipts } = useQuery({
    queryKey: ["operation-terminal-receipts", id],
    queryFn: async () => {
      const res = await api.get<ApiResponse<TerminalLoadingReceipt[]>>(`/operations/${id}/terminal-receipts`);
      return res.data.data;
    },
    enabled: canSeeMarine && op?.source_type === "terminal",
    staleTime: 0,
  });

  const [showTerminalReceiptForm, setShowTerminalReceiptForm] = useState(false);
  const [termQtyLitres, setTermQtyLitres] = useState("");
  const [termGov, setTermGov] = useState("");
  const [termGsv, setTermGsv] = useState("");
  const [termMtVacuum, setTermMtVacuum] = useState("");
  const [termDescription, setTermDescription] = useState("");
  const resetTerminalReceiptForm = () => {
    setShowTerminalReceiptForm(false);
    setTermQtyLitres(""); setTermGov(""); setTermGsv(""); setTermMtVacuum(""); setTermDescription("");
  };
  const createTerminalReceiptMutation = useMutation({
    mutationFn: async () => {
      await api.post(`/operations/${id}/terminal-receipts`, {
        quantity_litres: parseFloat(termQtyLitres),
        gov: termGov.trim() ? parseFloat(termGov) : undefined,
        gsv: termGsv.trim() ? parseFloat(termGsv) : undefined,
        mt_vacuum: termMtVacuum.trim() ? parseFloat(termMtVacuum) : undefined,
        description: termDescription.trim() || undefined,
      });
    },
    onSuccess: () => {
      toast.success("Terminal loading receipt recorded");
      resetTerminalReceiptForm();
      refetchTerminalReceipts();
      qc.invalidateQueries({ queryKey: ["operation-quantity-summary", id] });
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  const { data: truckOps } = useQuery({
    queryKey: ["operation-trucks", id],
    queryFn: async () => {
      const res = await api.get(`/operations/${id}/trucks`);
      const raw = res.data.data;
      const list = Array.isArray(raw) ? raw : ((raw as { items?: unknown[] })?.items ?? []);
      return list as TruckOperation[];
    },
    enabled: canSeeTruckOps,
  });

  const { data: docs } = useQuery({
    queryKey: ["operation-docs", id],
    queryFn: async () => {
      const res = await api.get<ApiResponse<Document[]>>(`/operations/${id}/documents`);
      return res.data.data;
    },
    enabled: isBM,
  });

  const { data: pfis, refetch: refetchPfis } = useQuery({
    queryKey: ["operation-pfis", id],
    queryFn: async () => {
      const res = await api.get<ApiResponse<PFI[]>>(`/operations/${id}/pfis`);
      return res.data.data ?? [];
    },
    enabled: canSeeFinance,
    staleTime: 0,
  });

  // ── Minimal "Link PFI" affordance for the pre-activation gate — BM only.
  // PFIs are normally linked at operation creation; this covers the case
  // where none was picked then and the operation still needs one to activate.
  const [showLinkPfi, setShowLinkPfi] = useState(false);
  const [linkPfiId, setLinkPfiId] = useState("");
  const [linkQuantity, setLinkQuantity] = useState("");

  const { data: unlinkedPfis } = useQuery({
    queryKey: ["pfis-unlinked"],
    queryFn: async () => {
      const res = await api.get<ApiResponse<PFI[]>>(`/pfis`, { params: { unlinked_only: true } });
      return res.data.data ?? [];
    },
    enabled: isBM && showLinkPfi,
  });

  const linkPfiMutation = useMutation({
    mutationFn: async () => {
      await api.post(`/operations/${id}/pfis/${linkPfiId}/allocations`, {
        quantity_litres: parseFloat(linkQuantity),
      });
    },
    onSuccess: () => {
      toast.success("PFI linked to this operation");
      setShowLinkPfi(false);
      setLinkPfiId("");
      setLinkQuantity("");
      refetchPfis();
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  const { data: feedbacks, refetch: refetchFeedbacks } = useQuery({
    queryKey: ["operation-feedback", id],
    queryFn: async () => {
      const res = await api.get<ApiResponse<TruckFeedback[]>>(`/operations/${id}/feedback`);
      return res.data.data;
    },
    enabled: canSeeFeedback && op?.type !== "vessel_only",
  });

  const { data: vesselActivities, refetch: refetchVesselActivities } = useQuery({
    queryKey: ["operation-vessel-activities", id],
    queryFn: async () => {
      const res = await api.get<ApiResponse<VesselActivity[]>>(
        `/operations/${id}/vessel-activities`
      );
      return res.data.data ?? [];
    },
    enabled: canSeeMarine,
  });


  const { data: allVessels } = useQuery({
    queryKey: ["vessels-list-all"],
    queryFn: async () => {
      const res = await api.get<ApiResponse<{ items: Vessel[] }>>("/vessels?per_page=200");
      const d = res.data.data;
      return Array.isArray(d) ? d : (d as { items: Vessel[] }).items ?? [];
    },
    enabled: isBM || isMM || isLO,
  });

  const { data: marineManagers } = useQuery({
    queryKey: ["marine-managers"],
    queryFn: async () => {
      const res = await api.get<ApiResponse<{ items: User[] }>>("/admin/users?per_page=100");
      const items = (res.data.data as { items: User[] }).items ?? [];
      return items.filter((u) => u.is_active && u.role === "cargo_superintendent");
    },
    enabled: isBM,
  });

  const { data: versions } = useQuery({
    queryKey: ["operation-versions", id],
    queryFn: async () => {
      const res = await api.get<ApiResponse<Operation[]>>(`/operations/${id}/versions`);
      return res.data.data;
    },
    enabled: !!(op?.parent_operation_id || (op?.version && op.version > 1)),
  });

  // ── Create a new truck inline while sourcing (LO), then add it to the nomination list
  const [newTruckNumber,   setNewTruckNumber]   = useState("");
  const [newTruckCapacity, setNewTruckCapacity] = useState("");
  const [newTruckChassis,  setNewTruckChassis]  = useState("");
  const [newTruckDriver,   setNewTruckDriver]   = useState("");
  const [newTruckPhone,    setNewTruckPhone]    = useState("");
  const [newTruckVendor,   setNewTruckVendor]   = useState("");
  const [newTruckPhotoFile,      setNewTruckPhotoFile]      = useState<File | null>(null);
  const [newTruckLicenceFile,    setNewTruckLicenceFile]    = useState<File | null>(null);
  const [newTruckCalibrationFile, setNewTruckCalibrationFile] = useState<File | null>(null);

  const resetCreateTruckForm = () => {
    setNewTruckNumber(""); setNewTruckCapacity(""); setNewTruckChassis("");
    setNewTruckDriver(""); setNewTruckPhone(""); setNewTruckVendor("");
    setNewTruckPhotoFile(null); setNewTruckLicenceFile(null); setNewTruckCalibrationFile(null);
  };

  const createTruckMutation = useMutation({
    mutationFn: async () => {
      const res = await api.post<{ data: { id: string; truck_number: string } }>("/trucks", {
        truck_number: newTruckNumber.trim(),
        capacity_mt: parseFloat(newTruckCapacity),
        chassis_number: newTruckChassis.trim() || undefined,
      });
      const truckId = res.data.data.id;

      const uploads: Promise<unknown>[] = [];
      if (newTruckPhotoFile) {
        const form = new FormData();
        form.append("file", newTruckPhotoFile);
        uploads.push(api.post(`/trucks/${truckId}/photo`, form, { headers: { "Content-Type": "multipart/form-data" } }));
      }
      if (newTruckLicenceFile) {
        const form = new FormData();
        form.append("file", newTruckLicenceFile);
        uploads.push(api.post(`/trucks/${truckId}/documents/licence`, form, { headers: { "Content-Type": "multipart/form-data" } }));
      }
      if (newTruckCalibrationFile) {
        const form = new FormData();
        form.append("file", newTruckCalibrationFile);
        uploads.push(api.post(`/trucks/${truckId}/documents/calibration_cert`, form, { headers: { "Content-Type": "multipart/form-data" } }));
      }
      await Promise.all(uploads);
      return { id: truckId, truck_number: res.data.data.truck_number };
    },
    onSuccess: (truck) => {
      toast.success(`Truck ${truck.truck_number} created`);
      setLoSelectedTrucks((prev) => prev.includes(truck.id) ? prev : [...prev, truck.id]);
      setLoTruckDetail(truck.id, "driver_name", newTruckDriver.trim());
      setLoTruckDetail(truck.id, "driver_phone", newTruckPhone.trim());
      setLoTruckDetail(truck.id, "vendor_name", newTruckVendor.trim());
      qc.invalidateQueries({ queryKey: ["fleet-trucks"] });
      setShowCreateTruckDialog(false);
      setPlateSearch("");
      resetCreateTruckForm();
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  const { data: fleetTrucks } = useQuery({
    queryKey: ["fleet-trucks"],
    queryFn: async () => {
      const res = await api.get<ApiResponse<TruckRecord[]>>("/trucks?active_only=true");
      const d = res.data.data;
      return Array.isArray(d) ? d : [];
    },
    // Nomination isn't status-gated (trucks can be added any time), and BM
    // needs this to resolve full truck details for pending submissions too
    // (before a TruckOperation row exists to read them from instead).
    enabled: isLO || isBM,
  });

  // Resolves a nominated truck's display details from whichever source has
  // them: the canonical TruckOperation row (once BM has approved and it
  // exists), else the fleet master record, else the driver info the LO typed
  // in at nomination time (fb.truck_details.driverInfo) — so both the LO's
  // own "Your Submissions" and the BM's review card can show full details
  // (plate, driver, vendor) even while the submission is still pending.
  const resolveTruckDisplay = (tid: string, fb?: TruckFeedback) => {
    const truckOp = truckOps?.find((to) => to.truck_id === tid);
    const fleetTruck = fleetTrucks?.find((t) => t.id === tid);
    const driverInfo = (fb?.truck_details as { driverInfo?: Record<string, { driver_name?: string; driver_phone?: string; vendor_name?: string }> } | undefined)
      ?.driverInfo?.[tid];
    return {
      truckNumber: truckOp?.truck?.truck_number ?? fleetTruck?.truck_number ?? null,
      capacityMt: fleetTruck?.capacity_mt ?? null,
      driverName: truckOp?.driver_name || driverInfo?.driver_name || fleetTruck?.driver_name || null,
      driverPhone: truckOp?.driver_phone || driverInfo?.driver_phone || fleetTruck?.driver_phone || null,
      vendorName: truckOp?.vendor_name || driverInfo?.vendor_name || null,
    };
  };

  // Every truck the BM has approved, across ALL approved feedback rounds.
  //
  // The LO may submit readiness more than once — e.g. one truck at 12:42, then
  // eight more at 12:58 — and the BM approves each round separately. The list
  // endpoint returns feedback newest-first, so reading a single approved row
  // silently dropped every truck nominated in an earlier round. Union them.
  const approvedNominations = useMemo(() => {
    const approved = (feedbacks ?? []).filter((f) => f.status === "approved");
    // Oldest round first, so trucks initialize in the order they were nominated.
    const ordered = [...approved].sort((a, b) =>
      (a.submitted_at ?? "").localeCompare(b.submitted_at ?? "")
    );

    const truckIds: string[] = [];
    const seen = new Set<string>();
    const driverInfo: Record<
      string,
      { driver_name?: string; driver_phone?: string; vendor_name?: string }
    > = {};

    for (const fb of ordered) {
      for (const tid of fb.truck_ids ?? []) {
        if (seen.has(tid)) continue;
        seen.add(tid);
        truckIds.push(tid);
      }
      // A later round re-nominating the same truck carries corrected driver
      // details, so let it win.
      const info = (
        fb.truck_details as {
          driverInfo?: Record<
            string,
            { driver_name?: string; driver_phone?: string; vendor_name?: string }
          >;
        } | undefined
      )?.driverInfo;
      if (info) Object.assign(driverInfo, info);
    }

    return { truckIds, driverInfo };
  }, [feedbacks]);

  // Approved trucks with no *live* TruckOperation row.
  //
  // A removed truck keeps its row for traceability with status `cancelled`.
  // That row must not suppress re-initialisation: a truck can legitimately be
  // removed and then nominated again in a later feedback round, and the API
  // allows it (add_truck_to_operation only rejects a duplicate that is
  // non-cancelled). Matching that rule here is what lets a re-approved truck
  // come back — keying off "has any row at all" stranded it permanently.
  // Which approved trucks can still be added is decided server-side, by the
  // same code that guards the add itself (truck_service.addable_truck_ids).
  // Deriving it here instead is what made trucks vanish from Truck Reports
  // twice — the UI's rule drifted from the API's. Do not reintroduce it.
  const { data: addableTrucks } = useQuery({
    // Nested under the truck-ops key so every existing
    // invalidateQueries(["operation-trucks", id]) refreshes this too — react
    // query matches key prefixes, so add/remove keeps the banner honest.
    queryKey: ["operation-trucks", id, "addable"],
    queryFn: async () => {
      const res = await api.get<ApiResponse<{ id: string; truck_number: string }[]>>(
        `/operations/${id}/trucks/addable`
      );
      return res.data.data ?? [];
    },
    enabled: canSeeTruckOps,
  });

  const uninitializedTruckIds = useMemo(
    () => (addableTrucks ?? []).map((t) => t.id),
    [addableTrucks]
  );

  // BM-only: live activity log (poll every 20 s)
  const { data: activityLog, refetch: refetchActivity } = useQuery({
    queryKey: ["operation-activity", id],
    queryFn: async () => {
      const res = await api.get<ApiResponse<AuditLogEntry[]>>(`/operations/${id}/audit-log`);
      return res.data.data ?? [];
    },
    enabled: isBM,
    refetchInterval: 20_000,
  });

  // ── Mutations
  const cancelTaskMutation = useMutation({
    mutationFn: async (taskId: string) => { await api.delete(`/tasks/${taskId}`); },
    onSuccess: () => {
      toast.success("Task cancelled");
      qc.invalidateQueries({ queryKey: ["operation-tasks", id] });
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  const transitionMutation = useMutation({
    mutationFn: async ({ to_status, reason, completion_notes }: {
      to_status: OperationStatus; reason?: string; completion_notes?: string;
    }) => {
      const res = await api.post(`/operations/${id}/transition`, {
        to_status,
        reason: reason || `Transitioned to ${to_status.replace(/_/g, " ")}`,
        completion_notes,
      });
      return extractData(res);
    },
    onSuccess: () => {
      toast.success("Operation status updated");
      setTransitionNotes("");
      setShowTransitionConfirm(null);
      qc.invalidateQueries({ queryKey: ["operation", id] });
      qc.invalidateQueries({ queryKey: ["operation-timeline", id] });
      qc.invalidateQueries({ queryKey: ["operations"] });
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  // ── Close Operation — completes with an optional ROB close-out
  // (Expected read off the vessel, Actual BM-entered; kept side by side,
  // never reconciled). Replaces the generic transition dialog specifically
  // for the "Complete Operation" step.
  const [showCloseDialog, setShowCloseDialog] = useState(false);
  const [closeActualRob, setCloseActualRob] = useState("");
  const [closeCompletionNotes, setCloseCompletionNotes] = useState("");
  const [closeReason, setCloseReason] = useState("");
  const resetCloseDialog = () => {
    setShowCloseDialog(false);
    setCloseActualRob(""); setCloseCompletionNotes(""); setCloseReason("");
  };
  const closeOperationMutation = useMutation({
    mutationFn: async () => {
      await api.post(`/operations/${id}/close`, {
        actual_rob_mt: closeActualRob.trim() ? parseFloat(closeActualRob) : undefined,
        completion_notes: closeCompletionNotes.trim() || undefined,
        reason: closeReason.trim(),
      });
    },
    onSuccess: () => {
      toast.success("Operation closed");
      resetCloseDialog();
      qc.invalidateQueries({ queryKey: ["operation", id] });
      qc.invalidateQueries({ queryKey: ["operation-timeline", id] });
      qc.invalidateQueries({ queryKey: ["operation-totals", id] });
      qc.invalidateQueries({ queryKey: ["operations"] });
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  const setColorMutation = useMutation({
    mutationFn: async (color: string | null) => {
      await api.patch(`/operations/${id}/color`, { color });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["operation", id] });
      qc.invalidateQueries({ queryKey: ["operations"] });
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  const [showEditOperation, setShowEditOperation] = useState(false);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [showLinkNc, setShowLinkNc] = useState(false);
  const [linkNcId, setLinkNcId] = useState("");
  const { data: linkableClearances } = useQuery({
    queryKey: ["naval-clearances-linkable"],
    queryFn: async () => {
      const res = await api.get<ApiResponse<NavalClearance[]>>("/naval-clearances");
      return (res.data.data ?? []).filter((nc) => nc.is_valid);
    },
    enabled: showLinkNc,
  });
  const linkNcMutation = useMutation({
    mutationFn: async () => {
      await api.post(`/operations/${id}/link-naval-clearance`, { naval_clearance_id: linkNcId });
    },
    onSuccess: () => {
      toast.success("Naval Clearance linked");
      setShowLinkNc(false);
      setLinkNcId("");
      qc.invalidateQueries({ queryKey: ["operation", id] });
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  // 31 Jul 2026 decision: "Link BFL / Naval Clearance" from More Actions is a
  // friendlier entry point onto the existing NC→drawdown→BFL chain, not a new
  // relationship — create one here and it links to this operation immediately.
  // Takes the new NC's id as a mutate() argument rather than reading it off
  // shared state, since setState+mutate in the same handler would otherwise
  // risk the mutation closing over a stale id.
  const [showCreateNc, setShowCreateNc] = useState(false);
  const createAndLinkNcMutation = useMutation({
    mutationFn: async (navalClearanceId: string) => {
      await api.post(`/operations/${id}/link-naval-clearance`, { naval_clearance_id: navalClearanceId });
    },
    onSuccess: () => {
      toast.success("Naval Clearance created and linked to this operation");
      qc.invalidateQueries({ queryKey: ["operation", id] });
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });
  const [unlinkNcReason, setUnlinkNcReason] = useState("");
  const [showUnlinkNc, setShowUnlinkNc] = useState(false);
  const unlinkNcMutation = useMutation({
    mutationFn: async () => {
      await api.post(`/operations/${id}/unlink-naval-clearance`, { reason: unlinkNcReason.trim() });
    },
    onSuccess: () => {
      toast.success("Naval Clearance unlinked");
      setShowUnlinkNc(false);
      setUnlinkNcReason("");
      qc.invalidateQueries({ queryKey: ["operation", id] });
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  // ── Client notifications — tick-to-send, strictly isolated per recipient ──
  const [showNotifyDialog, setShowNotifyDialog] = useState(false);
  const [tickedRecipients, setTickedRecipients] = useState<Set<string>>(new Set());
  const [notifType, setNotifType] = useState("stage_update");
  const [customMessage, setCustomMessage] = useState("");
  const [etaEditId, setEtaEditId] = useState<string | null>(null);
  const [etaEditValue, setEtaEditValue] = useState("");
  const [etaEditReason, setEtaEditReason] = useState("");

  const { data: notifyRecipients } = useQuery({
    queryKey: ["client-notification-recipients", id],
    queryFn: async () => {
      const res = await api.get<ApiResponse<ClientNotificationRecipient[]>>(`/operations/${id}/client-notifications/recipients`);
      return res.data.data ?? [];
    },
    enabled: showNotifyDialog && isBM,
  });

  const { data: notificationLog } = useQuery({
    queryKey: ["client-notification-log", id],
    queryFn: async () => {
      const res = await api.get<ApiResponse<ClientNotificationLog[]>>(`/operations/${id}/client-notifications/log`);
      return res.data.data ?? [];
    },
    enabled: isBM && !!op?.naval_clearance_id,
  });

  const { data: operationKpi, isLoading: operationKpiLoading, isError: operationKpiErrored, refetch: refetchOperationKpi } = useQuery({
    queryKey: ["operation-kpi", id],
    queryFn: async () => {
      const res = await api.get<ApiResponse<OperationKpi>>(`/operations/${id}/kpi`);
      return res.data.data ?? null;
    },
    enabled: isBM && op?.type !== "truck_only",
  });

  const { data: stageDurations, isLoading: stageDurationsLoading, isError: stageDurationsErrored, refetch: refetchStageDurations } = useQuery({
    queryKey: ["operation-kpi-stage-durations", id],
    queryFn: async () => {
      const res = await api.get<ApiResponse<RoleStageDurations>>(`/operations/${id}/kpi/stage-durations`);
      return res.data.data ?? null;
    },
    enabled: isBM && op?.type !== "truck_only",
  });

  const setEtaMutation = useMutation({
    mutationFn: async (ncvId: string) => {
      await api.post(`/naval-clearance-vessels/${ncvId}/eta`, {
        eta_at: new Date(etaEditValue).toISOString(),
        reason: etaEditReason.trim() || undefined,
      });
    },
    onSuccess: () => {
      toast.success("ETA recorded");
      setEtaEditId(null); setEtaEditValue(""); setEtaEditReason("");
      qc.invalidateQueries({ queryKey: ["client-notification-recipients", id] });
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  const sendNotificationMutation = useMutation({
    mutationFn: async () => {
      await api.post(`/operations/${id}/client-notifications/send`, {
        recipient_naval_clearance_vessel_ids: Array.from(tickedRecipients),
        notification_type: notifType,
        custom_message: customMessage.trim() || undefined,
      });
    },
    onSuccess: () => {
      toast.success(`Notification sent to ${tickedRecipients.size} recipient(s)`);
      setShowNotifyDialog(false);
      setTickedRecipients(new Set());
      setCustomMessage("");
      qc.invalidateQueries({ queryKey: ["client-notification-log", id] });
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  // ── Notify Staff — General stream, wholly separate from client
  // notifications and from the automatic role-scoped notifications.
  const [showNotifyStaffDialog, setShowNotifyStaffDialog] = useState(false);
  const [notifyAllStaff, setNotifyAllStaff] = useState(true);
  const [tickedStaff, setTickedStaff] = useState<Set<string>>(new Set());
  const [staffNotifTitle, setStaffNotifTitle] = useState("");
  const [staffNotifMessage, setStaffNotifMessage] = useState("");

  const { data: eligibleStaff } = useQuery({
    queryKey: ["operation-notification-staff"],
    queryFn: async () => {
      const res = await api.get<ApiResponse<{ id: string; full_name: string; role: string }[]>>("/operation-notifications/staff");
      return res.data.data ?? [];
    },
    enabled: showNotifyStaffDialog && isBM,
  });

  const { data: staffNotificationLog } = useQuery({
    queryKey: ["operation-notification-log", id],
    queryFn: async () => {
      const res = await api.get<ApiResponse<{ id: string; title: string; message: string; sent_at: string; sent_by_name?: string; recipients: { user_name?: string }[] }[]>>(`/operations/${id}/notifications`);
      return res.data.data ?? [];
    },
    enabled: showNotifyStaffDialog && isBM,
  });

  const resetNotifyStaffDialog = () => {
    setShowNotifyStaffDialog(false);
    setNotifyAllStaff(true);
    setTickedStaff(new Set());
    setStaffNotifTitle("");
    setStaffNotifMessage("");
  };

  const sendStaffNotificationMutation = useMutation({
    mutationFn: async () => {
      await api.post(`/operations/${id}/notifications`, {
        all_staff: notifyAllStaff,
        recipient_user_ids: notifyAllStaff ? [] : Array.from(tickedStaff),
        title: staffNotifTitle.trim(),
        message: staffNotifMessage.trim(),
      });
    },
    onSuccess: () => {
      toast.success("Notification sent");
      setStaffNotifTitle(""); setStaffNotifMessage(""); setTickedStaff(new Set());
      qc.invalidateQueries({ queryKey: ["operation-notification-log", id] });
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  const submitCompletionMutation = useMutation({
    mutationFn: async () => {
      const res = await api.post(`/operations/${id}/transition`, {
        to_status: "pending_completion",
        reason: completionReport.trim() || "Completion report submitted",
        completion_notes: completionReport.trim() || undefined,
      });
      return extractData(res);
    },
    onSuccess: () => {
      toast.success("Completion report submitted — awaiting BM review");
      setCompletionReport("");
      qc.invalidateQueries({ queryKey: ["operation", id] });
      qc.invalidateQueries({ queryKey: ["operation-timeline", id] });
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  const approveFeedbackMutation = useMutation({
    mutationFn: async ({ feedbackId, comment }: { feedbackId: string; comment?: string }) => {
      const res = await api.post(
        `/operations/${id}/feedback/${feedbackId}/approve`,
        comment ? { notes: comment } : {}
      );
      return res.data;
    },
    onSuccess: () => {
      toast.success("Feedback approved — operation is now active");
      setApprovingFeedbackId(null);
      setApproveComment("");
      refetchFeedbacks();
      qc.invalidateQueries({ queryKey: ["operation", id] });
      qc.invalidateQueries({ queryKey: ["operation-timeline", id] });
      // Approving a round changes which trucks are addable.
      qc.invalidateQueries({ queryKey: ["operation-trucks", id] });
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  const rejectFeedbackMutation = useMutation({
    mutationFn: async ({ feedbackId, reason }: { feedbackId: string; reason: string }) => {
      const res = await api.post(`/operations/${id}/feedback/${feedbackId}/reject`, { reason });
      return res.data;
    },
    onSuccess: () => {
      toast.success("Feedback rejected");
      setRejectFeedbackId(null);
      setRejectReason("");
      refetchFeedbacks();
      qc.invalidateQueries({ queryKey: ["operation", id] });
      qc.invalidateQueries({ queryKey: ["operation-timeline", id] });
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  const submitFeedbackMutation = useMutation({
    mutationFn: async () => {
      const truck_details: Record<string, unknown> = {};
      if (loNotes.trim()) truck_details.notes = loNotes.trim();
      if (Object.keys(loTruckDetails).length) truck_details.driverInfo = loTruckDetails;
      const res = await api.post(`/operations/${id}/feedback`, {
        truck_ids:        loSelectedTrucks,
        readiness_summary: loSummary.trim(),
        truck_details,
      });
      return res.data;
    },
    onSuccess: () => {
      toast.success("Feedback submitted");
      setLoSelectedTrucks([]);
      setLoSummary("");
      setLoNotes("");
      setLoTruckDetails({});
      refetchFeedbacks();
      qc.invalidateQueries({ queryKey: ["operation", id] });
      qc.invalidateQueries({ queryKey: ["operation-timeline", id] });
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  // ── BDN state & mutations
  const [showBdnForm,     setShowBdnForm]     = useState(false);
  const [bdnVesselId,     setBdnVesselId]     = useState("");
  const [bdnQty,          setBdnQty]          = useState("");
  const [bdnGov,          setBdnGov]          = useState("");
  const [bdnGsv,          setBdnGsv]          = useState("");
  const [bdnDeliveryDate, setBdnDeliveryDate] = useState("");
  const [bdnDensity,      setBdnDensity]      = useState("");
  const [bdnTemp,         setBdnTemp]         = useState("");
  const [bdnNotes,        setBdnNotes]        = useState("");
  const [rejectBdnId,     setRejectBdnId]     = useState<string | null>(null);
  const [rejectBdnReason, setRejectBdnReason] = useState("");

  const closeBdnForm = () => {
    setShowBdnForm(false);
    setBdnVesselId(""); setBdnQty(""); setBdnGov(""); setBdnGsv(""); setBdnDeliveryDate("");
    setBdnDensity(""); setBdnTemp(""); setBdnNotes("");
  };

  const createBdnMutation = useMutation({
    mutationFn: async () => {
      await api.post(`/operations/${id}/bdns`, {
        vessel_id:             bdnVesselId,
        quantity_delivered_mt: parseFloat(bdnQty),
        discharge_gov:         parseFloat(bdnGov),
        discharge_gsv:         parseFloat(bdnGsv),
        delivery_date:         bdnDeliveryDate ? new Date(bdnDeliveryDate).toISOString() : new Date().toISOString(),
        product_type:          op?.product_type || undefined,
        density:               bdnDensity ? parseFloat(bdnDensity) : undefined,
        temperature:           bdnTemp    ? parseFloat(bdnTemp)    : undefined,
        notes:                 bdnNotes.trim() || undefined,
      });
    },
    onSuccess: () => {
      toast.success("BDN created — awaiting Bunker Manager approval");
      closeBdnForm();
      qc.invalidateQueries({ queryKey: ["operation-bdns", id] });
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  const approveBdnMutation = useMutation({
    mutationFn: async (bdnId: string) => {
      await api.post(`/bdns/${bdnId}/approve`, {});
    },
    onSuccess: () => {
      toast.success("BDN approved");
      qc.invalidateQueries({ queryKey: ["operation-bdns", id] });
      qc.invalidateQueries({ queryKey: ["operation", id] });
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  const rejectBdnMutation = useMutation({
    mutationFn: async ({ bdnId, reason }: { bdnId: string; reason: string }) => {
      await api.post(`/bdns/${bdnId}/reject`, { reason });
    },
    onSuccess: () => {
      toast.success("BDN rejected");
      setRejectBdnId(null);
      setRejectBdnReason("");
      qc.invalidateQueries({ queryKey: ["operation-bdns", id] });
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  // ── Truck BDN state & mutations — every field is manually entered and
  // required; nothing is prefilled. The backend independently computes its
  // own snapshot for comparison, but never feeds it into this form.
  const TRUCK_BDN_REQUIRED_FIELDS = [
    "company_name", "product_type", "discharge_location",
    "quantity_loaded_mt", "quantity_discharged_mt",
    "receiving_vessel",
    "density", "temperature",
    "vcf", "gov",
    "discharge_commenced_at", "discharge_completed_at", "discharge_completion_date",
  ] as const;

  const [showTruckBdnForm,     setShowTruckBdnForm]     = useState(false);
  const [truckBdnForm,         setTruckBdnForm]         = useState<Record<string, string>>({});

  // GSV = GOV x VCF, MTvac = GSV x density — the same two identities the API
  // applies on submit. Shown live so the submitter sees what will be stored;
  // the server recomputes them regardless, so this is display only.
  const truckBdnComputed = (() => {
    const gov = parseFloat(truckBdnForm.gov ?? "");
    const vcf = parseFloat(truckBdnForm.vcf ?? "");
    const density = parseFloat(truckBdnForm.density ?? "");
    const gsv = Number.isFinite(gov) && Number.isFinite(vcf) ? gov * vcf : null;
    const mtVacuum = gsv !== null && Number.isFinite(density) ? gsv * density : null;
    return {
      gsv: gsv === null ? null : gsv.toLocaleString(undefined, { maximumFractionDigits: 2 }),
      mtVacuum: mtVacuum === null ? null : mtVacuum.toLocaleString(undefined, { maximumFractionDigits: 3 }),
    };
  })();
  const [rejectTruckBdnId,     setRejectTruckBdnId]     = useState<string | null>(null);
  const [rejectTruckBdnReason, setRejectTruckBdnReason] = useState("");
  const [editTruckBdnId,       setEditTruckBdnId]       = useState<string | null>(null);
  const [editTruckBdnForm,     setEditTruckBdnForm]     = useState<Record<string, string>>({});
  const [editTruckBdnReason,   setEditTruckBdnReason]   = useState("");

  const truckBdnFormComplete = TRUCK_BDN_REQUIRED_FIELDS.every((k) => (truckBdnForm[k] ?? "").trim() !== "");

  const closeTruckBdnForm = () => {
    setShowTruckBdnForm(false);
    setTruckBdnForm({});
  };

  const createTruckBdnMutation = useMutation({
    mutationFn: async () => {
      await api.post(`/operations/${id}/truck-bdns`, {
        company_name:               truckBdnForm.company_name?.trim(),
        product_type:               truckBdnForm.product_type?.trim(),
        discharge_location:         truckBdnForm.discharge_location?.trim(),
        quantity_loaded_mt:         parseFloat(truckBdnForm.quantity_loaded_mt),
        quantity_discharged_mt:     parseFloat(truckBdnForm.quantity_discharged_mt),
        receiving_vessel:           truckBdnForm.receiving_vessel?.trim(),
        density:                    parseFloat(truckBdnForm.density),
        temperature:                parseFloat(truckBdnForm.temperature),
        vcf:                        parseFloat(truckBdnForm.vcf),
        gov:                        parseFloat(truckBdnForm.gov),
        // gsv and mt_vacuum are deliberately not sent — the API derives both
        // from gov/vcf/density so a mistyped figure can't reach a client document.
        discharge_commenced_at:     new Date(truckBdnForm.discharge_commenced_at).toISOString(),
        discharge_completed_at:     new Date(truckBdnForm.discharge_completed_at).toISOString(),
        discharge_completion_date:  truckBdnForm.discharge_completion_date,
        notes:                      truckBdnForm.notes?.trim() || undefined,
      });
    },
    onSuccess: () => {
      toast.success("Truck BDN submitted — awaiting Bunker Manager approval");
      closeTruckBdnForm();
      qc.invalidateQueries({ queryKey: ["operation-truck-bdns", id] });
      qc.invalidateQueries({ queryKey: ["operation", id] });
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  const approveTruckBdnMutation = useMutation({
    mutationFn: async (truckBdnId: string) => {
      await api.post(`/truck-bdns/${truckBdnId}/approve`, {});
    },
    onSuccess: () => {
      toast.success("Truck BDN approved");
      qc.invalidateQueries({ queryKey: ["operation-truck-bdns", id] });
      qc.invalidateQueries({ queryKey: ["operation", id] });
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  const rejectTruckBdnMutation = useMutation({
    mutationFn: async ({ truckBdnId, reason }: { truckBdnId: string; reason: string }) => {
      await api.post(`/truck-bdns/${truckBdnId}/reject`, { reason });
    },
    onSuccess: () => {
      toast.success("Truck BDN rejected");
      setRejectTruckBdnId(null);
      setRejectTruckBdnReason("");
      qc.invalidateQueries({ queryKey: ["operation-truck-bdns", id] });
      qc.invalidateQueries({ queryKey: ["operation", id] });
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  const openEditTruckBdn = (tb: TruckBdn) => {
    setEditTruckBdnId(tb.id);
    setEditTruckBdnForm({
      company_name:               tb.company_name,
      product_type:               tb.product_type,
      discharge_location:         tb.discharge_location,
      quantity_loaded_mt:         tb.quantity_loaded_mt,
      quantity_discharged_mt:     tb.quantity_discharged_mt,
      density:                    tb.density,
      temperature:                tb.temperature,
      vcf:                        tb.vcf,
      gov:                        tb.gov,
      gsv:                        tb.gsv,
      mt_vacuum:                  tb.mt_vacuum,
      discharge_commenced_at:     tb.discharge_commenced_at ? tb.discharge_commenced_at.slice(0, 16) : "",
      discharge_completed_at:     tb.discharge_completed_at ? tb.discharge_completed_at.slice(0, 16) : "",
      discharge_completion_date:  tb.discharge_completion_date ?? "",
      notes:                      tb.notes ?? "",
    });
    setEditTruckBdnReason("");
  };

  const editTruckBdnMutation = useMutation({
    mutationFn: async () => {
      if (!editTruckBdnId) return;
      await api.put(`/truck-bdns/${editTruckBdnId}`, {
        company_name:               editTruckBdnForm.company_name || undefined,
        product_type:               editTruckBdnForm.product_type || undefined,
        discharge_location:         editTruckBdnForm.discharge_location || undefined,
        quantity_loaded_mt:         editTruckBdnForm.quantity_loaded_mt ? parseFloat(editTruckBdnForm.quantity_loaded_mt) : undefined,
        quantity_discharged_mt:     editTruckBdnForm.quantity_discharged_mt ? parseFloat(editTruckBdnForm.quantity_discharged_mt) : undefined,
        density:                    editTruckBdnForm.density ? parseFloat(editTruckBdnForm.density) : undefined,
        temperature:                editTruckBdnForm.temperature ? parseFloat(editTruckBdnForm.temperature) : undefined,
        vcf:                        editTruckBdnForm.vcf ? parseFloat(editTruckBdnForm.vcf) : undefined,
        gov:                        editTruckBdnForm.gov ? parseFloat(editTruckBdnForm.gov) : undefined,
        gsv:                        editTruckBdnForm.gsv ? parseFloat(editTruckBdnForm.gsv) : undefined,
        mt_vacuum:                  editTruckBdnForm.mt_vacuum ? parseFloat(editTruckBdnForm.mt_vacuum) : undefined,
        discharge_commenced_at:     editTruckBdnForm.discharge_commenced_at ? new Date(editTruckBdnForm.discharge_commenced_at).toISOString() : undefined,
        discharge_completed_at:     editTruckBdnForm.discharge_completed_at ? new Date(editTruckBdnForm.discharge_completed_at).toISOString() : undefined,
        discharge_completion_date:  editTruckBdnForm.discharge_completion_date || undefined,
        notes:                      editTruckBdnForm.notes || undefined,
        reason:                     editTruckBdnReason.trim(),
      });
    },
    onSuccess: () => {
      toast.success("Truck BDN updated");
      setEditTruckBdnId(null);
      qc.invalidateQueries({ queryKey: ["operation-truck-bdns", id] });
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  // ── Vessel BDN — one per vessel run, same manual/required/system-compare
  // pattern as Truck BDN, plus an "N of M vessel runs approved" progress
  // strip since completion depends on every run's BDN being approved.
  const VESSEL_BDN_REQUIRED_FIELDS = [
    "company_name", "product_type", "discharge_location", "receiving_vessel",
    "quantity_loaded_litres", "quantity_discharged_litres",
    "density", "temperature",
    "vcf", "discharge_gov", "discharge_gsv", "discharge_mt_vacuum",
    "discharge_completed_at", "discharge_completion_date",
  ] as const;

  const [vesselBdnFormActivityId, setVesselBdnFormActivityId] = useState<string | null>(null);
  // When op.type === "vessel_only", vesselBdnFormActivityId actually holds a
  // receiving-vessel LEG id (one BDN per leg), and this flag picks the
  // /vessel-activity-legs/{id}/bdn endpoint instead of /vessel-activities/{id}/bdn.
  const [vesselBdnFormIsLeg,      setVesselBdnFormIsLeg]      = useState(false);
  const [vesselBdnForm,           setVesselBdnForm]           = useState<Record<string, string>>({});
  const [rejectVesselBdnId,       setRejectVesselBdnId]       = useState<string | null>(null);
  const [rejectVesselBdnReason,   setRejectVesselBdnReason]   = useState("");
  const [editVesselBdnId,         setEditVesselBdnId]         = useState<string | null>(null);
  const [editVesselBdnForm,       setEditVesselBdnForm]       = useState<Record<string, string>>({});
  const [editVesselBdnReason,     setEditVesselBdnReason]     = useState("");

  // Mirrors the backend's positive_values validator — these fields must
  // parse to a number greater than zero, not just be a non-empty string.
  const VESSEL_BDN_POSITIVE_FIELDS = [
    "quantity_loaded_litres", "quantity_discharged_litres", "density",
    "vcf", "discharge_gov", "discharge_gsv", "discharge_mt_vacuum",
  ] as const;
  // Received-side readings are optional — if given, still must be positive.
  const VESSEL_BDN_OPTIONAL_POSITIVE_FIELDS = ["received_gov", "received_gsv", "received_mt_vacuum"] as const;

  // Full Operation only — replaces the retired Start/Receipt/Bunkering/
  // Discharge/Complete flow's ROB recording. Not required for vessel_only.
  const vesselBdnFormComplete =
    VESSEL_BDN_REQUIRED_FIELDS.every((k) => (vesselBdnForm[k] ?? "").trim() !== "") &&
    VESSEL_BDN_POSITIVE_FIELDS.every((k) => {
      const n = parseFloat(vesselBdnForm[k] ?? "");
      return Number.isFinite(n) && n > 0;
    }) &&
    VESSEL_BDN_OPTIONAL_POSITIVE_FIELDS.every((k) => {
      const raw = (vesselBdnForm[k] ?? "").trim();
      if (raw === "") return true;
      const n = parseFloat(raw);
      return Number.isFinite(n) && n > 0;
    }) &&
    (op?.type !== "full_operation" || (() => {
      const n = parseFloat(vesselBdnForm.vessel_received_total_mt ?? "");
      return Number.isFinite(n) && n > 0;
    })());

  const createVesselBdnMutation = useMutation({
    mutationFn: async () => {
      if (!vesselBdnFormActivityId) return;
      const endpoint = vesselBdnFormIsLeg
        ? `/vessel-activity-legs/${vesselBdnFormActivityId}/bdn`
        : `/vessel-activities/${vesselBdnFormActivityId}/bdn`;
      await api.post(endpoint, {
        company_name:               vesselBdnForm.company_name?.trim(),
        product_type:               vesselBdnForm.product_type?.trim(),
        discharge_location:         vesselBdnForm.discharge_location?.trim(),
        receiving_vessel:           vesselBdnForm.receiving_vessel?.trim(),
        quantity_loaded_litres:     parseFloat(vesselBdnForm.quantity_loaded_litres),
        quantity_discharged_litres: parseFloat(vesselBdnForm.quantity_discharged_litres),
        density:                    parseFloat(vesselBdnForm.density),
        temperature:                parseFloat(vesselBdnForm.temperature),
        vcf:                        parseFloat(vesselBdnForm.vcf),
        discharge_gov:              parseFloat(vesselBdnForm.discharge_gov),
        discharge_gsv:              parseFloat(vesselBdnForm.discharge_gsv),
        discharge_mt_vacuum:        parseFloat(vesselBdnForm.discharge_mt_vacuum),
        discharge_completed_at:     new Date(vesselBdnForm.discharge_completed_at).toISOString(),
        discharge_completion_date:  vesselBdnForm.discharge_completion_date,
        received_gov:               vesselBdnForm.received_gov?.trim() ? parseFloat(vesselBdnForm.received_gov) : undefined,
        received_gsv:               vesselBdnForm.received_gsv?.trim() ? parseFloat(vesselBdnForm.received_gsv) : undefined,
        received_mt_vacuum:         vesselBdnForm.received_mt_vacuum?.trim() ? parseFloat(vesselBdnForm.received_mt_vacuum) : undefined,
        vessel_received_total_mt:   vesselBdnForm.vessel_received_total_mt?.trim() ? parseFloat(vesselBdnForm.vessel_received_total_mt) : undefined,
        notes:                      vesselBdnForm.notes?.trim() || undefined,
      });
    },
    onSuccess: () => {
      toast.success("Vessel BDN submitted — awaiting Bunker Manager approval");
      setVesselBdnFormActivityId(null);
      setVesselBdnFormIsLeg(false);
      setVesselBdnForm({});
      qc.invalidateQueries({ queryKey: ["operation-vessel-bdns", id] });
      qc.invalidateQueries({ queryKey: ["operation", id] });
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  const approveVesselBdnMutation = useMutation({
    mutationFn: async (bdnId: string) => {
      const res = await api.post(`/vessel-bdns/${bdnId}/approve`, {});
      return extractData<{ total_vessel_runs: number; approved_vessel_runs: number; operation_completed_gate_cleared: boolean }>(res);
    },
    onSuccess: (data) => {
      toast.success(
        data.operation_completed_gate_cleared
          ? `Vessel BDN approved — all ${data.total_vessel_runs} vessel run(s) now approved`
          : `Vessel BDN approved — ${data.approved_vessel_runs} of ${data.total_vessel_runs} vessel run(s) approved so far`
      );
      qc.invalidateQueries({ queryKey: ["operation-vessel-bdns", id] });
      qc.invalidateQueries({ queryKey: ["operation", id] });
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  const rejectVesselBdnMutation = useMutation({
    mutationFn: async ({ bdnId, reason }: { bdnId: string; reason: string }) => {
      await api.post(`/vessel-bdns/${bdnId}/reject`, { reason });
    },
    onSuccess: () => {
      toast.success("Vessel BDN rejected");
      setRejectVesselBdnId(null);
      setRejectVesselBdnReason("");
      qc.invalidateQueries({ queryKey: ["operation-vessel-bdns", id] });
      qc.invalidateQueries({ queryKey: ["operation", id] });
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  const openEditVesselBdn = (vb: VesselBdn) => {
    setEditVesselBdnId(vb.id);
    setEditVesselBdnForm({
      company_name:               vb.company_name,
      product_type:               vb.product_type,
      discharge_location:         vb.discharge_location,
      receiving_vessel:           vb.receiving_vessel,
      quantity_loaded_litres:     vb.quantity_loaded_litres,
      quantity_discharged_litres: vb.quantity_discharged_litres,
      density:                    vb.density,
      temperature:                vb.temperature,
      vcf:                        vb.vcf,
      discharge_gov:              vb.discharge_gov,
      discharge_gsv:              vb.discharge_gsv,
      discharge_mt_vacuum:        vb.discharge_mt_vacuum,
      discharge_completed_at:     vb.discharge_completed_at ? vb.discharge_completed_at.slice(0, 16) : "",
      discharge_completion_date:  vb.discharge_completion_date ?? "",
      received_gov:               vb.received_gov ?? "",
      received_gsv:               vb.received_gsv ?? "",
      received_mt_vacuum:         vb.received_mt_vacuum ?? "",
      vessel_received_total_mt:   vb.vessel_received_total_mt ?? "",
      // Display-only — computed server-side, never sent back in the update payload.
      truck_discharged_total_mt: vb.truck_discharged_total_mt ?? "",
      truck_variance_mt:         vb.truck_variance_mt ?? "",
      notes:                      vb.notes ?? "",
    });
    setEditVesselBdnReason("");
  };

  const editVesselBdnMutation = useMutation({
    mutationFn: async () => {
      if (!editVesselBdnId) return;
      await api.put(`/vessel-bdns/${editVesselBdnId}`, {
        company_name:               editVesselBdnForm.company_name || undefined,
        product_type:               editVesselBdnForm.product_type || undefined,
        discharge_location:         editVesselBdnForm.discharge_location || undefined,
        receiving_vessel:           editVesselBdnForm.receiving_vessel || undefined,
        quantity_loaded_litres:     editVesselBdnForm.quantity_loaded_litres ? parseFloat(editVesselBdnForm.quantity_loaded_litres) : undefined,
        quantity_discharged_litres: editVesselBdnForm.quantity_discharged_litres ? parseFloat(editVesselBdnForm.quantity_discharged_litres) : undefined,
        density:                    editVesselBdnForm.density ? parseFloat(editVesselBdnForm.density) : undefined,
        temperature:                editVesselBdnForm.temperature ? parseFloat(editVesselBdnForm.temperature) : undefined,
        vcf:                        editVesselBdnForm.vcf ? parseFloat(editVesselBdnForm.vcf) : undefined,
        discharge_gov:              editVesselBdnForm.discharge_gov ? parseFloat(editVesselBdnForm.discharge_gov) : undefined,
        discharge_gsv:              editVesselBdnForm.discharge_gsv ? parseFloat(editVesselBdnForm.discharge_gsv) : undefined,
        discharge_mt_vacuum:        editVesselBdnForm.discharge_mt_vacuum ? parseFloat(editVesselBdnForm.discharge_mt_vacuum) : undefined,
        discharge_completed_at:     editVesselBdnForm.discharge_completed_at ? new Date(editVesselBdnForm.discharge_completed_at).toISOString() : undefined,
        discharge_completion_date:  editVesselBdnForm.discharge_completion_date || undefined,
        received_gov:               editVesselBdnForm.received_gov ? parseFloat(editVesselBdnForm.received_gov) : undefined,
        received_gsv:               editVesselBdnForm.received_gsv ? parseFloat(editVesselBdnForm.received_gsv) : undefined,
        received_mt_vacuum:         editVesselBdnForm.received_mt_vacuum ? parseFloat(editVesselBdnForm.received_mt_vacuum) : undefined,
        vessel_received_total_mt:   editVesselBdnForm.vessel_received_total_mt ? parseFloat(editVesselBdnForm.vessel_received_total_mt) : undefined,
        notes:                      editVesselBdnForm.notes || undefined,
        reason:                     editVesselBdnReason.trim(),
      });
    },
    onSuccess: () => {
      toast.success("Vessel BDN updated");
      setEditVesselBdnId(null);
      qc.invalidateQueries({ queryKey: ["operation-vessel-bdns", id] });
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  // ── Document upload (BM)
  const [showDocUploadForm, setShowDocUploadForm] = useState(false);
  const [opDocFile,         setOpDocFile]         = useState<File | null>(null);
  const [opDocType,         setOpDocType]         = useState("other");
  const [opDocDesc,         setOpDocDesc]         = useState("");

  const uploadDocMutation = useMutation({
    mutationFn: async () => {
      if (!opDocFile) throw new Error("No file selected");
      const form = new FormData();
      form.append("file", opDocFile);
      form.append("document_type", opDocType);
      if (opDocDesc.trim()) form.append("description", opDocDesc.trim());
      await api.post(`/operations/${id}/documents/upload`, form, {
        headers: { "Content-Type": "multipart/form-data" },
      });
    },
    onSuccess: () => {
      toast.success("Document uploaded");
      setShowDocUploadForm(false);
      setOpDocFile(null); setOpDocType("other"); setOpDocDesc("");
      qc.invalidateQueries({ queryKey: ["operation-docs", id] });
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  // ── Vessel Activity mutations
  const assignActivityMutation = useMutation({
    mutationFn: async () => {
      await api.post(`/operations/${id}/vessel-activities`, {
        vessel_id:   actVesselId,
        assigned_to: actAssignedTo,
        notes:       actNotes.trim() || undefined,
      });
    },
    onSuccess: () => {
      toast.success("Marine Supervisor assigned");
      setShowAssignActivityForm(false);
      setActVesselId(""); setActAssignedTo(""); setActNotes("");
      refetchVesselActivities();
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  const cancelActivityMutation = useMutation({
    mutationFn: async (activityId: string) => {
      await api.post(`/vessel-activities/${activityId}/cancel`, {});
    },
    onSuccess: () => { toast.success("Activity cancelled"); refetchVesselActivities(); },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  const patchInitialRobMutation = useMutation({
    mutationFn: async ({ activityId, value }: { activityId: string; value: string }) => {
      await api.patch(`/vessel-activities/${activityId}/initial-rob`, {
        initial_rob_mt: parseFloat(value),
      });
    },
    onSuccess: () => {
      toast.success("Initial ROB updated and logged");
      setEditingRobActivityId(null);
      setEditRobValue("");
      refetchVesselActivities();
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  // ── Per-vessel stage flow (cast off -> discharge completed) — independent
  // of the ROB session status above.
  const VESSEL_STAGES: { value: string; label: string }[] = [
    { value: "cast_off", label: "Cast Off" },
    { value: "approach", label: "Approach" },
    { value: "alongside", label: "Alongside" },
    { value: "hse_check", label: "Pre HSE Check" },
    { value: "commence_discharge", label: "Commence Discharge" },
    { value: "discharge_completed", label: "Discharge Completed" },
  ];
  const [stageFormActivityId, setStageFormActivityId] = useState<string | null>(null);
  const [stageOccurredAt, setStageOccurredAt] = useState("");
  const [stageComment, setStageComment] = useState("");

  const advanceStageMutation = useMutation({
    mutationFn: async ({ activityId, stage }: { activityId: string; stage: string }) => {
      await api.post(`/vessel-activities/${activityId}/advance-stage`, {
        stage, occurred_at: new Date(stageOccurredAt).toISOString(), comment: stageComment.trim() || undefined,
      });
    },
    onSuccess: () => {
      toast.success("Stage recorded");
      setStageFormActivityId(null); setStageOccurredAt(""); setStageComment("");
      refetchVesselActivities();
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  // ── HSE checklists — the client's own forms, verbatim.
  //
  // Two different operations, two different forms. LOADING on a TTS
  // operation is trucks discharging into the barge, so it uses the
  // transshipment form. Each DELIVERY leg is a ship-to-ship transfer with no
  // trucks involved at all, so it uses the vessel-to-vessel form.
  //
  // Sections are stored on each item, not just rendered, so a signed-off
  // checklist still reads the way it was signed even if a template changes.
  const LOADING_HSE_TEMPLATE: { section: string; item: string }[] = [
    ...[
      "Confirm vessel arrival time and storage capacity",
      "Confirm barge size is minimum of 15 metres breadth and securely placed",
      "Confirm depth of the jetty",
      "Verify truck scheduling and coordination",
      "Obtain necessary port, safety permits and Navy Clearance",
      "Conduct equipment inspections (hoses, pumps, connections)",
      "Inspect trucks for product type, quantity, and seal integrity",
      "Review weather conditions for safe operation",
      "Ensure availability of spill response kits and fire suppression equipment",
      "Conduct safety briefing for all personnel",
      "Verify PPE availability (fire-resistant clothing, gloves, boots, helmets)",
      "Confirm vessel readiness and jetty clearance",
    ].map((item) => ({ section: "A. Pre-Operation", item })),
    ...[
      "Ensure trucks are positioned in the correct designated area",
      "Ullage truck compartments",
      "Inspect trucks for any visible damage or leaks",
      "Confirm truck waybill",
      "Record product type and quantity",
      "Securely connect hoses and pipelines between trucks and vessel",
      "Securely connect flow meter between trucks and vessel",
      "Pump 250/300 litres into drum to confirm flow meter accuracy",
      "Is flow meter reading accurate?",
      "Assign pump operators for product flow management",
      "Begin product transfer at a controlled rate",
      "Monitor flow meters and tank levels",
      "Maintain communication between Jetty Supervisor, vessel crew, and truck drivers",
      "Address any leaks or spills immediately",
    ].map((item) => ({ section: "B. Transshipment Operation", item })),
    ...[
      "Continuous safety checks by Safety Officer",
      "Monitor for leaks, spills, or equipment malfunctions",
      "Adjust product flow rate as needed",
      "Ensure environmental protection protocols are followed",
      "Document any issues or incidents during the transfer process",
    ].map((item) => ({ section: "C. Monitoring", item })),
    ...[
      "Safely disconnect hoses and pipelines",
      "Confirm truck empty tanks are carried out and empty",
      "Confirm truck have no hidden tanks (Aso Rock)",
      "Seal truck valves and drain any remaining product",
      "Conduct final inspection for spills or leaks",
      "Complete all necessary documentation (bills of lading, transfer logs)",
      "Ensure all parties sign required documents",
      "Submit reports to port authorities and internal stakeholders",
      "Detain/release truck with loss or average",
      "Conduct a post-operation debrief with the team",
      "Clean and store equipment appropriately",
    ].map((item) => ({ section: "D. Post-Operation", item })),
  ];

  const LEG_HSE_TEMPLATE: { section: string; item: string }[] = [
    ...[
      "Confirm vessel details, ETA, and berth allocations",
      "Secure all necessary permits and approvals",
      "Complete a risk assessment and review weather/sea conditions",
      "Inspect hoses, fenders, mooring lines, and transfer equipment",
      "Verify spill kits and fire extinguishing systems are in place and operational",
      "Conduct vessel-to-vessel radio checks",
      "Review and verify product type, quantity, and quality",
      "Ensure all personnel are equipped with PPE (fire-resistant, boots, helmets)",
      "Conduct a safety briefing with all crew members",
      "Deploy fenders and securely moor vessels",
    ].map((item) => ({ section: "A. Pre-Operation", item })),
    ...[
      "Connect hoses securely between vessels",
      "Connect flow metre between vessels",
      "Check all hose connections and ensure the system is grounded",
      "Transfer 30m3 to the receiving vessel and compare figures",
      "Begin product transfer at a low rate",
      "Monitor flow meters, pressure gauges, and system integrity",
      "Gradually increase the flow rate and monitor for leaks or issues",
      "Ensure Pump Operators are continuously monitoring the transfer",
      "Maintain clear communication between both vessels",
      "Regularly check fenders and mooring line tensions",
    ].map((item) => ({ section: "B. Transfer Operation", item })),
    ...[
      "Continuously monitor for leaks, spills, or hazards",
      "Ensure emergency shutdown systems are ready and operational",
      "Check vessel stability and mooring tensions periodically",
      "Maintain communication and record any issues or clothing irregularities",
    ].map((item) => ({ section: "C. Mid-Operation Safety", item })),
    ...[
      "Reduce flow rate as transfer nears completion",
      "Safely disconnect hoses and drain any residual product",
      "Cap and seal all hose connections",
      "Conduct a final inspection for leaks, spills, or damage",
      "Dispose of waste materials and clean up the area",
      "Complete all transfer logs and compliance documentation",
      "Ensure signatures from relevant personnel",
      "Release mooring lines and retrieve fenders",
      "Ensure safe vessel departure following port authority regulations",
    ].map((item) => ({ section: "D. Post-Operation", item })),
  ];


  /** Renders a checklist grouped by its A/B/C/D sections, each line a tick
   *  plus an optional note — some lines record a figure ("Transfer 30m3 and
   *  compare figures") rather than a plain yes/no. */
  const renderHseChecklist = (
    rows: { section: string; item: string; passed: boolean; notes: string }[],
    setRows: Dispatch<SetStateAction<{ section: string; item: string; passed: boolean; notes: string }[]>>,
  ) => {
    let lastSection = "";
    return (
      <div className="max-h-80 overflow-y-auto pr-1 space-y-1">
        {rows.map((row, i) => {
          const header = row.section && row.section !== lastSection ? row.section : null;
          lastSection = row.section || lastSection;
          return (
            <div key={i}>
              {header && (
                <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground mt-2 mb-1">{header}</p>
              )}
              <div className="flex items-start gap-2">
                <input
                  type="checkbox"
                  className="mt-0.5 shrink-0"
                  checked={row.passed}
                  onChange={(e) => setRows((prev) => prev.map((r, idx) => idx === i ? { ...r, passed: e.target.checked } : r))}
                />
                <div className="flex-1 min-w-0">
                  <p className="text-xs leading-snug">{row.item}</p>
                  <Input
                    className="h-6 text-[11px] mt-0.5"
                    placeholder="Note / figure (optional)…"
                    value={row.notes}
                    onChange={(e) => setRows((prev) => prev.map((r, idx) => idx === i ? { ...r, notes: e.target.value } : r))}
                  />
                </div>
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  const blankChecklist = (template: { section: string; item: string }[]) =>
    template.map((t) => ({ section: t.section, item: t.item, passed: false, notes: "" }));

  const DEFAULT_HSE_CHECKLIST = blankChecklist(LOADING_HSE_TEMPLATE);
  const DEFAULT_LEG_HSE_CHECKLIST = blankChecklist(LEG_HSE_TEMPLATE);

  /** The three HSE checks per vessel run, each tied to the stage it is done at
   *  (docs/HSE-CHECKLISTS.md — the BM's own forms).
   *
   *  The items are SLICED OUT OF LEG_HSE_TEMPLATE rather than retyped: the
   *  BM's three lists map exactly onto its existing sections — A is the ten
   *  Pre-Operation items, B+C are the fourteen During items, D is the nine
   *  Post items. Deriving them means the two can never drift apart, and the
   *  wording stays the compliance-form wording it was signed off as.
   *
   *  `resultField`/`checklistField`/`notesField`/`officerField` name the
   *  columns each phase reads back from; "pre" uses the original unprefixed
   *  set, which is why existing recorded checklists still display after the
   *  split. The "during" label borrows the BM's own section header ("B.
   *  Transfer Operation") rather than a coined term like "During Operation",
   *  so the name on screen matches the name on the signed form. */
  const HSE_PHASES = [
    {
      phase: "pre" as const,
      label: "Pre-Operation",
      atStage: "hse_check",
      sections: ["A. Pre-Operation"],
      resultField: "hse_result" as const,
      checklistField: "hse_checklist" as const,
      notesField: "hse_notes" as const,
      officerField: "hse_safety_officer" as const,
    },
    {
      phase: "during" as const,
      label: "Transfer Operation",
      atStage: "commence_discharge",
      sections: ["B. Transfer Operation", "C. Mid-Operation Safety"],
      resultField: "hse_during_result" as const,
      checklistField: "hse_during_checklist" as const,
      notesField: "hse_during_notes" as const,
      officerField: "hse_during_safety_officer" as const,
    },
    {
      phase: "post" as const,
      label: "Post-Operation",
      atStage: "discharge_completed",
      sections: ["D. Post-Operation"],
      resultField: "hse_post_result" as const,
      checklistField: "hse_post_checklist" as const,
      notesField: "hse_post_notes" as const,
      officerField: "hse_post_safety_officer" as const,
    },
  ];

  const hsePhaseChecklist = (phase: (typeof HSE_PHASES)[number]) =>
    blankChecklist(LEG_HSE_TEMPLATE.filter((t) => phase.sections.includes(t.section)));

  /* ── Cast Off client block — who the run is for, and who hears about it.
     Nothing is sent from here: these addresses only receive mail once the BM
     has approved it and then explicitly pressed Send. ── */
  const [castOffFormActivityId, setCastOffFormActivityId] = useState<string | null>(null);
  const [castOffClient, setCastOffClient] = useState("");
  const [castOffVessel, setCastOffVessel] = useState("");
  const [castOffEmails, setCastOffEmails] = useState<string[]>([""]);

  const openCastOffForm = (activity: VesselActivity) => {
    setCastOffFormActivityId(activity.id);
    setCastOffClient(activity.cast_off_client_name ?? "");
    // Prefilled from the vessel already on the run — the BM can overwrite it
    // when the client's vessel is not the one recorded here.
    setCastOffVessel(activity.cast_off_client_vessel_name ?? activity.vessel_name ?? "");
    // Always leave one empty row so there is somewhere to type.
    setCastOffEmails(activity.cast_off_client_emails?.length ? [...activity.cast_off_client_emails] : [""]);
  };
  const closeCastOffForm = () => {
    setCastOffFormActivityId(null);
    setCastOffClient("");
    setCastOffVessel("");
    setCastOffEmails([""]);
  };

  const setCastOffContactsMutation = useMutation({
    mutationFn: async (activityId: string) => {
      await api.patch(`/vessel-activities/${activityId}/cast-off-contacts`, {
        client_name: castOffClient.trim() || undefined,
        client_vessel_name: castOffVessel.trim() || undefined,
        // Blanks and duplicates are dropped server-side too; trimming here
        // just avoids a pointless round trip on the empty starter row.
        emails: castOffEmails.map((e) => e.trim()).filter(Boolean),
      });
    },
    onSuccess: () => {
      toast.success("Client contacts saved");
      closeCastOffForm();
      refetchVesselActivities();
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  const [hseFormActivityId, setHseFormActivityId] = useState<string | null>(null);
  const [hseFormPhase, setHseFormPhase] = useState<"pre" | "during" | "post">("pre");
  const [hseChecklist, setHseChecklist] = useState(DEFAULT_HSE_CHECKLIST);
  const [hseNotes, setHseNotes] = useState("");
  const [hseOfficer, setHseOfficer] = useState("");
  // Set only when the form was opened via "Correct" on an already-recorded
  // phase — the backend requires a reason in that case, and this is what
  // keeps that requirement from applying to a fresh, first-time recording.
  const [hseIsCorrecting, setHseIsCorrecting] = useState(false);
  const [hseCorrectReason, setHseCorrectReason] = useState("");

  const openHseForm = (activityId: string, phase?: (typeof HSE_PHASES)[number]) => {
    setHseFormActivityId(activityId);
    setHseFormPhase(phase?.phase ?? "pre");
    // No phase passed = the older single-checklist callers (vessel-only legs,
    // loading), which keep their own template and the "pre" columns.
    setHseChecklist(phase ? hsePhaseChecklist(phase) : DEFAULT_HSE_CHECKLIST);
    setHseNotes("");
    setHseOfficer("");
    setHseIsCorrecting(false);
    setHseCorrectReason("");
  };
  // Reopens an already-recorded phase pre-filled with what was submitted, so
  // amending a checklist after the operation has moved on doesn't mean
  // retyping it from scratch. That room to go back stays open for the rest
  // of the run, same as the Cast Off client block below.
  const openHseCorrection = (activity: VesselActivity, phase: (typeof HSE_PHASES)[number]) => {
    setHseFormActivityId(activity.id);
    setHseFormPhase(phase.phase);
    const stored = (activity[phase.checklistField] as { section?: string; item: string; passed: boolean; notes?: string }[]) ?? [];
    setHseChecklist(stored.length
      ? stored.map((r) => ({ section: r.section ?? "", item: r.item, passed: r.passed, notes: r.notes ?? "" }))
      : hsePhaseChecklist(phase));
    setHseNotes((activity[phase.notesField] as string | undefined) ?? "");
    setHseOfficer((activity[phase.officerField] as string | undefined) ?? "");
    setHseIsCorrecting(true);
    setHseCorrectReason("");
  };
  const closeHseForm = () => {
    setHseFormActivityId(null);
    setHseFormPhase("pre");
    setHseChecklist(DEFAULT_HSE_CHECKLIST);
    setHseNotes("");
    setHseOfficer("");
    setHseIsCorrecting(false);
    setHseCorrectReason("");
  };

  const recordHseMutation = useMutation({
    mutationFn: async (activityId: string) => {
      await api.post(`/vessel-activities/${activityId}/hse`, {
        checklist: hseChecklist.map((c) => ({ section: c.section, item: c.item, passed: c.passed, notes: c.notes.trim() || undefined })),
        result: hseChecklist.every((c) => c.passed) ? "satisfactory" : "not_satisfactory",
        notes: hseNotes.trim() || undefined,
        safety_officer: hseOfficer.trim() || undefined,
        phase: hseFormPhase,
        reason: hseIsCorrecting ? hseCorrectReason.trim() : undefined,
      });
    },
    onSuccess: () => {
      const label = HSE_PHASES.find((p) => p.phase === hseFormPhase)?.label ?? "HSE";
      toast.success(hseIsCorrecting ? `${label} checklist correction saved` : `${label} checklist recorded`);
      closeHseForm();
      refetchVesselActivities();
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  const [dischargeQtyActivityId, setDischargeQtyActivityId] = useState<string | null>(null);
  const [dqGov, setDqGov] = useState("");
  const [dqVcf, setDqVcf] = useState("");
  const [dqDensity, setDqDensity] = useState("");
  const openDischargeQtyForm = (activityId: string) => {
    setDischargeQtyActivityId(activityId);
    setDqGov(""); setDqVcf(""); setDqDensity("");
  };
  const closeDischargeQtyForm = () => {
    setDischargeQtyActivityId(null);
    setDqGov(""); setDqVcf(""); setDqDensity("");
  };

  const recordDischargeQtyMutation = useMutation({
    mutationFn: async (activityId: string) => {
      await api.post(`/vessel-activities/${activityId}/discharge-quantities`, {
        gov: parseFloat(dqGov), vcf: parseFloat(dqVcf), density: parseFloat(dqDensity),
      });
    },
    onSuccess: () => {
      toast.success("Discharge quantities recorded — GSV/MTvac computed");
      closeDischargeQtyForm();
      refetchVesselActivities();
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  // ── Vessel-only: commence -> updates -> complete -> quantities ─────────────
  // Fully separate from the stage flow above — used only when op.type ===
  // "vessel_only"; full_operation keeps the stage/HSE/discharge-qty UI above
  // completely untouched.

  const [commenceFormActivityId, setCommenceFormActivityId] = useState<string | null>(null);
  const [commenceUserAt, setCommenceUserAt] = useState("");
  const [commenceDescription, setCommenceDescription] = useState("");

  const commenceMutation = useMutation({
    mutationFn: async (activityId: string) => {
      await api.post(`/vessel-activities/${activityId}/commence`, {
        commenced_user_at: new Date(commenceUserAt).toISOString(),
        description: commenceDescription.trim() || undefined,
      });
    },
    onSuccess: () => {
      toast.success("Loading commenced");
      setCommenceFormActivityId(null); setCommenceUserAt(""); setCommenceDescription("");
      refetchVesselActivities();
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  const [updateFormActivityId, setUpdateFormActivityId] = useState<string | null>(null);
  const [updateContent, setUpdateContent] = useState("");
  const [updateImageFile, setUpdateImageFile] = useState<File | null>(null);
  const updateImageInputRef = useRef<HTMLInputElement>(null);

  const addUpdateMutation = useMutation({
    mutationFn: async (activityId: string) => {
      const form = new FormData();
      form.append("content", updateContent.trim());
      if (updateImageFile) form.append("image", updateImageFile);
      await api.post(`/vessel-activities/${activityId}/updates`, form, {
        headers: { "Content-Type": "multipart/form-data" },
      });
    },
    onSuccess: () => {
      toast.success("Update added");
      setUpdateFormActivityId(null); setUpdateContent(""); setUpdateImageFile(null);
      if (updateImageInputRef.current) updateImageInputRef.current.value = "";
      refetchVesselActivities();
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  const [completeFormActivityId, setCompleteFormActivityId] = useState<string | null>(null);
  const [completeUserAt, setCompleteUserAt] = useState("");
  const [completeDescription, setCompleteDescription] = useState("");

  const completeVesselOpMutation = useMutation({
    mutationFn: async (activityId: string) => {
      await api.post(`/vessel-activities/${activityId}/complete-vessel-operation`, {
        completed_user_at: new Date(completeUserAt).toISOString(),
        description: completeDescription.trim() || undefined,
      });
    },
    onSuccess: () => {
      toast.success("Loading completed — add receiving vessels to begin delivery");
      setCompleteFormActivityId(null); setCompleteUserAt(""); setCompleteDescription("");
      refetchVesselActivities();
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  const [editTimingActivityId, setEditTimingActivityId] = useState<string | null>(null);
  const [editCommenceUserAt, setEditCommenceUserAt] = useState("");
  const [editCompleteUserAt, setEditCompleteUserAt] = useState("");
  // The system-recorded instants are correctable too — they only record when
  // the button was pressed, and a BM must be able to fix one logged late or
  // against the wrong run.
  const [editCommenceSystemAt, setEditCommenceSystemAt] = useState("");
  const [editCompleteSystemAt, setEditCompleteSystemAt] = useState("");
  const [editCommenceDesc, setEditCommenceDesc] = useState("");
  const [editCompleteDesc, setEditCompleteDesc] = useState("");
  const [editTimingReason, setEditTimingReason] = useState("");
  const openEditTiming = (activity: VesselActivity) => {
    setEditTimingActivityId(activity.id);
    setEditCommenceUserAt(activity.commence_user_at ? activity.commence_user_at.slice(0, 16) : "");
    setEditCompleteUserAt(activity.complete_user_at ? activity.complete_user_at.slice(0, 16) : "");
    setEditCommenceSystemAt(activity.commence_system_at ? activity.commence_system_at.slice(0, 16) : "");
    setEditCompleteSystemAt(activity.complete_system_at ? activity.complete_system_at.slice(0, 16) : "");
    setEditCommenceDesc(activity.commence_description ?? "");
    setEditCompleteDesc(activity.complete_description ?? "");
    setEditTimingReason("");
  };

  const correctTimingMutation = useMutation({
    mutationFn: async (activityId: string) => {
      await api.patch(`/vessel-activities/${activityId}/vessel-operation-timing`, {
        commence_user_at: editCommenceUserAt ? new Date(editCommenceUserAt).toISOString() : undefined,
        complete_user_at: editCompleteUserAt ? new Date(editCompleteUserAt).toISOString() : undefined,
        commence_system_at: editCommenceSystemAt ? new Date(editCommenceSystemAt).toISOString() : undefined,
        complete_system_at: editCompleteSystemAt ? new Date(editCompleteSystemAt).toISOString() : undefined,
        commence_description: editCommenceDesc,
        complete_description: editCompleteDesc,
        reason: editTimingReason.trim(),
      });
    },
    onSuccess: () => {
      toast.success("Timing corrected");
      setEditTimingActivityId(null); setEditTimingReason("");
      refetchVesselActivities();
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  // ── Loading Received Quantity — one-time, six-stage + legs flow ──
  const [loadReceiptFormActivityId, setLoadReceiptFormActivityId] = useState<string | null>(null);
  const [loadReceived, setLoadReceived] = useState("");
  const [loadDensity, setLoadDensity] = useState("");
  const [loadTempBefore, setLoadTempBefore] = useState("");
  const [loadTempAfter, setLoadTempAfter] = useState("");
  const [loadVcf, setLoadVcf] = useState("");
  const [loadGov, setLoadGov] = useState("");
  const [loadDescription, setLoadDescription] = useState("");
  const [loadReason, setLoadReason] = useState("");
  const resetLoadReceiptForm = () => {
    setLoadReceiptFormActivityId(null);
    setLoadReceived(""); setLoadDensity(""); setLoadTempBefore(""); setLoadTempAfter("");
    setLoadVcf(""); setLoadGov(""); setLoadDescription(""); setLoadReason("");
  };
  const openLoadReceiptForm = (activity: VesselActivity) => {
    setLoadReceiptFormActivityId(activity.id);
    setLoadReceived(activity.loading_received_quantity_litres ?? "");
    setLoadDensity(activity.loading_density ?? "");
    setLoadTempBefore(activity.loading_temperature_before_loading ?? "");
    setLoadTempAfter(activity.loading_temperature_after_loading ?? "");
    setLoadVcf(activity.loading_vcf ?? "");
    setLoadGov(activity.loading_gov ?? "");
    setLoadDescription(activity.loading_quantity_description ?? "");
    setLoadReason("");
  };
  const recordLoadingReceiptMutation = useMutation({
    mutationFn: async (activityId: string) => {
      await api.post(`/vessel-activities/${activityId}/loading-receipt`, {
        received_quantity_litres: parseFloat(loadReceived),
        density: parseFloat(loadDensity),
        temperature_before_loading: parseFloat(loadTempBefore),
        temperature_after_loading: parseFloat(loadTempAfter),
        vcf: parseFloat(loadVcf),
        gov: parseFloat(loadGov),
        description: loadDescription.trim() || undefined,
        reason: loadReason.trim() || undefined,
      });
    },
    onSuccess: () => {
      toast.success("Loading receipt recorded");
      resetLoadReceiptForm();
      refetchVesselActivities();
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  // ── Receiving-vessel legs — added at any point, each runs its own
  // Cast Off -> Alongside -> Discharge Commenced -> Discharge Completed.
  const [addLegFormActivityId, setAddLegFormActivityId] = useState<string | null>(null);
  const [newLegName, setNewLegName] = useState("");
  const [newLegImo, setNewLegImo] = useState("");
  const [newLegEta, setNewLegEta] = useState("");
  const addLegMutation = useMutation({
    mutationFn: async (activityId: string) => {
      await api.post(`/vessel-activities/${activityId}/legs`, {
        receiving_vessel_name: newLegName.trim(),
        imo_number: newLegImo.trim() || undefined,
        eta_at: newLegEta ? new Date(newLegEta).toISOString() : undefined,
      });
    },
    onSuccess: () => {
      toast.success("Receiving vessel added");
      setAddLegFormActivityId(null); setNewLegName(""); setNewLegImo(""); setNewLegEta("");
      refetchVesselActivities();
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  const [legStageFormLegId, setLegStageFormLegId] = useState<string | null>(null);
  const [legStageTarget, setLegStageTarget] = useState<string>("");
  const [legStageOccurredAt, setLegStageOccurredAt] = useState("");
  const advanceLegStageMutation = useMutation({
    mutationFn: async (legId: string) => {
      await api.post(`/vessel-activity-legs/${legId}/advance-stage`, {
        stage: legStageTarget,
        occurred_at: new Date(legStageOccurredAt).toISOString(),
      });
    },
    onSuccess: () => {
      toast.success("Leg stage recorded");
      setLegStageFormLegId(null); setLegStageTarget(""); setLegStageOccurredAt("");
      refetchVesselActivities();
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  const [legHseFormLegId, setLegHseFormLegId] = useState<string | null>(null);
  const [legHseChecklist, setLegHseChecklist] = useState(DEFAULT_LEG_HSE_CHECKLIST);
  const [legHseNotes, setLegHseNotes] = useState("");
  const [legHseOfficer, setLegHseOfficer] = useState("");
  const openLegHseForm = (legId: string) => {
    setLegHseFormLegId(legId);
    setLegHseChecklist(DEFAULT_LEG_HSE_CHECKLIST);
    setLegHseNotes("");
    setLegHseOfficer("");
  };
  const recordLegHseMutation = useMutation({
    mutationFn: async (legId: string) => {
      await api.post(`/vessel-activity-legs/${legId}/hse`, {
        checklist: legHseChecklist.map((c) => ({ section: c.section, item: c.item, passed: c.passed, notes: c.notes.trim() || undefined })),
        result: legHseChecklist.every((c) => c.passed) ? "satisfactory" : "not_satisfactory",
        notes: legHseNotes.trim() || undefined,
        safety_officer: legHseOfficer.trim() || undefined,
      });
    },
    onSuccess: () => {
      toast.success("Leg HSE checklist recorded");
      setLegHseFormLegId(null); setLegHseNotes("");
      refetchVesselActivities();
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  const [legQtyFormLegId, setLegQtyFormLegId] = useState<string | null>(null);
  const [legQtyDischarged, setLegQtyDischarged] = useState("");
  const [legQtyDensity, setLegQtyDensity] = useState("");
  const [legQtyTempBefore, setLegQtyTempBefore] = useState("");
  const [legQtyTempAfter, setLegQtyTempAfter] = useState("");
  const [legQtyVcf, setLegQtyVcf] = useState("");
  const [legQtyGov, setLegQtyGov] = useState("");
  const [legQtyDescription, setLegQtyDescription] = useState("");
  const [legQtyReason, setLegQtyReason] = useState("");
  const resetLegQtyForm = () => {
    setLegQtyFormLegId(null);
    setLegQtyDischarged(""); setLegQtyDensity(""); setLegQtyTempBefore(""); setLegQtyTempAfter("");
    setLegQtyVcf(""); setLegQtyGov(""); setLegQtyDescription(""); setLegQtyReason("");
  };
  const openLegQtyForm = (leg: VesselActivityLeg) => {
    setLegQtyFormLegId(leg.id);
    setLegQtyDischarged(leg.quantity_discharged_litres ?? "");
    setLegQtyDensity(leg.density ?? "");
    setLegQtyTempBefore(leg.temperature_before_loading ?? "");
    setLegQtyTempAfter(leg.temperature_after_loading ?? "");
    setLegQtyVcf(leg.vcf ?? "");
    setLegQtyGov(leg.gov ?? "");
    setLegQtyDescription(leg.quantity_description ?? "");
    setLegQtyReason("");
  };
  const recordLegQtyMutation = useMutation({
    mutationFn: async (legId: string) => {
      await api.post(`/vessel-activity-legs/${legId}/quantities`, {
        quantity_discharged_litres: parseFloat(legQtyDischarged),
        density: parseFloat(legQtyDensity),
        temperature_before_loading: parseFloat(legQtyTempBefore),
        temperature_after_loading: parseFloat(legQtyTempAfter),
        vcf: parseFloat(legQtyVcf),
        gov: parseFloat(legQtyGov),
        description: legQtyDescription.trim() || undefined,
        reason: legQtyReason.trim() || undefined,
      });
    },
    onSuccess: () => {
      toast.success("Leg quantities recorded");
      resetLegQtyForm();
      refetchVesselActivities();
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  const [editLegTimingId, setEditLegTimingId] = useState<string | null>(null);
  const [editLegTimingFields, setEditLegTimingFields] = useState<Record<string, string>>({});
  const [editLegTimingReason, setEditLegTimingReason] = useState("");
  const openEditLegTiming = (leg: VesselActivityLeg) => {
    setEditLegTimingId(leg.id);
    setEditLegTimingFields({
      stage_cast_off_user_at: leg.stage_cast_off_user_at?.slice(0, 16) ?? "",
      stage_alongside_user_at: leg.stage_alongside_user_at?.slice(0, 16) ?? "",
      stage_discharge_commenced_user_at: leg.stage_discharge_commenced_user_at?.slice(0, 16) ?? "",
      stage_discharge_completed_user_at: leg.stage_discharge_completed_user_at?.slice(0, 16) ?? "",
    });
    setEditLegTimingReason("");
  };
  const correctLegTimingMutation = useMutation({
    mutationFn: async (legId: string) => {
      const body: Record<string, string> = { reason: editLegTimingReason.trim() };
      for (const [k, v] of Object.entries(editLegTimingFields)) {
        if (v) body[k] = new Date(v).toISOString();
      }
      await api.patch(`/vessel-activity-legs/${legId}/timing`, body);
    },
    onSuccess: () => {
      toast.success("Leg timing corrected");
      setEditLegTimingId(null); setEditLegTimingReason("");
      refetchVesselActivities();
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  const [cancelLegFormId, setCancelLegFormId] = useState<string | null>(null);
  const [cancelLegReason, setCancelLegReason] = useState("");
  const cancelLegMutation = useMutation({
    mutationFn: async (legId: string) => {
      await api.post(`/vessel-activity-legs/${legId}/cancel`, { reason: cancelLegReason.trim() });
    },
    onSuccess: () => {
      toast.success("Receiving vessel cancelled");
      setCancelLegFormId(null); setCancelLegReason("");
      refetchVesselActivities();
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });


  // ── BM corrections — the BM can fix any recorded detail. Every one of
  // these sends a required reason, which the backend audit-logs. Nothing is
  // deletable: a correction edits the record and marks it as edited.

  // Correct a posted update (content and/or replacement image)
  const [editUpdateId, setEditUpdateId] = useState<string | null>(null);
  const [editUpdateContent, setEditUpdateContent] = useState("");
  const [editUpdateReason, setEditUpdateReason] = useState("");
  const [editUpdateImage, setEditUpdateImage] = useState<File | null>(null);
  const openEditUpdate = (u: VesselActivityUpdate) => {
    setEditUpdateId(u.id); setEditUpdateContent(u.content);
    setEditUpdateReason(""); setEditUpdateImage(null);
  };
  const resetEditUpdate = () => {
    setEditUpdateId(null); setEditUpdateContent(""); setEditUpdateReason(""); setEditUpdateImage(null);
  };
  const editUpdateMutation = useMutation({
    mutationFn: async (updateId: string) => {
      const form = new FormData();
      form.append("reason", editUpdateReason.trim());
      form.append("content", editUpdateContent.trim());
      if (editUpdateImage) form.append("image", editUpdateImage);
      await api.patch(`/vessel-activity-updates/${updateId}`, form, {
        headers: { "Content-Type": "multipart/form-data" },
      });
    },
    onSuccess: () => { toast.success("Update corrected"); resetEditUpdate(); refetchVesselActivities(); },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  // Correct a receiving vessel's identity
  const [editLegId, setEditLegId] = useState<string | null>(null);
  const [editLegName, setEditLegName] = useState("");
  const [editLegImo, setEditLegImo] = useState("");
  const [editLegEta, setEditLegEta] = useState("");
  const [editLegReason, setEditLegReason] = useState("");
  const openEditLeg = (leg: VesselActivityLeg) => {
    setEditLegId(leg.id); setEditLegName(leg.receiving_vessel_name);
    setEditLegImo(leg.imo_number ?? ""); setEditLegEta(leg.eta_at ? leg.eta_at.slice(0, 16) : "");
    setEditLegReason("");
  };
  const editLegMutation = useMutation({
    mutationFn: async (legId: string) => {
      await api.patch(`/vessel-activity-legs/${legId}`, {
        receiving_vessel_name: editLegName.trim(),
        imo_number: editLegImo.trim() || undefined,
        eta_at: editLegEta ? new Date(editLegEta).toISOString() : undefined,
        reason: editLegReason.trim(),
      });
    },
    onSuccess: () => { toast.success("Receiving vessel updated"); setEditLegId(null); refetchVesselActivities(); },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  // Ad-hoc client contact — capture only (decision 6), for a receiving
  // vessel with no registered client account. Only editable once cast off.
  const [adhocClientFormLegId, setAdhocClientFormLegId] = useState<string | null>(null);
  const [adhocClientEmail, setAdhocClientEmail] = useState("");
  const [adhocClientName, setAdhocClientName] = useState("");
  const openAdhocClientForm = (leg: VesselActivityLeg) => {
    setAdhocClientFormLegId(leg.id);
    setAdhocClientEmail(leg.adhoc_client_email ?? "");
    setAdhocClientName(leg.adhoc_client_name ?? "");
  };
  const setLegAdhocClientMutation = useMutation({
    mutationFn: async (legId: string) => {
      await api.patch(`/vessel-activity-legs/${legId}/adhoc-client`, {
        adhoc_client_email: adhocClientEmail.trim(),
        adhoc_client_name: adhocClientName.trim() || undefined,
      });
    },
    onSuccess: () => { toast.success("Client contact saved"); setAdhocClientFormLegId(null); refetchVesselActivities(); },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  // Roll a leg back to an earlier stage (blocked once a BDN exists)
  const [rollbackLegId, setRollbackLegId] = useState<string | null>(null);
  const [rollbackStage, setRollbackStage] = useState("");
  const [rollbackReason, setRollbackReason] = useState("");
  const rollbackLegMutation = useMutation({
    mutationFn: async (legId: string) => {
      await api.patch(`/vessel-activity-legs/${legId}/timing`, {
        stage: rollbackStage,
        reason: rollbackReason.trim(),
      });
    },
    onSuccess: () => {
      toast.success("Stage rolled back");
      setRollbackLegId(null); setRollbackStage(""); setRollbackReason("");
      refetchVesselActivities();
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  // Restore a cancelled receiving vessel
  const [uncancelLegId, setUncancelLegId] = useState<string | null>(null);
  const [uncancelReason, setUncancelReason] = useState("");
  const uncancelLegMutation = useMutation({
    mutationFn: async (legId: string) => {
      await api.post(`/vessel-activity-legs/${legId}/uncancel`, { reason: uncancelReason.trim() });
    },
    onSuccess: () => {
      toast.success("Receiving vessel restored");
      setUncancelLegId(null); setUncancelReason(""); refetchVesselActivities();
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  // Correct the Initial ROB (allowed even after completion)
  const [editInitialRobId, setEditInitialRobId] = useState<string | null>(null);
  const [editInitialRob, setEditInitialRob] = useState("");
  const [editInitialRobReason, setEditInitialRobReason] = useState("");
  const editInitialRobMutation = useMutation({
    mutationFn: async (activityId: string) => {
      await api.patch(`/vessel-activities/${activityId}/initial-rob`, {
        initial_rob_mt: parseFloat(editInitialRob),
        reason: editInitialRobReason.trim(),
      });
    },
    onSuccess: () => {
      toast.success("Initial ROB corrected");
      setEditInitialRobId(null); setEditInitialRob(""); setEditInitialRobReason("");
      refetchVesselActivities();
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  // Re-open a recorded HSE checklist to correct it (activity or leg)
  const [correctHseTarget, setCorrectHseTarget] = useState<{ kind: "activity" | "leg"; id: string } | null>(null);
  const [correctHseReason, setCorrectHseReason] = useState("");
  const openCorrectHse = (
    kind: "activity" | "leg",
    id: string,
    checklist: { section?: string; item: string; passed: boolean; notes?: string }[],
    notes?: string,
  ) => {
    setCorrectHseTarget({ kind, id });
    setCorrectHseReason("");
    const rows = checklist.length
      ? checklist.map((c) => ({ section: c.section ?? "", item: c.item, passed: c.passed, notes: c.notes ?? "" }))
      : (kind === "leg" ? DEFAULT_LEG_HSE_CHECKLIST : DEFAULT_HSE_CHECKLIST);
    if (kind === "activity") { setHseChecklist(rows); setHseNotes(notes ?? ""); }
    else { setLegHseChecklist(rows); setLegHseNotes(notes ?? ""); }
  };
  const correctHseMutation = useMutation({
    mutationFn: async () => {
      if (!correctHseTarget) return;
      const isLeg = correctHseTarget.kind === "leg";
      const rows = isLeg ? legHseChecklist : hseChecklist;
      const body = {
        checklist: rows.map((c) => ({ section: c.section, item: c.item, passed: c.passed, notes: c.notes.trim() || undefined })),
        result: rows.every((c) => c.passed) ? "satisfactory" : "not_satisfactory",
        notes: (isLeg ? legHseNotes : hseNotes).trim() || undefined,
        safety_officer: (isLeg ? legHseOfficer : hseOfficer).trim() || undefined,
        reason: correctHseReason.trim(),
      };
      await api.post(
        isLeg ? `/vessel-activity-legs/${correctHseTarget.id}/hse` : `/vessel-activities/${correctHseTarget.id}/hse`,
        body,
      );
    },
    onSuccess: () => {
      toast.success("HSE checklist corrected");
      setCorrectHseTarget(null); setCorrectHseReason(""); refetchVesselActivities();
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  const reopenMutation = useMutation<Operation, Error, void>({
    mutationFn: async () => {
      const res = await api.post(`/operations/${id}/reopen`, {
        version_notes: reopenNotes.trim() || undefined,
      });
      return extractData(res) as Operation;
    },
    onSuccess: (newOp: Operation) => {
      toast.success(`Revision ${newOp.version} created: ${newOp.operation_number}`);
      setShowReopenDialog(false);
      setReopenNotes("");
      router.push(`/operations/${newOp.id}`);
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  // ── Truck progress report state
  // stageForms[truckOpId][stageKey][fieldKey] = value
  const [stageForms, setStageForms] = useState<Record<string, Record<string, Record<string, string>>>>({});
  // which stageKey is actively being recorded per truck op
  const [activeRecording, setActiveRecording] = useState<Record<string, string>>({});
  // BM document upload
  const [uploadingTruckId, setUploadingTruckId] = useState<string | null>(null);
  const docFileRef = useRef<HTMLInputElement>(null);
  const [docFile, setDocFile] = useState<File | null>(null);

  // BM: remove a truck from the operation — at any phase, reason required
  const [removeTruckTarget, setRemoveTruckTarget] = useState<TruckOperation | null>(null);
  const [removeTruckReason, setRemoveTruckReason] = useState("");

  // ── Discharge vessel selector state (per truck op, discharge_end_at stage)
  // "system" = dropdown, "other" = free-text
  const [dischargeVesselMode, setDischargeVesselMode] = useState<Record<string, "system" | "other">>({});
  const [dischargeVesselId, setDischargeVesselId] = useState<Record<string, string>>({});
  const [dischargeVesselName, setDischargeVesselName] = useState<Record<string, string>>({});

  // ── BM: discharge edit dialog state
  const [editDischargeId, setEditDischargeId] = useState<string | null>(null);
  const [editDischQty, setEditDischQty] = useState("");
  const [editDischSpillage, setEditDischSpillage] = useState("");
  const [editDischTemp, setEditDischTemp] = useState("");
  const [editDischVesselMode, setEditDischVesselMode] = useState<"system" | "other">("system");
  const [editDischVesselId, setEditDischVesselId] = useState("");
  const [editDischVesselName, setEditDischVesselName] = useState("");
  const [editDischNotes, setEditDischNotes] = useState("");

  const openEditDischarge = (to: TruckOperation) => {
    setEditDischargeId(to.id);
    setEditDischQty(to.quantity_discharged_mt ?? "");
    setEditDischSpillage(to.spillage_mt ?? "");
    setEditDischTemp(to.temperature_celsius ?? "");
    if (to.destination_vessel_id) {
      setEditDischVesselMode("system");
      setEditDischVesselId(to.destination_vessel_id);
      setEditDischVesselName("");
    } else if (to.destination_vessel_name) {
      setEditDischVesselMode("other");
      setEditDischVesselId("");
      setEditDischVesselName(to.destination_vessel_name);
    } else {
      setEditDischVesselMode("system");
      setEditDischVesselId("");
      setEditDischVesselName("");
    }
    setEditDischNotes(to.notes ?? "");
  };

  // ── Safety audit state
  // Pre (before loading): vessel/jetty readiness + transshipment loading procedure
  const PRE_CHECKLIST_ITEMS = [
    "Confirm vessel arrival time and storage capacity",
    "Confirm barge size is minimum of 15 metres breadth and securely placed",
    "Confirm depth of the jetty",
    "Verify truck scheduling and coordination",
    "Obtain necessary port, safety permits and Navy Clearance",
    "Conduct equipment inspections (hoses, pumps, connections)",
    "Inspect trucks for product type, quantity, and seal integrity",
    "Review weather conditions for safe operation",
    "Ensure availability of spill response kits and fire suppression equipment",
    "Conduct safety briefing for all personnel",
    "Verify PPE availability (fire-resistant clothing, gloves, boots, helmets)",
    "Confirm vessel readiness and jetty clearance",
    "Ensure trucks are positioned in the correct designated area",
    "Ullage truck compartments",
    "Inspect trucks for any visible damage or leaks",
    "Confirm truck waybill",
    "Record product type and quantity",
    "Securely connect hoses and pipelines between trucks and vessel",
    "Securely connect flow meter between trucks and vessel",
    "Pump 250/300 litres into drum to confirm flow meter accuracy",
    "Is flow meter reading accurate?",
    "Assign pump operators for product flow management",
    "Begin product transfer at a controlled rate",
    "Monitor flow meters and tank levels",
    "Maintain communication between Jetty Supervisor, vessel crew, and truck drivers",
    "Address any leaks or spills immediately",
  ];
  // Post (before discharge): ongoing monitoring + close-out checks, gating discharge
  const POST_CHECKLIST_ITEMS = [
    "Continuous safety checks by Safety Officer",
    "Monitor for leaks, spills, or equipment malfunctions",
    "Adjust product flow rate as needed",
    "Ensure environmental protection protocols are followed",
    "Document any issues or incidents during the transfer process",
    "Safely disconnect hoses and pipelines",
    "Confirm truck empty tanks are carried out and empty",
    "Confirm truck have no hidden tanks (Aso Rock)",
    "Seal truck valves and drain any remaining product",
    "Conduct final inspection for spills or leaks",
    "Complete all necessary documentation (bills of lading, transfer logs)",
    "Ensure all parties sign required documents",
    "Submit reports to port authorities and internal stakeholders",
    "Detain/release truck with loss or average",
    "Conduct a post-operation debrief with the team",
    "Clean and store equipment appropriately",
  ];
  const CHECKLIST_ITEMS_BY_PHASE: Record<AuditPhase, string[]> = { pre: PRE_CHECKLIST_ITEMS, post: POST_CHECKLIST_ITEMS };
  const HEADER_FIELDS_BY_PHASE: Record<AuditPhase, { k: string; label: string }[]> = {
    pre: [
      { k: "safety_officer", label: "Safety Officer" },
      { k: "driver_name", label: "Truck Driver" },
      { k: "truck_number", label: "Truck Number" },
      { k: "truck_quantity", label: "Truck Quantity" },
      { k: "driver_phone", label: "Driver Contact" },
      { k: "pfi_number", label: "PFI" },
      { k: "nomination_date", label: "Nomination Date" },
      { k: "product_type", label: "Product Type" },
    ],
    post: [
      { k: "truck_arrival_date", label: "Truck Arrival Date" },
      { k: "quantity_discharge", label: "Quantity Discharge" },
      { k: "discharge_date", label: "Discharge Date" },
    ],
  };

  const [auditDialogTruckOpId, setAuditDialogTruckOpId] = useState<string | null>(null);
  const [auditPhase, setAuditPhase] = useState<AuditPhase>("pre");
  const [auditChecklist, setAuditChecklist] = useState<Record<string, boolean>>({});
  const [auditItemTimestamps, setAuditItemTimestamps] = useState<Record<string, string>>({});
  const [auditHeader, setAuditHeader] = useState<Record<string, string>>({});
  const [auditResult, setAuditResult] = useState<AuditResult>("satisfactory");
  const [auditNotes, setAuditNotes] = useState("");

  const openAuditDialog = (truckOpId: string, phase: AuditPhase, existing?: TruckSafetyAudit) => {
    const items = CHECKLIST_ITEMS_BY_PHASE[phase];
    if (existing) {
      const map: Record<string, boolean> = {};
      const ts: Record<string, string> = {};
      existing.checklist.forEach((c) => {
        map[c.item] = c.passed;
        if (c.checked_at) ts[c.item] = c.checked_at;
      });
      setAuditChecklist(map);
      setAuditItemTimestamps(ts);
      setAuditHeader(existing.header ?? {});
      setAuditResult(existing.result);
      setAuditNotes(existing.notes ?? "");
    } else {
      const map: Record<string, boolean> = {};
      items.forEach((item) => { map[item] = false; });
      setAuditChecklist(map);
      setAuditItemTimestamps({});
      setAuditHeader({});
      setAuditResult("satisfactory");
      setAuditNotes("");
    }
    setAuditPhase(phase);
    setAuditDialogTruckOpId(truckOpId);
  };

  const toggleAuditItem = (item: string, passed: boolean) => {
    setAuditChecklist((prev) => ({ ...prev, [item]: passed }));
    setAuditItemTimestamps((prev) => ({ ...prev, [item]: new Date().toISOString() }));
  };

  const submitAuditMutation = useMutation({
    mutationFn: async ({ truckOpId }: { truckOpId: string }) => {
      const checklist = CHECKLIST_ITEMS_BY_PHASE[auditPhase].map((item) => ({
        item,
        passed: auditChecklist[item] ?? false,
        checked_at: auditItemTimestamps[item],
      }));
      await api.post(`/operations/${id}/trucks/${truckOpId}/audit`, {
        phase: auditPhase,
        result: auditResult,
        checklist,
        header: auditHeader,
        notes: auditNotes.trim() || undefined,
      });
    },
    onSuccess: () => {
      toast.success("Safety audit submitted");
      setAuditDialogTruckOpId(null);
      qc.invalidateQueries({ queryKey: ["operation-trucks", id] });
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  // ── Waiver state (BM only)
  const [waiverDialog, setWaiverDialog] = useState<{
    truckOpId: string; phase: AuditPhase; item: string;
  } | null>(null);
  const [waiverNotes, setWaiverNotes] = useState("");

  const waiveItemMutation = useMutation({
    mutationFn: async ({ truckOpId, phase, item, notes }: { truckOpId: string; phase: AuditPhase; item: string; notes: string }) => {
      await api.post(`/operations/${id}/trucks/${truckOpId}/audit/waive`, {
        phase,
        item,
        waiver_notes: notes.trim() || undefined,
      });
    },
    onSuccess: () => {
      toast.success("Item waived — recorded on operation");
      setWaiverDialog(null);
      setWaiverNotes("");
      qc.invalidateQueries({ queryKey: ["operation-trucks", id] });
      qc.invalidateQueries({ queryKey: ["operation-activity", id] });
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  // Renders one phase's (Pre or Post) safety-checklist banner + breakdown for a
  // truck operation. Neither phase gates the other, nor the movement stages —
  // both are just independently trackable readiness checks.
  const renderAuditBanner = (to: TruckOperation, phase: AuditPhase, audit?: TruckSafetyAudit) => {
    const label = phase === "pre" ? "Pre (before loading)" : "Post (before discharge)";
    const auditPassed = audit?.result === "satisfactory";
    const failedItems = audit?.checklist.filter((c) => !c.passed) ?? [];
    const waivedSet = new Set((audit?.waivers ?? []).map((w: AuditWaiver) => w.item));
    const unwaivedFailed = failedItems.filter((c) => !waivedSet.has(c.item));
    const hasWaivers = (audit?.waivers?.length ?? 0) > 0;

    return (
      <div key={phase}>
        <div className={`flex items-center gap-2 px-5 py-2.5 border-b ${
          auditPassed ? "bg-emerald-50/50" : audit ? "bg-rose-50/40" : "bg-amber-50/50"
        }`}>
          {auditPassed
            ? <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
            : audit
            ? <ShieldAlert className="w-3.5 h-3.5 text-rose-600 shrink-0" />
            : <Shield className="w-3.5 h-3.5 text-amber-600 shrink-0" />}
          <p className={`text-xs font-medium flex-1 ${
            auditPassed ? "text-emerald-700" : audit ? "text-rose-700" : "text-amber-700"
          }`}>
            <span className="font-semibold">{label}:</span>{" "}
            {auditPassed
              ? `Passed · ${audit?.conductor_name ?? ""}${audit?.conducted_at ? ` · ${formatDate(audit.conducted_at)}` : ""}`
              : audit
              ? `FAILED — ${unwaivedFailed.length} unresolved issue${unwaivedFailed.length !== 1 ? "s" : ""}`
              : "Not yet conducted"}
            {hasWaivers && !auditPassed && (
              <span className="ml-2 text-amber-600 font-semibold">
                ({(audit?.waivers?.length ?? 0)} waived by BM)
              </span>
            )}
          </p>
          {(isLO || isOS) && (
            <Button size="sm" variant={audit && !auditPassed ? "destructive" : "outline"}
              className="h-6 text-[11px] px-2 shrink-0"
              onClick={() => openAuditDialog(to.id, phase, audit ?? undefined)}>
              {audit ? "Re-audit" : "Conduct Audit"}
            </Button>
          )}
        </div>

        {isBM && audit && (
          <div className="px-5 py-3 border-b bg-muted/10 space-y-1.5">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-2">
              {label} checklist — {audit.conductor_name} · {formatDateTime(audit.conducted_at)}
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1">
              {audit.checklist.map((c) => {
                const waiver = (audit.waivers ?? []).find((w: AuditWaiver) => w.item === c.item);
                return (
                  <div key={c.item} className={`flex items-start gap-2 text-xs rounded-md px-2.5 py-1.5 ${
                    c.passed ? "bg-emerald-50 text-emerald-700"
                    : waiver ? "bg-amber-50 text-amber-800"
                    : "bg-rose-50 text-rose-700"
                  }`}>
                    <span className="shrink-0 mt-0.5 font-bold">
                      {c.passed ? "✓" : waiver ? "⚠" : "✗"}
                    </span>
                    <div className="flex-1 min-w-0">
                      <span>{c.item}</span>
                      {c.checked_at && <span className="ml-1.5 text-[9px] text-muted-foreground">{formatDateTime(c.checked_at)}</span>}
                      {!c.passed && !waiver && (
                        <button
                          type="button"
                          className="ml-2 text-[10px] font-semibold underline text-rose-600 hover:text-rose-800"
                          onClick={() => { setWaiverDialog({ truckOpId: to.id, phase, item: c.item }); setWaiverNotes(""); }}
                        >
                          Waive
                        </button>
                      )}
                      {waiver && (
                        <p className="text-[10px] text-amber-700 mt-0.5">
                          Waived by {waiver.waived_by_name} · {formatDate(waiver.waived_at)}
                          {waiver.notes && ` — "${waiver.notes}"`}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
            {audit.notes && (
              <p className="text-[11px] text-muted-foreground italic mt-2">Notes: {audit.notes}</p>
            )}
          </div>
        )}

        {!isBM && audit && failedItems.length > 0 && (
          <div className="px-5 py-2 border-b bg-rose-50/30">
            <p className="text-[10px] font-semibold text-rose-600 mb-1">Failed items:</p>
            <div className="flex flex-wrap gap-1.5">
              {failedItems.map((c) => (
                <span key={c.item} className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                  waivedSet.has(c.item) ? "bg-amber-100 text-amber-700" : "bg-rose-100 text-rose-700"
                }`}>
                  {waivedSet.has(c.item) ? "⚠ " : "✗ "}{c.item}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };

  // CSV export of activity log
  const exportActivityCsv = () => {
    if (!activityLog?.length) return;
    const header = ["Timestamp", "User", "Role", "Acted As", "Action", "Entity", "Details"];
    const rows = activityLog.map((e) => [
      new Date(e.created_at).toLocaleString(),
      e.user_name,
      e.user_role,
      e.acted_as_role ?? "",
      e.action.replace(/_/g, " "),
      e.entity_type.replace(/_/g, " "),
      e.changes ? JSON.stringify(e.changes) : "",
    ]);
    const csv = [header, ...rows].map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `activity-${id.slice(0, 8)}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  // ── Helpers
  const ACTION_LABELS: Record<string, string> = {
    ADD_TRUCK_TO_OPERATION: "Truck added to operation",
    UPDATE_TRUCK_OPERATION: "Truck stage updated",
    SUBMIT_SAFETY_AUDIT:    "Safety audit submitted",
    WAIVE_AUDIT_ITEM:       "Audit item waived by BM",
    SUBMIT_FEEDBACK:        "Truck readiness feedback submitted",
    APPROVE_FEEDBACK:       "Feedback approved",
    REJECT_FEEDBACK:        "Feedback rejected",
    TRANSITION_STATUS:      "Operation status changed",
    LINK_PFI:               "PFI linked",
    UPLOAD_DOCUMENT:        "Document uploaded",
    SUBMIT_COMPLETION:      "Completion report submitted",
    START_TRANSIT:               "Truck started transit",
    ARRIVE_DISCHARGE:            "Truck arrived at discharge",
    START_DISCHARGE:             "Discharge started",
    END_DISCHARGE:               "Discharge completed",
    APPROVE_DISCHARGE:           "Discharge approved by BM",
    BM_EDITED_DISCHARGE_RECORD:  "Discharge record edited by BM",
    ACT_AS_ROLE_SWITCH:          "Switched Role",
    ACT_AS_ROLE_CLEAR:           "Switched Back to BM",
  };

  const ACTION_COLOR: Record<string, string> = {
    WAIVE_AUDIT_ITEM:           "text-amber-600",
    SUBMIT_SAFETY_AUDIT:        "text-brand-600",
    SUBMIT_FEEDBACK:            "text-violet-600",
    APPROVE_FEEDBACK:           "text-emerald-600",
    REJECT_FEEDBACK:            "text-rose-600",
    TRANSITION_STATUS:          "text-primary",
    UPLOAD_DOCUMENT:            "text-brand-500",
    UPDATE_TRUCK_OPERATION:     "text-violet-600",
    APPROVE_DISCHARGE:          "text-emerald-700",
    BM_EDITED_DISCHARGE_RECORD: "text-amber-600",
    ACT_AS_ROLE_SWITCH:         "text-slate-600",
    ACT_AS_ROLE_CLEAR:          "text-slate-600",
  };

  // Initialize TruckOperation records from approved feedback truck_ids, applying
  // the driver/vendor info the LO captured at nomination time (see truck_details.driverInfo).
  const initTrucksMutation = useMutation({
    mutationFn: async ({ truckIds, driverInfo }: { truckIds: string[]; driverInfo?: Record<string, { driver_name?: string; driver_phone?: string; vendor_name?: string }> }) => {
      // Cancelled rows don't count as initialised — a removed truck that has
      // been re-approved must be POSTed again to get a fresh live row.
      const alreadyInitialized = new Set(
        (truckOps ?? []).filter((to) => to.status !== "cancelled").map((to) => to.truck_id)
      );
      const newIds = truckIds.filter((tid) => !alreadyInitialized.has(tid));
      for (const truck_id of newIds) {
        const info = driverInfo?.[truck_id];
        await api.post(`/operations/${id}/trucks`, {
          truck_id,
          driver_name: info?.driver_name || undefined,
          driver_phone: info?.driver_phone || undefined,
          vendor_name: info?.vendor_name || undefined,
        });
      }
    },
    onSuccess: () => {
      toast.success("Trucks initialized — you can now record progress");
      qc.invalidateQueries({ queryKey: ["operation-trucks", id] });
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  // ── Waybill link (LO only): waiver number + driver + vendor come together here
  const [waybillDialogTruckOpId, setWaybillDialogTruckOpId] = useState<string | null>(null);
  const [waybillWaiverId,  setWaybillWaiverId]  = useState("");
  const [waybillDriver,    setWaybillDriver]    = useState("");
  const [waybillPhone,     setWaybillPhone]     = useState("");
  const [waybillVendor,    setWaybillVendor]    = useState("");
  const [waybillDocNumber, setWaybillDocNumber] = useState("");
  const [waybillNumber,    setWaybillNumber]    = useState("");

  // 31 Jul 2026 decision: one waiver can cover multiple trucks at once, so the
  // dropdown offers every waiver, not just ones with zero existing links.
  const { data: availableWaivers } = useQuery({
    queryKey: ["truck-waivers"],
    queryFn: async () => {
      const res = await api.get<ApiResponse<TruckWaiver[]>>("/trucks/waivers");
      return res.data.data ?? [];
    },
    enabled: !!waybillDialogTruckOpId,
  });

  const openWaybillDialog = (to: TruckOperation) => {
    setWaybillDialogTruckOpId(to.id);
    setWaybillWaiverId(to.waiver_id ?? "");
    setWaybillDriver(to.driver_name ?? "");
    setWaybillPhone(to.driver_phone ?? "");
    setWaybillVendor(to.vendor_name ?? "");
    setWaybillDocNumber(to.waybill_document_number ?? "");
    setWaybillNumber(to.waybill_number ?? "");
  };

  const linkWaybillMutation = useMutation({
    mutationFn: async () => {
      if (!waybillDialogTruckOpId) return;
      await api.post(`/operations/${id}/trucks/${waybillDialogTruckOpId}/waybill`, {
        waiver_id: waybillWaiverId,
        driver_name: waybillDriver.trim(),
        driver_phone: waybillPhone.trim(),
        vendor_name: waybillVendor.trim() || undefined,
        waybill_document_number: waybillDocNumber.trim() || undefined,
        waybill_number: waybillNumber.trim() || undefined,
      });
    },
    onSuccess: () => {
      toast.success("Waybill linked — waiver, plate, and driver are now on record");
      setWaybillDialogTruckOpId(null);
      qc.invalidateQueries({ queryKey: ["operation-trucks", id] });
      qc.invalidateQueries({ queryKey: ["truck-waivers"] });
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  const removeTruckMutation = useMutation({
    mutationFn: async () => {
      if (!removeTruckTarget) return;
      await api.delete(`/operations/${id}/trucks/${removeTruckTarget.id}`, {
        data: { reason: removeTruckReason.trim() },
      });
    },
    onSuccess: () => {
      toast.success("Truck removed from operation");
      setRemoveTruckTarget(null);
      setRemoveTruckReason("");
      qc.invalidateQueries({ queryKey: ["operation-trucks", id] });
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  const getStageForm = (truckOpId: string, stageKey: string) =>
    stageForms[truckOpId]?.[stageKey] ?? {};

  const setStageField = (truckOpId: string, stageKey: string, field: string, value: string) =>
    setStageForms((prev) => ({
      ...prev,
      [truckOpId]: {
        ...(prev[truckOpId] ?? {}),
        [stageKey]: { ...(prev[truckOpId]?.[stageKey] ?? {}), [field]: value },
      },
    }));

  const recordStageMutation = useMutation({
    mutationFn: async ({ truckOpId, stageKey, form }: {
      truckOpId: string; stageKey: string; form: Record<string, string>;
    }) => {
      const stage = TRUCK_STAGES.find((s) => s.key === stageKey)!;

      const ts = form.ts ? new Date(form.ts).toISOString() : undefined;

      if (stageKey === "departed_parking_at") {
        await api.post(`/operations/${id}/trucks/${truckOpId}/depart-parking`, {
          departed_parking_at: ts,
          notes: form.notes || undefined,
        });
        return;
      }
      if (stageKey === "arrived_loading_at") {
        await api.post(`/operations/${id}/trucks/${truckOpId}/arrived-loading`, {
          arrived_loading_at: ts,
          loading_location: form.loading_location || undefined,
          notes: form.notes || undefined,
        });
        return;
      }
      if (stageKey === "departed_loading_at") {
        await api.post(`/operations/${id}/trucks/${truckOpId}/departed-loading`, {
          departed_loading_at: ts,
          quantity_loaded_mt: form.quantity_loaded_mt ? parseFloat(form.quantity_loaded_mt) : undefined,
          product_type: form.product_type || op?.product_type || undefined,
          notes: form.waybill_number ? `Waybill: ${form.waybill_number}${form.notes ? `\n${form.notes}` : ""}` : form.notes || undefined,
        });
        return;
      }
      if (stageKey === "arrived_discharge_at") {
        await api.post(`/operations/${id}/trucks/${truckOpId}/arrived-discharge`, {
          arrived_discharge_at: ts,
          discharge_location: form.discharge_location || undefined,
          notes: form.notes || undefined,
        });
        return;
      }
      if (stageKey === "discharge_start_at") {
        await api.post(`/operations/${id}/trucks/${truckOpId}/start-discharge`, {});
        return;
      }
      if (stageKey === "discharge_end_at") {
        const payload: Record<string, unknown> = {
          quantity_discharged_mt: parseFloat(form.quantity_discharged_mt || "0"),
        };
        if (ts) payload.discharge_end_at = ts;
        if (form.temperature_celsius) payload.temperature_celsius = parseFloat(form.temperature_celsius);
        if (form.spillage_mt) payload.spillage_mt = parseFloat(form.spillage_mt);
        if (form.notes) payload.notes = form.notes;
        const mode = dischargeVesselMode[truckOpId] ?? "system";
        // Full operations: trucks discharge into THIS operation's vessel. Default to
        // it when the officer hasn't picked one, so truck fuel lands on the right ROB.
        const systemVesselId = dischargeVesselId[truckOpId]
          || (op?.type === "full_operation" ? op?.vessel_id ?? undefined : undefined);
        if (mode === "system" && systemVesselId)
          payload.destination_vessel_id = systemVesselId;
        else if (mode === "other" && dischargeVesselName[truckOpId])
          payload.destination_vessel_name = dischargeVesselName[truckOpId];
        await api.post(`/operations/${id}/trucks/${truckOpId}/end-discharge`, payload);
        return;
      }

      // Fallback: generic PUT for transit_start_at and any future stages
      const payload: Record<string, unknown> = {};
      if (ts) payload[stageKey] = ts;
      for (const extra of stage.extras) {
        if (form[extra.k]) {
          payload[extra.k] = extra.type === "number" ? parseFloat(form[extra.k]) : form[extra.k];
        }
      }
      if (form.notes) payload.notes = form.notes;
      await api.put(`/operations/${id}/trucks/${truckOpId}`, payload);
    },
    onSuccess: (_, { truckOpId, stageKey }) => {
      toast.success("Progress recorded");
      setActiveRecording((prev) => ({ ...prev, [truckOpId]: "" }));
      setStageForms((prev) => ({
        ...prev,
        [truckOpId]: { ...(prev[truckOpId] ?? {}), [stageKey]: {} },
      }));
      qc.invalidateQueries({ queryKey: ["operation-trucks", id] });
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  const uploadTruckDocMutation = useMutation({
    mutationFn: async ({ file, truckNumber }: { file: File; truckNumber: string }) => {
      const form = new FormData();
      form.append("file", file);
      form.append("document_type", "report");
      form.append("description", `Truck report document — ${truckNumber}`);
      await api.post(`/operations/${id}/documents/upload`, form, {
        headers: { "Content-Type": "multipart/form-data" },
      });
    },
    onSuccess: () => {
      toast.success("Document uploaded successfully");
      setUploadingTruckId(null);
      setDocFile(null);
      if (docFileRef.current) docFileRef.current.value = "";
      qc.invalidateQueries({ queryKey: ["operation-docs", id] });
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  const approveDischargeM = useMutation({
    mutationFn: async (truckOpId: string) => {
      await api.post(`/operations/${id}/trucks/${truckOpId}/approve-discharge`, {});
    },
    onSuccess: () => {
      toast.success("Discharge approved — vessel ROB updated");
      qc.invalidateQueries({ queryKey: ["operation-trucks", id] });
      qc.invalidateQueries({ queryKey: ["operation-activity", id] });
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  const editDischargeM = useMutation({
    mutationFn: async () => {
      if (!editDischargeId) return;
      const payload: Record<string, unknown> = {};
      if (editDischQty) payload.quantity_discharged_mt = parseFloat(editDischQty);
      if (editDischSpillage) payload.spillage_mt = parseFloat(editDischSpillage);
      if (editDischTemp) payload.temperature_celsius = parseFloat(editDischTemp);
      if (editDischVesselMode === "system" && editDischVesselId)
        payload.destination_vessel_id = editDischVesselId;
      else if (editDischVesselMode === "other" && editDischVesselName)
        payload.destination_vessel_name = editDischVesselName;
      if (editDischNotes) payload.notes = editDischNotes;
      await api.patch(`/operations/${id}/trucks/${editDischargeId}/discharge-record`, payload);
    },
    onSuccess: () => {
      toast.success("Discharge record updated — change logged in audit trail");
      setEditDischargeId(null);
      qc.invalidateQueries({ queryKey: ["operation-trucks", id] });
      qc.invalidateQueries({ queryKey: ["operation-activity", id] });
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  // ── Render guards
  if (isLoading) {
    return (
      <DashboardShell bare>
        <div className="space-y-4">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-9 w-64" />
          <Skeleton className="h-8 w-96" />
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_336px]">
            <div className="min-w-0 space-y-4">
              <Skeleton className="h-28 w-full rounded-2xl" />
              <Skeleton className="h-9 w-full" />
              <Skeleton className="h-80 w-full rounded-2xl" />
            </div>
            <div className="space-y-4">
              <Skeleton className="h-56 w-full rounded-2xl" />
              <Skeleton className="h-72 w-full rounded-2xl" />
            </div>
          </div>
        </div>
      </DashboardShell>
    );
  }
  if (!op) return null;

  const availableTransitions = isBM ? getAvailableTransitions(op) : [];
  const isReopenable         = isBM && REOPENABLE_STATUSES.includes(op.status);
  // Completion is now triggered from the Truck Reports tab when all stages are done

  // expected_volume_mt is the legacy single-product scalar — null on anything
  // created through the current multi-product flow, where the real per-product
  // quantities live in `products[]` instead.
  const expectedVolumeMt = resolveExpectedVolumeMt(op);

  // The barge this operation runs on. The operation itself only carries a
  // vessel_id, so fall back through the sources the page already fetches.
  const opVessel   = allVessels?.find((v) => v.id === op.vessel_id);
  const vesselName = opVessel?.vessel_name ?? vesselActivities?.[0]?.vessel_name;

  // Header overflow: everything the old badge row could do that the design's
  // three buttons don't cover. Every item in it is BM-only, so the menu is too.
  const hasMoreActions = isBM;

  // ── Page
  return (
    <DashboardShell bare>
      <DetailHeader
        backHref="/operations"
        title={op.operation_number}
        status={op.status as OperationStatus}
        meta={
          <>
            <MetaChip icon={Ship}>{OP_TYPE_LABELS[op.type]}</MetaChip>
            {op.type === "vessel_only" && op.source_type && (
              <MetaChip>{VESSEL_SOURCE_TYPE_LABELS[op.source_type]}</MetaChip>
            )}
            {op.product_type && (
              <MetaChip icon={Tag}>
                {PRODUCT_TYPE_LABELS[op.product_type as keyof typeof PRODUCT_TYPE_LABELS] ?? op.product_type}
              </MetaChip>
            )}
            {vesselName && <MetaChip icon={Anchor}>{vesselName}</MetaChip>}
            <MetaChip>{op.currency}</MetaChip>
            {op.version > 1 && (
              <MetaChip icon={GitBranch}>v{op.version}</MetaChip>
            )}
            {expectedVolumeMt != null && (
              <MetaChip icon={Droplets}>
                <span className="tabular-nums">
                  {expectedVolumeMt.toLocaleString()} L expected
                </span>
              </MetaChip>
            )}
            {op.type !== "truck_only" && op.naval_clearance && (
              <MetaChip icon={ShieldCheck}>
                {op.naval_clearance.clearance_number}
                {!op.naval_clearance.is_valid && (
                  <span className="ml-1 text-amber-600">(expired)</span>
                )}
              </MetaChip>
            )}
            {op.color && (
              <MetaChip>
                <span
                  aria-hidden="true"
                  className={cn("h-2.5 w-2.5 rounded-full border", OPERATION_COLOR_SWATCHES[op.color])}
                />
                Tagged
              </MetaChip>
            )}
            <MetaChip icon={CalendarDays}>Created {formatDateTime(op.created_at)}</MetaChip>
          </>
        }
        actions={
          <>
            {isBM && (
              <Button
                variant="outline"
                className="h-10.5 gap-2 text-[13px] font-semibold"
                onClick={() => setShowEditOperation(true)}
              >
                <Pencil className="h-4 w-4" strokeWidth={2.2} />
                Edit
              </Button>
            )}

            {isBM && (
              <Button
                variant="outline"
                className="h-10.5 gap-2 text-[13px] font-semibold"
                onClick={exportActivityCsv}
                disabled={!activityLog?.length}
              >
                <Download className="h-4 w-4" strokeWidth={2.2} />
                Export Activity
              </Button>
            )}

            {hasMoreActions && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" className="h-10.5 gap-2 text-[13px] font-semibold">
                    <MoreHorizontal className="h-4 w-4" strokeWidth={2.2} />
                    More Actions
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuLabel className="text-[11px] text-muted-foreground">
                    Operation actions
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />

                  <DropdownMenuItem className="text-[13px]" onSelect={() => setShowNotifyStaffDialog(true)}>
                    <Bell className="mr-2 h-3.5 w-3.5" />
                    Notify Staff
                  </DropdownMenuItem>

                  {op.type !== "truck_only" && (
                    op.naval_clearance ? (
                      <>
                        <DropdownMenuItem className="text-[13px]" onSelect={() => setShowNotifyDialog(true)}>
                          <Bell className="mr-2 h-3.5 w-3.5" />
                          Notify Clients
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="text-[13px] text-destructive focus:text-destructive"
                          onSelect={() => setShowUnlinkNc(true)}
                        >
                          <XCircle className="mr-2 h-3.5 w-3.5" />
                          Unlink Naval Clearance
                        </DropdownMenuItem>
                      </>
                    ) : (
                      <>
                        <DropdownMenuItem className="text-[13px]" onSelect={() => setShowLinkNc(true)}>
                          <Anchor className="mr-2 h-3.5 w-3.5" />
                          Link Naval Clearance
                        </DropdownMenuItem>
                        <DropdownMenuItem className="text-[13px]" onSelect={() => setShowCreateNc(true)}>
                          <PlusCircle className="mr-2 h-3.5 w-3.5" />
                          Create &amp; Link BFL / Naval Clearance
                        </DropdownMenuItem>
                      </>
                    )
                  )}

                  <DropdownMenuItem className="text-[13px]" onSelect={() => setShowColorPicker(true)}>
                    <Palette className="mr-2 h-3.5 w-3.5" />
                    Set operation colour
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}

            {isReopenable && (
              <Button
                className="brand-grad-active h-10.5 gap-2 text-[13px] font-semibold text-white shadow-sm"
                onClick={() => setShowReopenDialog(true)}
              >
                <RefreshCw className="h-4 w-4" strokeWidth={2.2} />
                Reopen as Revision
                <ChevronRight className="h-4 w-4" strokeWidth={2.5} />
              </Button>
            )}
          </>
        }
      />

      {/* ── Two columns: the working area, and a rail that stays put across
           every tab so the operation's identity is never more than a glance
           away. Stacks under 1280px. */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_336px]">
        <div className="min-w-0 space-y-4">

        {/* ── Vessel journey progress ── the spec's six numbered stages, at a
             glance, on every tab. Loading (1-2) happens once on the barge run;
             delivery (3-6) repeats per receiving vessel, so those four
             aggregate: a stage only counts as done once EVERY non-cancelled
             receiving vessel has reached it, and the count shows how far
             along the fleet is. */}
        {op.type === "vessel_only" && op.status !== "cancelled" && op.status !== "archived" && (() => {
          const acts = (vesselActivities ?? []).filter((a) => a.status !== "cancelled");
          if (acts.length === 0) return null;
          const legs = acts.flatMap((a) => (a.legs ?? []).filter((l) => !l.cancelled_at));
          const legsAtLeast = (stage: string) => {
            const order = LEG_STAGES.findIndex((s) => s.value === stage);
            return legs.filter((l) => {
              const idx = l.stage ? LEG_STAGES.findIndex((s) => s.value === l.stage) : -1;
              return idx >= order;
            }).length;
          };
          // Loading is a single event across the barge run, so its detail line
          // is the last recorded time; delivery repeats, so those carry the
          // fleet count instead.
          const lastOf = (pick: (a: VesselActivity) => string | undefined) => {
            const times = acts.map(pick).filter(Boolean) as string[];
            return times.length === acts.length && times.length > 0
              ? formatDayTime(times.sort().at(-1))
              : undefined;
          };
          const steps: JourneyStep[] = [
            {
              label: "Loading Commenced",
              done: acts.every((a) => !!a.commence_system_at),
              detail: lastOf((a) => a.commence_system_at),
            },
            {
              label: "Loading Completed",
              done: acts.every((a) => !!a.complete_system_at),
              detail: lastOf((a) => a.complete_system_at),
            },
            ...LEG_STAGES.map((s) => {
              const reached = legsAtLeast(s.value);
              return {
                label: s.label,
                done: legs.length > 0 && reached === legs.length,
                detail: legs.length > 0 ? `${reached}/${legs.length}` : undefined,
              };
            }),
          ];
          return <JourneyStepper steps={steps} />;
        })()}

        {/* ── Status pipeline ── the fallback for operation types that have no
             six-stage vessel journey. Shows where this operation sits in its
             own flow. */}
        {op.type !== "vessel_only" && op.status !== "cancelled" && op.status !== "archived" && (() => {
          const pipeline = STATUS_PIPELINE[op.type] ?? [];
          const currentIdx = pipeline.indexOf(op.status);
          return (
            <section
              className="animate-rise overflow-hidden rounded-2xl border border-navy-100 bg-card px-4 py-4 shadow-[0_1px_2px_rgb(16_36_71/0.04)] dark:border-border lg:px-5"
              aria-label="Operation pipeline"
            >
              <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
                Pipeline
              </p>
              <div className="scrollbar-slim mt-3 overflow-x-auto pb-1">
                <div className="flex min-w-max items-center">
                  {pipeline.map((st, i) => {
                    const isPast    = i < currentIdx;
                    const isCurrent = i === currentIdx;
                    return (
                      <div key={st} className="flex items-center">
                        {i > 0 && (
                          <span
                            aria-hidden="true"
                            className={cn(
                              "mx-1 h-0.5 w-5 rounded-full",
                              isPast || isCurrent ? "bg-emerald-500" : "bg-border"
                            )}
                          />
                        )}
                        <span
                          aria-current={isCurrent ? "step" : undefined}
                          className={cn(
                            "inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-[11px] font-semibold",
                            isCurrent
                              ? "brand-grad-active text-white shadow-sm"
                              : isPast
                                ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300"
                                : "bg-muted text-muted-foreground/60"
                          )}
                        >
                          {isPast && <CheckCircle2 className="h-3 w-3" strokeWidth={2.5} />}
                          {PIPELINE_LABELS[st] ?? st.replace(/_/g, " ")}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </section>
          );
        })()}

        {/* ── BM: Pending Completion review card */}
        {isBM && op.status === "pending_completion" && (
          <Card className="rounded-2xl border border-amber-200 bg-amber-50/50 shadow-[0_1px_2px_rgb(16_36_71/0.04)] dark:border-amber-500/30 dark:bg-amber-500/10">
            <CardContent className="p-4 space-y-3">
              <div className="flex items-start gap-3">
                <ClipboardCheck className="w-5 h-5 text-amber-600 mt-0.5 shrink-0" />
                <div className="flex-1">
                  <p className="text-sm font-semibold text-amber-800">Completion Report Submitted</p>
                  {op.completion_notes ? (
                    <p className="text-sm text-amber-700 mt-1">{op.completion_notes}</p>
                  ) : (
                    <p className="text-xs text-muted-foreground mt-0.5">
                      No completion notes provided. Review the timeline for details.
                    </p>
                  )}
                  {/* Which BDN gates completion depends on the operation type —
                       a Vessel Only operation never involves a Truck BDN. */}
                  <p className="text-xs text-amber-700/80 mt-1.5">
                    {op.type === "vessel_only" ? (
                      <>
                        Awaiting the Ops Supervisor / Marine Manager to submit a Vessel BDN for each
                        receiving vessel (Vessel BDN tab) — the operation completes once every one is approved.
                      </>
                    ) : op.type === "truck_only" ? (
                      <>
                        Awaiting the Ops Supervisor / Logistics Officer to submit a Truck BDN for this
                        delivery (Truck BDN tab) — the operation completes once it&apos;s approved.
                      </>
                    ) : (
                      <>
                        Awaiting the Truck BDN and every vessel run&apos;s Vessel BDN — the operation
                        completes once all of them are approved.
                      </>
                    )}
                  </p>
                </div>
              </div>
              <div className="flex gap-2 flex-wrap pt-1">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={transitionMutation.isPending}
                  onClick={() => transitionMutation.mutate({ to_status: "active", reason: "Returned to active by BM" })}
                >
                  {transitionMutation.isPending
                    ? <Spinner size={14} className="mr-1.5" />
                    : <XCircle className="w-3.5 h-3.5 mr-1.5" />}
                  Return to Active
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* ── BM: PFI Activation Gate (vessel / full operations only) */}
        {isBM && op.type !== "truck_only" && (
          (() => {
            const preActivationStatuses = ["draft", "tasks_assigned", "awaiting_feedback", "feedback_submitted", "feedback_rejected"];
            const isPreActivation = preActivationStatuses.includes(op.status);
            if (!isPreActivation) return null;

            const hasPfi = (pfis?.length ?? 0) > 0;
            const latestPfi = pfis?.[0];

            return hasPfi ? (
              <Card className="rounded-2xl border border-emerald-200 bg-emerald-50/50 shadow-[0_1px_2px_rgb(16_36_71/0.04)] dark:border-emerald-500/30 dark:bg-emerald-500/10">
                <CardContent className="p-4 flex items-center gap-3">
                  <ShieldCheck className="w-5 h-5 text-emerald-600 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-emerald-800">PFI Linked</p>
                    <p className="text-xs text-emerald-700 mt-0.5">
                      {latestPfi?.currency} {parseFloat(latestPfi?.amount ?? "0").toLocaleString()}
                      {latestPfi?.supplier_name ? ` · ${latestPfi.supplier_name}` : ""}
                      {" · "}{formatDate(latestPfi?.created_at ?? "")}
                    </p>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <Card className="rounded-2xl border border-amber-200 bg-amber-50/50 shadow-[0_1px_2px_rgb(16_36_71/0.04)] dark:border-amber-500/30 dark:bg-amber-500/10">
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-amber-800">No PFI Linked</p>
                      <p className="text-xs text-amber-700 mt-0.5">
                        Optionally link a Proforma Invoice to this operation.
                      </p>
                    </div>
                    {isBM && !showLinkPfi && (
                      <Button size="sm" variant="outline" className="h-7 text-xs shrink-0" onClick={() => setShowLinkPfi(true)}>
                        Link PFI
                      </Button>
                    )}
                  </div>
                  {isBM && showLinkPfi && (
                    <div className="grid grid-cols-1 sm:grid-cols-[1fr_120px_auto] gap-2 items-end pt-1 border-t border-amber-200/60">
                      <div className="space-y-1">
                        <Label className="text-[10px]">Select a PFI</Label>
                        <Select value={linkPfiId} onValueChange={setLinkPfiId}>
                          <SelectTrigger className="h-8 text-xs bg-white"><SelectValue placeholder="Select PFI…" /></SelectTrigger>
                          <SelectContent>
                            {unlinkedPfis?.map((p) => (
                              <SelectItem key={p.id} value={p.id} className="text-xs">
                                {p.pfi_number} — {p.currency} {parseFloat(p.amount).toLocaleString()}
                                {p.remaining_litres != null ? ` (${parseFloat(p.remaining_litres).toLocaleString()} L left)` : ""}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[10px]">Quantity (L)</Label>
                        <Input
                          type="number" min="0" step="0.01" className="h-8 text-xs bg-white"
                          value={linkQuantity} onChange={(e) => setLinkQuantity(e.target.value)}
                        />
                      </div>
                      <Button
                        size="sm" className="h-8 text-xs"
                        disabled={!linkPfiId || !linkQuantity || parseFloat(linkQuantity) <= 0 || linkPfiMutation.isPending}
                        onClick={() => linkPfiMutation.mutate()}
                      >
                        {linkPfiMutation.isPending ? <Spinner size={14} /> : "Link"}
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })()
        )}

        {/* ── BM: Standard transition card */}
        {isBM && availableTransitions.length > 0 && op.status !== "pending_completion" && (
          <Card className="rounded-2xl border border-brand-200 bg-brand-50/50 shadow-[0_1px_2px_rgb(16_36_71/0.04)] dark:border-brand-500/30 dark:bg-brand-500/10">
            <CardContent className="p-4 flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-semibold">Stage Transition</p>
                <p className="text-xs text-muted-foreground">
                  Move this operation to its next stage.
                  {op.status === "draft" && (
                    <span className="text-amber-600 font-medium ml-1">
                      Assign tasks in the Tasks tab first.
                    </span>
                  )}
                </p>
              </div>
              <div className="flex gap-2 flex-wrap">
                {availableTransitions.map((t) => (
                  <Button
                    key={t.to}
                    size="sm"
                    variant={t.destructive ? "destructive" : "default"}
                    disabled={transitionMutation.isPending}
                    onClick={() => (t.to === "completed" ? setShowCloseDialog(true) : setShowTransitionConfirm(t))}
                  >
                    {transitionMutation.isPending
                      ? <Spinner size={14} className="mr-1.5" />
                      : <ChevronRight className="w-3.5 h-3.5 mr-1.5" />}
                    {t.label}
                  </Button>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* ── BM: role-aware "next step" hint (states the BM doesn't action) */}
        {isBM && availableTransitions.length === 0 && (() => {
          const hint = getNextStepHint(op);
          if (!hint) return null;
          return (
            <Card className="rounded-2xl border border-navy-100 shadow-[0_1px_2px_rgb(16_36_71/0.04)] dark:border-border bg-accent/10">
              <CardContent className="p-4 flex items-start gap-3">
                <Clock className="w-4 h-4 text-accent-foreground/70 mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm font-semibold">
                    Next step · <span className="text-accent-foreground">{hint.who}</span>
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">{hint.text}</p>
                </div>
              </CardContent>
            </Card>
          );
        })()}

        {/* ── Full operation: load the vessel via trucks before starting vessel ops */}
        {isBM && op.type === "full_operation" && op.status === "active" && (
          <Card className="rounded-2xl border border-amber-200 bg-amber-50/50 shadow-[0_1px_2px_rgb(16_36_71/0.04)] dark:border-amber-500/30 dark:bg-amber-500/10">
            <CardContent className="p-4 flex items-start gap-3">
              <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-semibold text-amber-800">Load the vessel first</p>
                <p className="text-xs text-amber-700/90 mt-0.5">
                  This is a full operation: record all truck discharges into the vessel
                  (Truck Reports tab) <strong>before</strong> starting vessel operations. The
                  vessel&rsquo;s ROB is captured when vessel ops begin — starting early snapshots
                  a stale figure.
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Completion report is now handled via the Truck Reports tab progress tracker */}

            <Tabs value={activeTab} onValueChange={setActiveTab} className="animate-rise">
              <TabsList variant="underline">
                <TabsTrigger value="overview">Overview</TabsTrigger>

                {canSeeTasks && (
                  <TabsTrigger value="tasks">
                    Tasks
                    <TabCount value={tasks?.length} />
                  </TabsTrigger>
                )}

                {canSeeFeedback && op.type !== "vessel_only" && (
                  <TabsTrigger value="feedback">
                    Feedback
                    <TabCount
                      value={feedbacks?.length}
                      accent={feedbacks?.some((f) => f.status === "pending")}
                    />
                  </TabsTrigger>
                )}

                {canSeeBDN && (
                  <TabsTrigger value="bdns">
                    BDNs
                    <TabCount value={bdns?.length} />
                  </TabsTrigger>
                )}

                {canSeeTruckBdn && op.type === "truck_only" && (
                  <TabsTrigger value="truck-bdns">
                    Truck BDN
                    <TabCount value={truckBdns?.length} />
                  </TabsTrigger>
                )}

                {canSeeMarine && (
                  <TabsTrigger value="marine">
                    Marine
                    <TabCount
                      value={vesselActivities?.length}
                      accent={vesselActivities?.some((a) => a.status === "active")}
                    />
                  </TabsTrigger>
                )}

                {/* Full Operation now records GOV/GSV/MT on the BDNs tab itself
                     (the one actually used) and that tab's approval drives ROB —
                     this tab would be a pure duplicate there, so it's scoped to
                     vessel_only, where it's still the only per-receiving-vessel
                     delivery record that exists. */}
                {canSeeVesselBdn && op.type === "vessel_only" && (
                  <TabsTrigger value="vessel-bdns">
                    Vessel Received Quantity
                    <TabCount value={vesselBdns?.length} />
                  </TabsTrigger>
                )}

                {isBM && op.type !== "truck_only" && (
                  <TabsTrigger value="kpi">KPI</TabsTrigger>
                )}

                {(isLO || isBM || isOS) && op.type !== "vessel_only" && (
                  <TabsTrigger value="truck-reports">
                    Truck Reports
                    <TabCount value={truckOps?.length} />
                  </TabsTrigger>
                )}

                <TabsTrigger value="documents">
                  Docs
                  <TabCount value={docs?.length} />
                </TabsTrigger>

                {isBM && (
                  <TabsTrigger value="activity">
                    Activity
                    <TabCount value={activityLog?.length} />
                  </TabsTrigger>
                )}

              </TabsList>

              {/* ── Overview tab */}
              <TabsContent value="overview" className="mt-4 space-y-4">
                {/* Definition grid — the operation's own record, two columns */}
                <section className="overflow-hidden rounded-2xl border border-navy-100 bg-card p-4 shadow-[0_1px_2px_rgb(16_36_71/0.04)] dark:border-border lg:p-5">
                  <dl className="grid grid-cols-1 gap-x-8 gap-y-5 sm:grid-cols-2">
                    <InfoItem label="Operation Number" value={op.operation_number} mono />
                    <InfoItem label="Type" value={OP_TYPE_LABELS[op.type]} />
                    {op.product_type && (
                      <InfoItem
                        label="Product"
                        value={PRODUCT_TYPE_LABELS[op.product_type as keyof typeof PRODUCT_TYPE_LABELS] ?? op.product_type}
                      />
                    )}
                    <InfoItem label="Currency" value={op.currency} />
                    {op.loading_location && (
                      <InfoItem label="Loading Location" value={op.loading_location} />
                    )}
                    {op.discharge_location && (
                      <InfoItem label="Discharge Location" value={op.discharge_location} />
                    )}
                    <InfoItem
                      label="Expected Volume (L)"
                      value={expectedVolumeMt != null ? expectedVolumeMt.toLocaleString() : "—"}
                      numeric
                    />
                    <InfoItem
                      label="Actual Volume (L)"
                      value={op.actual_volume_mt ? parseFloat(op.actual_volume_mt).toLocaleString() : "—"}
                      numeric
                    />
                    <InfoItem label="Version" value={`v${op.version ?? 1}`} numeric />
                    <InfoItem label="Created" value={formatDateTime(op.created_at)} numeric />
                    <InfoItem label="Last Updated" value={formatDateTime(op.updated_at)} numeric />
                    <InfoItem
                      label="Completed"
                      value={op.completed_at ? formatDateTime(op.completed_at) : "—"}
                      numeric
                    />
                    {op.version_notes && (
                      <InfoItem label="Revision Notes" value={op.version_notes} wide muted />
                    )}
                    {op.completion_notes && (
                      <InfoItem label="Completion Notes" value={op.completion_notes} wide />
                    )}
                    {op.notes && <InfoItem label="Notes" value={op.notes} wide />}
                  </dl>
                </section>

                {/* Supporting detail — vessel, parties, documents */}
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                  {opVessel && (
                    <PanelCard icon={Ship} title="Vessel Details" className="relative isolate overflow-hidden">
                      {/* Decorative — ornament, never data. */}
                      <Ship
                        aria-hidden="true"
                        className="pointer-events-none absolute -bottom-5 -right-4 -z-10 h-28 w-28 text-brand-500/8"
                        strokeWidth={1}
                      />
                      <dl className="space-y-3.5">
                        <InfoItem label="Vessel Name" value={opVessel.vessel_name} />
                        <InfoItem label="Vessel Type" value={opVessel.vessel_type} />
                        <InfoItem label="IMO Number" value={`IMO ${opVessel.imo_number}`} numeric />
                        {opVessel.flag_state && (
                          <InfoItem label="Flag State" value={opVessel.flag_state} />
                        )}
                      </dl>
                    </PanelCard>
                  )}

                  {/* The model carries a client and a creator — there are no
                      charterer / supplier / trader fields to show. */}
                  {(op.client || op.creator) && (
                    <PanelCard icon={Users} tone="violet" title="Parties">
                      <dl className="space-y-3.5">
                        {op.client && (
                          <InfoItem label="Client" value={op.client.full_name} hint={op.client.email} />
                        )}
                        {op.creator && (
                          <InfoItem
                            label="Created By"
                            value={op.creator.full_name}
                            hint={ROLE_LABELS[op.creator.role] ?? op.creator.role}
                          />
                        )}
                      </dl>
                    </PanelCard>
                  )}

                  {docs && docs.length > 0 && (
                    <PanelCard
                      icon={FileText}
                      tone="sky"
                      title={`Documents (${docs.length})`}
                      action={
                        <button
                          type="button"
                          className="rounded text-[12px] font-semibold text-brand-600 transition-colors hover:text-brand-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                          onClick={() => setActiveTab("documents")}
                        >
                          View all
                        </button>
                      }
                    >
                      <ul className="space-y-2.5">
                        {docs.slice(0, 4).map((doc) => (
                          <li key={doc.id} className="flex items-center justify-between gap-3">
                            <span className="flex min-w-0 items-center gap-2">
                              <FileText className="h-3.5 w-3.5 shrink-0 text-muted-foreground" strokeWidth={2} />
                              <span className="truncate text-[13px] font-medium text-foreground">
                                {doc.file_name}
                              </span>
                            </span>
                            <Badge
                              variant="secondary"
                              className="shrink-0 rounded-lg px-2 text-[10px] font-semibold"
                            >
                              {DOC_TYPE_LABELS[doc.document_type] ?? doc.document_type}
                            </Badge>
                          </li>
                        ))}
                        {docs.length > 4 && (
                          <li className="flex items-center justify-between gap-3 pt-0.5">
                            <span className="text-[12px] text-muted-foreground">More documents</span>
                            <Badge variant="secondary" className="shrink-0 rounded-lg px-2 text-[10px] tabular-nums">
                              +{docs.length - 4}
                            </Badge>
                          </li>
                        )}
                      </ul>
                    </PanelCard>
                  )}
                </div>

                {/* Version history */}
                {versions && versions.length > 1 && (
                  <PanelCard
                    icon={GitBranch}
                    tone="amber"
                    title={`Operation Versions (${versions.length})`}
                    subtitle="Each reopen creates a linked revision"
                    flush
                  >
                    <div className="divide-y divide-border/70">
                      {versions.map((v) => (
                        <button
                          key={v.id}
                          type="button"
                          disabled={v.id === id}
                          className={cn(
                            "flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition-colors lg:px-5",
                            v.id === id ? "bg-brand-50/60 dark:bg-brand-500/10" : "hover:bg-muted/50"
                          )}
                          onClick={() => v.id !== id && router.push(`/operations/${v.id}`)}
                        >
                          <div className="min-w-0">
                            <p className="truncate font-mono text-[13px] font-semibold text-foreground">
                              {v.operation_number}
                            </p>
                            {v.version_notes && (
                              <p className="truncate text-[11px] italic text-muted-foreground">
                                {v.version_notes}
                              </p>
                            )}
                          </div>
                          <div className="flex shrink-0 items-center gap-2">
                            <StatusBadge status={v.status} />
                            {v.id === id && (
                              <Badge variant="secondary" className="text-[10px]">current</Badge>
                            )}
                          </div>
                        </button>
                      ))}
                    </div>
                  </PanelCard>
                )}
              </TabsContent>

              {/* ── Tasks tab */}
              {canSeeTasks && (
                <TabsContent value="tasks" className="mt-4 space-y-3">
                  {isBM && (
                    <div className="flex items-center justify-between">
                      <p className="text-xs text-muted-foreground">
                        Assign individual tasks to staff members.
                      </p>
                      <Button size="sm" onClick={() => setShowAssignTask(true)}>
                        <PlusCircle className="w-4 h-4 mr-1.5" />
                        Assign Task
                      </Button>
                    </div>
                  )}
                  <Card className="rounded-2xl border border-navy-100 shadow-[0_1px_2px_rgb(16_36_71/0.04)] dark:border-border">
                    <CardContent className="p-0">
                      {tasks?.length ? (
                        <div className="divide-y">
                          {tasks.map((task) => (
                            <div key={task.id} className="flex items-start justify-between px-5 py-3 gap-4">
                              <div className="min-w-0 flex-1">
                                <p className="text-sm font-medium capitalize">
                                  {task.task_type.replace(/_/g, " ")}
                                </p>
                                {task.assignee && (
                                  <p className="text-xs text-muted-foreground mt-0.5">
                                    Assigned to: <span className="font-medium">{task.assignee.full_name}</span>
                                    {" · "}{ROLE_LABELS[task.assignee.role] ?? task.assignee.role}
                                  </p>
                                )}
                                <p className="text-xs text-muted-foreground">
                                  Priority: <span className="capitalize">{task.priority}</span>
                                  {" · "}Created: {formatDateTime(task.created_at)}
                                </p>
                                {task.instructions && (
                                  <p className="text-xs text-muted-foreground mt-0.5 italic truncate max-w-xs">
                                    {task.instructions}
                                  </p>
                                )}
                              </div>
                              <div className="flex items-center gap-2 shrink-0">
                                <Badge
                                  variant={
                                    task.status === "completed" ? "default"
                                    : task.status === "cancelled" ? "destructive"
                                    : "secondary"
                                  }
                                  className="text-xs capitalize"
                                >
                                  {task.status}
                                </Badge>
                                {isBM && task.status !== "cancelled" && task.status !== "completed" && (
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-7 w-7 text-muted-foreground hover:text-destructive"
                                    disabled={cancelTaskMutation.isPending}
                                    onClick={() => cancelTaskMutation.mutate(task.id as string)}
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </Button>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-sm text-muted-foreground text-center py-8">
                          No tasks assigned yet
                        </p>
                      )}
                    </CardContent>
                  </Card>
                </TabsContent>
              )}

              {/* ── Feedback tab — truck-nomination readiness, never applicable to vessel-only operations */}
              {canSeeFeedback && op.type !== "vessel_only" && (
                <TabsContent value="feedback" className="mt-4 space-y-3">
                  {/* LO submission form — also reachable by BM (unrestricted edit power). Trucks
                      can be nominated/added at any point in the operation's lifecycle, not just
                      while awaiting_feedback — no status gate here by design. */}
                  {(isLO || isBM) && (
                    <Card className="rounded-2xl border border-navy-100 shadow-[0_1px_2px_rgb(16_36_71/0.04)] dark:border-border">
                      <CardContent className="p-5 space-y-4">
                        <>
                            <div>
                              <p className="text-sm font-semibold mb-1">Nominate Trucks & Submit Readiness</p>
                              <p className="text-xs text-muted-foreground">
                                Select which trucks from the fleet you are nominating for this operation, then confirm their readiness status.
                              </p>
                            </div>

                            <div className="space-y-1.5">
                              <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                                Nominate Trucks *
                              </Label>

                              {/* Search-or-create by plate number */}
                              <div className="relative">
                                <Input
                                  placeholder="Type a plate number to find or add a truck…"
                                  value={plateSearch}
                                  onChange={(e) => setPlateSearch(e.target.value)}
                                  disabled={!fleetTrucks}
                                />
                                {plateSearch.trim() && (
                                  <div className="absolute z-10 mt-1 w-full rounded-md border bg-popover shadow-md max-h-52 overflow-y-auto">
                                    {(() => {
                                      const q = plateSearch.trim().toLowerCase();
                                      const matches = (fleetTrucks ?? []).filter(
                                        (t) => t.truck_number.toLowerCase().includes(q) && !loSelectedTrucks.includes(t.id)
                                      );
                                      return (
                                        <>
                                          {matches.map((t) => (
                                            <button
                                              key={t.id}
                                              type="button"
                                              className="w-full text-left px-3 py-2 text-sm hover:bg-muted flex items-center justify-between gap-2"
                                              onClick={() => {
                                                setLoSelectedTrucks((prev) => [...prev, t.id]);
                                                setPlateSearch("");
                                              }}
                                            >
                                              <span className="font-medium">{t.truck_number}</span>
                                              {t.capacity_mt && (
                                                <span className="text-xs text-muted-foreground">{parseFloat(t.capacity_mt).toLocaleString()} L</span>
                                              )}
                                            </button>
                                          ))}
                                          {matches.length === 0 && (
                                            <div className="px-3 py-2 text-xs text-muted-foreground">No matching truck in fleet.</div>
                                          )}
                                          <button
                                            type="button"
                                            className="w-full text-left px-3 py-2 text-sm text-primary hover:bg-muted border-t flex items-center gap-1.5"
                                            onClick={() => {
                                              setNewTruckNumber(plateSearch.trim());
                                              setShowCreateTruckDialog(true);
                                            }}
                                          >
                                            <PlusCircle className="w-3.5 h-3.5" />
                                            Create new truck &quot;{plateSearch.trim()}&quot;
                                          </button>
                                        </>
                                      );
                                    })()}
                                  </div>
                                )}
                              </div>

                              {/* Selected trucks — driver captured inline, per truck */}
                              {loSelectedTrucks.length > 0 && (
                                <div className="space-y-2 mt-2">
                                  {loSelectedTrucks.map((truckId) => {
                                    const truck = fleetTrucks?.find((t) => t.id === truckId);
                                    const details = loTruckDetails[truckId] ?? { driver_name: "", driver_phone: "", vendor_name: "" };
                                    return (
                                      <div key={truckId} className="border rounded-md p-2.5 space-y-1.5">
                                        <div className="flex items-center justify-between">
                                          <span className="text-sm font-semibold">{truck?.truck_number ?? "New truck"}</span>
                                          <button
                                            type="button"
                                            className="text-muted-foreground hover:text-destructive"
                                            onClick={() => setLoSelectedTrucks((prev) => prev.filter((i) => i !== truckId))}
                                          >
                                            <Trash2 className="w-3.5 h-3.5" />
                                          </button>
                                        </div>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                          <Input
                                            className="h-8 text-xs" placeholder="Driver name"
                                            value={details.driver_name}
                                            onChange={(e) => setLoTruckDetail(truckId, "driver_name", e.target.value)}
                                          />
                                          <Input
                                            className="h-8 text-xs" placeholder="Driver phone"
                                            value={details.driver_phone}
                                            onChange={(e) => setLoTruckDetail(truckId, "driver_phone", e.target.value)}
                                          />
                                        </div>
                                        <Input
                                          className="h-8 text-xs" placeholder="Vendor (optional)"
                                          value={details.vendor_name}
                                          onChange={(e) => setLoTruckDetail(truckId, "vendor_name", e.target.value)}
                                        />
                                      </div>
                                    );
                                  })}
                                  <p className="text-xs text-emerald-600 font-medium">
                                    {loSelectedTrucks.length} truck{loSelectedTrucks.length > 1 ? "s" : ""} nominated
                                  </p>
                                </div>
                              )}
                            </div>

                            <div className="space-y-1.5">
                              <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                                Readiness Summary *
                              </Label>
                              <Textarea
                                placeholder="Describe the overall truck readiness status…"
                                rows={3}
                                className="resize-none"
                                value={loSummary}
                                onChange={(e) => setLoSummary(e.target.value)}
                              />
                            </div>

                            <div className="space-y-1.5">
                              <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                                Additional Notes <span className="normal-case font-normal">(optional)</span>
                              </Label>
                              <Textarea
                                placeholder="Any issues, delays, or specific truck notes…"
                                rows={2}
                                className="resize-none"
                                value={loNotes}
                                onChange={(e) => setLoNotes(e.target.value)}
                              />
                            </div>

                            <div className="flex justify-end">
                              <Button
                                disabled={loSelectedTrucks.length === 0 || loSummary.trim().length < 5 || submitFeedbackMutation.isPending}
                                onClick={() => submitFeedbackMutation.mutate()}
                              >
                                {submitFeedbackMutation.isPending && <Spinner size={16} className="mr-1.5" />}
                                Submit Feedback
                              </Button>
                            </div>
                        </>

                        {!!feedbacks?.length && (
                          <div className="pt-4 border-t space-y-2">
                            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Your Submissions</p>
                            {/* Full details always shown, regardless of approval status —
                                a submission never collapses to just a status badge. */}
                            {feedbacks.map((fb) => (
                              <div key={fb.id} className="rounded-md bg-muted/50 px-3 py-2.5 space-y-2">
                                <div className="flex items-center justify-between gap-2">
                                  <span className="text-xs text-muted-foreground">
                                    v{fb.version} · Submitted {formatDateTime(fb.submitted_at)}
                                  </span>
                                  <Badge
                                    variant={fb.status === "approved" ? "default" : fb.status === "rejected" ? "destructive" : "secondary"}
                                    className="text-xs capitalize shrink-0"
                                  >
                                    {fb.status}
                                  </Badge>
                                </div>
                                <p className="text-sm">{fb.readiness_summary}</p>
                                {Array.isArray(fb.truck_ids) && fb.truck_ids.length > 0 && (
                                  <div className="flex flex-wrap gap-1.5">
                                    {(fb.truck_ids as string[]).map((tid, i) => {
                                      const t = resolveTruckDisplay(tid, fb);
                                      return (
                                        <span
                                          key={tid}
                                          className="text-[11px] bg-background border px-2 py-0.5 rounded font-mono"
                                          title={[t.driverName, t.driverPhone, t.vendorName].filter(Boolean).join(" · ") || undefined}
                                        >
                                          <span className="mr-1 font-sans font-semibold tabular-nums text-muted-foreground">
                                            {i + 1}.
                                          </span>
                                          {t.truckNumber ?? `${tid.slice(0, 8)}…`}
                                        </span>
                                      );
                                    })}
                                  </div>
                                )}
                                {fb.status === "rejected" && fb.rejection_reason && (
                                  <p className="text-xs text-rose-700">
                                    <span className="font-semibold">Rejection reason:</span> {fb.rejection_reason}
                                  </p>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  )}

                  {/* BM review panel */}
                  {isBM && !feedbacks?.length && (
                    <Card className="rounded-2xl border border-navy-100 shadow-[0_1px_2px_rgb(16_36_71/0.04)] dark:border-border">
                      <CardContent className="p-0">
                        <div className="flex flex-col items-center py-12 text-muted-foreground">
                          <Truck className="w-10 h-10 mb-3 opacity-30" />
                          <p className="text-sm">No feedback submitted yet</p>
                          <p className="text-xs mt-1">
                            Logistics Officers submit feedback once the operation is &ldquo;Awaiting Feedback&rdquo;.
                          </p>
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  {isBM && feedbacks?.map((fb) => {
                    const isPending   = fb.status === "pending";
                    const isApproved  = fb.status === "approved";
                    const isRejecting = rejectFeedbackId === fb.id;
                    const isApproving = approvingFeedbackId === fb.id;
                    const fbNotes     = (fb.truck_details as Record<string, string>)?.notes;

                    return (
                      <Card
                        key={fb.id}
                        className={cn(
                          "rounded-2xl border shadow-[0_1px_2px_rgb(16_36_71/0.04)]",
                          isPending    ? "border-amber-200 bg-amber-50/40 dark:border-amber-500/30 dark:bg-amber-500/10"
                          : isApproved ? "border-emerald-200 bg-emerald-50/30 dark:border-emerald-500/30 dark:bg-emerald-500/10"
                          : "border-rose-200 bg-rose-50/30 dark:border-rose-500/30 dark:bg-rose-500/10"
                        )}
                      >
                        <CardContent className="p-5 space-y-4">
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className={`text-xs font-semibold px-2 py-0.5 rounded capitalize ${
                                  isPending  ? "bg-amber-100 text-amber-700"
                                  : isApproved ? "bg-emerald-100 text-emerald-700"
                                  : "bg-rose-100 text-rose-700"
                                }`}>
                                  {fb.status}
                                </span>
                                <span className="text-xs text-muted-foreground">
                                  v{fb.version} · Submitted {formatDateTime(fb.submitted_at)}
                                </span>
                              </div>
                              <p className="text-sm font-medium mt-1.5">{fb.readiness_summary}</p>
                              {fbNotes && (
                                <p className="text-sm text-muted-foreground mt-1 italic">{fbNotes}</p>
                              )}
                            </div>
                            {isPending && !isRejecting && !isApproving && (
                              <div className="flex gap-2 shrink-0">
                                <Button
                                  size="sm"
                                  className="h-8 text-xs bg-emerald-600 hover:bg-emerald-700"
                                  onClick={() => setApprovingFeedbackId(fb.id)}
                                >
                                  <CheckCircle2 className="w-3 h-3 mr-1" />
                                  Approve
                                </Button>
                                <Button
                                  size="sm"
                                  variant="destructive"
                                  className="h-8 text-xs"
                                  onClick={() => setRejectFeedbackId(fb.id)}
                                >
                                  <XCircle className="w-3 h-3 mr-1" />
                                  Reject
                                </Button>
                              </div>
                            )}
                            {isApproved && (
                              <span className="text-xs text-emerald-700 flex items-center gap-1 shrink-0">
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                Approved {fb.reviewed_at ? formatDate(fb.reviewed_at) : ""}
                              </span>
                            )}
                            {fb.status === "rejected" && (
                              <span className="text-xs text-rose-700 flex items-center gap-1 shrink-0">
                                <XCircle className="w-3.5 h-3.5" />
                                Rejected
                              </span>
                            )}
                          </div>

                          {Array.isArray(fb.truck_ids) && fb.truck_ids.length > 0 && (
                            <div>
                              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">
                                Trucks ({fb.truck_ids.length})
                              </p>
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                                {(fb.truck_ids as string[]).map((tid, i) => {
                                  const t = resolveTruckDisplay(tid, fb);
                                  return (
                                    <Link
                                      key={tid}
                                      href={`/fleet/${tid}`}
                                      className="flex items-center justify-between gap-2 text-xs bg-background hover:bg-primary/5 border px-2.5 py-1.5 rounded-md transition-colors"
                                    >
                                      <span className="flex min-w-0 items-center gap-1.5">
                                        <span className="w-4 shrink-0 text-right font-semibold tabular-nums text-muted-foreground">
                                          {i + 1}.
                                        </span>
                                        <span className="truncate font-mono font-semibold text-primary">
                                          {t.truckNumber ?? `${tid.slice(0, 8)}…`}
                                        </span>
                                      </span>
                                      <span className="text-muted-foreground truncate text-[11px]">
                                        {[t.driverName, t.driverPhone, t.vendorName].filter(Boolean).join(" · ") || (t.capacityMt ? `${parseFloat(t.capacityMt).toLocaleString()} L` : "")}
                                      </span>
                                    </Link>
                                  );
                                })}
                              </div>
                            </div>
                          )}

                          {fb.rejection_reason && (
                            <div className="rounded-md bg-rose-50 border border-rose-200 px-3 py-2">
                              <p className="text-xs font-semibold text-rose-700 flex items-center gap-1 mb-0.5">
                                <AlertTriangle className="w-3 h-3" /> Rejection Reason
                              </p>
                              <p className="text-xs text-rose-700">{fb.rejection_reason}</p>
                            </div>
                          )}

                          {isApproving && (
                            <div className="space-y-2 pt-2 border-t">
                              <p className="text-xs font-semibold text-emerald-700">Approval comment (optional)</p>
                              <textarea
                                className="w-full text-sm border rounded-md px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-ring"
                                rows={2}
                                placeholder="Add an optional note to your approval…"
                                value={approveComment}
                                onChange={(e) => setApproveComment(e.target.value)}
                              />
                              <div className="flex gap-2 justify-end">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-7 text-xs"
                                  onClick={() => { setApprovingFeedbackId(null); setApproveComment(""); }}
                                >
                                  Cancel
                                </Button>
                                <Button
                                  size="sm"
                                  className="h-7 text-xs bg-emerald-600 hover:bg-emerald-700"
                                  disabled={approveFeedbackMutation.isPending}
                                  onClick={() => approveFeedbackMutation.mutate({
                                    feedbackId: fb.id,
                                    comment: approveComment.trim() || undefined,
                                  })}
                                >
                                  {approveFeedbackMutation.isPending && <Spinner size={12} className="mr-1" />}
                                  Confirm Approval
                                </Button>
                              </div>
                            </div>
                          )}

                          {isRejecting && (
                            <div className="space-y-2 pt-2 border-t">
                              <p className="text-xs font-semibold text-destructive">Rejection reason (min 10 chars)</p>
                              <textarea
                                className="w-full text-sm border rounded-md px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-ring"
                                rows={3}
                                placeholder="Explain why this feedback is being rejected…"
                                value={rejectReason}
                                onChange={(e) => setRejectReason(e.target.value)}
                              />
                              <div className="flex gap-2 justify-end">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-7 text-xs"
                                  onClick={() => { setRejectFeedbackId(null); setRejectReason(""); }}
                                >
                                  Cancel
                                </Button>
                                <Button
                                  size="sm"
                                  variant="destructive"
                                  className="h-7 text-xs"
                                  disabled={rejectReason.trim().length < 10 || rejectFeedbackMutation.isPending}
                                  onClick={() => rejectFeedbackMutation.mutate({ feedbackId: fb.id, reason: rejectReason.trim() })}
                                >
                                  {rejectFeedbackMutation.isPending && <Spinner size={12} className="mr-1" />}
                                  Confirm Reject
                                </Button>
                              </div>
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    );
                  })}
                </TabsContent>
              )}

              {/* ── BDNs tab */}
              {canSeeBDN && (
                <TabsContent value="bdns" className="mt-4 space-y-4">

                  {/* MM: Create BDN form */}
                  {isMM && !["completed", "cancelled", "archived"].includes(op.status) && (
                    <Card className="rounded-2xl border border-navy-100 shadow-[0_1px_2px_rgb(16_36_71/0.04)] dark:border-border">
                      <CardHeader className="pb-3 pt-4 px-5">
                        <div className="flex items-center justify-between">
                          <CardTitle className="text-[15px] font-bold tracking-tight">
                            {bdns?.length ? "Submit Another BDN" : "Submit Bunker Delivery Note"}
                          </CardTitle>
                          {(bdns?.length ?? 0) > 0 && (
                            <Button
                              size="sm"
                              variant={showBdnForm ? "outline" : "default"}
                              onClick={() => setShowBdnForm((v) => !v)}
                            >
                              {showBdnForm ? "Cancel" : <><PlusCircle className="w-3.5 h-3.5 mr-1.5" />New BDN</>}
                            </Button>
                          )}
                        </div>
                      </CardHeader>

                      {(!bdns?.length || showBdnForm) && (
                        <CardContent className="px-5 pb-5 space-y-3 border-t pt-4">
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div className="space-y-1.5">
                              <Label className="text-xs">Vessel <span className="text-destructive">*</span></Label>
                              <Select value={bdnVesselId} onValueChange={setBdnVesselId}>
                                <SelectTrigger className="h-8 text-xs">
                                  <SelectValue placeholder="Select vessel…" />
                                </SelectTrigger>
                                <SelectContent>
                                  {allVessels?.map((v) => (
                                    <SelectItem key={v.id} value={v.id} className="text-xs">
                                      {v.vessel_name}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="space-y-1.5">
                              <Label className="text-xs">Quantity Loaded (MT) <span className="text-destructive">*</span></Label>
                              <Input
                                type="number" step="0.001" min="0"
                                className="h-8 text-xs" placeholder="0.000"
                                value={bdnQty} onChange={(e) => setBdnQty(e.target.value)}
                              />
                            </div>
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div className="space-y-1.5">
                              <Label className="text-xs">GOV <span className="text-destructive">*</span></Label>
                              <Input
                                type="number" step="0.01" min="0"
                                className="h-8 text-xs" placeholder="0.00"
                                value={bdnGov} onChange={(e) => setBdnGov(e.target.value)}
                              />
                            </div>
                            <div className="space-y-1.5">
                              <Label className="text-xs">GSV <span className="text-destructive">*</span></Label>
                              <Input
                                type="number" step="0.01" min="0"
                                className="h-8 text-xs" placeholder="0.00"
                                value={bdnGsv} onChange={(e) => setBdnGsv(e.target.value)}
                              />
                            </div>
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div className="space-y-1.5">
                              <Label className="text-xs">Loading Date <span className="text-destructive">*</span></Label>
                              <Input
                                type="date" className="h-9 sm:h-8 text-xs"
                                value={bdnDeliveryDate} onChange={(e) => setBdnDeliveryDate(e.target.value)}
                              />
                            </div>
                            <div className="space-y-1.5">
                              <Label className="text-xs">Product Type</Label>
                              <div className="flex items-center h-8 px-3 rounded-md border bg-muted/50 text-xs text-muted-foreground">
                                {op.product_type ?? "—"}
                                <span className="ml-1 text-[10px] opacity-60">(from operation)</span>
                              </div>
                            </div>
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div className="space-y-1.5">
                              <Label className="text-xs">Density (kg/m³)</Label>
                              <Input
                                type="number" step="0.001" min="0"
                                className="h-8 text-xs" placeholder="optional"
                                value={bdnDensity} onChange={(e) => setBdnDensity(e.target.value)}
                              />
                            </div>
                            <div className="space-y-1.5">
                              <Label className="text-xs">Temperature (°C)</Label>
                              <Input
                                type="number" step="0.1"
                                className="h-8 text-xs" placeholder="optional"
                                value={bdnTemp} onChange={(e) => setBdnTemp(e.target.value)}
                              />
                            </div>
                          </div>
                          <div className="space-y-1.5">
                            <Label className="text-xs">Notes</Label>
                            <Textarea
                              className="text-xs min-h-15 resize-none"
                              placeholder="Any additional delivery notes…"
                              value={bdnNotes} onChange={(e) => setBdnNotes(e.target.value)}
                            />
                          </div>
                          <Button
                            size="sm" className="w-full"
                            disabled={!bdnVesselId || !bdnQty || !bdnGov || !bdnGsv || !bdnDeliveryDate || createBdnMutation.isPending}
                            onClick={() => createBdnMutation.mutate()}
                          >
                            {createBdnMutation.isPending ? "Submitting…" : "Submit BDN"}
                          </Button>
                        </CardContent>
                      )}
                    </Card>
                  )}

                  {/* BDN list */}
                  <Card className="rounded-2xl border border-navy-100 shadow-[0_1px_2px_rgb(16_36_71/0.04)] dark:border-border">
                    <CardContent className="p-0">
                      {bdns?.length ? (
                        <div className="divide-y">
                          {bdns.map((bdn) => (
                            <div key={bdn.id} className="px-5 py-4 space-y-2">
                              <div className="flex items-center justify-between">
                                <div>
                                  <p className="text-sm font-mono font-semibold">{bdn.bdn_number}</p>
                                  <p className="text-xs text-muted-foreground">
                                    {parseFloat(bdn.quantity_delivered_mt).toLocaleString(undefined, { minimumFractionDigits: 3 })} MT
                                    {bdn.product_type ? ` · ${bdn.product_type}` : ""}
                                    {" · "}{formatDate(bdn.delivery_date)}
                                  </p>
                                </div>
                                <Badge
                                  variant={bdn.status === "approved" ? "default" : bdn.status === "rejected" ? "destructive" : "secondary"}
                                  className="text-xs capitalize"
                                >
                                  {bdn.status}
                                </Badge>
                              </div>

                              {(bdn.discharge_gov || bdn.discharge_gsv) && (
                                <div className="grid grid-cols-3 gap-x-4 gap-y-1 text-[11px] text-muted-foreground bg-muted/20 rounded-md p-2.5">
                                  {bdn.discharge_gov && <span>GOV: {parseFloat(bdn.discharge_gov).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>}
                                  {bdn.discharge_gsv && <span>GSV: {parseFloat(bdn.discharge_gsv).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>}
                                  {bdn.density && <span>Density: {parseFloat(bdn.density).toLocaleString(undefined, { minimumFractionDigits: 3 })}</span>}
                                  {bdn.temperature && <span>Temp: {parseFloat(bdn.temperature).toFixed(1)}°C</span>}
                                </div>
                              )}

                              {bdn.truck_discharged_total_mt != null && (
                                <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[11px] rounded-md p-2.5 bg-indigo-50 text-indigo-800 dark:bg-indigo-500/10 dark:text-indigo-300">
                                  <span className="col-span-2 text-[10px] font-semibold uppercase tracking-wide">Truck ↔ Vessel Reconciliation</span>
                                  <span>Discharged by Trucks: {parseFloat(bdn.truck_discharged_total_mt).toLocaleString(undefined, { minimumFractionDigits: 3 })} MT</span>
                                  {bdn.truck_variance_mt != null && (
                                    <span className="font-semibold">Truck Variance: {parseFloat(bdn.truck_variance_mt).toLocaleString(undefined, { minimumFractionDigits: 3 })} MT</span>
                                  )}
                                </div>
                              )}

                              {/* BM: approve / reject buttons for pending BDNs */}
                              {isBM && bdn.status === "pending" && (
                                <div className="pt-1 space-y-2">
                                  {rejectBdnId === bdn.id ? (
                                    <div className="space-y-2 border rounded-md p-3 bg-muted/30">
                                      <Label className="text-xs">Rejection reason <span className="text-destructive">*</span></Label>
                                      <Textarea
                                        className="text-xs min-h-15 resize-none"
                                        placeholder="Explain why this BDN is being rejected (min 10 characters)…"
                                        value={rejectBdnReason}
                                        onChange={(e) => setRejectBdnReason(e.target.value)}
                                      />
                                      <div className="flex gap-2">
                                        <Button
                                          size="sm" variant="destructive" className="flex-1 text-xs"
                                          disabled={rejectBdnReason.trim().length < 10 || rejectBdnMutation.isPending}
                                          onClick={() => rejectBdnMutation.mutate({ bdnId: bdn.id, reason: rejectBdnReason.trim() })}
                                        >
                                          {rejectBdnMutation.isPending ? "Rejecting…" : "Confirm Rejection"}
                                        </Button>
                                        <Button
                                          size="sm" variant="outline" className="flex-1 text-xs"
                                          onClick={() => { setRejectBdnId(null); setRejectBdnReason(""); }}
                                        >
                                          Cancel
                                        </Button>
                                      </div>
                                    </div>
                                  ) : (
                                    <div className="flex gap-2">
                                      <Button
                                        size="sm" className="flex-1 text-xs"
                                        disabled={approveBdnMutation.isPending}
                                        onClick={() => approveBdnMutation.mutate(bdn.id)}
                                      >
                                        Approve BDN
                                      </Button>
                                      <Button
                                        size="sm" variant="outline" className="flex-1 text-xs text-destructive border-destructive/30 hover:bg-destructive/10"
                                        onClick={() => setRejectBdnId(bdn.id)}
                                      >
                                        Reject
                                      </Button>
                                    </div>
                                  )}
                                </div>
                              )}

                              {/* Show rejection reason if rejected */}
                              {bdn.status === "rejected" && bdn.rejection_reason && (
                                <p className="text-xs text-destructive bg-destructive/10 rounded px-2 py-1">
                                  Rejected: {bdn.rejection_reason}
                                </p>
                              )}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-sm text-muted-foreground text-center py-8">No BDNs yet</p>
                      )}
                    </CardContent>
                  </Card>
                </TabsContent>
              )}

              {/* ── Truck BDN tab — truck-only delivery proof, gates completion */}
              {canSeeTruckBdn && op.type === "truck_only" && (
                <TabsContent value="truck-bdns" className="mt-4 space-y-4">

                  {/* OS/LO: Submit Truck BDN form — every field manual & required.
                      Only valid once delivery completion has been submitted (pending_completion) —
                      that's the only status the state machine allows a Truck BDN submission from. */}
                  {(isOS || isLO) && op.status === "pending_completion" && (
                    <Card className="rounded-2xl border border-navy-100 shadow-[0_1px_2px_rgb(16_36_71/0.04)] dark:border-border">
                      <CardHeader className="pb-3 pt-4 px-5">
                        <div className="flex items-center justify-between">
                          <CardTitle className="text-[15px] font-bold tracking-tight">
                            {truckBdns?.length ? "Submit Another Truck BDN" : "Submit Truck Bunker Delivery Note"}
                          </CardTitle>
                          {(truckBdns?.length ?? 0) > 0 && (
                            <Button
                              size="sm"
                              variant={showTruckBdnForm ? "outline" : "default"}
                              onClick={() => setShowTruckBdnForm((v) => !v)}
                            >
                              {showTruckBdnForm ? "Cancel" : <><PlusCircle className="w-3.5 h-3.5 mr-1.5" />New Truck BDN</>}
                            </Button>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                          All fields are entered manually and required. The system separately records its own figures
                          from this operation's trucks — the Bunker Manager will see both side by side.
                        </p>
                      </CardHeader>

                      {(!truckBdns?.length || showTruckBdnForm) && (
                        <CardContent className="px-5 pb-5 space-y-4 border-t pt-4">
                          <div className="space-y-3">
                            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Basic Info</p>
                            <div className="space-y-1.5">
                              <Label className="text-xs">Company Name <span className="text-destructive">*</span></Label>
                              <Input
                                className="h-8 text-xs"
                                placeholder="Client company being supplied to…"
                                value={truckBdnForm.company_name ?? ""}
                                onChange={(e) => setTruckBdnForm((f) => ({ ...f, company_name: e.target.value }))}
                              />
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                              <div className="space-y-1.5">
                                <Label className="text-xs">Product Type <span className="text-destructive">*</span></Label>
                                <Input
                                  className="h-8 text-xs"
                                  value={truckBdnForm.product_type ?? ""}
                                  onChange={(e) => setTruckBdnForm((f) => ({ ...f, product_type: e.target.value }))}
                                />
                              </div>
                              <div className="space-y-1.5">
                                <Label className="text-xs">Receiving Vessel <span className="text-destructive">*</span></Label>
                                {/* Both ways on purpose: pick a registered vessel, or
                                    type one that isn't in the system yet. */}
                                <Input
                                  list="truck-bdn-vessels"
                                  className="h-8 text-xs"
                                  placeholder="Select or type the receiving vessel…"
                                  value={truckBdnForm.receiving_vessel ?? ""}
                                  onChange={(e) => setTruckBdnForm((f) => ({ ...f, receiving_vessel: e.target.value }))}
                                />
                                <datalist id="truck-bdn-vessels">
                                  {(allVessels ?? []).map((v) => (
                                    <option key={v.id} value={v.vessel_name} />
                                  ))}
                                </datalist>
                              </div>
                              <div className="space-y-1.5">
                                <Label className="text-xs">Discharge Location <span className="text-destructive">*</span></Label>
                                <Input
                                  className="h-8 text-xs"
                                  value={truckBdnForm.discharge_location ?? ""}
                                  onChange={(e) => setTruckBdnForm((f) => ({ ...f, discharge_location: e.target.value }))}
                                />
                              </div>
                            </div>
                          </div>

                          <div className="space-y-3">
                            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Quantities</p>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                              <div className="space-y-1.5">
                                <Label className="text-xs">Quantity Loaded (L) <span className="text-destructive">*</span></Label>
                                <Input
                                  type="number" step="0.001" min="0" className="h-8 text-xs"
                                  value={truckBdnForm.quantity_loaded_mt ?? ""}
                                  onChange={(e) => setTruckBdnForm((f) => ({ ...f, quantity_loaded_mt: e.target.value }))}
                                />
                              </div>
                              <div className="space-y-1.5">
                                <Label className="text-xs">Quantity Discharged (L) <span className="text-destructive">*</span></Label>
                                <Input
                                  type="number" step="0.001" min="0" className="h-8 text-xs"
                                  value={truckBdnForm.quantity_discharged_mt ?? ""}
                                  onChange={(e) => setTruckBdnForm((f) => ({ ...f, quantity_discharged_mt: e.target.value }))}
                                />
                              </div>
                            </div>
                          </div>

                          <div className="space-y-3">
                            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Product Quality</p>
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                              <div className="space-y-1.5">
                                <Label className="text-xs">Density (kg/m³) <span className="text-destructive">*</span></Label>
                                <Input
                                  type="number" step="0.0001" min="0" className="h-8 text-xs"
                                  value={truckBdnForm.density ?? ""}
                                  onChange={(e) => setTruckBdnForm((f) => ({ ...f, density: e.target.value }))}
                                />
                              </div>
                              <div className="space-y-1.5">
                                <Label className="text-xs">Temperature (°C) <span className="text-destructive">*</span></Label>
                                <Input
                                  type="number" step="0.1" className="h-8 text-xs"
                                  value={truckBdnForm.temperature ?? ""}
                                  onChange={(e) => setTruckBdnForm((f) => ({ ...f, temperature: e.target.value }))}
                                />
                              </div>
                            </div>
                          </div>

                          <div className="space-y-3">
                            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Delivery Quantity / Method</p>
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                              <div className="space-y-1.5">
                                <Label className="text-xs">VCF <span className="text-destructive">*</span></Label>
                                <Input
                                  type="number" step="0.0001" min="0" className="h-8 text-xs"
                                  value={truckBdnForm.vcf ?? ""}
                                  onChange={(e) => setTruckBdnForm((f) => ({ ...f, vcf: e.target.value }))}
                                />
                              </div>
                              <div className="space-y-1.5">
                                <Label className="text-xs">GOV (L) <span className="text-destructive">*</span></Label>
                                <Input
                                  type="number" step="0.01" min="0" className="h-8 text-xs"
                                  value={truckBdnForm.gov ?? ""}
                                  onChange={(e) => setTruckBdnForm((f) => ({ ...f, gov: e.target.value }))}
                                />
                              </div>
                              {/* Worked out from GOV x VCF x density, exactly as the
                                  vessel side does — typing them by hand was how a
                                  mistyped figure reached a client document. */}
                              <div className="space-y-1.5">
                                <Label className="text-xs text-muted-foreground">GSV (L) — calculated</Label>
                                <div className="flex h-8 items-center rounded-md border border-dashed border-navy-100 bg-muted/40 px-2.5 text-xs font-semibold tabular-nums dark:border-border">
                                  {truckBdnComputed.gsv ?? <span className="font-normal text-muted-foreground">GOV x VCF</span>}
                                </div>
                              </div>
                              <div className="space-y-1.5">
                                <Label className="text-xs text-muted-foreground">MTvac — calculated</Label>
                                <div className="flex h-8 items-center rounded-md border border-dashed border-navy-100 bg-muted/40 px-2.5 text-xs font-semibold tabular-nums dark:border-border">
                                  {truckBdnComputed.mtVacuum ?? <span className="font-normal text-muted-foreground">GSV x density</span>}
                                </div>
                              </div>
                            </div>
                          </div>

                          <div className="space-y-3">
                            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Timing</p>
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                              <div className="space-y-1.5">
                                <Label className="text-xs">Commenced Discharge <span className="text-destructive">*</span></Label>
                                <Input
                                  type="datetime-local" className="h-9 sm:h-8 text-xs"
                                  value={truckBdnForm.discharge_commenced_at ?? ""}
                                  onChange={(e) => setTruckBdnForm((f) => ({ ...f, discharge_commenced_at: e.target.value }))}
                                />
                              </div>
                              <div className="space-y-1.5">
                                <Label className="text-xs">Completed Discharge <span className="text-destructive">*</span></Label>
                                <Input
                                  type="datetime-local" className="h-9 sm:h-8 text-xs"
                                  value={truckBdnForm.discharge_completed_at ?? ""}
                                  onChange={(e) => setTruckBdnForm((f) => ({ ...f, discharge_completed_at: e.target.value }))}
                                />
                              </div>
                              <div className="space-y-1.5">
                                <Label className="text-xs">Date of Discharge Completion <span className="text-destructive">*</span></Label>
                                <Input
                                  type="date" className="h-9 sm:h-8 text-xs"
                                  value={truckBdnForm.discharge_completion_date ?? ""}
                                  onChange={(e) => setTruckBdnForm((f) => ({ ...f, discharge_completion_date: e.target.value }))}
                                />
                              </div>
                            </div>
                          </div>

                          <div className="space-y-1.5">
                            <Label className="text-xs">Notes</Label>
                            <Textarea
                              className="text-xs min-h-15 resize-none"
                              placeholder="Any additional delivery notes…"
                              value={truckBdnForm.notes ?? ""}
                              onChange={(e) => setTruckBdnForm((f) => ({ ...f, notes: e.target.value }))}
                            />
                          </div>
                          <Button
                            size="sm" className="w-full"
                            disabled={!truckBdnFormComplete || createTruckBdnMutation.isPending}
                            onClick={() => createTruckBdnMutation.mutate()}
                          >
                            {createTruckBdnMutation.isPending ? "Submitting…" : "Submit Truck BDN"}
                          </Button>
                        </CardContent>
                      )}
                    </Card>
                  )}

                  {/* Truck BDN list */}
                  <Card className="rounded-2xl border border-navy-100 shadow-[0_1px_2px_rgb(16_36_71/0.04)] dark:border-border">
                    <CardContent className="p-0">
                      {truckBdns?.length ? (
                        <div className="divide-y">
                          {truckBdns.map((tb) => {
                            const norm = (v?: string) => (v ?? "").trim().toLowerCase();
                            const rows: { label: string; system?: string; submitted: string; mismatch: boolean }[] = [
                              {
                                label: "Product Type",
                                system: tb.system_product_type ?? "—",
                                submitted: tb.product_type,
                                mismatch: norm(tb.system_product_type) !== norm(tb.product_type),
                              },
                              {
                                label: "Discharge Location",
                                system: tb.system_discharge_location ?? "—",
                                submitted: tb.discharge_location,
                                mismatch: norm(tb.system_discharge_location) !== norm(tb.discharge_location),
                              },
                              {
                                label: "Quantity Loaded",
                                system: tb.system_quantity_loaded_mt ? `${parseFloat(tb.system_quantity_loaded_mt).toLocaleString(undefined, { minimumFractionDigits: 3 })} L` : "—",
                                submitted: `${parseFloat(tb.quantity_loaded_mt).toLocaleString(undefined, { minimumFractionDigits: 3 })} L`,
                                mismatch: tb.system_quantity_loaded_mt !== undefined && parseFloat(tb.system_quantity_loaded_mt ?? "0") !== parseFloat(tb.quantity_loaded_mt),
                              },
                              {
                                label: "Quantity Discharged",
                                system: tb.system_quantity_discharged_mt ? `${parseFloat(tb.system_quantity_discharged_mt).toLocaleString(undefined, { minimumFractionDigits: 3 })} L` : "—",
                                submitted: `${parseFloat(tb.quantity_discharged_mt).toLocaleString(undefined, { minimumFractionDigits: 3 })} L`,
                                mismatch: tb.system_quantity_discharged_mt !== undefined && parseFloat(tb.system_quantity_discharged_mt ?? "0") !== parseFloat(tb.quantity_discharged_mt),
                              },
                              {
                                label: "Commenced Discharge",
                                system: tb.system_discharge_commenced_at ? formatDateTime(tb.system_discharge_commenced_at) : "—",
                                submitted: formatDateTime(tb.discharge_commenced_at),
                                mismatch: tb.system_discharge_commenced_at !== undefined && tb.system_discharge_commenced_at !== tb.discharge_commenced_at,
                              },
                              {
                                label: "Completed Discharge",
                                system: tb.system_discharge_completed_at ? formatDateTime(tb.system_discharge_completed_at) : "—",
                                submitted: formatDateTime(tb.discharge_completed_at),
                                mismatch: tb.system_discharge_completed_at !== undefined && tb.system_discharge_completed_at !== tb.discharge_completed_at,
                              },
                            ];
                            const mismatchCount = rows.filter((r) => r.mismatch).length;

                            return (
                            <div key={tb.id} className="px-5 py-4 space-y-3">
                              <div className="flex items-center justify-between">
                                <div>
                                  <p className="text-sm font-mono font-semibold">{tb.truck_bdn_number}</p>
                                  <p className="text-xs text-muted-foreground">
                                    {tb.company_name}
                                    {" · "}{parseFloat(tb.quantity_discharged_mt).toLocaleString(undefined, { minimumFractionDigits: 3 })} L
                                    {" · "}{tb.product_type}
                                  </p>
                                </div>
                                <div className="flex items-center gap-1.5">
                                  {mismatchCount > 0 && (
                                    <Badge variant="outline" className="text-[10px] gap-1 border-amber-300 text-amber-700 bg-amber-50">
                                      <AlertTriangle className="w-3 h-3" />{mismatchCount} discrepanc{mismatchCount === 1 ? "y" : "ies"}
                                    </Badge>
                                  )}
                                  <Badge
                                    variant={tb.status === "approved" ? "default" : tb.status === "rejected" ? "destructive" : "secondary"}
                                    className="text-xs capitalize"
                                  >
                                    {tb.status}
                                  </Badge>
                                  {isBM && (
                                    <Button size="sm" variant="outline" className="h-6 px-1.5" onClick={() => openEditTruckBdn(tb)}>
                                      <Pencil className="w-3 h-3" />
                                    </Button>
                                  )}
                                </div>
                              </div>

                              {/* System recorded vs. Submitted comparison */}
                              <div className="rounded-md border overflow-hidden">
                                <div className="grid grid-cols-[1fr_1fr_1fr] bg-muted/40 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                                  <span>Field</span>
                                  <span>System Recorded</span>
                                  <span>Submitted</span>
                                </div>
                                {rows.map((r) => (
                                  <div
                                    key={r.label}
                                    className={`grid grid-cols-[1fr_1fr_1fr] px-3 py-1.5 text-xs border-t items-center ${r.mismatch ? "bg-amber-50" : ""}`}
                                  >
                                    <span className="text-muted-foreground">{r.label}</span>
                                    <span>{r.system}</span>
                                    <span className={r.mismatch ? "text-amber-800 font-semibold flex items-center gap-1" : ""}>
                                      {r.mismatch && <AlertTriangle className="w-3 h-3 shrink-0" />}
                                      {r.submitted}
                                    </span>
                                  </div>
                                ))}
                              </div>

                              {/* Product quality / delivery method — submitter-only, no system equivalent */}
                              <div className="grid grid-cols-3 gap-x-4 gap-y-1 text-[11px] text-muted-foreground bg-muted/20 rounded-md p-2.5">
                                <span>Density: {parseFloat(tb.density).toLocaleString(undefined, { minimumFractionDigits: 4 })}</span>
                                <span>Temp: {parseFloat(tb.temperature).toFixed(1)}°C</span>
                                <span>VCF: {parseFloat(tb.vcf).toLocaleString(undefined, { minimumFractionDigits: 4 })}</span>
                                <span>GOV: {parseFloat(tb.gov).toLocaleString(undefined, { minimumFractionDigits: 2 })} L</span>
                                <span>GSV: {parseFloat(tb.gsv).toLocaleString(undefined, { minimumFractionDigits: 2 })} L</span>
                                <span>MTvac: {parseFloat(tb.mt_vacuum).toLocaleString(undefined, { minimumFractionDigits: 3 })}</span>
                                {tb.variance_mt && <span>Variance: {parseFloat(tb.variance_mt).toLocaleString(undefined, { minimumFractionDigits: 3 })} L</span>}
                                <span>Completion Date: {formatDate(tb.discharge_completion_date)}</span>
                              </div>
                              {tb.notes && <p className="text-xs text-foreground/80">{tb.notes}</p>}

                              {/* BM: approve / reject buttons for pending Truck BDNs */}
                              {isBM && tb.status === "pending" && (
                                <div className="pt-1 space-y-2">
                                  {rejectTruckBdnId === tb.id ? (
                                    <div className="space-y-2 border rounded-md p-3 bg-muted/30">
                                      <Label className="text-xs">Rejection reason <span className="text-destructive">*</span></Label>
                                      <Textarea
                                        className="text-xs min-h-15 resize-none"
                                        placeholder="Explain why this Truck BDN is being rejected (min 10 characters)…"
                                        value={rejectTruckBdnReason}
                                        onChange={(e) => setRejectTruckBdnReason(e.target.value)}
                                      />
                                      <div className="flex gap-2">
                                        <Button
                                          size="sm" variant="destructive" className="flex-1 text-xs"
                                          disabled={rejectTruckBdnReason.trim().length < 10 || rejectTruckBdnMutation.isPending}
                                          onClick={() => rejectTruckBdnMutation.mutate({ truckBdnId: tb.id, reason: rejectTruckBdnReason.trim() })}
                                        >
                                          {rejectTruckBdnMutation.isPending ? "Rejecting…" : "Confirm Rejection"}
                                        </Button>
                                        <Button
                                          size="sm" variant="outline" className="flex-1 text-xs"
                                          onClick={() => { setRejectTruckBdnId(null); setRejectTruckBdnReason(""); }}
                                        >
                                          Cancel
                                        </Button>
                                      </div>
                                    </div>
                                  ) : (
                                    <div className="flex gap-2">
                                      <Button
                                        size="sm" className="flex-1 text-xs"
                                        disabled={approveTruckBdnMutation.isPending}
                                        onClick={() => approveTruckBdnMutation.mutate(tb.id)}
                                      >
                                        Approve Truck BDN
                                      </Button>
                                      <Button
                                        size="sm" variant="outline" className="flex-1 text-xs text-destructive border-destructive/30 hover:bg-destructive/10"
                                        onClick={() => setRejectTruckBdnId(tb.id)}
                                      >
                                        Reject
                                      </Button>
                                    </div>
                                  )}
                                </div>
                              )}

                              {tb.status === "rejected" && tb.rejection_reason && (
                                <p className="text-xs text-destructive bg-destructive/10 rounded px-2 py-1">
                                  Rejected: {tb.rejection_reason}
                                </p>
                              )}
                            </div>
                            );
                          })}
                        </div>
                      ) : (
                        <p className="text-sm text-muted-foreground text-center py-8">No Truck BDNs yet</p>
                      )}
                    </CardContent>
                  </Card>
                </TabsContent>
              )}

              {/* ── Vessel BDN tab — vessel_only only (see the trigger's comment above);
                   one per receiving-vessel leg, gates operation completion until ALL are approved */}
              {canSeeVesselBdn && op.type === "vessel_only" && (() => {
                const isVesselOnly = op.type === "vessel_only";

                // vessel_only: one BDN per receiving-vessel LEG (delivery
                // repeats per receiving vessel). Everything else: one BDN
                // per VesselActivity (vessel run), unchanged.
                const bdnnedLegIds = new Set(
                  (vesselBdns ?? []).filter((b) => (b.status === "pending" || b.status === "approved") && b.vessel_leg_id).map((b) => b.vessel_leg_id)
                );
                const bdnnedActivityIds = new Set(
                  (vesselBdns ?? []).filter((b) => b.status === "pending" || b.status === "approved").map((b) => b.vessel_activity_id)
                );

                const allLegs = isVesselOnly
                  ? (vesselActivities ?? []).flatMap((a) => (a.legs ?? []).map((leg) => ({ leg, activity: a })))
                  : [];
                const submittableLegs = allLegs.filter(
                  ({ leg }) => !leg.cancelled_at && leg.stage === "discharge_completed" && !bdnnedLegIds.has(leg.id)
                );
                const submittableActivities = isVesselOnly ? [] : (vesselActivities ?? []).filter(
                  (a) => a.status !== "cancelled" && !bdnnedActivityIds.has(a.id) && a.stage === "discharge_completed"
                );

                const totalRuns = isVesselOnly
                  ? allLegs.filter(({ leg }) => !leg.cancelled_at).length
                  : (vesselActivities ?? []).filter((a) => a.status !== "cancelled").length;
                const approvedRuns = isVesselOnly
                  ? (vesselBdns ?? []).filter((b) => b.status === "approved" && b.vessel_leg_id).length
                  : (vesselBdns ?? []).filter((b) => b.status === "approved").length;

                return (
                <TabsContent value="vessel-bdns" className="mt-4 space-y-4">

                  {totalRuns > 0 && (
                    <div className={`rounded-md px-3 py-2 text-xs flex items-center gap-2 ${approvedRuns >= totalRuns ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>
                      <ShieldCheck className="w-3.5 h-3.5 shrink-0" />
                      {approvedRuns} of {totalRuns} vessel run(s) approved
                      {approvedRuns < totalRuns && " — operation cannot complete until every run is approved"}
                    </div>
                  )}

                  {/* OS/Marine: Submit Vessel BDN form */}
                  {(isOS || isMM) && (isVesselOnly ? submittableLegs.length > 0 : submittableActivities.length > 0) && (
                    <Card className="rounded-2xl border border-navy-100 shadow-[0_1px_2px_rgb(16_36_71/0.04)] dark:border-border">
                      <CardHeader className="pb-3 pt-4 px-5">
                        <div className="flex items-center justify-between">
                          <CardTitle className="text-[15px] font-bold tracking-tight">Submit Vessel Bunker Delivery Note</CardTitle>
                          {!vesselBdnFormActivityId && (
                            <Select
                              value=""
                              onValueChange={(v) => {
                                setVesselBdnFormActivityId(v);
                                setVesselBdnFormIsLeg(isVesselOnly);
                                setVesselBdnForm(
                                  isVesselOnly
                                    ? { receiving_vessel: submittableLegs.find(({ leg }) => leg.id === v)?.leg.receiving_vessel_name ?? "" }
                                    : {}
                                );
                              }}
                            >
                              <SelectTrigger className="h-8 text-xs w-55"><SelectValue placeholder={isVesselOnly ? "Select receiving vessel…" : "Select vessel run…"} /></SelectTrigger>
                              <SelectContent>
                                {isVesselOnly
                                  ? submittableLegs.map(({ leg, activity }) => (
                                      <SelectItem key={leg.id} value={leg.id} className="text-xs">{leg.receiving_vessel_name} · {activity.vessel_name}</SelectItem>
                                    ))
                                  : submittableActivities.map((a) => (
                                      <SelectItem key={a.id} value={a.id} className="text-xs">{a.activity_number} · {a.vessel_name}</SelectItem>
                                    ))}
                              </SelectContent>
                            </Select>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                          All fields are entered manually and required. The system separately records its own figures
                          from this vessel run — the Bunker Manager will see both side by side.
                        </p>
                      </CardHeader>

                      {vesselBdnFormActivityId && (
                        <CardContent className="px-5 pb-5 space-y-4 border-t pt-4">
                          <div className="space-y-3">
                            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Basic Info</p>
                            <div className="space-y-1.5">
                              <Label className="text-xs">Company Name <span className="text-destructive">*</span></Label>
                              <Input className="h-8 text-xs" placeholder="Client company being supplied to…" value={vesselBdnForm.company_name ?? ""} onChange={(e) => setVesselBdnForm((f) => ({ ...f, company_name: e.target.value }))} />
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                              <div className="space-y-1.5">
                                <Label className="text-xs">Product Type <span className="text-destructive">*</span></Label>
                                <Input className="h-8 text-xs" value={vesselBdnForm.product_type ?? ""} onChange={(e) => setVesselBdnForm((f) => ({ ...f, product_type: e.target.value }))} />
                              </div>
                              <div className="space-y-1.5">
                                <Label className="text-xs">Discharge Location <span className="text-destructive">*</span></Label>
                                <Input className="h-8 text-xs" value={vesselBdnForm.discharge_location ?? ""} onChange={(e) => setVesselBdnForm((f) => ({ ...f, discharge_location: e.target.value }))} />
                              </div>
                              <div className="space-y-1.5">
                                <Label className="text-xs">Receiving Vessel <span className="text-destructive">*</span></Label>
                                <Input className="h-8 text-xs" placeholder="e.g. MV Breydel" value={vesselBdnForm.receiving_vessel ?? ""} onChange={(e) => setVesselBdnForm((f) => ({ ...f, receiving_vessel: e.target.value }))} />
                              </div>
                            </div>
                          </div>

                          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                            <div className="space-y-4 rounded-lg border p-3">
                              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Discharge Quantity — as read by the discharging vessel</p>
                              <div className="space-y-1.5">
                                <Label className="text-xs">Quantity Loaded (MT) <span className="text-destructive">*</span></Label>
                                <Input type="number" step="0.01" min="0" className="h-8 text-xs" value={vesselBdnForm.quantity_loaded_litres ?? ""} onChange={(e) => setVesselBdnForm((f) => ({ ...f, quantity_loaded_litres: e.target.value }))} />
                              </div>
                              <div className="space-y-1.5">
                                <Label className="text-xs">Quantity Discharged (MT) <span className="text-destructive">*</span></Label>
                                <Input type="number" step="0.01" min="0" className="h-8 text-xs" value={vesselBdnForm.quantity_discharged_litres ?? ""} onChange={(e) => setVesselBdnForm((f) => ({ ...f, quantity_discharged_litres: e.target.value }))} />
                              </div>
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <div className="space-y-1.5">
                                  <Label className="text-xs">Density (kg/m³) <span className="text-destructive">*</span></Label>
                                  <Input type="number" step="0.0001" min="0" className="h-8 text-xs" value={vesselBdnForm.density ?? ""} onChange={(e) => setVesselBdnForm((f) => ({ ...f, density: e.target.value }))} />
                                </div>
                                <div className="space-y-1.5">
                                  <Label className="text-xs">VCF <span className="text-destructive">*</span></Label>
                                  <Input type="number" step="0.0001" min="0" className="h-8 text-xs" value={vesselBdnForm.vcf ?? ""} onChange={(e) => setVesselBdnForm((f) => ({ ...f, vcf: e.target.value }))} />
                                </div>
                                <div className="space-y-1.5">
                                  <Label className="text-xs">Temperature (°C) <span className="text-destructive">*</span></Label>
                                  <Input type="number" step="0.1" className="h-8 text-xs" value={vesselBdnForm.temperature ?? ""} onChange={(e) => setVesselBdnForm((f) => ({ ...f, temperature: e.target.value }))} />
                                </div>
                              </div>
                              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                <div className="space-y-1.5">
                                  <Label className="text-xs">GOV <span className="text-destructive">*</span></Label>
                                  <Input type="number" step="0.01" min="0" className="h-8 text-xs" value={vesselBdnForm.discharge_gov ?? ""} onChange={(e) => setVesselBdnForm((f) => ({ ...f, discharge_gov: e.target.value }))} />
                                </div>
                                <div className="space-y-1.5">
                                  <Label className="text-xs">GSV <span className="text-destructive">*</span></Label>
                                  <Input type="number" step="0.01" min="0" className="h-8 text-xs" value={vesselBdnForm.discharge_gsv ?? ""} onChange={(e) => setVesselBdnForm((f) => ({ ...f, discharge_gsv: e.target.value }))} />
                                </div>
                                <div className="space-y-1.5">
                                  <Label className="text-xs">MTvac <span className="text-destructive">*</span></Label>
                                  <Input type="number" step="0.001" min="0" className="h-8 text-xs" value={vesselBdnForm.discharge_mt_vacuum ?? ""} onChange={(e) => setVesselBdnForm((f) => ({ ...f, discharge_mt_vacuum: e.target.value }))} />
                                </div>
                              </div>
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <div className="space-y-1.5">
                                  <Label className="text-xs">Completed Discharge <span className="text-destructive">*</span></Label>
                                  <Input type="datetime-local" className="h-9 sm:h-8 text-xs" value={vesselBdnForm.discharge_completed_at ?? ""} onChange={(e) => setVesselBdnForm((f) => ({ ...f, discharge_completed_at: e.target.value }))} />
                                </div>
                                <div className="space-y-1.5">
                                  <Label className="text-xs">Date of Discharge Completion <span className="text-destructive">*</span></Label>
                                  <Input type="date" className="h-9 sm:h-8 text-xs" value={vesselBdnForm.discharge_completion_date ?? ""} onChange={(e) => setVesselBdnForm((f) => ({ ...f, discharge_completion_date: e.target.value }))} />
                                </div>
                              </div>
                            </div>

                            <div className="space-y-4 rounded-lg border p-3">
                              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Received Quantity — as independently read by the receiving vessel (optional)</p>
                              <p className="text-[11px] text-muted-foreground">
                                Fill in if the receiving vessel took its own readings — lets the Bunker Manager compare against the discharge figures above. Leave blank if not available yet.
                              </p>
                              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                <div className="space-y-1.5">
                                  <Label className="text-xs">GOV</Label>
                                  <Input type="number" step="0.01" min="0" className="h-8 text-xs" value={vesselBdnForm.received_gov ?? ""} onChange={(e) => setVesselBdnForm((f) => ({ ...f, received_gov: e.target.value }))} />
                                </div>
                                <div className="space-y-1.5">
                                  <Label className="text-xs">GSV</Label>
                                  <Input type="number" step="0.01" min="0" className="h-8 text-xs" value={vesselBdnForm.received_gsv ?? ""} onChange={(e) => setVesselBdnForm((f) => ({ ...f, received_gsv: e.target.value }))} />
                                </div>
                                <div className="space-y-1.5">
                                  <Label className="text-xs">MTvac</Label>
                                  <Input type="number" step="0.001" min="0" className="h-8 text-xs" value={vesselBdnForm.received_mt_vacuum ?? ""} onChange={(e) => setVesselBdnForm((f) => ({ ...f, received_mt_vacuum: e.target.value }))} />
                                </div>
                              </div>
                            </div>

                          </div>

                          <div className="space-y-1.5">
                            <Label className="text-xs">Notes</Label>
                            <Textarea className="text-xs min-h-15 resize-none" placeholder="Any additional delivery notes…" value={vesselBdnForm.notes ?? ""} onChange={(e) => setVesselBdnForm((f) => ({ ...f, notes: e.target.value }))} />
                          </div>
                          <div className="flex gap-2">
                            <Button size="sm" className="flex-1" disabled={!vesselBdnFormComplete || createVesselBdnMutation.isPending} onClick={() => createVesselBdnMutation.mutate()}>
                              {createVesselBdnMutation.isPending ? "Submitting…" : "Submit Vessel BDN"}
                            </Button>
                            <Button size="sm" variant="outline" onClick={() => { setVesselBdnFormActivityId(null); setVesselBdnFormIsLeg(false); setVesselBdnForm({}); }}>Cancel</Button>
                          </div>
                        </CardContent>
                      )}
                    </Card>
                  )}

                  {/* Vessel BDN list */}
                  <Card className="rounded-2xl border border-navy-100 shadow-[0_1px_2px_rgb(16_36_71/0.04)] dark:border-border">
                    <CardContent className="p-0">
                      {vesselBdnsLoading ? (
                        <div className="flex justify-center py-8"><Spinner size={20} className="text-muted-foreground" /></div>
                      ) : vesselBdnsErrored ? (
                        <div className="flex flex-col items-center gap-2 py-8">
                          <p className="text-sm text-rose-600">Failed to load Vessel BDNs</p>
                          <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => refetchVesselBdns()}>Retry</Button>
                        </div>
                      ) : vesselBdns?.length ? (
                        <div className="divide-y">
                          {vesselBdns.map((vb) => {
                            const activity = vesselActivities?.find((a) => a.id === vb.vessel_activity_id);
                            const leg = vb.vessel_leg_id ? activity?.legs?.find((l) => l.id === vb.vessel_leg_id) : undefined;
                            const rows: { label: string; system?: string; submitted: string; mismatch: boolean }[] = [
                              { label: "Product Type", system: vb.system_product_type ?? "—", submitted: vb.product_type, mismatch: (vb.system_product_type ?? "").trim().toLowerCase() !== vb.product_type.trim().toLowerCase() },
                              {
                                label: "Quantity Loaded",
                                system: vb.system_quantity_loaded_litres ? `${parseFloat(vb.system_quantity_loaded_litres).toLocaleString(undefined, { minimumFractionDigits: 2 })} L` : "—",
                                submitted: `${parseFloat(vb.quantity_loaded_litres).toLocaleString(undefined, { minimumFractionDigits: 2 })} L`,
                                mismatch: vb.system_quantity_loaded_litres !== undefined && parseFloat(vb.system_quantity_loaded_litres ?? "0") !== parseFloat(vb.quantity_loaded_litres),
                              },
                              {
                                label: "Quantity Discharged",
                                system: vb.system_quantity_discharged_litres ? `${parseFloat(vb.system_quantity_discharged_litres).toLocaleString(undefined, { minimumFractionDigits: 2 })} L` : "—",
                                submitted: `${parseFloat(vb.quantity_discharged_litres).toLocaleString(undefined, { minimumFractionDigits: 2 })} L`,
                                mismatch: vb.system_quantity_discharged_litres !== undefined && parseFloat(vb.system_quantity_discharged_litres ?? "0") !== parseFloat(vb.quantity_discharged_litres),
                              },
                              {
                                label: "Completed Discharge",
                                system: vb.system_discharge_completed_at ? formatDateTime(vb.system_discharge_completed_at) : "—",
                                submitted: formatDateTime(vb.discharge_completed_at),
                                mismatch: vb.system_discharge_completed_at !== undefined && vb.system_discharge_completed_at !== vb.discharge_completed_at,
                              },
                            ];
                            const mismatchCount = rows.filter((r) => r.mismatch).length;

                            return (
                            <div key={vb.id} className="px-5 py-4 space-y-3">
                              <div className="flex items-center justify-between">
                                <div>
                                  <p className="text-sm font-mono font-semibold">{vb.bdn_number}</p>
                                  <p className="text-xs text-muted-foreground">
                                    {leg ? `${leg.receiving_vessel_name} · ${activity?.vessel_name}` : activity ? `${activity.activity_number} · ${activity.vessel_name}` : "—"}
                                    {" · "}{vb.company_name}
                                    {" · "}{parseFloat(vb.quantity_discharged_litres).toLocaleString(undefined, { minimumFractionDigits: 2 })} L
                                  </p>
                                </div>
                                <div className="flex items-center gap-1.5">
                                  {mismatchCount > 0 && (
                                    <Badge variant="outline" className="text-[10px] gap-1 border-amber-300 text-amber-700 bg-amber-50">
                                      <AlertTriangle className="w-3 h-3" />{mismatchCount} discrepanc{mismatchCount === 1 ? "y" : "ies"}
                                    </Badge>
                                  )}
                                  <Badge variant={vb.status === "approved" ? "default" : vb.status === "rejected" ? "destructive" : "secondary"} className="text-xs capitalize">
                                    {vb.status}
                                  </Badge>
                                  {isBM && (
                                    <Button size="sm" variant="outline" className="h-6 px-1.5" onClick={() => openEditVesselBdn(vb)}>
                                      <Pencil className="w-3 h-3" />
                                    </Button>
                                  )}
                                </div>
                              </div>

                              <div className="rounded-md border overflow-hidden">
                                <div className="grid grid-cols-[1fr_1fr_1fr] bg-muted/40 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                                  <span>Field</span><span>System Recorded</span><span>Submitted</span>
                                </div>
                                {rows.map((r) => (
                                  <div key={r.label} className={`grid grid-cols-[1fr_1fr_1fr] px-3 py-1.5 text-xs border-t items-center ${r.mismatch ? "bg-amber-50" : ""}`}>
                                    <span className="text-muted-foreground">{r.label}</span>
                                    <span>{r.system}</span>
                                    <span className={r.mismatch ? "text-amber-800 font-semibold flex items-center gap-1" : ""}>
                                      {r.mismatch && <AlertTriangle className="w-3 h-3 shrink-0" />}{r.submitted}
                                    </span>
                                  </div>
                                ))}
                              </div>

                              <div className="grid grid-cols-3 gap-x-4 gap-y-1 text-[11px] text-muted-foreground bg-muted/20 rounded-md p-2.5">
                                <span>Receiving Vessel: {vb.receiving_vessel}</span>
                                <span>Discharge Location: {vb.discharge_location}</span>
                                <span>Density: {parseFloat(vb.density).toLocaleString(undefined, { minimumFractionDigits: 4 })}</span>
                                <span>Temp: {parseFloat(vb.temperature).toFixed(1)}°C</span>
                                <span>VCF: {parseFloat(vb.vcf).toLocaleString(undefined, { minimumFractionDigits: 4 })}</span>
                                <span>Discharge GOV: {parseFloat(vb.discharge_gov).toLocaleString(undefined, { minimumFractionDigits: 2 })} L</span>
                                <span>Discharge GSV: {parseFloat(vb.discharge_gsv).toLocaleString(undefined, { minimumFractionDigits: 2 })} L</span>
                                <span>Discharge MTvac: {parseFloat(vb.discharge_mt_vacuum).toLocaleString(undefined, { minimumFractionDigits: 3 })}</span>
                                {vb.variance_litres && <span>Variance: {parseFloat(vb.variance_litres).toLocaleString(undefined, { minimumFractionDigits: 2 })} L</span>}
                                <span>Completion Date: {formatDate(vb.discharge_completion_date)}</span>
                              </div>

                              {(vb.received_gov || vb.received_gsv || vb.received_mt_vacuum) && (
                                <div className="grid grid-cols-3 gap-x-4 gap-y-1 text-[11px] rounded-md p-2.5 bg-sky-50 text-sky-800 dark:bg-sky-500/10 dark:text-sky-300">
                                  <span className="col-span-3 text-[10px] font-semibold uppercase tracking-wide">Received Quantity — receiving vessel&apos;s own readings</span>
                                  {vb.received_gov && <span>Received GOV: {parseFloat(vb.received_gov).toLocaleString(undefined, { minimumFractionDigits: 2 })} L</span>}
                                  {vb.received_gsv && <span>Received GSV: {parseFloat(vb.received_gsv).toLocaleString(undefined, { minimumFractionDigits: 2 })} L</span>}
                                  {vb.received_mt_vacuum && <span>Received MTvac: {parseFloat(vb.received_mt_vacuum).toLocaleString(undefined, { minimumFractionDigits: 3 })}</span>}
                                  {vb.received_mt_vacuum && (
                                    <span className="col-span-3 font-semibold">
                                      Variance vs Discharge MTvac: {(parseFloat(vb.discharge_mt_vacuum) - parseFloat(vb.received_mt_vacuum)).toLocaleString(undefined, { minimumFractionDigits: 3 })}
                                    </span>
                                  )}
                                </div>
                              )}
                              {vb.truck_discharged_total_mt != null && (
                                <div className="grid grid-cols-3 gap-x-4 gap-y-1 text-[11px] rounded-md p-2.5 bg-indigo-50 text-indigo-800 dark:bg-indigo-500/10 dark:text-indigo-300">
                                  <span className="col-span-3 text-[10px] font-semibold uppercase tracking-wide">Truck ↔ Vessel Reconciliation</span>
                                  <span>Discharged by Trucks: {parseFloat(vb.truck_discharged_total_mt).toLocaleString(undefined, { minimumFractionDigits: 3 })} MT</span>
                                  <span>Received by Vessel: {parseFloat(vb.vessel_received_total_mt ?? "0").toLocaleString(undefined, { minimumFractionDigits: 3 })} MT</span>
                                  {vb.truck_variance_mt != null && (
                                    <span className="font-semibold">Truck Variance: {parseFloat(vb.truck_variance_mt).toLocaleString(undefined, { minimumFractionDigits: 3 })} MT</span>
                                  )}
                                </div>
                              )}
                              {vb.notes && <p className="text-xs text-foreground/80">{vb.notes}</p>}

                              {isBM && vb.status === "pending" && (
                                <div className="pt-1 space-y-2">
                                  {rejectVesselBdnId === vb.id ? (
                                    <div className="space-y-2 border rounded-md p-3 bg-muted/30">
                                      <Label className="text-xs">Rejection reason <span className="text-destructive">*</span></Label>
                                      <Textarea className="text-xs min-h-15 resize-none" placeholder="Explain why this Vessel BDN is being rejected (min 10 characters)…" value={rejectVesselBdnReason} onChange={(e) => setRejectVesselBdnReason(e.target.value)} />
                                      <div className="flex gap-2">
                                        <Button size="sm" variant="destructive" className="flex-1 text-xs" disabled={rejectVesselBdnReason.trim().length < 10 || rejectVesselBdnMutation.isPending} onClick={() => rejectVesselBdnMutation.mutate({ bdnId: vb.id, reason: rejectVesselBdnReason.trim() })}>
                                          {rejectVesselBdnMutation.isPending ? "Rejecting…" : "Confirm Rejection"}
                                        </Button>
                                        <Button size="sm" variant="outline" className="flex-1 text-xs" onClick={() => { setRejectVesselBdnId(null); setRejectVesselBdnReason(""); }}>Cancel</Button>
                                      </div>
                                    </div>
                                  ) : (
                                    <div className="flex gap-2">
                                      <Button size="sm" className="flex-1 text-xs" disabled={approveVesselBdnMutation.isPending} onClick={() => approveVesselBdnMutation.mutate(vb.id)}>
                                        Approve Vessel BDN
                                      </Button>
                                      <Button size="sm" variant="outline" className="flex-1 text-xs text-destructive border-destructive/30 hover:bg-destructive/10" onClick={() => setRejectVesselBdnId(vb.id)}>
                                        Reject
                                      </Button>
                                    </div>
                                  )}
                                </div>
                              )}

                              {vb.status === "rejected" && vb.rejection_reason && (
                                <p className="text-xs text-destructive bg-destructive/10 rounded px-2 py-1">Rejected: {vb.rejection_reason}</p>
                              )}
                            </div>
                            );
                          })}
                        </div>
                      ) : (
                        <p className="text-sm text-muted-foreground text-center py-8">No Vessel BDNs yet</p>
                      )}
                    </CardContent>
                  </Card>
                </TabsContent>
                );
              })()}

              {/* ── Marine tab — vessel receipt summary + activity sessions */}
              {canSeeMarine && (
                <TabsContent value="marine" className="mt-4 space-y-4">

                  {/* ── Tab header + the four figures that summarise the run.
                       Every number is read straight off the vessel activities;
                       nothing here is derived from a baseline the API can't
                       produce. ── */}
                  <section className="overflow-hidden rounded-2xl border border-navy-100 bg-card shadow-[0_1px_2px_rgb(16_36_71/0.04)] dark:border-border">
                    <div className="px-4 pb-3 pt-4 lg:px-5 lg:pt-5">
                      <h2 className="text-[15px] font-bold tracking-tight text-foreground">
                        Marine Operation
                      </h2>
                      <p className="mt-0.5 text-[12px] text-muted-foreground">
                        Track marine activities and receiving vessel progress
                      </p>
                    </div>

                    <StatTileRow className="border-t border-border/70">
                      <StatTile
                        icon={Gauge}
                        tone="blue"
                        label="Total Loaded Quantity"
                        value={quantitySummary ? `${parseFloat(quantitySummary.total_loaded_mt).toLocaleString(undefined, { minimumFractionDigits: 2 })} MT` : "—"}
                        detail={quantitySummary ? `Trucks ${parseFloat(quantitySummary.truck_loaded_mt).toLocaleString()} MT · Terminal ${parseFloat(quantitySummary.terminal_loaded_mt).toLocaleString()} MT` : undefined}
                      />
                    </StatTileRow>

                    <StatTileRow className="border-t border-border/70">
                      <StatTile
                        icon={Droplets}
                        tone="emerald"
                        label="Total Discharged"
                        value={operationTotals ? `${parseFloat(operationTotals.total_discharged_mt).toLocaleString(undefined, { minimumFractionDigits: 2 })} MT` : "—"}
                        detail="Approved Vessel BDNs"
                      />
                      <StatTile
                        icon={Anchor}
                        tone="violet"
                        label="Total Received"
                        value={operationTotals ? `${parseFloat(operationTotals.total_received_mt).toLocaleString(undefined, { minimumFractionDigits: 2 })} MT` : "—"}
                        detail="Receiving vessel's own readings"
                      />
                      <StatTile
                        icon={Ship}
                        tone="sky"
                        label="Vessels Received"
                        value={operationTotals ? String(operationTotals.vessels_received) : "—"}
                      />
                      <StatTile
                        icon={TrendingDown}
                        tone={operationTotals && parseFloat(operationTotals.tts_variance_mt) !== 0 ? "amber" : undefined}
                        label="TTS Variance"
                        value={operationTotals ? `${parseFloat(operationTotals.tts_variance_mt).toLocaleString(undefined, { minimumFractionDigits: 3 })} MT` : "—"}
                        detail="Truck-to-ship, from truck deliveries"
                      />
                      <StatTile
                        icon={TrendingDown}
                        tone={operationTotals && parseFloat(operationTotals.sts_variance_mt) !== 0 ? "amber" : undefined}
                        label="STS Variance"
                        value={operationTotals ? `${parseFloat(operationTotals.sts_variance_mt).toLocaleString(undefined, { minimumFractionDigits: 3 })} MT` : "—"}
                        detail="Ship-to-ship, discharge vs received"
                      />
                    </StatTileRow>

                    {op.source_type === "terminal" && (
                      <div className="border-t border-border/70 px-4 py-4 lg:px-5 space-y-3">
                        <div className="flex items-center justify-between">
                          <p className="text-[13px] font-bold tracking-tight text-foreground">Terminal Loading Receipts</p>
                          {(isBM || isOS || isMM) && !showTerminalReceiptForm && (
                            <Button size="sm" variant="outline" className="h-7 text-xs gap-1.5" onClick={() => setShowTerminalReceiptForm(true)}>
                              <PlusCircle className="w-3.5 h-3.5" />Record Receipt
                            </Button>
                          )}
                        </div>

                        {showTerminalReceiptForm && (
                          <div className="rounded-lg border bg-muted/30 p-3 space-y-2">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                              <div className="space-y-1">
                                <Label className="text-[10px] text-muted-foreground">Quantity (MT) <span className="text-destructive">*</span></Label>
                                <Input type="number" step="0.01" min="0" className="h-8 text-xs" value={termQtyLitres} onChange={(e) => setTermQtyLitres(e.target.value)} />
                              </div>
                              <div className="space-y-1">
                                <Label className="text-[10px] text-muted-foreground">GOV</Label>
                                <Input type="number" step="0.01" min="0" className="h-8 text-xs" value={termGov} onChange={(e) => setTermGov(e.target.value)} />
                              </div>
                              <div className="space-y-1">
                                <Label className="text-[10px] text-muted-foreground">GSV</Label>
                                <Input type="number" step="0.01" min="0" className="h-8 text-xs" value={termGsv} onChange={(e) => setTermGsv(e.target.value)} />
                              </div>
                              <div className="space-y-1">
                                <Label className="text-[10px] text-muted-foreground">MT Vacuum</Label>
                                <Input type="number" step="0.001" min="0" className="h-8 text-xs" value={termMtVacuum} onChange={(e) => setTermMtVacuum(e.target.value)} />
                              </div>
                            </div>
                            <Textarea className="text-xs min-h-12.5 resize-none" placeholder="Description (optional)…" value={termDescription} onChange={(e) => setTermDescription(e.target.value)} />
                            <div className="flex gap-2">
                              <Button size="sm" className="flex-1 text-xs" disabled={!termQtyLitres || createTerminalReceiptMutation.isPending} onClick={() => createTerminalReceiptMutation.mutate()}>
                                {createTerminalReceiptMutation.isPending ? <Spinner size={14} /> : "Save Receipt"}
                              </Button>
                              <Button size="sm" variant="ghost" className="text-xs" onClick={resetTerminalReceiptForm}>Cancel</Button>
                            </div>
                          </div>
                        )}

                        {terminalReceipts?.length ? (
                          <div className="space-y-1.5">
                            {terminalReceipts.map((r) => (
                              <QuantityReadout
                                key={r.id}
                                columns={[
                                  ["Quantity", `${parseFloat(r.quantity_litres).toLocaleString()} L`],
                                  ["MTVC", r.mt_vacuum ? parseFloat(r.mt_vacuum).toLocaleString() : "—"],
                                  ["Recorded", formatDateTime(r.recorded_at)],
                                ]}
                                note={r.description}
                              />
                            ))}
                          </div>
                        ) : !showTerminalReceiptForm ? (
                          <p className="text-xs text-muted-foreground">No terminal loading receipts recorded yet</p>
                        ) : null}
                      </div>
                    )}

                    {op.type === "vessel_only" && (() => {
                      const acts = (vesselActivities ?? []).filter((a) => a.status !== "cancelled");
                      if (acts.length === 0) return null;
                      const legs = acts.flatMap((a) => (a.legs ?? []).filter((l) => !l.cancelled_at));

                      const sum = (vals: (string | undefined)[]) =>
                        vals.reduce<number>((acc, v) => acc + (v ? parseFloat(v) : 0), 0);
                      const litres = (n: number) => (n > 0 ? `${n.toLocaleString()} L` : "—");
                      const mtvc = (n: number) => (n > 0 ? `${n.toLocaleString()} MTVC` : undefined);

                      const loadedL   = sum(acts.map((a) => a.loading_received_quantity_litres));
                      const loadedMt  = sum(acts.map((a) => a.loading_mt_vacuum));
                      const dischL    = sum(legs.map((l) => l.quantity_discharged_litres));
                      const dischMt   = sum(legs.map((l) => l.mt_vacuum));

                      // "Completed" is the last discharge actually recorded —
                      // or the operation's own completion stamp once closed.
                      const lastDischarge = legs
                        .map((l) => l.stage_discharge_completed_system_at)
                        .filter(Boolean)
                        .sort()
                        .at(-1);
                      const completedAt = op.completed_at ?? lastDischarge;

                      return (
                        <StatTileRow className="border-t border-border/70">
                          <StatTile
                            icon={Ship}
                            label="Loading Received Quantity"
                            value={litres(loadedL)}
                            detail={mtvc(loadedMt)}
                          />
                          <StatTile
                            icon={Droplets}
                            tone="emerald"
                            label="Discharge Quantity"
                            value={litres(dischL)}
                            detail={mtvc(dischMt)}
                          />
                          <StatTile
                            icon={Anchor}
                            tone="violet"
                            label={legs.length === 1 ? "Receiving Vessel" : "Receiving Vessels"}
                            value={legs.length === 1 ? legs[0].receiving_vessel_name : String(legs.length)}
                            detail={
                              legs.length === 1
                                ? legs[0].imo_number
                                  ? `IMO ${legs[0].imo_number}`
                                  : undefined
                                : `${legs.filter((l) => l.stage === "discharge_completed").length} discharged`
                            }
                          />
                          <StatTile
                            icon={CalendarDays}
                            tone="amber"
                            label="Completed"
                            value={completedAt ? formatDate(completedAt) : "In progress"}
                            detail={completedAt ? formatDayTime(completedAt) : undefined}
                          />
                        </StatTileRow>
                      );
                    })()}
                  </section>

                  {/* ── Vessel Receipt Summary: the actual BDN detail, not a truck-
                       derived guess. Sourced from whichever BDN flow is the real
                       record of truth for this operation type:
                         - full_operation → the "BDNs" tab (bdns) — the one actually
                           used; GOV/GSV/MT are manually entered there and approving
                           one is what credits the vessel's ROB.
                         - vessel_only    → the "Vessel Received Quantity" tab
                           (vesselBdns) — unaffected by the above, still its own
                           per-receiving-vessel record.
                       A vessel with no submitted BDN yet simply doesn't appear —
                       this only ever shows what was actually recorded and approved.
                       Trucks-discharged stays visible per BDN purely for reference;
                       it never drives anything. ── */}
                  {(() => {
                    type Row = {
                      id: string; bdnNumber: string; vesselId: string; status: string;
                      primaryMt: number | null; secondaryLabel: string; secondaryValue: string;
                      truckTotalMt: number | null; truckVarianceMt: number | null; sortKey: string;
                    };

                    const rows: Row[] = op.type === "vessel_only"
                      ? (vesselBdns ?? []).filter((vb) => vb.status !== "rejected").map((vb) => ({
                          id: vb.id, bdnNumber: vb.bdn_number, vesselId: vb.vessel_id, status: vb.status,
                          primaryMt: vb.vessel_received_total_mt ? parseFloat(vb.vessel_received_total_mt) : null,
                          secondaryLabel: "Discharge MTvac",
                          secondaryValue: parseFloat(vb.discharge_mt_vacuum).toLocaleString(undefined, { minimumFractionDigits: 3 }),
                          truckTotalMt: vb.truck_discharged_total_mt != null ? parseFloat(vb.truck_discharged_total_mt) : null,
                          truckVarianceMt: vb.truck_variance_mt != null ? parseFloat(vb.truck_variance_mt) : null,
                          sortKey: vb.approved_at ?? vb.discharge_completed_at,
                        }))
                      : (bdns ?? []).filter((b) => b.status !== "rejected").map((b) => ({
                          id: b.id, bdnNumber: b.bdn_number, vesselId: b.vessel_id, status: b.status,
                          primaryMt: parseFloat(b.quantity_delivered_mt),
                          secondaryLabel: "GOV / GSV",
                          secondaryValue: `${b.discharge_gov ? parseFloat(b.discharge_gov).toLocaleString(undefined, { minimumFractionDigits: 2 }) : "—"} / ${b.discharge_gsv ? parseFloat(b.discharge_gsv).toLocaleString(undefined, { minimumFractionDigits: 2 }) : "—"}`,
                          truckTotalMt: b.truck_discharged_total_mt != null ? parseFloat(b.truck_discharged_total_mt) : null,
                          truckVarianceMt: b.truck_variance_mt != null ? parseFloat(b.truck_variance_mt) : null,
                          sortKey: b.approved_at ?? b.delivery_date,
                        }));

                    if (!rows.length) return null;

                    const byVessel = new Map<string, Row[]>();
                    rows.forEach((r) => {
                      const list = byVessel.get(r.vesselId);
                      if (list) list.push(r); else byVessel.set(r.vesselId, [r]);
                    });
                    byVessel.forEach((list) => list.sort((a, b) => b.sortKey.localeCompare(a.sortKey)));

                    const totalMt = rows.reduce((acc, r) => acc + (r.primaryMt ?? 0), 0);

                    return (
                      <Card className="rounded-2xl border border-navy-100 shadow-[0_1px_2px_rgb(16_36_71/0.04)] dark:border-border">
                        <CardHeader className="pb-2 pt-4 px-5">
                          <CardTitle className="flex items-center gap-2 text-[15px] font-bold tracking-tight">
                            <Ship className="w-4 h-4 text-brand-600" />
                            Vessel Receipt Summary
                          </CardTitle>
                          <p className="text-xs text-muted-foreground">
                            Recorded BDNs for this operation — the figure below is what updated each vessel&apos;s ROB.
                          </p>
                        </CardHeader>
                        <CardContent className="p-0">
                          <div className="divide-y">
                            {Array.from(byVessel.entries()).flatMap(([vid, rList]) => {
                              const vesselRecord = allVessels?.find((v) => v.id === vid);
                              const name = vesselRecord?.vessel_name ?? `Vessel ${vid.slice(0, 8)}`;
                              return rList.map((r) => (
                                <div key={r.id} className="px-5 py-3 space-y-1.5">
                                  <div className="flex items-center justify-between gap-3">
                                    <div className="min-w-0">
                                      <p className="text-sm font-semibold truncate">{name}</p>
                                      <p className="text-xs text-muted-foreground font-mono">{r.bdnNumber}</p>
                                    </div>
                                    <div className="text-right shrink-0">
                                      <p className="text-sm font-mono font-semibold text-brand-700">
                                        {r.primaryMt != null ? `+${r.primaryMt.toFixed(3)} MT` : "—"}
                                      </p>
                                      <p className="text-[10px] text-muted-foreground uppercase tracking-wide">received</p>
                                    </div>
                                  </div>
                                  <div className="flex items-center justify-between gap-3 text-[11px] text-muted-foreground">
                                    <span>{r.secondaryLabel}: {r.secondaryValue}</span>
                                    <Badge variant={r.status === "approved" ? "default" : "secondary"} className="text-[10px] capitalize shrink-0">{r.status}</Badge>
                                  </div>
                                  {r.truckTotalMt != null && (
                                    <p className="text-[11px] text-muted-foreground">
                                      Trucks discharged: {r.truckTotalMt.toLocaleString(undefined, { minimumFractionDigits: 3 })} MT (for reference)
                                      {r.truckVarianceMt != null && ` · Truck Variance: ${r.truckVarianceMt.toLocaleString(undefined, { minimumFractionDigits: 3 })} MT`}
                                    </p>
                                  )}
                                </div>
                              ));
                            })}
                          </div>
                          {rows.length > 1 && (
                            <div className="px-5 py-2.5 border-t bg-muted/20 flex items-center justify-between">
                              <p className="text-xs text-muted-foreground">Total received across all vessels</p>
                              <p className="text-sm font-mono font-semibold">{totalMt.toFixed(3)} MT</p>
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    );
                  })()}

                  {/* ── VesselActivity management — vessel_only and full_operation only ── */}
                  {op.type !== "truck_only" && <>

                  {/* ── BM: Assign form
                       - No activities yet  → form is open by default, no toggle needed
                       - Activities exist   → collapsed behind "Assign Another" button     */}
                  {isBM && (
                    <Card className="rounded-2xl border border-navy-100 shadow-[0_1px_2px_rgb(16_36_71/0.04)] dark:border-border">
                      <CardHeader className="pb-3 pt-4 px-5">
                        <div className="flex items-center justify-between">
                          <div>
                            <CardTitle className="text-[15px] font-bold tracking-tight">
                              {vesselActivities?.length ? "Assign Another Supervisor" : "Assign Marine Supervisor"}
                            </CardTitle>
                            {!vesselActivities?.length && (() => {
                              const marineTasks = tasks?.filter(
                                t => (t.task_type === "marine_discharge" || t.task_type === "vessel_operations") && t.status !== "cancelled"
                              ) ?? [];
                              return marineTasks.length > 0 ? (
                                <p className="text-xs text-amber-700 mt-1 bg-amber-50 border border-amber-200 rounded px-2 py-1">
                                  {marineTasks.length} vessel task{marineTasks.length > 1 ? "s" : ""} assigned but no vessel activity session exists yet.
                                  Create one below to begin tracking quantities.
                                </p>
                              ) : (
                                <p className="text-xs text-muted-foreground mt-0.5">
                                  Select a vessel and marine manager to begin vessel operations.
                                </p>
                              );
                            })()}
                          </div>
                          {(vesselActivities?.length ?? 0) > 0 && (
                            <Button
                              size="sm"
                              variant={showAssignActivityForm ? "outline" : "default"}
                              onClick={() => setShowAssignActivityForm((v) => !v)}
                            >
                              {showAssignActivityForm ? "Cancel" : <><PlusCircle className="w-3.5 h-3.5 mr-1.5" />Assign</>}
                            </Button>
                          )}
                        </div>
                      </CardHeader>

                      {/* Show form: always when empty, or when toggle is open */}
                      {(!vesselActivities?.length || showAssignActivityForm) && (
                        <CardContent className="px-5 pb-5 space-y-3 border-t pt-4">
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div className="space-y-1.5">
                              <Label className="text-xs">Vessel *</Label>
                              <Select value={actVesselId} onValueChange={setActVesselId}>
                                <SelectTrigger className="h-8 text-xs">
                                  <SelectValue placeholder="Select vessel…" />
                                </SelectTrigger>
                                <SelectContent>
                                  {allVessels?.map((v) => (
                                    <SelectItem key={v.id} value={v.id} className="text-xs">
                                      {v.vessel_name} — ROB: {parseFloat(v.current_rob_mt).toFixed(1)} MT
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="space-y-1.5">
                              <Label className="text-xs">Marine Manager *</Label>
                              <Select value={actAssignedTo} onValueChange={setActAssignedTo}>
                                <SelectTrigger className="h-8 text-xs">
                                  <SelectValue placeholder="Select manager…" />
                                </SelectTrigger>
                                <SelectContent>
                                  {marineManagers?.map((u) => (
                                    <SelectItem key={u.id} value={u.id} className="text-xs">{u.full_name}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                          </div>
                          <div className="space-y-1.5">
                            <Label className="text-xs">Instructions (optional)</Label>
                            <Textarea
                              className="h-16 text-xs resize-none"
                              placeholder="Any special instructions for the supervisor…"
                              value={actNotes}
                              onChange={(e) => setActNotes(e.target.value)}
                            />
                          </div>
                          <div className="flex justify-end">
                            <Button
                              size="sm"
                              disabled={!actVesselId || !actAssignedTo || assignActivityMutation.isPending}
                              onClick={() => assignActivityMutation.mutate()}
                            >
                              {assignActivityMutation.isPending && <Spinner size={14} className="mr-1.5" />}
                              Assign Activity
                            </Button>
                          </div>
                        </CardContent>
                      )}
                    </Card>
                  )}

                  {/* ── MM: no activities yet ── */}
                  {!isBM && !vesselActivities?.length && (() => {
                    const myMarineTasks = tasks?.filter(
                      t => t.assigned_to === user?.id &&
                           (t.task_type === "marine_discharge" || t.task_type === "vessel_operations") &&
                           t.status !== "cancelled"
                    ) ?? [];
                    return myMarineTasks.length > 0 ? (
                      <div className="space-y-3">
                        <Card className="rounded-2xl border border-amber-200 bg-amber-50/50 shadow-[0_1px_2px_rgb(16_36_71/0.04)] dark:border-amber-500/30 dark:bg-amber-500/10">
                          <CardContent className="p-4">
                            <div className="flex items-start gap-3">
                              <Anchor className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                              <div>
                                <p className="text-sm font-semibold text-amber-800">Task assigned — waiting for session</p>
                                <p className="text-xs text-amber-700 mt-0.5">
                                  You have been assigned to this vessel operation. The Bunker Manager needs to open a
                                  vessel activity session before you can begin recording quantities.
                                </p>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                        {myMarineTasks.map(t => (
                          <Card key={t.id} className="rounded-2xl border border-navy-100 shadow-[0_1px_2px_rgb(16_36_71/0.04)] dark:border-border">
                            <CardContent className="p-4">
                              <div className="flex items-start justify-between gap-3">
                                <div>
                                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">
                                    Task · {t.task_type === "vessel_operations" ? "Vessel Operations" : "Marine Discharge"}
                                  </p>
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <Badge className={`text-[10px] capitalize border-0 ${
                                      t.status === "in_progress" ? "bg-brand-600 text-white"
                                      : t.status === "completed"  ? "bg-emerald-600 text-white"
                                      : "bg-amber-100 text-amber-800"
                                    }`}>{t.status.replace(/_/g, " ")}</Badge>
                                    <Badge variant="outline" className="text-[10px] capitalize">
                                      {t.priority}
                                    </Badge>
                                  </div>
                                  {t.instructions && (
                                    <p className="text-xs text-muted-foreground mt-2 italic">{t.instructions}</p>
                                  )}
                                  {t.due_date && (
                                    <p className="text-[10px] text-muted-foreground mt-1">
                                      Due: {new Date(t.due_date).toLocaleDateString()}
                                    </p>
                                  )}
                                </div>
                                <p className="text-[10px] text-muted-foreground whitespace-nowrap shrink-0">
                                  Assigned {new Date(t.created_at).toLocaleDateString()}
                                </p>
                              </div>
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    ) : (
                      <Card className="rounded-2xl border border-navy-100 shadow-[0_1px_2px_rgb(16_36_71/0.04)] dark:border-border">
                        <CardContent className="py-10 text-center">
                          <Anchor className="w-9 h-9 mx-auto mb-3 text-muted-foreground/30" />
                          <p className="text-sm font-medium text-muted-foreground">No vessel activities assigned yet</p>
                          <p className="text-xs text-muted-foreground mt-1">
                            The Bunker Manager will assign you once vessel operations begin.
                          </p>
                        </CardContent>
                      </Card>
                    );
                  })()}

                  {/* ── Activity list ── */}
                  {(vesselActivities?.length ?? 0) > 0 && (
                    <div className="space-y-4">
                      {vesselActivities!.map((activity) => {
                        const isAssignee   = user?.id === activity.assigned_to;
                        // Mirrors the backend's _assert_authorized (vessel_activity_service.py),
                        // which checks the account's TRUE role, not the "acting as" preview role —
                        // a real Bunker Manager or Ops Supervisor always retains action authority
                        // here even while previewing the app as another role.
                        // Mirrors the backend's _assert_authorized: the
                        // assigned Cargo Superintendent, any Ops Supervisor, or the
                        // Bunker Manager (who is never assignee-gated).
                        const canAct       = isAssignee || isBM || isOS;
                        const hasReceipt   = !!activity.vessel_received_mt;
                        const hasDischarge = !!activity.quantity_discharged_mt;

                        return (
                          <Card
                            key={activity.id}
                            className={cn(
                              "overflow-hidden rounded-2xl border border-navy-100 shadow-[0_1px_2px_rgb(16_36_71/0.04)] dark:border-border",
                              activity.status === "active"    && "ring-1 ring-brand-200 dark:ring-brand-500/30",
                              activity.status === "completed" && "ring-1 ring-emerald-200 dark:ring-emerald-500/30"
                            )}
                          >
                            {/* ── Header ── */}
                            <div className={cn(
                              "flex items-start justify-between gap-3 border-b border-border/70 px-4 py-3.5 lg:px-5",
                              activity.status === "active"    ? "bg-brand-50/60 dark:bg-brand-500/10"    :
                              activity.status === "completed" ? "bg-emerald-50/40 dark:bg-emerald-500/10" :
                              activity.status === "cancelled" ? "bg-muted/40"                             : ""
                            )}>
                              <div className="min-w-0">
                                <div className="flex flex-wrap items-center gap-2">
                                  <p className="font-mono text-[14px] font-bold tracking-tight text-foreground">
                                    {activity.activity_number}
                                  </p>
                                  <Badge className={cn(
                                    "rounded-lg border-0 px-2 text-[10px] font-semibold capitalize",
                                    activity.status === "active"    ? "bg-brand-600 text-white"                                            :
                                    activity.status === "completed" ? "bg-emerald-600 text-white"                                          :
                                    activity.status === "cancelled" ? "bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300"   :
                                    "bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300"
                                  )}>
                                    {activity.status}
                                  </Badge>
                                </div>
                                {activity.vessel_name && (
                                  <p className="mt-1 flex items-center gap-1.5 text-[12px] font-medium text-foreground/80">
                                    <Ship className="h-3.5 w-3.5 shrink-0 text-muted-foreground" strokeWidth={2} />
                                    {activity.vessel_name}
                                  </p>
                                )}
                                <p className="mt-0.5 text-[11px] tabular-nums text-muted-foreground">
                                  {activity.status === "completed" && activity.completed_at
                                    ? `Completed ${formatDateTime(activity.completed_at)}`
                                    : activity.started_at
                                    ? `Started ${formatDateTime(activity.started_at)}`
                                    : `Assigned ${formatDate(activity.created_at)}`}
                                </p>
                              </div>

                              {/* BM cancel (when active or pending) */}
                              {isBM && activity.status !== "completed" && activity.status !== "cancelled" && (
                                <Button
                                  size="sm" variant="ghost"
                                  className="h-8 shrink-0 text-xs font-semibold text-destructive hover:text-destructive"
                                  disabled={cancelActivityMutation.isPending}
                                  onClick={() => cancelActivityMutation.mutate(activity.id)}
                                >
                                  Cancel
                                </Button>
                              )}
                            </div>

                            {/* ── Branch: vessel-only gets the new commence/updates/complete/
                                 quantities flow; full_operation keeps the old ROB-session +
                                 6-stage tracker byte-for-byte, fully untouched. ── */}
                            {op.type !== "vessel_only" ? <>

                            {/* ── Initial ROB strip (BM-editable, always shown while not cancelled) ── */}
                            {activity.status !== "cancelled" && (
                              <div className="px-5 py-2.5 border-t flex items-center justify-between gap-3 bg-muted/10">
                                <div className="flex items-center gap-2 min-w-0">
                                  <span className="text-[10px] uppercase tracking-wide text-muted-foreground font-medium shrink-0">
                                    Initial ROB
                                  </span>
                                  {editingRobActivityId === activity.id ? (
                                    <div className="flex items-center gap-1.5">
                                      <Input
                                        type="number" step="0.001"
                                        className="h-6 text-xs w-28 font-mono"
                                        value={editRobValue}
                                        onChange={(e) => setEditRobValue(e.target.value)}
                                        autoFocus
                                      />
                                      <Button
                                        size="sm" className="h-6 px-2 text-xs"
                                        disabled={!editRobValue || patchInitialRobMutation.isPending}
                                        onClick={() => patchInitialRobMutation.mutate({ activityId: activity.id, value: editRobValue })}
                                      >
                                        {patchInitialRobMutation.isPending ? <Spinner size={12} /> : "Save"}
                                      </Button>
                                      <Button
                                        size="sm" variant="ghost" className="h-6 px-2 text-xs"
                                        onClick={() => { setEditingRobActivityId(null); setEditRobValue(""); }}
                                      >
                                        Cancel
                                      </Button>
                                    </div>
                                  ) : (
                                    <span className="text-xs font-mono font-semibold">
                                      {activity.initial_rob_mt
                                        ? `${parseFloat(activity.initial_rob_mt).toFixed(3)} MT`
                                        : <span className="text-muted-foreground">—</span>}
                                    </span>
                                  )}
                                </div>
                                {isBM && activity.status !== "completed" && editingRobActivityId !== activity.id && (
                                  <Button
                                    size="sm" variant="ghost"
                                    className="h-6 px-2 text-xs text-muted-foreground hover:text-foreground shrink-0"
                                    onClick={() => {
                                      setEditingRobActivityId(activity.id);
                                      setEditRobValue(activity.initial_rob_mt
                                        ? parseFloat(activity.initial_rob_mt).toFixed(3)
                                        : "");
                                    }}
                                  >
                                    <Pencil className="w-3 h-3 mr-1" />Edit
                                  </Button>
                                )}
                                {isBM && activity.status === "completed" && (
                                  <span className="text-[10px] text-muted-foreground italic shrink-0">locked</span>
                                )}
                              </div>
                            )}

                            {/* ── ROB data strip ── */}
                            {hasReceipt && (
                              <div className="grid grid-cols-4 gap-px border-t bg-muted/20">
                                {[
                                  ["Prev ROB",  activity.previous_rob_mt],
                                  ["Discharged", activity.vessel_received_mt],
                                  ["New ROB",   activity.new_rob_mt],
                                  ["Variance",  activity.variance_mt],
                                ].map(([lbl, val]) => (
                                  <div key={String(lbl)} className="bg-background px-3.5 py-2">
                                    <p className="text-[9px] text-muted-foreground uppercase tracking-wide">{lbl}</p>
                                    <p className={`text-xs font-semibold font-mono ${
                                      lbl === "Variance" && val && parseFloat(String(val)) > 0 ? "text-amber-600" : ""
                                    }`}>
                                      {val
                                        ? `${lbl === "Variance" && parseFloat(String(val)) > 0 ? "+" : ""}${parseFloat(String(val)).toFixed(2)}`
                                        : "—"}
                                    </p>
                                  </div>
                                ))}
                              </div>
                            )}
                            {hasDischarge && (
                              <div className="grid grid-cols-3 gap-px border-t bg-muted/20">
                                {[
                                  ["Discharged", activity.quantity_discharged_mt],
                                  ["Final ROB",  activity.final_rob_mt],
                                  ["Spillage",   activity.spillage_mt],
                                ].map(([lbl, val]) => (
                                  <div key={String(lbl)} className="bg-emerald-50/40 px-3.5 py-2">
                                    <p className="text-[9px] text-muted-foreground uppercase tracking-wide">{lbl}</p>
                                    <p className={`text-xs font-semibold font-mono ${lbl === "Spillage" && val && parseFloat(String(val)) > 0 ? "text-amber-600" : "text-emerald-700"}`}>
                                      {val && parseFloat(String(val)) > 0
                                        ? `${parseFloat(String(val)).toFixed(3)} L`
                                        : "—"}
                                    </p>
                                  </div>
                                ))}
                              </div>
                            )}

                            {/* ── Completed summary ── */}
                            {activity.status === "completed" && (
                              <div className="px-5 py-3 border-t text-xs text-muted-foreground space-y-0.5">
                                {activity.completion_notes && <p className="italic">{activity.completion_notes}</p>}
                                <p>ROB updated on vessel · Record locked for audit · BM &amp; Finance notified.</p>
                              </div>
                            )}

                            {/* ── Per-vessel stage flow — cast off through discharge completed.
                                 Independent of the ROB session status above (Reliant's own
                                 barge's physical journey, not the truck→barge replenishment). ── */}
                            {activity.status !== "cancelled" && (() => {
                              const stageIdx = VESSEL_STAGES.findIndex((s) => s.value === activity.stage);
                              const nextStage = VESSEL_STAGES[stageIdx + 1];
                              const isFormOpen = stageFormActivityId === activity.id;
                              return (
                                <div className="border-t px-5 py-3.5 space-y-3">
                                  <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Vessel Stage</p>
                                  <div className="flex items-center gap-1 overflow-x-auto pb-1">
                                    {VESSEL_STAGES.map((s, i) => {
                                      const done = i <= stageIdx;
                                      const current = i === stageIdx + 1;
                                      // The HSE check tied to this stage, if any — shown inline so
                                      // the checklist status is visible on the progress line itself,
                                      // not only in the separate section further down.
                                      const hsePhase = HSE_PHASES.find((p) => p.atStage === s.value);
                                      const hseRecorded = hsePhase ? !!activity[hsePhase.resultField] : false;
                                      return (
                                        <div key={s.value} className="flex items-center gap-1 shrink-0">
                                          <div className="flex flex-col items-center gap-0.5">
                                            <div className="flex items-center gap-1">
                                              <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold ${
                                                done ? "bg-emerald-500 text-white" : current ? "bg-primary text-white" : "bg-muted text-muted-foreground"
                                              }`}>
                                                {done ? "✓" : i + 1}
                                              </div>
                                              <span className={`text-[10px] ${done ? "text-muted-foreground line-through" : current ? "font-semibold" : "text-muted-foreground"}`}>
                                                {s.label}
                                              </span>
                                            </div>
                                            {hsePhase && i <= stageIdx && (
                                              <span className={`flex items-center gap-0.5 text-[8px] font-medium whitespace-nowrap ${hseRecorded ? "text-emerald-600" : "text-amber-600"}`}>
                                                <ShieldCheck className="w-2.5 h-2.5 shrink-0" />
                                                {hsePhase.label} HSE {hseRecorded ? "✓" : "pending"}
                                              </span>
                                            )}
                                          </div>
                                          {i < VESSEL_STAGES.length - 1 && <ChevronRight className="w-2.5 h-2.5 text-muted-foreground/30 shrink-0" />}
                                        </div>
                                      );
                                    })}
                                  </div>

                                  {/* Per-stage timestamps already logged */}
                                  {stageIdx >= 0 && (
                                    <div className="grid grid-cols-3 gap-x-3 gap-y-1 text-[10px] text-muted-foreground">
                                      {VESSEL_STAGES.slice(0, stageIdx + 1).map((s) => {
                                        const key = `stage_${s.value}_at` as keyof VesselActivity;
                                        const val = activity[key] as string | undefined;
                                        return val ? <span key={s.value}>{s.label}: {formatDateTime(val)}</span> : null;
                                      })}
                                    </div>
                                  )}

                                  {canAct && nextStage && (
                                    isFormOpen ? (
                                      <div className="rounded-lg border bg-muted/30 p-3 space-y-2">
                                        <p className="text-xs font-semibold">Log "{nextStage.label}"</p>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                          <div className="space-y-1">
                                            <Label className="text-[10px] text-muted-foreground">Occurred At</Label>
                                            <Input type="datetime-local" className="h-9 sm:h-8 text-xs" value={stageOccurredAt} onChange={(e) => setStageOccurredAt(e.target.value)} />
                                          </div>
                                        </div>
                                        <div className="space-y-1">
                                          <Label className="text-[10px] text-muted-foreground">Comment (optional)</Label>
                                          <Textarea className="text-xs min-h-12.5 resize-none" value={stageComment} onChange={(e) => setStageComment(e.target.value)} placeholder="Progress notes, delays, explanations…" />
                                        </div>
                                        <div className="flex gap-2">
                                          <Button
                                            size="sm" className="flex-1 text-xs"
                                            disabled={!stageOccurredAt || advanceStageMutation.isPending}
                                            onClick={() => advanceStageMutation.mutate({ activityId: activity.id, stage: nextStage.value })}
                                          >
                                            {advanceStageMutation.isPending ? <Spinner size={14} /> : `Confirm ${nextStage.label}`}
                                          </Button>
                                          <Button size="sm" variant="ghost" className="text-xs" onClick={() => { setStageFormActivityId(null); setStageOccurredAt(""); setStageComment(""); }}>Cancel</Button>
                                        </div>
                                      </div>
                                    ) : (
                                      <Button
                                        size="sm" variant="outline" className="text-xs gap-1.5"
                                        onClick={() => { setStageFormActivityId(activity.id); setStageOccurredAt(""); setStageComment(""); }}
                                      >
                                        <ChevronRight className="w-3.5 h-3.5" />Log "{nextStage.label}"
                                      </Button>
                                    )
                                  )}

                                  {/* Cast Off client block. Shown from Cast Off onwards and
                                      editable for the rest of the run — a contact remembered
                                      late is still worth recording, and a wrong address found
                                      afterwards still needs fixing. */}
                                  {canAct && stageIdx >= VESSEL_STAGES.findIndex((s) => s.value === "cast_off") && (
                                    <div className="pt-1">
                                      {castOffFormActivityId === activity.id ? (
                                        <div className="rounded-lg border bg-muted/30 p-3 space-y-2">
                                          <p className="text-xs font-semibold">Client Details</p>
                                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                            <div className="space-y-1">
                                              <Label className="text-[10px] text-muted-foreground">Client Name</Label>
                                              <Input className="h-9 sm:h-8 text-xs" value={castOffClient} onChange={(e) => setCastOffClient(e.target.value)} placeholder="Client company…" />
                                            </div>
                                            <div className="space-y-1">
                                              <Label className="text-[10px] text-muted-foreground">Vessel Name</Label>
                                              <Input className="h-9 sm:h-8 text-xs" value={castOffVessel} onChange={(e) => setCastOffVessel(e.target.value)} placeholder="Receiving vessel…" />
                                            </div>
                                          </div>
                                          <div className="space-y-1">
                                            <Label className="text-[10px] text-muted-foreground">Email Recipients</Label>
                                            {castOffEmails.map((em, i) => (
                                              <div key={i} className="flex gap-2">
                                                <Input
                                                  type="email" className="h-9 sm:h-8 text-xs flex-1"
                                                  placeholder="name@company.com"
                                                  value={em}
                                                  onChange={(e) => setCastOffEmails((rows) => rows.map((r, idx) => idx === i ? e.target.value : r))}
                                                />
                                                {castOffEmails.length > 1 && (
                                                  <Button size="sm" variant="ghost" className="h-9 sm:h-8 px-2 text-xs text-muted-foreground"
                                                    onClick={() => setCastOffEmails((rows) => rows.filter((_, idx) => idx !== i))}>
                                                    Remove
                                                  </Button>
                                                )}
                                              </div>
                                            ))}
                                            <Button size="sm" variant="outline" className="text-xs gap-1.5"
                                              onClick={() => setCastOffEmails((rows) => [...rows, ""])}>
                                              <PlusCircle className="w-3.5 h-3.5" />Add Email
                                            </Button>
                                          </div>
                                          <p className="text-[10px] text-muted-foreground">
                                            Saving only records these contacts — no email is sent until it is approved and sent.
                                          </p>
                                          <div className="flex gap-2">
                                            <Button size="sm" className="flex-1 text-xs" disabled={setCastOffContactsMutation.isPending}
                                              onClick={() => setCastOffContactsMutation.mutate(activity.id)}>
                                              {setCastOffContactsMutation.isPending ? <Spinner size={14} /> : "Save Client Details"}
                                            </Button>
                                            <Button size="sm" variant="ghost" className="text-xs" onClick={closeCastOffForm}>Cancel</Button>
                                          </div>
                                        </div>
                                      ) : activity.cast_off_client_name || activity.cast_off_client_emails?.length ? (
                                        <div className="rounded-md border px-3 py-2 text-xs space-y-1">
                                          <div className="flex items-center justify-between gap-2">
                                            <span className="font-semibold">{activity.cast_off_client_name || "Client"}</span>
                                            <button className={cn(INLINE_LINK, "shrink-0")} onClick={() => openCastOffForm(activity)}>Edit</button>
                                          </div>
                                          {activity.cast_off_client_vessel_name && (
                                            <p className="text-muted-foreground">Vessel: {activity.cast_off_client_vessel_name}</p>
                                          )}
                                          {!!activity.cast_off_client_emails?.length && (
                                            <p className="text-muted-foreground break-words">
                                              {activity.cast_off_client_emails.join(", ")}
                                            </p>
                                          )}
                                        </div>
                                      ) : (
                                        <Button size="sm" variant="outline" className="text-xs gap-1.5" onClick={() => openCastOffForm(activity)}>
                                          <PlusCircle className="w-3.5 h-3.5" />Add Client Details
                                        </Button>
                                      )}
                                    </div>
                                  )}

                                  {/* HSE — three checks, each unlocked by its own stage and
                                      recorded separately. Non-blocking throughout: a failed
                                      item is recorded, never enforced, and never gates the
                                      stage it sits under. */}
                                  {canAct && HSE_PHASES.map((p) => {
                                    const unlockIdx = VESSEL_STAGES.findIndex((s) => s.value === p.atStage);
                                    if (stageIdx < unlockIdx) return null;   // stage not reached yet
                                    const result = activity[p.resultField] as string | undefined;
                                    const isOpen = hseFormActivityId === activity.id && hseFormPhase === p.phase;
                                    const isCorrectingThis = isOpen && hseIsCorrecting;
                                    return (
                                      <div key={p.phase} className="pt-1">
                                        {result && !isCorrectingThis ? (
                                          <div className={`rounded-md px-3 py-2 text-xs flex items-center justify-between gap-2 ${result === "satisfactory" ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>
                                            <span className="flex items-center gap-2">
                                              <ShieldCheck className="w-3.5 h-3.5 shrink-0" />
                                              {p.label} HSE recorded — {result === "satisfactory" ? "Satisfactory" : "Issues noted (recorded, non-blocking)"}
                                            </span>
                                            {isBM && (
                                              <button className={cn(INLINE_LINK, "shrink-0")} onClick={() => openHseCorrection(activity, p)}>Correct</button>
                                            )}
                                          </div>
                                        ) : isOpen ? (
                                          <div className="rounded-lg border bg-muted/30 p-3 space-y-2">
                                            <p className="text-xs font-semibold">{isCorrectingThis ? `Correct ${p.label} HSE Checklist` : `${p.label} HSE Checklist`}</p>
                                            {hseChecklist.map((item, i) => (
                                              <label key={i} className="flex items-start gap-2 text-xs">
                                                <input type="checkbox" className="mt-0.5 shrink-0" checked={item.passed} onChange={(e) => setHseChecklist((rows) => rows.map((r, idx) => idx === i ? { ...r, passed: e.target.checked } : r))} />
                                                {item.item}
                                              </label>
                                            ))}
                                            <div className="space-y-1">
                                              <Label className="text-[10px] text-muted-foreground">Safety Officer</Label>
                                              <Input className="h-9 sm:h-8 text-xs" placeholder="Name of the officer signing off…" value={hseOfficer} onChange={(e) => setHseOfficer(e.target.value)} />
                                            </div>
                                            <Textarea className="text-xs min-h-12.5 resize-none" placeholder="Notes…" value={hseNotes} onChange={(e) => setHseNotes(e.target.value)} />
                                            {isCorrectingThis && (
                                              <Textarea className="text-xs min-h-10 resize-none" placeholder="Reason for correction (required)…" value={hseCorrectReason} onChange={(e) => setHseCorrectReason(e.target.value)} />
                                            )}
                                            <div className="flex gap-2">
                                              <Button
                                                size="sm" className="flex-1 text-xs"
                                                disabled={recordHseMutation.isPending || (isCorrectingThis && !hseCorrectReason.trim())}
                                                onClick={() => recordHseMutation.mutate(activity.id)}
                                              >
                                                {recordHseMutation.isPending ? <Spinner size={14} /> : isCorrectingThis ? "Save Correction" : `Submit ${p.label} Checklist`}
                                              </Button>
                                              <Button size="sm" variant="ghost" className="text-xs" onClick={closeHseForm}>Cancel</Button>
                                            </div>
                                          </div>
                                        ) : (
                                          <Button size="sm" variant="outline" className="text-xs gap-1.5" onClick={() => openHseForm(activity.id, p)}>
                                            <ShieldCheck className="w-3.5 h-3.5" />Record {p.label} HSE
                                          </Button>
                                        )}
                                      </div>
                                    );
                                  })}

                                  {/* Discharge quantities — GOV/VCF/density in, GSV/MTvac computed */}
                                  {canAct && stageIdx >= VESSEL_STAGES.findIndex((s) => s.value === "commence_discharge") && (
                                    <div className="pt-1">
                                      {activity.gsv ? (
                                        <div className="grid grid-cols-4 gap-px border rounded-md overflow-hidden text-xs">
                                          {[["GOV", activity.gov], ["VCF", activity.vcf], ["GSV", activity.gsv], ["MTvac", activity.mt_vacuum]].map(([lbl, val]) => (
                                            <div key={String(lbl)} className="bg-muted/20 px-2.5 py-1.5">
                                              <p className="text-[9px] text-muted-foreground uppercase">{lbl}</p>
                                              <p className="font-mono font-semibold">{val ? parseFloat(String(val)).toLocaleString() : "—"}</p>
                                            </div>
                                          ))}
                                        </div>
                                      ) : dischargeQtyActivityId === activity.id ? (
                                        <div className="rounded-lg border bg-muted/30 p-3 space-y-2">
                                          <p className="text-xs font-semibold">Discharge Quantities</p>
                                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                                            <div className="space-y-1">
                                              <Label className="text-[10px] text-muted-foreground">GOV</Label>
                                              <Input type="number" className="h-8 text-xs" value={dqGov} onChange={(e) => setDqGov(e.target.value)} />
                                            </div>
                                            <div className="space-y-1">
                                              <Label className="text-[10px] text-muted-foreground">VCF</Label>
                                              <Input type="number" step="0.0001" className="h-8 text-xs" value={dqVcf} onChange={(e) => setDqVcf(e.target.value)} />
                                            </div>
                                            <div className="space-y-1">
                                              <Label className="text-[10px] text-muted-foreground">Density</Label>
                                              <Input type="number" step="0.0001" className="h-8 text-xs" value={dqDensity} onChange={(e) => setDqDensity(e.target.value)} />
                                            </div>
                                          </div>
                                          <div className="flex gap-2">
                                            <Button
                                              size="sm" className="flex-1 text-xs"
                                              disabled={!dqGov || !dqVcf || !dqDensity || recordDischargeQtyMutation.isPending}
                                              onClick={() => recordDischargeQtyMutation.mutate(activity.id)}
                                            >
                                              {recordDischargeQtyMutation.isPending ? <Spinner size={14} /> : "Compute GSV/MTvac"}
                                            </Button>
                                            <Button size="sm" variant="ghost" className="text-xs" onClick={closeDischargeQtyForm}>Cancel</Button>
                                          </div>
                                        </div>
                                      ) : (
                                        <Button size="sm" variant="outline" className="text-xs gap-1.5" onClick={() => openDischargeQtyForm(activity.id)}>
                                          <FileText className="w-3.5 h-3.5" />Record Discharge Quantities
                                        </Button>
                                      )}
                                    </div>
                                  )}

                                  {/* Comments log */}
                                  {activity.comments.length > 0 && (
                                    <div className="pt-1 space-y-1">
                                      <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Comments</p>
                                      {activity.comments.map((c) => (
                                        <div key={c.id} className="text-[11px] text-muted-foreground border-l-2 border-muted pl-2">
                                          <span className="font-medium text-foreground">{c.recorded_by_name ?? "—"}</span>
                                          {c.stage && <span className="ml-1 text-muted-foreground">({VESSEL_STAGES.find((s) => s.value === c.stage)?.label ?? c.stage})</span>}
                                          <span className="ml-1">{formatDateTime(c.recorded_at)}</span>
                                          <p className="text-foreground/80">{c.comment}</p>
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              );
                            })()}


                            </> : <>

                            {/* ── Vessel-only: commence -> updates -> complete -> quantities ── */}
                            {activity.status !== "cancelled" && (
                              <div className="border-t">

                                {/* Commence */}
                                {!activity.commence_system_at ? (
                                  canAct && (
                                    <div className="px-5 py-3.5">
                                      {commenceFormActivityId === activity.id ? (
                                        <div className="rounded-lg border bg-muted/30 p-3 space-y-2">
                                          <Label className="text-[10px] text-muted-foreground">Commenced At</Label>
                                          <Input type="datetime-local" className="h-9 sm:h-8 text-xs" value={commenceUserAt} onChange={(e) => setCommenceUserAt(e.target.value)} />
                                          <Label className="text-[10px] text-muted-foreground">Description (optional)</Label>
                                          <Textarea className="text-xs min-h-12.5 resize-none" placeholder="Any notes about how the vessel operation is commencing…" value={commenceDescription} onChange={(e) => setCommenceDescription(e.target.value)} />
                                          <div className="flex gap-2">
                                            <Button size="sm" className="flex-1 text-xs" disabled={!commenceUserAt || commenceMutation.isPending} onClick={() => commenceMutation.mutate(activity.id)}>
                                              {commenceMutation.isPending ? <Spinner size={14} /> : "Mark Loading Commenced"}
                                            </Button>
                                            <Button size="sm" variant="ghost" className="text-xs" onClick={() => { setCommenceFormActivityId(null); setCommenceUserAt(""); setCommenceDescription(""); }}>Cancel</Button>
                                          </div>
                                        </div>
                                      ) : (
                                        <Button size="sm" className="text-xs gap-1.5" onClick={() => { setCommenceFormActivityId(activity.id); setCommenceUserAt(""); setCommenceDescription(""); }}>
                                          <PlayCircle className="w-3.5 h-3.5" />Mark Loading Commenced
                                        </Button>
                                      )}
                                    </div>
                                  )
                                ) : (
                                  <div className="px-5 py-3.5 space-y-3">

                                    {/* ── Stages 1–2: LOADING (happens once on the barge run) ── */}
                                    <div>
                                      <SectionHead
                                        title="Loading"
                                        subtitle="Stages 1–2 · happens once, at the source"
                                        action={
                                          isBM && editTimingActivityId !== activity.id ? (
                                            <button className={INLINE_LINK} onClick={() => openEditTiming(activity)}>Correct a timing</button>
                                          ) : undefined
                                        }
                                      />

                                      {editTimingActivityId === activity.id ? (
                                        <div className="rounded-lg border bg-muted/30 p-3 space-y-2">
                                          <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Correct the loading record</p>
                                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                            <div className="space-y-1">
                                              <Label className="text-[10px] text-muted-foreground">Commenced — you entered</Label>
                                              <Input type="datetime-local" className="h-9 sm:h-8 text-xs" value={editCommenceUserAt} onChange={(e) => setEditCommenceUserAt(e.target.value)} />
                                            </div>
                                            <div className="space-y-1">
                                              <Label className="text-[10px] text-muted-foreground">Commenced — system recorded</Label>
                                              <Input type="datetime-local" className="h-9 sm:h-8 text-xs" value={editCommenceSystemAt} onChange={(e) => setEditCommenceSystemAt(e.target.value)} />
                                            </div>
                                            <div className="space-y-1">
                                              <Label className="text-[10px] text-muted-foreground">Completed — you entered</Label>
                                              <Input type="datetime-local" className="h-9 sm:h-8 text-xs" value={editCompleteUserAt} onChange={(e) => setEditCompleteUserAt(e.target.value)} disabled={!activity.complete_system_at} />
                                            </div>
                                            <div className="space-y-1">
                                              <Label className="text-[10px] text-muted-foreground">Completed — system recorded</Label>
                                              <Input type="datetime-local" className="h-9 sm:h-8 text-xs" value={editCompleteSystemAt} onChange={(e) => setEditCompleteSystemAt(e.target.value)} disabled={!activity.complete_system_at} />
                                            </div>
                                          </div>
                                          <Label className="text-[10px] text-muted-foreground">Commenced comment</Label>
                                          <Textarea className="text-xs min-h-10 resize-none" value={editCommenceDesc} onChange={(e) => setEditCommenceDesc(e.target.value)} />
                                          <Label className="text-[10px] text-muted-foreground">Completed comment</Label>
                                          <Textarea className="text-xs min-h-10 resize-none" value={editCompleteDesc} onChange={(e) => setEditCompleteDesc(e.target.value)} />
                                          <Textarea className="text-xs min-h-12.5 resize-none" placeholder="Reason for correction (required)…" value={editTimingReason} onChange={(e) => setEditTimingReason(e.target.value)} />
                                          <div className="flex gap-2">
                                            <Button size="sm" className="flex-1 text-xs" disabled={!editTimingReason.trim() || correctTimingMutation.isPending} onClick={() => correctTimingMutation.mutate(activity.id)}>
                                              {correctTimingMutation.isPending ? <Spinner size={14} /> : "Save Correction"}
                                            </Button>
                                            <Button size="sm" variant="ghost" className="text-xs" onClick={() => setEditTimingActivityId(null)}>Cancel</Button>
                                          </div>
                                        </div>
                                      ) : (
                                        <div className="rounded-xl border border-navy-100 bg-background px-3.5 py-1 dark:border-border">
                                          <JourneyStage
                                            number={1}
                                            label="Loading Commenced"
                                            systemAt={activity.commence_system_at}
                                            userAt={activity.commence_user_at}
                                            done={!!activity.commence_system_at}
                                            current={false}
                                          />
                                          <JourneyStage
                                            number={2}
                                            label="Loading Completed"
                                            systemAt={activity.complete_system_at}
                                            userAt={activity.complete_user_at}
                                            done={!!activity.complete_system_at}
                                            current={!activity.complete_system_at}
                                            last
                                          />
                                        </div>
                                      )}
                                      {isBM && (
                                        editInitialRobId === activity.id ? (
                                          <div className="rounded-lg border bg-muted/30 p-3 space-y-2 mt-2">
                                            <Label className="text-[10px] text-muted-foreground">Initial ROB (MT)</Label>
                                            <Input type="number" className="h-8 text-xs" value={editInitialRob} onChange={(e) => setEditInitialRob(e.target.value)} />
                                            <Textarea className="text-xs min-h-10 resize-none" placeholder="Reason for correction (required)…" value={editInitialRobReason} onChange={(e) => setEditInitialRobReason(e.target.value)} />
                                            <div className="flex gap-2">
                                              <Button size="sm" className="flex-1 text-xs" disabled={!editInitialRob || !editInitialRobReason.trim() || editInitialRobMutation.isPending} onClick={() => editInitialRobMutation.mutate(activity.id)}>
                                                {editInitialRobMutation.isPending ? <Spinner size={14} /> : "Save Correction"}
                                              </Button>
                                              <Button size="sm" variant="ghost" className="text-xs" onClick={() => setEditInitialRobId(null)}>Cancel</Button>
                                            </div>
                                          </div>
                                        ) : (
                                          <p className="text-[10px] text-muted-foreground mt-1.5">
                                            Initial ROB: <span className="font-mono">{activity.initial_rob_mt ? parseFloat(activity.initial_rob_mt).toLocaleString() : "—"}</span>
                                            <button className="ml-1.5 text-primary underline" onClick={() => { setEditInitialRobId(activity.id); setEditInitialRob(activity.initial_rob_mt ?? ""); setEditInitialRobReason(""); }}>Correct</button>
                                          </p>
                                        )
                                      )}

                                      {(activity.commence_description || activity.complete_description) && (
                                        <div className="mt-1.5 space-y-1">
                                          {activity.commence_description && (
                                            <p className="text-[11px] text-muted-foreground italic">
                                              <span className="not-italic font-medium">Commenced:</span> {activity.commence_description}
                                            </p>
                                          )}
                                          {activity.complete_description && (
                                            <p className="text-[11px] text-muted-foreground italic">
                                              <span className="not-italic font-medium">Completed:</span> {activity.complete_description}
                                            </p>
                                          )}
                                        </div>
                                      )}
                                    </div>

                                    {/* HSE checklist — available any time once commenced, non-blocking.
                                         Gated on BM/OS to match the backend's _hse_roles; the assigned
                                         Cargo Superintendent would otherwise see a button that 403s. */}
                                    {(isBM || isOS) && (
                                      <div>
                                        {activity.hse_result && correctHseTarget?.id !== activity.id ? (
                                          <div className={cn(
                                                              "flex items-center justify-between gap-2 rounded-xl border px-3.5 py-2.5 text-[12px] font-medium",
                                                              activity.hse_result === "satisfactory"
                                                                ? "border-emerald-200 bg-emerald-50/70 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300"
                                                                : "border-amber-200 bg-amber-50/70 text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300"
                                                            )}>
                                            <span className="flex items-center gap-2">
                                              <ShieldCheck className="w-3.5 h-3.5 shrink-0" />
                                              HSE checklist recorded — {activity.hse_result === "satisfactory" ? "Satisfactory" : "Issues noted (recorded, non-blocking)"}
                                            </span>
                                            {isBM && (
                                              <button className={cn(INLINE_LINK, "shrink-0")} onClick={() => openCorrectHse("activity", activity.id, activity.hse_checklist, activity.hse_notes)}>Correct</button>
                                            )}
                                          </div>
                                        ) : correctHseTarget?.kind === "activity" && correctHseTarget.id === activity.id ? (
                                          <div className="rounded-lg border bg-muted/30 p-3 space-y-2">
                                            <p className="text-xs font-semibold">Correct Transshipment Safety Checklist</p>
                                            <div className="space-y-1">
                                              <Label className="text-[10px] text-muted-foreground">Name of Safety Officer</Label>
                                              <Input className="h-8 text-xs" value={hseOfficer} onChange={(e) => setHseOfficer(e.target.value)} />
                                            </div>
                                            {renderHseChecklist(hseChecklist, setHseChecklist)}
                                            <Textarea className="text-xs min-h-12.5 resize-none" placeholder="Overall notes…" value={hseNotes} onChange={(e) => setHseNotes(e.target.value)} />
                                            <Textarea className="text-xs min-h-10 resize-none" placeholder="Reason for correction (required)…" value={correctHseReason} onChange={(e) => setCorrectHseReason(e.target.value)} />
                                            <div className="flex gap-2">
                                              <Button size="sm" className="flex-1 text-xs" disabled={!correctHseReason.trim() || correctHseMutation.isPending} onClick={() => correctHseMutation.mutate()}>
                                                {correctHseMutation.isPending ? <Spinner size={14} /> : "Save Correction"}
                                              </Button>
                                              <Button size="sm" variant="ghost" className="text-xs" onClick={() => setCorrectHseTarget(null)}>Cancel</Button>
                                            </div>
                                          </div>
                                        ) : hseFormActivityId === activity.id ? (
                                          <div className="rounded-lg border bg-muted/30 p-3 space-y-2">
                                            <p className="text-xs font-semibold">Transshipment Safety Checklist</p>
                                            <div className="grid grid-cols-2 gap-2 text-[11px] rounded-md border bg-background p-2">
                                              <div><span className="text-muted-foreground">Bunker Tanker:</span> {activity.vessel_name ?? "—"}</div>
                                              <div><span className="text-muted-foreground">Delivery Location:</span> {op.discharge_location ?? "—"}</div>
                                              <div><span className="text-muted-foreground">Loading Commenced:</span> {activity.commence_system_at ? formatDateTime(activity.commence_system_at) : "—"}</div>
                                              <div><span className="text-muted-foreground">Loading Completed:</span> {activity.complete_system_at ? formatDateTime(activity.complete_system_at) : "—"}</div>
                                            </div>
                                            <div className="space-y-1">
                                              <Label className="text-[10px] text-muted-foreground">Name of Safety Officer</Label>
                                              <Input className="h-8 text-xs" value={hseOfficer} onChange={(e) => setHseOfficer(e.target.value)} />
                                            </div>
                                            {renderHseChecklist(hseChecklist, setHseChecklist)}
                                            <Textarea className="text-xs min-h-12.5 resize-none" placeholder="Overall notes…" value={hseNotes} onChange={(e) => setHseNotes(e.target.value)} />
                                            <div className="flex gap-2">
                                              <Button size="sm" className="flex-1 text-xs" disabled={recordHseMutation.isPending} onClick={() => recordHseMutation.mutate(activity.id)}>
                                                {recordHseMutation.isPending ? <Spinner size={14} /> : "Submit HSE Checklist"}
                                              </Button>
                                              <Button size="sm" variant="ghost" className="text-xs" onClick={closeHseForm}>Cancel</Button>
                                            </div>
                                          </div>
                                        ) : (
                                          <Button size="sm" variant="outline" className="text-xs gap-1.5" onClick={() => openHseForm(activity.id)}>
                                            <ShieldCheck className="w-3.5 h-3.5" />Record HSE Checklist
                                          </Button>
                                        )}
                                      </div>
                                    )}

                                    {/* Updates timeline — reverse-chronological, system-time only */}
                                    <div>
                                      <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-1.5">Updates</p>
                                      {activity.updates.length > 0 && (
                                        <div className="space-y-1.5 mb-2 max-h-56 overflow-y-auto pr-1">
                                          {activity.updates.map((u) => (
                                            <div key={u.id} className="text-[11px] border-l-2 border-muted pl-2 py-0.5">
                                              {editUpdateId === u.id ? (
                                                <div className="rounded-lg border bg-muted/30 p-2 space-y-2">
                                                  <Textarea className="text-xs min-h-15 resize-none" value={editUpdateContent} onChange={(e) => setEditUpdateContent(e.target.value)} />
                                                  <div className="space-y-1">
                                                    <Label className="text-[10px] text-muted-foreground">Replace image (optional)</Label>
                                                    <input type="file" accept="image/*" className="text-xs" onChange={(e) => setEditUpdateImage(e.target.files?.[0] ?? null)} />
                                                  </div>
                                                  <Textarea className="text-xs min-h-10 resize-none" placeholder="Reason for correction (required)…" value={editUpdateReason} onChange={(e) => setEditUpdateReason(e.target.value)} />
                                                  <div className="flex gap-2">
                                                    <Button size="sm" className="flex-1 text-xs" disabled={!editUpdateReason.trim() || !editUpdateContent.trim() || editUpdateMutation.isPending} onClick={() => editUpdateMutation.mutate(u.id)}>
                                                      {editUpdateMutation.isPending ? <Spinner size={14} /> : "Save Correction"}
                                                    </Button>
                                                    <Button size="sm" variant="ghost" className="text-xs" onClick={resetEditUpdate}>Cancel</Button>
                                                  </div>
                                                </div>
                                              ) : (
                                                <>
                                                  <div className="flex items-start justify-between gap-2">
                                                    <div>
                                                      <span className="font-medium text-foreground">{u.recorded_by_name ?? "—"}</span>
                                                      <span className="ml-1 text-muted-foreground">{formatDateTime(u.recorded_at)}</span>
                                                      {u.edited_at && (
                                                        <span className="ml-1.5 text-[9px] text-amber-700 bg-amber-50 rounded px-1 py-px" title={`Corrected by ${u.edited_by_name ?? "BM"}: ${u.edit_reason ?? ""}`}>
                                                          edited
                                                        </span>
                                                      )}
                                                    </div>
                                                    {isBM && (
                                                      <button className={cn(INLINE_LINK, "shrink-0")} onClick={() => openEditUpdate(u)}>Edit</button>
                                                    )}
                                                  </div>
                                                  <p className="text-foreground/80">{u.content}</p>
                                                  {u.image_url && (
                                                    <a href={u.image_url} target="_blank" rel="noopener noreferrer" className="text-primary underline text-[10px]">View image</a>
                                                  )}
                                                </>
                                              )}
                                            </div>
                                          ))}
                                        </div>
                                      )}
                                      {canAct && (
                                        updateFormActivityId === activity.id ? (
                                          <div className="rounded-lg border bg-muted/30 p-3 space-y-2">
                                            <Textarea className="text-xs min-h-15 resize-none" placeholder="What's happening…" value={updateContent} onChange={(e) => setUpdateContent(e.target.value)} />
                                            <input
                                              ref={updateImageInputRef} type="file" accept="image/*" className="text-xs"
                                              onChange={(e) => setUpdateImageFile(e.target.files?.[0] ?? null)}
                                            />
                                            <div className="flex gap-2">
                                              <Button size="sm" className="flex-1 text-xs" disabled={!updateContent.trim() || addUpdateMutation.isPending} onClick={() => addUpdateMutation.mutate(activity.id)}>
                                                {addUpdateMutation.isPending ? <Spinner size={14} /> : "Post Update"}
                                              </Button>
                                              <Button size="sm" variant="ghost" className="text-xs" onClick={() => { setUpdateFormActivityId(null); setUpdateContent(""); setUpdateImageFile(null); if (updateImageInputRef.current) updateImageInputRef.current.value = ""; }}>Cancel</Button>
                                            </div>
                                          </div>
                                        ) : (
                                          <Button size="sm" variant="outline" className="text-xs gap-1.5" onClick={() => { setUpdateFormActivityId(activity.id); setUpdateContent(""); setUpdateImageFile(null); }}>
                                            <PlusCircle className="w-3.5 h-3.5" />Add Update
                                          </Button>
                                        )
                                      )}
                                    </div>

                                    {/* Complete */}
                                    {!activity.complete_system_at && canAct && (
                                      <div>
                                        {completeFormActivityId === activity.id ? (
                                          <div className="rounded-lg border bg-muted/30 p-3 space-y-2">
                                            <Label className="text-[10px] text-muted-foreground">Completed At</Label>
                                            <Input type="datetime-local" className="h-9 sm:h-8 text-xs" value={completeUserAt} onChange={(e) => setCompleteUserAt(e.target.value)} />
                                            <Label className="text-[10px] text-muted-foreground">Comment (optional)</Label>
                                            <Textarea className="text-xs min-h-12.5 resize-none" placeholder="Any notes on how loading finished — delays, shortfalls, conditions…" value={completeDescription} onChange={(e) => setCompleteDescription(e.target.value)} />
                                            <div className="flex gap-2">
                                              <Button size="sm" className="flex-1 text-xs bg-emerald-700 hover:bg-emerald-800" disabled={!completeUserAt || completeVesselOpMutation.isPending} onClick={() => completeVesselOpMutation.mutate(activity.id)}>
                                                {completeVesselOpMutation.isPending ? <Spinner size={14} /> : "Mark Loading Completed"}
                                              </Button>
                                              <Button size="sm" variant="ghost" className="text-xs" onClick={() => { setCompleteFormActivityId(null); setCompleteUserAt(""); setCompleteDescription(""); }}>Cancel</Button>
                                            </div>
                                          </div>
                                        ) : (
                                          <Button size="sm" className="text-xs gap-1.5 bg-emerald-700 hover:bg-emerald-800" onClick={() => { setCompleteFormActivityId(activity.id); setCompleteUserAt(""); setCompleteDescription(""); }}>
                                            <CheckCircle2 className="w-3.5 h-3.5" />Mark Loading Completed
                                          </Button>
                                        )}
                                      </div>
                                    )}

                                    {/* Loading Received Quantity — visible once Loading Completed, one-time */}
                                    {activity.complete_system_at && (
                                      <div>
                                        <SectionHead
                                          title="Loading Received Quantity"
                                          action={
                                            activity.loading_quantity_recorded_at && isBM && loadReceiptFormActivityId !== activity.id ? (
                                              <button className={INLINE_LINK} onClick={() => openLoadReceiptForm(activity)}>Edit</button>
                                            ) : undefined
                                          }
                                        />
                                        {loadReceiptFormActivityId === activity.id ? (
                                          <div className="rounded-lg border bg-muted/30 p-3 space-y-2">
                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                              <div className="space-y-1">
                                                <Label className="text-[10px] text-muted-foreground">Received Quantity (MT)</Label>
                                                <Input type="number" className="h-8 text-xs" value={loadReceived} onChange={(e) => setLoadReceived(e.target.value)} />
                                              </div>
                                              <div className="space-y-1">
                                                <Label className="text-[10px] text-muted-foreground">Density</Label>
                                                <Input type="number" step="0.0001" className="h-8 text-xs" value={loadDensity} onChange={(e) => setLoadDensity(e.target.value)} />
                                              </div>
                                              <div className="space-y-1">
                                                <Label className="text-[10px] text-muted-foreground">Temp Before Loading (°C)</Label>
                                                <Input type="number" step="0.01" className="h-8 text-xs" value={loadTempBefore} onChange={(e) => setLoadTempBefore(e.target.value)} />
                                              </div>
                                              <div className="space-y-1">
                                                <Label className="text-[10px] text-muted-foreground">Temp After Loading (°C)</Label>
                                                <Input type="number" step="0.01" className="h-8 text-xs" value={loadTempAfter} onChange={(e) => setLoadTempAfter(e.target.value)} />
                                              </div>
                                              <div className="space-y-1">
                                                <Label className="text-[10px] text-muted-foreground">VCF</Label>
                                                <Input type="number" step="0.0001" className="h-8 text-xs" value={loadVcf} onChange={(e) => setLoadVcf(e.target.value)} />
                                              </div>
                                              <div className="space-y-1">
                                                <Label className="text-[10px] text-muted-foreground">GOV</Label>
                                                <Input type="number" className="h-8 text-xs" value={loadGov} onChange={(e) => setLoadGov(e.target.value)} />
                                              </div>
                                            </div>
                                            {loadGov && loadVcf && loadDensity && (
                                              <div className="grid grid-cols-2 gap-px border rounded-md overflow-hidden text-[11px]">
                                                <div className="bg-background px-2.5 py-1.5">
                                                  <p className="text-[9px] text-muted-foreground uppercase">GSV (computed)</p>
                                                  <p className="font-mono font-semibold">{(parseFloat(loadGov) * parseFloat(loadVcf)).toLocaleString()}</p>
                                                </div>
                                                <div className="bg-background px-2.5 py-1.5">
                                                  <p className="text-[9px] text-muted-foreground uppercase">MTvac (computed)</p>
                                                  <p className="font-mono font-semibold">{(parseFloat(loadGov) * parseFloat(loadVcf) * parseFloat(loadDensity)).toLocaleString()}</p>
                                                </div>
                                              </div>
                                            )}
                                            <Textarea className="text-xs min-h-12.5 resize-none" placeholder="Description (optional)…" value={loadDescription} onChange={(e) => setLoadDescription(e.target.value)} />
                                            {activity.loading_quantity_recorded_at && (
                                              <Textarea className="text-xs min-h-10 resize-none" placeholder="Reason for correction (required)…" value={loadReason} onChange={(e) => setLoadReason(e.target.value)} />
                                            )}
                                            <div className="flex gap-2">
                                              <Button
                                                size="sm" className="flex-1 text-xs"
                                                disabled={!loadReceived || !loadDensity || !loadTempBefore || !loadTempAfter || !loadVcf || !loadGov || (!!activity.loading_quantity_recorded_at && !loadReason.trim()) || recordLoadingReceiptMutation.isPending}
                                                onClick={() => recordLoadingReceiptMutation.mutate(activity.id)}
                                              >
                                                {recordLoadingReceiptMutation.isPending ? <Spinner size={14} /> : "Save Loading Receipt"}
                                              </Button>
                                              <Button size="sm" variant="ghost" className="text-xs" onClick={resetLoadReceiptForm}>Cancel</Button>
                                            </div>
                                          </div>
                                        ) : activity.loading_quantity_recorded_at ? (
                                          <QuantityReadout
                                            columns={[
                                              ["Received", `${parseFloat(activity.loading_received_quantity_litres ?? "0").toLocaleString()} MT`],
                                              ["MTVC",     parseFloat(activity.loading_mt_vacuum ?? "0").toLocaleString()],
                                              ["Recorded", formatDateTime(activity.loading_quantity_recorded_at)],
                                            ]}
                                            note={activity.loading_quantity_description}
                                          />
                                        ) : canAct ? (
                                          <Button size="sm" variant="outline" className="text-xs gap-1.5" onClick={() => openLoadReceiptForm(activity)}>
                                            <FileText className="w-3.5 h-3.5" />Record Loading Received Quantity
                                          </Button>
                                        ) : (
                                          <p className="text-xs text-muted-foreground">Not yet recorded</p>
                                        )}
                                      </div>
                                    )}

                                    {/* Receiving Vessels — BM can add at any point once Loading Completed;
                                         each runs its own Cast Off -> Alongside -> Discharge Commenced ->
                                         Discharge Completed sequence, independently. */}
                                    {activity.complete_system_at && (
                                      <div>
                                        <SectionHead
                                          title="Delivery — Receiving Vessels"
                                          subtitle={
                                            <>
                                              Stages 3–6 · repeat per receiving vessel
                                              {activity.legs.length > 0 && ` · ${activity.legs.filter((l) => !l.cancelled_at && l.stage === "discharge_completed").length} of ${activity.legs.filter((l) => !l.cancelled_at).length} complete`}
                                            </>
                                          }
                                          action={
                                            isBM && addLegFormActivityId !== activity.id ? (
                                              <Button size="sm" variant="outline" className="h-8 gap-1.5 text-xs" onClick={() => { setAddLegFormActivityId(activity.id); setNewLegName(""); setNewLegImo(""); setNewLegEta(""); }}>
                                                <PlusCircle className="w-3.5 h-3.5" />Add Receiving Vessel
                                              </Button>
                                            ) : undefined
                                          }
                                        />

                                        {addLegFormActivityId === activity.id && (
                                          <div className="rounded-lg border bg-muted/30 p-3 space-y-2 mb-2">
                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                              <div className="space-y-1">
                                                <Label className="text-[10px] text-muted-foreground">Receiving Vessel Name</Label>
                                                <Input className="h-8 text-xs" value={newLegName} onChange={(e) => setNewLegName(e.target.value)} />
                                              </div>
                                              <div className="space-y-1">
                                                <Label className="text-[10px] text-muted-foreground">IMO Number (optional)</Label>
                                                <Input className="h-8 text-xs" value={newLegImo} onChange={(e) => setNewLegImo(e.target.value)} />
                                              </div>
                                            </div>
                                            <div className="space-y-1">
                                              <Label className="text-[10px] text-muted-foreground">ETA (optional)</Label>
                                              <Input type="datetime-local" className="h-9 sm:h-8 text-xs" value={newLegEta} onChange={(e) => setNewLegEta(e.target.value)} />
                                            </div>
                                            <div className="flex gap-2">
                                              <Button size="sm" className="flex-1 text-xs" disabled={!newLegName.trim() || addLegMutation.isPending} onClick={() => addLegMutation.mutate(activity.id)}>
                                                {addLegMutation.isPending ? <Spinner size={14} /> : "Add Receiving Vessel"}
                                              </Button>
                                              <Button size="sm" variant="ghost" className="text-xs" onClick={() => setAddLegFormActivityId(null)}>Cancel</Button>
                                            </div>
                                          </div>
                                        )}

                                        {activity.legs.length === 0 ? (
                                          <p className="text-xs text-muted-foreground">No receiving vessels added yet.</p>
                                        ) : (
                                          <div className="space-y-3">
                                            {activity.legs.map((leg) => {
                                              const legStageIdx = leg.stage ? LEG_STAGES.findIndex((s) => s.value === leg.stage) : -1;
                                              const nextLegStage = LEG_STAGES[legStageIdx + 1];
                                              return (
                                                <div key={leg.id} className={cn(
                                                  "overflow-hidden rounded-xl border border-navy-100 bg-card dark:border-border",
                                                  leg.cancelled_at && "opacity-60"
                                                )}>
                                                  <div className="flex items-center justify-between gap-3 border-b border-border/70 bg-muted/30 px-3.5 py-2.5">
                                                    <div className="min-w-0">
                                                      <p className="truncate text-[13px] font-bold tracking-tight text-foreground">
                                                        {leg.receiving_vessel_name}{leg.imo_number ? ` • IMO ${leg.imo_number}` : ""}
                                                      </p>
                                                      {leg.eta_at && (
                                                        <p className="text-[11px] tabular-nums text-muted-foreground">
                                                          ETA: {formatDateTime(leg.eta_at)}
                                                        </p>
                                                      )}
                                                    </div>
                                                    <div className="flex items-center gap-2 shrink-0">
                                                      {leg.cancelled_at ? (
                                                        <>
                                                          <Badge variant="outline" className="text-[10px]">Cancelled</Badge>
                                                          {isBM && uncancelLegId !== leg.id && (
                                                            <button className={INLINE_LINK} onClick={() => { setUncancelLegId(leg.id); setUncancelReason(""); }}>Restore</button>
                                                          )}
                                                        </>
                                                      ) : isBM && cancelLegFormId !== leg.id ? (
                                                        <>
                                                          <button className={INLINE_LINK} onClick={() => openEditLeg(leg)}>Edit</button>
                                                          <button className={INLINE_LINK_DANGER} onClick={() => { setCancelLegFormId(leg.id); setCancelLegReason(""); }}>Cancel</button>
                                                        </>
                                                      ) : null}
                                                    </div>
                                                  </div>

                                                  {editLegId === leg.id && (
                                                    <div className="px-3 py-2 border-t bg-muted/10 space-y-2">
                                                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                                        <div className="space-y-1">
                                                          <Label className="text-[10px] text-muted-foreground">Receiving Vessel Name</Label>
                                                          <Input className="h-8 text-xs" value={editLegName} onChange={(e) => setEditLegName(e.target.value)} />
                                                        </div>
                                                        <div className="space-y-1">
                                                          <Label className="text-[10px] text-muted-foreground">IMO Number</Label>
                                                          <Input className="h-8 text-xs" value={editLegImo} onChange={(e) => setEditLegImo(e.target.value)} />
                                                        </div>
                                                      </div>
                                                      <div className="space-y-1">
                                                        <Label className="text-[10px] text-muted-foreground">ETA</Label>
                                                        <Input type="datetime-local" className="h-9 sm:h-8 text-xs" value={editLegEta} onChange={(e) => setEditLegEta(e.target.value)} />
                                                      </div>
                                                      <Textarea className="text-xs min-h-10 resize-none" placeholder="Reason for correction (required)…" value={editLegReason} onChange={(e) => setEditLegReason(e.target.value)} />
                                                      <div className="flex gap-2">
                                                        <Button size="sm" className="flex-1 text-xs" disabled={!editLegName.trim() || !editLegReason.trim() || editLegMutation.isPending} onClick={() => editLegMutation.mutate(leg.id)}>
                                                          {editLegMutation.isPending ? <Spinner size={14} /> : "Save Correction"}
                                                        </Button>
                                                        <Button size="sm" variant="ghost" className="text-xs" onClick={() => setEditLegId(null)}>Cancel</Button>
                                                      </div>
                                                    </div>
                                                  )}

                                                  {uncancelLegId === leg.id && (
                                                    <div className="px-3 py-2 border-t bg-muted/10 space-y-2">
                                                      <Textarea className="text-xs min-h-10 resize-none" placeholder="Reason for restoring (required)…" value={uncancelReason} onChange={(e) => setUncancelReason(e.target.value)} />
                                                      <div className="flex gap-2">
                                                        <Button size="sm" className="flex-1 text-xs" disabled={!uncancelReason.trim() || uncancelLegMutation.isPending} onClick={() => uncancelLegMutation.mutate(leg.id)}>
                                                          {uncancelLegMutation.isPending ? <Spinner size={14} /> : "Restore Receiving Vessel"}
                                                        </Button>
                                                        <Button size="sm" variant="ghost" className="text-xs" onClick={() => setUncancelLegId(null)}>Cancel</Button>
                                                      </div>
                                                    </div>
                                                  )}

                                                  {cancelLegFormId === leg.id && (
                                                    <div className="px-3 py-2 border-t bg-muted/10 space-y-2">
                                                      <Textarea className="text-xs min-h-10 resize-none" placeholder="Reason for cancelling (required)…" value={cancelLegReason} onChange={(e) => setCancelLegReason(e.target.value)} />
                                                      <div className="flex gap-2">
                                                        <Button size="sm" variant="destructive" className="flex-1 text-xs" disabled={!cancelLegReason.trim() || cancelLegMutation.isPending} onClick={() => cancelLegMutation.mutate(leg.id)}>
                                                          {cancelLegMutation.isPending ? <Spinner size={14} /> : "Confirm Cancel"}
                                                        </Button>
                                                        <Button size="sm" variant="ghost" className="text-xs" onClick={() => setCancelLegFormId(null)}>Back</Button>
                                                      </div>
                                                    </div>
                                                  )}

                                                  {leg.cancelled_at ? (
                                                    <p className="px-3 py-2 text-[11px] text-muted-foreground italic">{leg.cancelled_reason}</p>
                                                  ) : (
                                                    <div className="p-3 space-y-3">
                                                      {/* Stages 3–6 for this receiving vessel — continues the
                                                           operation's six-stage journey, numbered to match. */}
                                                      <div className="rounded-xl border border-navy-100 bg-background px-3.5 py-1 dark:border-border">
                                                        {LEG_STAGES.map((s, i) => {
                                                          const rec = leg as unknown as Record<string, string>;
                                                          return (
                                                            <JourneyStage
                                                              key={s.value}
                                                              number={i + 3}
                                                              label={s.label}
                                                              systemAt={rec[`stage_${s.value}_system_at`]}
                                                              userAt={rec[`stage_${s.value}_user_at`]}
                                                              done={i <= legStageIdx}
                                                              current={i === legStageIdx + 1}
                                                              last={i === LEG_STAGES.length - 1}
                                                            />
                                                          );
                                                        })}
                                                      </div>
                                                      {isBM && (
                                                        editLegTimingId === leg.id ? (
                                                          <div className="rounded-lg border bg-muted/30 p-3 space-y-2">
                                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                                              {LEG_STAGES.slice(0, legStageIdx + 1).map((s) => (
                                                                <div key={s.value} className="space-y-1">
                                                                  <Label className="text-[10px] text-muted-foreground">{s.label} (you entered)</Label>
                                                                  <Input
                                                                    type="datetime-local" className="h-9 sm:h-8 text-xs"
                                                                    value={editLegTimingFields[`stage_${s.value}_user_at`] ?? ""}
                                                                    onChange={(e) => setEditLegTimingFields((f) => ({ ...f, [`stage_${s.value}_user_at`]: e.target.value }))}
                                                                  />
                                                                </div>
                                                              ))}
                                                            </div>
                                                            <Textarea className="text-xs min-h-10 resize-none" placeholder="Reason for correction…" value={editLegTimingReason} onChange={(e) => setEditLegTimingReason(e.target.value)} />
                                                            <div className="flex gap-2">
                                                              <Button size="sm" className="flex-1 text-xs" disabled={!editLegTimingReason.trim() || correctLegTimingMutation.isPending} onClick={() => correctLegTimingMutation.mutate(leg.id)}>
                                                                {correctLegTimingMutation.isPending ? <Spinner size={14} /> : "Save Correction"}
                                                              </Button>
                                                              <Button size="sm" variant="ghost" className="text-xs" onClick={() => setEditLegTimingId(null)}>Cancel</Button>
                                                            </div>
                                                          </div>
                                                        ) : legStageIdx >= 0 && (
                                                          <div className="flex items-center gap-3">
                                                            <button className={INLINE_LINK} onClick={() => openEditLegTiming(leg)}>Correct a timing</button>
                                                            {rollbackLegId === leg.id ? null : (
                                                              <button className={INLINE_LINK} onClick={() => { setRollbackLegId(leg.id); setRollbackStage(""); setRollbackReason(""); }}>Roll back a stage</button>
                                                            )}
                                                          </div>
                                                        )
                                                      )}

                                                      {rollbackLegId === leg.id && (
                                                        <div className="rounded-lg border bg-muted/30 p-3 space-y-2">
                                                          <Label className="text-[10px] text-muted-foreground">Roll this receiving vessel back to</Label>
                                                          <Select value={rollbackStage} onValueChange={setRollbackStage}>
                                                            <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Select stage…" /></SelectTrigger>
                                                            <SelectContent>
                                                              {LEG_STAGES.slice(0, Math.max(legStageIdx, 0)).map((st) => (
                                                                <SelectItem key={st.value} value={st.value} className="text-xs">{st.label}</SelectItem>
                                                              ))}
                                                            </SelectContent>
                                                          </Select>
                                                          <Textarea className="text-xs min-h-10 resize-none" placeholder="Reason for rolling back (required)…" value={rollbackReason} onChange={(e) => setRollbackReason(e.target.value)} />
                                                          <p className="text-[10px] text-muted-foreground">A stage cannot be rolled back once a Vessel BDN has been submitted for this receiving vessel — reject that BDN first.</p>
                                                          <div className="flex gap-2">
                                                            <Button size="sm" className="flex-1 text-xs" disabled={!rollbackStage || !rollbackReason.trim() || rollbackLegMutation.isPending} onClick={() => rollbackLegMutation.mutate(leg.id)}>
                                                              {rollbackLegMutation.isPending ? <Spinner size={14} /> : "Roll Back"}
                                                            </Button>
                                                            <Button size="sm" variant="ghost" className="text-xs" onClick={() => setRollbackLegId(null)}>Cancel</Button>
                                                          </div>
                                                        </div>
                                                      )}

                                                      {/* Advance to next stage */}
                                                      {canAct && nextLegStage && (
                                                        legStageFormLegId === leg.id ? (
                                                          <div className="rounded-lg border bg-muted/30 p-3 space-y-2">
                                                            <Label className="text-[10px] text-muted-foreground">{nextLegStage.label} — occurred at</Label>
                                                            <Input type="datetime-local" className="h-9 sm:h-8 text-xs" value={legStageOccurredAt} onChange={(e) => setLegStageOccurredAt(e.target.value)} />
                                                            <div className="flex gap-2">
                                                              <Button
                                                                size="sm" className="flex-1 text-xs"
                                                                disabled={!legStageOccurredAt || advanceLegStageMutation.isPending}
                                                                onClick={() => { setLegStageTarget(nextLegStage.value); advanceLegStageMutation.mutate(leg.id); }}
                                                              >
                                                                {advanceLegStageMutation.isPending ? <Spinner size={14} /> : `Log ${nextLegStage.label}`}
                                                              </Button>
                                                              <Button size="sm" variant="ghost" className="text-xs" onClick={() => { setLegStageFormLegId(null); setLegStageOccurredAt(""); }}>Cancel</Button>
                                                            </div>
                                                          </div>
                                                        ) : (
                                                          <Button size="sm" variant="outline" className="text-xs gap-1.5" onClick={() => { setLegStageFormLegId(leg.id); setLegStageTarget(nextLegStage.value); setLegStageOccurredAt(""); }}>
                                                            <PlayCircle className="w-3.5 h-3.5" />Log {nextLegStage.label}
                                                          </Button>
                                                        )
                                                      )}

                                                      {/* Ad-hoc client contact — capture only, for a receiving
                                                           vessel with no registered client account. Only
                                                           editable once cast off. */}
                                                      {canAct && legStageIdx >= 0 && (
                                                        adhocClientFormLegId === leg.id ? (
                                                          <div className="rounded-lg border bg-muted/30 p-3 space-y-2">
                                                            <Label className="text-[10px] text-muted-foreground">Ad-hoc Client Email</Label>
                                                            <Input type="email" className="h-8 text-xs" placeholder="client@example.com" value={adhocClientEmail} onChange={(e) => setAdhocClientEmail(e.target.value)} />
                                                            <Label className="text-[10px] text-muted-foreground">Client Name (optional)</Label>
                                                            <Input className="h-8 text-xs" value={adhocClientName} onChange={(e) => setAdhocClientName(e.target.value)} />
                                                            <p className="text-[10px] text-muted-foreground">For a client with no registered account — captured only, not sent anywhere yet.</p>
                                                            <div className="flex gap-2">
                                                              <Button size="sm" className="flex-1 text-xs" disabled={!adhocClientEmail.trim() || setLegAdhocClientMutation.isPending} onClick={() => setLegAdhocClientMutation.mutate(leg.id)}>
                                                                {setLegAdhocClientMutation.isPending ? <Spinner size={14} /> : "Save Client Contact"}
                                                              </Button>
                                                              <Button size="sm" variant="ghost" className="text-xs" onClick={() => setAdhocClientFormLegId(null)}>Cancel</Button>
                                                            </div>
                                                          </div>
                                                        ) : leg.adhoc_client_email ? (
                                                          <div className="flex items-center justify-between gap-2 text-[11px] text-muted-foreground">
                                                            <span>Ad-hoc client: <span className="text-foreground">{leg.adhoc_client_name ?? "—"}</span> ({leg.adhoc_client_email})</span>
                                                            <button className={INLINE_LINK} onClick={() => openAdhocClientForm(leg)}>Edit</button>
                                                          </div>
                                                        ) : (
                                                          <button className={INLINE_LINK} onClick={() => openAdhocClientForm(leg)}>+ Add ad-hoc client contact</button>
                                                        )
                                                      )}

                                                      {/* HSE — non-blocking, available once cast off.
                                                           BM/OS only, matching the backend's _hse_roles. */}
                                                      {(isBM || isOS) && legStageIdx >= 0 && (
                                                        <div>
                                                          {leg.hse_result && correctHseTarget?.id !== leg.id ? (
                                                            <div className={cn(
                                                              "flex items-center justify-between gap-2 rounded-xl border px-3.5 py-2.5 text-[12px] font-medium",
                                                              leg.hse_result === "satisfactory"
                                                                ? "border-emerald-200 bg-emerald-50/70 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300"
                                                                : "border-amber-200 bg-amber-50/70 text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300"
                                                            )}>
                                                              <span className="flex items-center gap-2">
                                                                <ShieldCheck className="w-3.5 h-3.5 shrink-0" />
                                                                HSE recorded — {leg.hse_result === "satisfactory" ? "Satisfactory" : "Issues noted (non-blocking)"}
                                                              </span>
                                                              {isBM && (
                                                                <button className={cn(INLINE_LINK, "shrink-0")} onClick={() => openCorrectHse("leg", leg.id, leg.hse_checklist, leg.hse_notes)}>Correct</button>
                                                              )}
                                                            </div>
                                                          ) : correctHseTarget?.kind === "leg" && correctHseTarget.id === leg.id ? (
                                                            <div className="rounded-lg border bg-muted/30 p-3 space-y-2">
                                                              <p className="text-xs font-semibold">Correct Ship-to-Ship Safety Checklist</p>
                                                              <div className="space-y-1">
                                                                <Label className="text-[10px] text-muted-foreground">Name of Safety Officer</Label>
                                                                <Input className="h-8 text-xs" value={legHseOfficer} onChange={(e) => setLegHseOfficer(e.target.value)} />
                                                              </div>
                                                              {renderHseChecklist(legHseChecklist, setLegHseChecklist)}
                                                              <Textarea className="text-xs min-h-12.5 resize-none" placeholder="Overall notes…" value={legHseNotes} onChange={(e) => setLegHseNotes(e.target.value)} />
                                                              <Textarea className="text-xs min-h-10 resize-none" placeholder="Reason for correction (required)…" value={correctHseReason} onChange={(e) => setCorrectHseReason(e.target.value)} />
                                                              <div className="flex gap-2">
                                                                <Button size="sm" className="flex-1 text-xs" disabled={!correctHseReason.trim() || correctHseMutation.isPending} onClick={() => correctHseMutation.mutate()}>
                                                                  {correctHseMutation.isPending ? <Spinner size={14} /> : "Save Correction"}
                                                                </Button>
                                                                <Button size="sm" variant="ghost" className="text-xs" onClick={() => setCorrectHseTarget(null)}>Cancel</Button>
                                                              </div>
                                                            </div>
                                                          ) : legHseFormLegId === leg.id ? (
                                                            <div className="rounded-lg border bg-muted/30 p-3 space-y-2">
                                                              <p className="text-xs font-semibold">Ship-to-Ship Safety Checklist</p>
                                                              <div className="grid grid-cols-2 gap-2 text-[11px] rounded-md border bg-background p-2">
                                                                <div><span className="text-muted-foreground">Bunker Tanker:</span> {activity.vessel_name ?? "—"}</div>
                                                                <div><span className="text-muted-foreground">Receiving Vessel:</span> {leg.receiving_vessel_name}</div>
                                                                <div><span className="text-muted-foreground">Delivery Location:</span> {op.discharge_location ?? "—"}</div>
                                                                <div><span className="text-muted-foreground">Alongside:</span> {leg.stage_alongside_system_at ? formatDateTime(leg.stage_alongside_system_at) : "—"}</div>
                                                                <div><span className="text-muted-foreground">Commenced Pumping:</span> {leg.stage_discharge_commenced_system_at ? formatDateTime(leg.stage_discharge_commenced_system_at) : "—"}</div>
                                                                <div><span className="text-muted-foreground">Completed Receiving:</span> {leg.stage_discharge_completed_system_at ? formatDateTime(leg.stage_discharge_completed_system_at) : "—"}</div>
                                                                <div><span className="text-muted-foreground">Quantity Delivered:</span> {leg.quantity_discharged_litres ? `${parseFloat(leg.quantity_discharged_litres).toLocaleString()} L` : "—"}</div>
                                                                <div><span className="text-muted-foreground">Product:</span> {op.products?.length ? op.products.map((pr) => pr.product_type).join(", ") : (op.product_type ?? "—")}</div>
                                                              </div>
                                                              <div className="space-y-1">
                                                                <Label className="text-[10px] text-muted-foreground">Name of Safety Officer</Label>
                                                                <Input className="h-8 text-xs" value={legHseOfficer} onChange={(e) => setLegHseOfficer(e.target.value)} />
                                                              </div>
                                                              {renderHseChecklist(legHseChecklist, setLegHseChecklist)}
                                                              <Textarea className="text-xs min-h-12.5 resize-none" placeholder="Overall notes…" value={legHseNotes} onChange={(e) => setLegHseNotes(e.target.value)} />
                                                              <div className="flex gap-2">
                                                                <Button size="sm" className="flex-1 text-xs" disabled={recordLegHseMutation.isPending} onClick={() => recordLegHseMutation.mutate(leg.id)}>
                                                                  {recordLegHseMutation.isPending ? <Spinner size={14} /> : "Submit HSE Checklist"}
                                                                </Button>
                                                                <Button size="sm" variant="ghost" className="text-xs" onClick={() => setLegHseFormLegId(null)}>Cancel</Button>
                                                              </div>
                                                            </div>
                                                          ) : (
                                                            <Button size="sm" variant="outline" className="text-xs gap-1.5" onClick={() => openLegHseForm(leg.id)}>
                                                              <ShieldCheck className="w-3.5 h-3.5" />Record HSE Checklist
                                                            </Button>
                                                          )}
                                                        </div>
                                                      )}

                                                      {/* Discharge Quantity — once this leg reaches Discharge Completed */}
                                                      {leg.stage === "discharge_completed" && (
                                                        <div>
                                                          <SectionHead
                                                            title="Discharge Quantity"
                                                            action={
                                                              leg.quantity_recorded_at && isBM && legQtyFormLegId !== leg.id ? (
                                                                <button className={INLINE_LINK} onClick={() => openLegQtyForm(leg)}>Edit</button>
                                                              ) : undefined
                                                            }
                                                          />
                                                          {legQtyFormLegId === leg.id ? (
                                                            <div className="rounded-lg border bg-muted/30 p-3 space-y-2">
                                                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                                                <div className="space-y-1">
                                                                  <Label className="text-[10px] text-muted-foreground">Discharged Quantity (MT)</Label>
                                                                  <Input type="number" className="h-8 text-xs" value={legQtyDischarged} onChange={(e) => setLegQtyDischarged(e.target.value)} />
                                                                </div>
                                                                <div className="space-y-1">
                                                                  <Label className="text-[10px] text-muted-foreground">Density</Label>
                                                                  <Input type="number" step="0.0001" className="h-8 text-xs" value={legQtyDensity} onChange={(e) => setLegQtyDensity(e.target.value)} />
                                                                </div>
                                                                <div className="space-y-1">
                                                                  <Label className="text-[10px] text-muted-foreground">Temp Before Loading (°C)</Label>
                                                                  <Input type="number" step="0.01" className="h-8 text-xs" value={legQtyTempBefore} onChange={(e) => setLegQtyTempBefore(e.target.value)} />
                                                                </div>
                                                                <div className="space-y-1">
                                                                  <Label className="text-[10px] text-muted-foreground">Temp After Loading (°C)</Label>
                                                                  <Input type="number" step="0.01" className="h-8 text-xs" value={legQtyTempAfter} onChange={(e) => setLegQtyTempAfter(e.target.value)} />
                                                                </div>
                                                                <div className="space-y-1">
                                                                  <Label className="text-[10px] text-muted-foreground">VCF</Label>
                                                                  <Input type="number" step="0.0001" className="h-8 text-xs" value={legQtyVcf} onChange={(e) => setLegQtyVcf(e.target.value)} />
                                                                </div>
                                                                <div className="space-y-1">
                                                                  <Label className="text-[10px] text-muted-foreground">GOV</Label>
                                                                  <Input type="number" className="h-8 text-xs" value={legQtyGov} onChange={(e) => setLegQtyGov(e.target.value)} />
                                                                </div>
                                                              </div>
                                                              {legQtyGov && legQtyVcf && legQtyDensity && (
                                                                <div className="grid grid-cols-2 gap-px border rounded-md overflow-hidden text-[11px]">
                                                                  <div className="bg-background px-2.5 py-1.5">
                                                                    <p className="text-[9px] text-muted-foreground uppercase">GSV (computed)</p>
                                                                    <p className="font-mono font-semibold">{(parseFloat(legQtyGov) * parseFloat(legQtyVcf)).toLocaleString()}</p>
                                                                  </div>
                                                                  <div className="bg-background px-2.5 py-1.5">
                                                                    <p className="text-[9px] text-muted-foreground uppercase">MTvac (computed)</p>
                                                                    <p className="font-mono font-semibold">{(parseFloat(legQtyGov) * parseFloat(legQtyVcf) * parseFloat(legQtyDensity)).toLocaleString()}</p>
                                                                  </div>
                                                                </div>
                                                              )}
                                                              <Textarea className="text-xs min-h-12.5 resize-none" placeholder="Description (optional)…" value={legQtyDescription} onChange={(e) => setLegQtyDescription(e.target.value)} />
                                                              {leg.quantity_recorded_at && (
                                                                <Textarea className="text-xs min-h-10 resize-none" placeholder="Reason for correction (required)…" value={legQtyReason} onChange={(e) => setLegQtyReason(e.target.value)} />
                                                              )}
                                                              <div className="flex gap-2">
                                                                <Button
                                                                  size="sm" className="flex-1 text-xs"
                                                                  disabled={!legQtyDischarged || !legQtyDensity || !legQtyTempBefore || !legQtyTempAfter || !legQtyVcf || !legQtyGov || (!!leg.quantity_recorded_at && !legQtyReason.trim()) || recordLegQtyMutation.isPending}
                                                                  onClick={() => recordLegQtyMutation.mutate(leg.id)}
                                                                >
                                                                  {recordLegQtyMutation.isPending ? <Spinner size={14} /> : "Save Quantities"}
                                                                </Button>
                                                                <Button size="sm" variant="ghost" className="text-xs" onClick={resetLegQtyForm}>Cancel</Button>
                                                              </div>
                                                            </div>
                                                          ) : leg.quantity_recorded_at ? (
                                                            <QuantityReadout
                                                              columns={[
                                                                ["Discharged", `${parseFloat(leg.quantity_discharged_litres ?? "0").toLocaleString()} L`],
                                                                ["MTVC",       parseFloat(leg.mt_vacuum ?? "0").toLocaleString()],
                                                                ["Recorded",   formatDateTime(leg.quantity_recorded_at)],
                                                              ]}
                                                              note={leg.quantity_description}
                                                            />
                                                          ) : canAct ? (
                                                            <Button size="sm" variant="outline" className="text-xs gap-1.5" onClick={() => openLegQtyForm(leg)}>
                                                              <FileText className="w-3.5 h-3.5" />Record Discharge Quantity
                                                            </Button>
                                                          ) : null}
                                                        </div>
                                                      )}
                                                    </div>
                                                  )}
                                                </div>
                                              );
                                            })}

                                            {/* Continue-the-journey CTA — sits directly below the
                                                 last receiving vessel so it's found right where a
                                                 discharge finishes, not only at the top of the
                                                 section. Completed vessels stay on screen above so
                                                 the whole operation stays reviewable. */}
                                            {isBM && addLegFormActivityId !== activity.id && (() => {
                                              const live = activity.legs.filter((l) => !l.cancelled_at);
                                              const allDone = live.length > 0 && live.every((l) => l.stage === "discharge_completed");
                                              return (
                                                <div className={cn(
                                                  "flex flex-wrap items-center justify-between gap-3 rounded-xl border p-3.5",
                                                  allDone
                                                    ? "border-emerald-200 bg-emerald-50/60 dark:border-emerald-500/30 dark:bg-emerald-500/10"
                                                    : "border-dashed border-navy-100 bg-muted/30 dark:border-border"
                                                )}>
                                                  <p className="text-[12px] text-muted-foreground">
                                                    {allDone
                                                      ? "All receiving vessels discharged. Add another to keep this operation going, or raise the Vessel BDNs."
                                                      : "Delivering to another vessel on this same operation?"}
                                                  </p>
                                                  <Button
                                                    size="sm"
                                                    variant={allDone ? "default" : "outline"}
                                                    className={cn(
                                                      "h-9 shrink-0 gap-1.5 text-xs font-semibold",
                                                      allDone && "brand-grad-active text-white shadow-sm"
                                                    )}
                                                    onClick={() => { setAddLegFormActivityId(activity.id); setNewLegName(""); setNewLegImo(""); setNewLegEta(""); }}
                                                  >
                                                    <PlusCircle className="w-3.5 h-3.5" />Add Another Receiving Vessel
                                                  </Button>
                                                </div>
                                              );
                                            })()}
                                          </div>
                                        )}
                                      </div>
                                    )}
                                  </div>
                                )}
                              </div>
                            )}

                            </> }

                          </Card>
                        );
                      })}
                    </div>
                  )}

                  </> /* end op.type !== "truck_only" */}

                </TabsContent>
              )}

              {/* ── KPI tab — cast-off to discharge-completed duration + per-stage/role timing, computed live from stage timestamps and the audit trail, no new tables */}
              {isBM && op.type !== "truck_only" && (
                <TabsContent value="kpi" className="mt-4 space-y-4">
                  <Card className="rounded-2xl border border-navy-100 shadow-[0_1px_2px_rgb(16_36_71/0.04)] dark:border-border">
                    <CardHeader className="pb-2">
                      <CardTitle className="flex items-center gap-2 text-[15px] font-bold tracking-tight">
                        <Gauge className="w-4 h-4 text-primary" />
                        Operation Duration
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="p-5 pt-0">
                      {operationKpiLoading ? (
                        <div className="flex justify-center py-6"><Spinner size={20} className="text-muted-foreground" /></div>
                      ) : operationKpiErrored ? (
                        <div className="flex flex-col items-center gap-2 py-6">
                          <p className="text-sm text-rose-600">Failed to load operation duration</p>
                          <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => refetchOperationKpi()}>Retry</Button>
                        </div>
                      ) : !operationKpi || (!operationKpi.cast_off_at && !operationKpi.discharge_completed_at) ? (
                        <p className="text-sm text-muted-foreground text-center py-6">No stage data recorded yet</p>
                      ) : (
                        <div className="grid grid-cols-3 gap-4">
                          <InfoItem label="Earliest Cast-Off" value={operationKpi.cast_off_at ? formatDateTime(operationKpi.cast_off_at) : "—"} />
                          <InfoItem label="Latest Discharge Completed" value={operationKpi.discharge_completed_at ? formatDateTime(operationKpi.discharge_completed_at) : "—"} />
                          <InfoItem label="Overall Duration" value={operationKpi.duration_hours != null ? `${operationKpi.duration_hours.toFixed(1)} hrs` : "—"} />
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  <Card className="rounded-2xl border border-navy-100 shadow-[0_1px_2px_rgb(16_36_71/0.04)] dark:border-border">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-[15px] font-bold tracking-tight">Per-Vessel-Run Breakdown</CardTitle>
                    </CardHeader>
                    <CardContent className="p-0">
                      {operationKpiLoading ? (
                        <div className="flex justify-center py-6"><Spinner size={20} className="text-muted-foreground" /></div>
                      ) : operationKpiErrored ? (
                        <div className="flex flex-col items-center gap-2 py-6">
                          <p className="text-sm text-rose-600">Failed to load vessel-run breakdown</p>
                          <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => refetchOperationKpi()}>Retry</Button>
                        </div>
                      ) : !operationKpi?.vessel_runs.length ? (
                        <p className="text-sm text-muted-foreground text-center py-6">No vessel runs yet</p>
                      ) : (
                        <div className="divide-y">
                          {operationKpi.vessel_runs.map((r) => (
                            <div key={r.vessel_activity_id} className="px-4 py-3 flex items-center justify-between gap-3 text-xs">
                              <span className="font-medium">{r.vessel_name ?? "—"}</span>
                              <span className="text-muted-foreground">
                                {r.cast_off_at ? formatDateTime(r.cast_off_at) : "—"} → {r.discharge_completed_at ? formatDateTime(r.discharge_completed_at) : "—"}
                              </span>
                              <span className="font-mono shrink-0">{r.duration_hours != null ? `${r.duration_hours.toFixed(1)} hrs` : "—"}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  <Card className="rounded-2xl border border-navy-100 shadow-[0_1px_2px_rgb(16_36_71/0.04)] dark:border-border">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-[15px] font-bold tracking-tight">Stage-by-Stage Timing</CardTitle>
                    </CardHeader>
                    <CardContent className="p-0">
                      {stageDurationsLoading ? (
                        <div className="flex justify-center py-6"><Spinner size={20} className="text-muted-foreground" /></div>
                      ) : stageDurationsErrored ? (
                        <div className="flex flex-col items-center gap-2 py-6">
                          <p className="text-sm text-rose-600">Failed to load stage timing</p>
                          <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => refetchStageDurations()}>Retry</Button>
                        </div>
                      ) : !stageDurations?.entries.length ? (
                        <p className="text-sm text-muted-foreground text-center py-6">No stage advances logged yet</p>
                      ) : (
                        <div className="divide-y">
                          {stageDurations.entries.map((e, i) => (
                            <div key={`${e.vessel_activity_id}-${e.stage}-${i}`} className="px-4 py-2.5 flex items-center justify-between gap-3 text-xs">
                              <span className="capitalize font-medium w-32 shrink-0">{e.stage.replace(/_/g, " ")}</span>
                              <span className="text-muted-foreground flex-1">
                                {e.user_name ?? "—"}{e.role ? ` (${ROLE_LABELS[e.role] ?? e.role})` : ""}
                              </span>
                              <span className="text-muted-foreground text-[10px] shrink-0">{e.completed_at ? formatDateTime(e.completed_at) : "—"}</span>
                              <span className="font-mono shrink-0 w-16 text-right">{e.duration_hours != null ? `${e.duration_hours.toFixed(1)}h` : "—"}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </TabsContent>
              )}

              {/* ── Truck Reports tab — stage-by-stage progress tracker */}
              {(isLO || isBM || isOS) && op.type !== "vessel_only" && (
                <TabsContent value="truck-reports" className="mt-4 space-y-3">

                  {/* Hidden file input backing the per-truck Upload Doc control.
                      Must be rendered for every role that gets the button and the
                      panel below (BM and LO) — gating it to BM alone left the LO
                      with a working button whose click found a null ref and did
                      nothing at all. */}
                  {(isBM || isLO) && (
                    <input
                      ref={docFileRef}
                      type="file"
                      accept=".pdf,.jpg,.jpeg,.png,.webp,.csv,.txt,.docx,.xlsx"
                      className="hidden"
                      onChange={(e) => setDocFile(e.target.files?.[0] ?? null)}
                    />
                  )}

                  {!truckOps?.length ? (
                    <Card className="rounded-2xl border border-navy-100 shadow-[0_1px_2px_rgb(16_36_71/0.04)] dark:border-border">
                      <CardContent className="flex flex-col items-center py-14 text-muted-foreground gap-1">
                        <Truck className="w-10 h-10 mb-2 opacity-30" />
                        <p className="text-sm font-medium">No trucks initialized for reporting</p>
                        {uninitializedTruckIds.length > 0 && isLO ? (
                          <div className="mt-2 text-center space-y-2">
                            <p className="text-xs text-muted-foreground max-w-xs">
                              {uninitializedTruckIds.length} truck{uninitializedTruckIds.length > 1 ? "s" : ""} from approved feedback {uninitializedTruckIds.length > 1 ? "are" : "is"} ready to be initialized for progress reporting.
                            </p>
                            <Button
                              size="sm"
                              disabled={initTrucksMutation.isPending}
                              onClick={() => initTrucksMutation.mutate({
                                truckIds: uninitializedTruckIds,
                                driverInfo: approvedNominations.driverInfo,
                              })}
                            >
                              {initTrucksMutation.isPending
                                ? <Spinner size={14} className="mr-1.5" />
                                : <PlusCircle className="w-3.5 h-3.5 mr-1.5" />}
                              Initialize {uninitializedTruckIds.length} Truck{uninitializedTruckIds.length > 1 ? "s" : ""} for Reporting
                            </Button>
                          </div>
                        ) : (
                          <p className="text-xs mt-1 text-center max-w-xs opacity-70">
                            Trucks must be added to this operation before reporting can begin.
                          </p>
                        )}
                      </CardContent>
                    </Card>
                  ) : (
                    <>
                    {/* Feedback approved after the first batch was initialized
                        would otherwise have no route into this list — the
                        initialize action used to live only in the empty state. */}
                    {uninitializedTruckIds.length > 0 && isLO && (
                      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-amber-200 bg-amber-50/70 px-4 py-3 dark:border-amber-500/25 dark:bg-amber-500/10">
                        <div className="min-w-0">
                          <p className="text-[13px] font-bold text-amber-800 dark:text-amber-300">
                            {uninitializedTruckIds.length} approved truck{uninitializedTruckIds.length > 1 ? "s" : ""} not yet initialized
                          </p>
                          <p className="text-[11px] text-muted-foreground">
                            Nominated in an earlier or later feedback round. Initialize to start recording progress.
                          </p>
                        </div>
                        <Button
                          size="sm"
                          className="shrink-0"
                          disabled={initTrucksMutation.isPending}
                          onClick={() => initTrucksMutation.mutate({
                            truckIds: uninitializedTruckIds,
                            driverInfo: approvedNominations.driverInfo,
                          })}
                        >
                          {initTrucksMutation.isPending
                            ? <Spinner size={14} className="mr-1.5" />
                            : <PlusCircle className="w-3.5 h-3.5 mr-1.5" />}
                          Initialize {uninitializedTruckIds.length} Truck{uninitializedTruckIds.length > 1 ? "s" : ""}
                        </Button>
                      </div>
                    )}
                    {truckOps.map((to, truckIndex) => {
                      const label = to.truck?.truck_number ?? to.truck_id.slice(0, 8);
                      const cap   = to.truck?.capacity_mt ? `${parseFloat(to.truck.capacity_mt).toLocaleString()} L` : "";
                      // 1-based position in the list, so "truck 6 of 9" is
                      // sayable over the radio without counting cards.
                      const seq   = truckIndex + 1;

                      // Removed trucks stay visible (traceability — nothing is
                      // ever silently deleted) but read-only: no waybill/doc/
                      // stage actions, since they're no longer part of the
                      // active operation. Distinct from the live-status pill
                      // above, which only appears on trucks still in play.
                      if (to.status === "cancelled") {
                        return (
                          <Card key={to.id} className="rounded-2xl border border-navy-100 shadow-[0_1px_2px_rgb(16_36_71/0.04)] dark:border-border overflow-hidden opacity-60">
                            <div className="flex items-center justify-between px-5 py-3.5">
                              <div className="flex items-center gap-3 min-w-0">
                                <span className="w-6 shrink-0 text-right text-sm font-bold tabular-nums text-muted-foreground/60">
                                  {seq}.
                                </span>
                                <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center shrink-0">
                                  <Trash2 className="w-4 h-4 text-muted-foreground" />
                                </div>
                                <div>
                                  <p className="text-sm font-bold font-mono tracking-tight text-muted-foreground line-through">{label}</p>
                                  {cap && <p className="text-xs text-muted-foreground">{cap}</p>}
                                </div>
                              </div>
                              <span className="text-[11px] font-medium px-2.5 py-0.5 rounded-full bg-muted text-muted-foreground">
                                Removed from operation
                              </span>
                            </div>
                          </Card>
                        );
                      }

                      const recording = activeRecording[to.id] ?? "";

                      // Determine which stages are done
                      const stageValues: Record<string, string | null | undefined> = {
                        departed_parking_at:  to.departed_parking_at,
                        arrived_loading_at:   to.arrived_loading_at,
                        transit_start_at:     to.transit_start_at,
                        departed_loading_at:  to.departed_loading_at,
                        arrived_discharge_at: to.arrived_discharge_at,
                        discharge_start_at:   to.discharge_start_at,
                        discharge_end_at:     to.discharge_end_at,
                      };
                      const firstPendingIdx = TRUCK_STAGES.findIndex((s) => !stageValues[s.key]);

                      // Pre (before loading) and Post (before discharge) are two independent,
                      // non-blocking checklists — neither gates the other or the movement stages.
                      const preAudit  = to.safety_audits?.find((a) => a.phase === "pre");
                      const postAudit = to.safety_audits?.find((a) => a.phase === "post");

                      return (
                        <Card key={to.id} className="rounded-2xl border border-navy-100 shadow-[0_1px_2px_rgb(16_36_71/0.04)] dark:border-border overflow-hidden">
                          {/* Truck header — stacks below sm. The action group can
                              carry up to four buttons; keeping it shrink-0 on a
                              phone drove it straight over the plate number. */}
                          <div className="flex flex-col items-stretch gap-2 border-b bg-muted/20 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5 sm:py-3.5">
                            <div className="flex items-center gap-3 min-w-0">
                              <span className="w-6 shrink-0 text-right text-sm font-bold tabular-nums text-muted-foreground">
                                {seq}.
                              </span>
                              <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                                <Truck className="w-4 h-4 text-primary" />
                              </div>
                              <div className="min-w-0">
                                <p className="truncate text-sm font-bold font-mono tracking-tight">{label}</p>
                                {cap && <p className="truncate text-xs text-muted-foreground">{cap}</p>}
                              </div>
                            </div>
                            <div className="flex flex-wrap items-center gap-2 sm:shrink-0">
                              {to.status && (
                                <span className="text-[11px] font-medium px-2.5 py-0.5 rounded-full bg-primary/10 text-primary capitalize">
                                  {to.status.replace(/_/g, " ")}
                                </span>
                              )}
                              {/* LO: link waiver number + driver at waybill-generation time */}
                              {isLO && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-7 text-xs gap-1.5"
                                  onClick={() => openWaybillDialog(to)}
                                >
                                  <FileText className="w-3.5 h-3.5" />
                                  {to.waiver_id ? "Edit Waybill" : "Link Waybill"}
                                </Button>
                              )}
                              {/* BM and LO: upload document for this truck */}
                              {(isBM || isLO) && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-7 text-xs gap-1.5"
                                  onClick={() => {
                                    setUploadingTruckId(uploadingTruckId === to.id ? null : to.id);
                                    setDocFile(null);
                                    if (docFileRef.current) docFileRef.current.value = "";
                                  }}
                                >
                                  <UploadCloud className="w-3.5 h-3.5" />
                                  Upload Doc
                                </Button>
                              )}
                              {/* BM: remove a nominated-but-unused truck, at any phase — blocked
                                   once it already has recorded delivery/discharge data (the
                                   backend is the source of truth; this just avoids offering an
                                   action that would only come back as a 422). */}
                              {isBM && !to.quantity_discharged_mt && !to.discharge_end_at
                                && to.status !== "discharging" && to.status !== "completed"
                                && to.status !== "cancelled" && (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-7 text-xs gap-1.5 text-destructive hover:text-destructive"
                                  onClick={() => { setRemoveTruckTarget(to); setRemoveTruckReason(""); }}
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                  Remove
                                </Button>
                              )}
                            </div>
                          </div>

                          {/* Waybill / driver summary, once linked */}
                          {to.waiver_id && (
                            <div className="px-5 py-2 border-b bg-brand-50/40 text-[11px] text-brand-800 flex flex-wrap gap-x-4 gap-y-0.5">
                              <span>Driver: <strong>{to.driver_name}</strong> ({to.driver_phone})</span>
                              {to.vendor_name && <span>Vendor: <strong>{to.vendor_name}</strong></span>}
                              {to.waybill_document_number && <span>Waybill No: <strong>{to.waybill_document_number}</strong></span>}
                            </div>
                          )}

                          {/* Safety Audits — Pre (before loading) and Post (before discharge),
                              independently trackable, neither gates the other */}
                          {renderAuditBanner(to, "pre", preAudit)}
                          {renderAuditBanner(to, "post", postAudit)}

                          {/* BM/LO upload panel */}
                          {(isBM || isLO) && uploadingTruckId === to.id && (
                            <div className="px-5 py-3 border-b bg-brand-50/30 flex items-center gap-3 flex-wrap">
                              <button
                                type="button"
                                className="flex-1 min-w-0 flex items-center gap-2 text-xs text-muted-foreground border border-dashed border-border rounded-md px-3 py-2 hover:border-primary hover:text-primary transition-colors"
                                onClick={() => {
                                  // No optional-chain here on purpose: a missing
                                  // input is a bug, and silently doing nothing is
                                  // exactly what hid it last time.
                                  if (!docFileRef.current) {
                                    toast.error("File picker unavailable — please reload the page");
                                    return;
                                  }
                                  docFileRef.current.click();
                                }}
                              >
                                <UploadCloud className="w-3.5 h-3.5 shrink-0" />
                                {docFile ? docFile.name : "Click to select file (PDF, image, DOCX…)"}
                              </button>
                              <div className="flex gap-2 shrink-0">
                                <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => { setUploadingTruckId(null); setDocFile(null); }}>
                                  Cancel
                                </Button>
                                <Button
                                  size="sm"
                                  className="h-7 text-xs"
                                  disabled={!docFile || uploadTruckDocMutation.isPending}
                                  onClick={() => docFile && uploadTruckDocMutation.mutate({ file: docFile, truckNumber: label })}
                                >
                                  {uploadTruckDocMutation.isPending && <Spinner size={12} className="mr-1" />}
                                  Upload
                                </Button>
                              </div>
                            </div>
                          )}

                          {/* Progress stages */}
                          <div className="divide-y">
                            {TRUCK_STAGES.map((stage, idx) => {
                              const doneValue = stageValues[stage.key];
                              const isDone    = !!doneValue;
                              const isNext    = idx === firstPendingIdx;
                              const isFuture  = idx > firstPendingIdx && firstPendingIdx !== -1;
                              const isRecording = recording === stage.key;

                              // Extra field values already saved on this truck op
                              const savedExtras: Record<string, string> = {};
                              if (stage.key === "arrived_loading_at"   && to.loading_location)      savedExtras.loading_location      = to.loading_location;
                              if (stage.key === "transit_start_at"     && to.temperature_celsius)   savedExtras.temperature_celsius   = to.temperature_celsius;
                              if (stage.key === "departed_loading_at") {
                                if (to.quantity_loaded_mt) savedExtras.quantity_loaded_mt = to.quantity_loaded_mt;
                                if (to.waybill_number)     savedExtras.waybill_number     = to.waybill_number;
                              }
                              if (stage.key === "arrived_discharge_at" && to.discharge_location)    savedExtras.discharge_location    = to.discharge_location;
                              if (stage.key === "discharge_start_at"   && to.temperature_celsius)   savedExtras.temperature_celsius   = to.temperature_celsius;
                              if (stage.key === "discharge_end_at") {
                                if (to.quantity_discharged_mt) savedExtras.quantity_discharged_mt = to.quantity_discharged_mt;
                                if (to.temperature_celsius)    savedExtras.temperature_celsius    = to.temperature_celsius;
                              }

                              const form = getStageForm(to.id, stage.key);

                              return (
                                <div key={stage.key} className={`px-5 py-3 ${isFuture ? "opacity-40" : ""}`}>
                                  <div className="flex items-start gap-3">
                                    {/* Stage indicator */}
                                    <div className="flex flex-col items-center shrink-0 pt-0.5">
                                      <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center text-[10px] font-bold ${
                                        isDone
                                          ? "bg-emerald-500 border-emerald-500 text-white"
                                          : isNext
                                          ? "border-primary text-primary bg-primary/10"
                                          : "border-muted-foreground/30 text-muted-foreground/40"
                                      }`}>
                                        {isDone ? <CheckCircle2 className="w-3 h-3" /> : idx + 1}
                                      </div>
                                      {idx < TRUCK_STAGES.length - 1 && (
                                        <div className={`w-px h-4 mt-1 ${isDone ? "bg-emerald-300" : "bg-border"}`} />
                                      )}
                                    </div>

                                    {/* Stage content */}
                                    <div className="flex-1 min-w-0 pb-1">
                                      <div className="flex items-center justify-between gap-2">
                                        <div>
                                          <p className={`text-sm font-medium ${isDone ? "text-emerald-700" : isNext ? "" : "text-muted-foreground"}`}>
                                            {stage.label}
                                          </p>
                                          <p className="text-[11px] text-muted-foreground">{stage.description}</p>
                                        </div>
                                        {/* Record button — any undone stage is recordable; phases don't gate
                                            each other. Out-of-order recording is still allowed (BM can always
                                            unlock/override), it's just visually de-emphasized via isFuture. */}
                                        {!isDone && (isLO || isOS) && !isRecording && (
                                          <Button
                                            size="sm"
                                            variant={isNext ? "default" : "outline"}
                                            className="h-7 text-xs shrink-0"
                                            onClick={() => setActiveRecording((prev) => ({ ...prev, [to.id]: stage.key }))}
                                          >
                                            Record
                                          </Button>
                                        )}
                                      </div>

                                      {/* Completed stage data */}
                                      {isDone && (
                                        <div className="mt-1.5 rounded-md bg-emerald-50/60 border border-emerald-100 px-3 py-2 space-y-0.5">
                                          <p className="text-xs text-emerald-800 font-medium">{formatDateTime(doneValue as string)}</p>
                                          {Object.entries(savedExtras).map(([k, v]) => {
                                            const def = stage.extras.find((e) => e.k === k);
                                            if (!def || !v) return null;
                                            return (
                                              <p key={k} className="text-[11px] text-emerald-700">
                                                {def.label}: <span className="font-medium">{v}</span>
                                              </p>
                                            );
                                          })}
                                          {/* Discharge-specific: vessel & approval info */}
                                          {stage.key === "discharge_end_at" && (() => {
                                            const vesselDisplay = to.destination_vessel_id
                                              ? (allVessels?.find((v) => v.id === to.destination_vessel_id)?.vessel_name ?? `Vessel ID: ${to.destination_vessel_id.slice(0, 8)}`)
                                              : to.destination_vessel_name || null;
                                            return (
                                              <>
                                                {vesselDisplay && (
                                                  <p className="text-[11px] text-emerald-700">
                                                    Delivered to: <span className="font-semibold">{vesselDisplay}</span>
                                                    {!to.destination_vessel_id && <span className="ml-1 text-muted-foreground">(external)</span>}
                                                  </p>
                                                )}
                                                {to.spillage_mt && parseFloat(to.spillage_mt) > 0 && (
                                                  <p className="text-[11px] text-rose-600">
                                                    Spillage: <span className="font-semibold">{parseFloat(to.spillage_mt).toFixed(3)} L</span>
                                                  </p>
                                                )}
                                                {/* Approval badge */}
                                                {to.discharge_approved === true && (
                                                  <div className="flex items-center gap-1 mt-1">
                                                    <BadgeCheck className="w-3 h-3 text-emerald-600" />
                                                    <span className="text-[10px] font-semibold text-emerald-700">BM Approved — ROB updated</span>
                                                  </div>
                                                )}
                                                {to.discharge_approved === false && (
                                                  <div className="flex items-center gap-1 mt-1">
                                                    <Clock className="w-3 h-3 text-amber-600" />
                                                    <span className="text-[10px] font-semibold text-amber-700">Pending BM approval</span>
                                                  </div>
                                                )}
                                              </>
                                            );
                                          })()}
                                        </div>
                                      )}

                                      {/* Inline recording form */}
                                      {isRecording && (
                                        <div className="mt-2 space-y-2 rounded-md border bg-background p-3">
                                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                            <div className="space-y-1 col-span-2 sm:col-span-1">
                                              <Label className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                                                {stage.label} Time <span className="text-destructive">*</span>
                                              </Label>
                                              <Input
                                                type="datetime-local"
                                                className="h-9 sm:h-8 text-xs"
                                                value={form.ts ?? ""}
                                                onChange={(e) => setStageField(to.id, stage.key, "ts", e.target.value)}
                                              />
                                            </div>
                                            {stage.extras.map((extra) => (
                                              <div key={extra.k} className="space-y-1">
                                                <Label className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                                                  {extra.label}
                                                  {extra.optional && <span className="normal-case font-normal ml-1 text-muted-foreground/60">(opt.)</span>}
                                                  {!extra.optional && <span className="text-destructive ml-1">*</span>}
                                                </Label>
                                                <Input
                                                  type={extra.type === "number" ? "number" : "text"}
                                                  step={extra.type === "number" ? "0.001" : undefined}
                                                  className="h-8 text-xs"
                                                  placeholder={extra.type === "number" ? "0.000" : ""}
                                                  value={form[extra.k] ?? ""}
                                                  onChange={(e) => setStageField(to.id, stage.key, extra.k, e.target.value)}
                                                />
                                              </div>
                                            ))}
                                          </div>

                                          {/* Vessel selector — only for discharge_end_at */}
                                          {stage.key === "discharge_end_at" && (
                                            <div className="space-y-2 pt-1 border-t">
                                              <Label className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                                                Delivered To <span className="normal-case font-normal text-muted-foreground/60">(vessel / client)</span>
                                              </Label>
                                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                                <div className="space-y-1">
                                                  <Select
                                                    value={dischargeVesselMode[to.id] ?? "system"}
                                                    onValueChange={(v) => setDischargeVesselMode((p) => ({ ...p, [to.id]: v as "system" | "other" }))}
                                                  >
                                                    <SelectTrigger className="h-8 text-xs">
                                                      <SelectValue />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                      <SelectItem value="system">System Vessel</SelectItem>
                                                      <SelectItem value="other">Other (not in system)</SelectItem>
                                                    </SelectContent>
                                                  </Select>
                                                </div>
                                                {(dischargeVesselMode[to.id] ?? "system") === "system" ? (
                                                  <div className="space-y-1">
                                                    <Select
                                                      value={dischargeVesselId[to.id] ?? (op?.type === "full_operation" ? (op?.vessel_id ?? "") : "")}
                                                      onValueChange={(v) => setDischargeVesselId((p) => ({ ...p, [to.id]: v }))}
                                                    >
                                                      <SelectTrigger className="h-8 text-xs">
                                                        <SelectValue placeholder="Select vessel…" />
                                                      </SelectTrigger>
                                                      <SelectContent>
                                                        {allVessels?.map((v) => (
                                                          <SelectItem key={v.id} value={v.id}>
                                                            {v.vessel_name}
                                                          </SelectItem>
                                                        ))}
                                                      </SelectContent>
                                                    </Select>
                                                  </div>
                                                ) : (
                                                  <Input
                                                    className="h-8 text-xs"
                                                    placeholder="Vessel or client name…"
                                                    value={dischargeVesselName[to.id] ?? ""}
                                                    onChange={(e) => setDischargeVesselName((p) => ({ ...p, [to.id]: e.target.value }))}
                                                  />
                                                )}
                                              </div>
                                              <p className="text-[10px] text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-1">
                                                If a vessel is specified, BM must approve this discharge before it affects vessel ROB.
                                              </p>
                                            </div>
                                          )}

                                          <div className="space-y-1">
                                            <Label className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                                              Notes <span className="normal-case font-normal text-muted-foreground/60">(optional)</span>
                                            </Label>
                                            <Textarea
                                              rows={2}
                                              className="resize-none text-xs"
                                              placeholder="Any observations for this stage…"
                                              value={form.notes ?? ""}
                                              onChange={(e) => setStageField(to.id, stage.key, "notes", e.target.value)}
                                            />
                                          </div>
                                          <div className="flex justify-end gap-2 pt-0.5">
                                            <Button
                                              size="sm"
                                              variant="outline"
                                              className="h-7 text-xs"
                                              onClick={() => setActiveRecording((prev) => ({ ...prev, [to.id]: "" }))}
                                            >
                                              Cancel
                                            </Button>
                                            <Button
                                              size="sm"
                                              className="h-7 text-xs"
                                              disabled={
                                                (stage.key !== "discharge_end_at" && !form.ts) ||
                                                (stage.key === "discharge_end_at" && !form.quantity_discharged_mt) ||
                                                recordStageMutation.isPending
                                              }
                                              onClick={() => recordStageMutation.mutate({ truckOpId: to.id, stageKey: stage.key, form })}
                                            >
                                              {recordStageMutation.isPending && <Spinner size={12} className="mr-1" />}
                                              Save Progress
                                            </Button>
                                          </div>
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>

                          {/* Operational data summary — visible to BM, LO, OS */}
                          {(isBM || isLO || isOS) && (to.quantity_loaded_mt || to.quantity_discharged_mt || to.waybill_number || to.spillage_mt) && (
                            <div className="px-5 py-3 border-t bg-slate-50/50 space-y-2">
                              <div className="flex flex-wrap gap-x-6 gap-y-1.5">
                                {to.quantity_loaded_mt && (
                                  <div className="text-xs">
                                    <span className="text-muted-foreground">Loaded: </span>
                                    <span className="font-semibold">{parseFloat(to.quantity_loaded_mt).toLocaleString()} L</span>
                                  </div>
                                )}
                                {to.quantity_discharged_mt && (
                                  <div className="text-xs">
                                    <span className="text-muted-foreground">Discharged: </span>
                                    <span className="font-semibold">{parseFloat(to.quantity_discharged_mt).toLocaleString()} L</span>
                                  </div>
                                )}
                                {to.quantity_loaded_mt && to.quantity_discharged_mt && (
                                  <div className="text-xs">
                                    <span className="text-muted-foreground">Variance: </span>
                                    <span className={`font-semibold ${
                                      parseFloat(to.quantity_discharged_mt) < parseFloat(to.quantity_loaded_mt)
                                      ? "text-rose-600" : "text-emerald-600"
                                    }`}>
                                      {(parseFloat(to.quantity_discharged_mt) - parseFloat(to.quantity_loaded_mt)).toFixed(3)} L
                                    </span>
                                  </div>
                                )}
                                {to.spillage_mt && parseFloat(to.spillage_mt) > 0 && (
                                  <div className="text-xs">
                                    <span className="text-muted-foreground">Spillage: </span>
                                    <span className="font-semibold text-rose-600">{parseFloat(to.spillage_mt).toLocaleString()} L</span>
                                  </div>
                                )}
                                {to.waybill_number && (
                                  <div className="text-xs">
                                    <span className="text-muted-foreground">Waybill: </span>
                                    <span className="font-semibold font-mono">{to.waybill_number}</span>
                                  </div>
                                )}
                                {to.temperature_celsius && (
                                  <div className="text-xs">
                                    <span className="text-muted-foreground">Temp: </span>
                                    <span className="font-semibold">{to.temperature_celsius}°C</span>
                                  </div>
                                )}
                                {/* Destination vessel info */}
                                {(to.destination_vessel_id || to.destination_vessel_name) && (() => {
                                  const vesselDisplay = to.destination_vessel_id
                                    ? (allVessels?.find((v) => v.id === to.destination_vessel_id)?.vessel_name ?? `Vessel ID: ${to.destination_vessel_id.slice(0, 8)}`)
                                    : to.destination_vessel_name;
                                  return (
                                    <div className="text-xs">
                                      <span className="text-muted-foreground">Delivered to: </span>
                                      <span className="font-semibold">{vesselDisplay}</span>
                                      {!to.destination_vessel_id && <span className="ml-1 text-[10px] text-muted-foreground">(external)</span>}
                                    </div>
                                  );
                                })()}
                              </div>

                              {/* BM: discharge approval section */}
                              {isBM && to.discharge_approved === false && (
                                <div className="flex items-center gap-3 pt-1 border-t flex-wrap">
                                  <div className="flex items-center gap-1.5 flex-1">
                                    <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                                    <p className="text-xs font-semibold text-amber-800">
                                      Discharge pending approval — ROB not yet updated
                                    </p>
                                  </div>
                                  <div className="flex gap-2 shrink-0">
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      className="h-7 text-xs gap-1"
                                      onClick={() => openEditDischarge(to)}
                                    >
                                      <Pencil className="w-3 h-3" />
                                      Edit
                                    </Button>
                                    <Button
                                      size="sm"
                                      className="h-7 text-xs gap-1 bg-emerald-600 hover:bg-emerald-700"
                                      disabled={approveDischargeM.isPending}
                                      onClick={() => approveDischargeM.mutate(to.id)}
                                    >
                                      {approveDischargeM.isPending ? (
                                        <Spinner size={12} />
                                      ) : (
                                        <BadgeCheck className="w-3 h-3" />
                                      )}
                                      Approve Discharge
                                    </Button>
                                  </div>
                                </div>
                              )}
                              {isBM && to.discharge_approved === true && (
                                <div className="flex items-center justify-between gap-3 pt-1 border-t flex-wrap">
                                  <div className="flex items-center gap-1.5">
                                    <BadgeCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                                    <p className="text-xs font-semibold text-emerald-700">
                                      Discharge approved — vessel ROB updated
                                      {to.discharge_approved_at && (
                                        <span className="ml-1 font-normal text-muted-foreground">
                                          · {formatDateTime(to.discharge_approved_at)}
                                        </span>
                                      )}
                                    </p>
                                  </div>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="h-7 text-xs gap-1 shrink-0"
                                    onClick={() => openEditDischarge(to)}
                                  >
                                    <Pencil className="w-3 h-3" />
                                    Edit Record
                                  </Button>
                                </div>
                              )}
                            </div>
                          )}

                          {/* Operational notes — visible to all roles */}
                          {to.notes && (
                            <div className="px-5 py-3 border-t flex items-start gap-2">
                              <ClipboardList className="w-3.5 h-3.5 text-muted-foreground shrink-0 mt-0.5" />
                              <div>
                                <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-0.5">Notes</p>
                                <p className="text-xs text-foreground/80 whitespace-pre-wrap">{to.notes}</p>
                              </div>
                            </div>
                          )}

                          {/* Submit completion — truck_only */}
                          {firstPendingIdx === -1 && (isLO || isOS) && (op.status === "active" || op.status === "payment_confirmed") && op.type === "truck_only" && (
                            <div className="px-5 py-3 border-t bg-emerald-50/30 flex items-center justify-between gap-3">
                              <div className="flex items-center gap-2">
                                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                                <p className="text-sm font-medium text-emerald-800">All deliveries complete — submit for completion</p>
                              </div>
                              <Button
                                size="sm"
                                className="bg-emerald-600 hover:bg-emerald-700 shrink-0"
                                disabled={submitCompletionMutation.isPending}
                                onClick={() => submitCompletionMutation.mutate()}
                              >
                                {submitCompletionMutation.isPending && <Spinner size={14} className="mr-1.5" />}
                                Submit Completion
                              </Button>
                            </div>
                          )}
                          {/* For full/vessel operations: truck stages done is informational; BM drives vessel ops next */}
                          {firstPendingIdx === -1 && (isLO || isOS) && op.status === "active" && op.type !== "truck_only" && (
                            <div className="px-5 py-3 border-t bg-emerald-50/30 flex items-center gap-2">
                              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                              <p className="text-sm font-medium text-emerald-800">All truck stages complete — BM will initiate vessel operations</p>
                            </div>
                          )}
                        </Card>
                      );
                    })}
                    </>
                  )}
                </TabsContent>
              )}

              {/* ── Documents tab (visible/read-only to all roles who can see the tab; upload/delete stays BM-only) */}
              <TabsContent value="documents" className="mt-4 space-y-4">
                <>
                    {/* Upload form (BM-only) */}
                    {isBM && (
                    <Card className="rounded-2xl border border-navy-100 shadow-[0_1px_2px_rgb(16_36_71/0.04)] dark:border-border">
                      <CardHeader className="pb-3 pt-4 px-5">
                        <div className="flex items-center justify-between">
                          <CardTitle className="text-[15px] font-bold tracking-tight">Upload Document</CardTitle>
                          {!showDocUploadForm && (
                            <Button size="sm" onClick={() => setShowDocUploadForm(true)}>
                              <PlusCircle className="w-3.5 h-3.5 mr-1.5" />Upload
                            </Button>
                          )}
                        </div>
                      </CardHeader>

                      {showDocUploadForm && (
                        <CardContent className="px-5 pb-5 border-t pt-4 space-y-3">
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div className="space-y-1.5 col-span-2">
                              <Label className="text-xs">File <span className="text-destructive">*</span></Label>
                              <Input
                                type="file"
                                className="h-8 text-xs"
                                accept=".pdf,.jpg,.jpeg,.png,.webp,.doc,.docx,.xls,.xlsx,.txt,.csv"
                                onChange={(e) => setOpDocFile(e.target.files?.[0] ?? null)}
                              />
                              <p className="text-[10px] text-muted-foreground">PDF, images, Word, Excel, CSV — max 10MB</p>
                            </div>
                            <div className="space-y-1.5">
                              <Label className="text-xs">Document Type <span className="text-destructive">*</span></Label>
                              <Select value={opDocType} onValueChange={setOpDocType}>
                                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                  {DOC_TYPES.map((d) => (
                                    <SelectItem key={d.value} value={d.value} className="text-xs">{d.label}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="space-y-1.5">
                              <Label className="text-xs">Description</Label>
                              <Input
                                className="h-8 text-xs" placeholder="Optional…"
                                value={opDocDesc} onChange={(e) => setOpDocDesc(e.target.value)}
                              />
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <Button
                              size="sm" className="flex-1"
                              disabled={!opDocFile || uploadDocMutation.isPending}
                              onClick={() => uploadDocMutation.mutate()}
                            >
                              {uploadDocMutation.isPending ? "Uploading…" : "Upload"}
                            </Button>
                            <Button
                              size="sm" variant="outline" className="flex-1"
                              onClick={() => { setShowDocUploadForm(false); setOpDocFile(null); setOpDocType("other"); setOpDocDesc(""); }}
                            >
                              Cancel
                            </Button>
                          </div>
                        </CardContent>
                      )}
                    </Card>
                    )}

                    {/* Document list — visible/read-only to all roles who can see this tab */}
                    <Card className="rounded-2xl border border-navy-100 shadow-[0_1px_2px_rgb(16_36_71/0.04)] dark:border-border">
                      <CardContent className="p-0">
                        {docs?.length ? (
                          <div className="divide-y">
                            {docs.map((doc) => (
                              <div key={doc.id} className="flex items-center justify-between px-5 py-3">
                                <div className="flex items-center gap-3 min-w-0">
                                  <FileText className="w-4 h-4 text-muted-foreground shrink-0" />
                                  <div className="min-w-0">
                                    <button
                                      type="button"
                                      className="text-sm font-medium text-primary hover:underline truncate block text-left"
                                      onClick={async () => {
                                        try {
                                          const res = await api.get<{ success: boolean; data: { url: string } }>(
                                            `/documents/${doc.id}/download`
                                          );
                                          window.open(res.data.data.url, "_blank", "noopener,noreferrer");
                                        } catch {
                                          window.open(doc.file_url, "_blank", "noopener,noreferrer");
                                        }
                                      }}
                                    >
                                      {doc.file_name}
                                    </button>
                                    <p className="text-xs text-muted-foreground">
                                      <span className="capitalize">{doc.document_type.replace(/_/g, " ")}</span>
                                      {doc.description ? ` · ${doc.description}` : ""}
                                      {" · "}{formatDate(doc.created_at)}
                                      {doc.file_size_bytes ? ` · ${(doc.file_size_bytes / 1024).toFixed(0)} KB` : ""}
                                    </p>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-sm text-muted-foreground text-center py-8">No documents uploaded yet</p>
                        )}
                      </CardContent>
                    </Card>
                  </>
              </TabsContent>

              {/* ── Activity feed (BM only) */}
              {isBM && (
                <TabsContent value="activity" className="mt-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-xs text-muted-foreground">Live audit trail — auto-refreshes every 20s</p>
                    <div className="flex items-center gap-2">
                      <Button size="sm" variant="outline" className="h-7 text-xs gap-1.5"
                        onClick={() => refetchActivity()}>
                        <RefreshCw className="w-3 h-3" />
                        Refresh
                      </Button>
                      <Button size="sm" variant="outline" className="h-7 text-xs gap-1.5"
                        onClick={exportActivityCsv}
                        disabled={!activityLog?.length}>
                        <Download className="w-3 h-3" />
                        Export CSV
                      </Button>
                    </div>
                  </div>

                  <Card className="rounded-2xl border border-navy-100 shadow-[0_1px_2px_rgb(16_36_71/0.04)] dark:border-border">
                    <CardContent className="p-0">
                      {!activityLog?.length ? (
                        <div className="flex flex-col items-center py-10 text-muted-foreground gap-2">
                          <Activity className="w-8 h-8 opacity-25" />
                          <p className="text-sm">No activity recorded yet</p>
                        </div>
                      ) : (
                        <div className="divide-y">
                          {[...activityLog].reverse().map((entry) => {
                            const label = ACTION_LABELS[entry.action] ?? entry.action.replace(/_/g, " ");
                            const colorCls = ACTION_COLOR[entry.action] ?? "text-foreground";
                            const roleLabel = ROLE_LABELS[entry.user_role] ?? entry.user_role;
                            const actedAsLabel = entry.acted_as_role
                              ? ROLE_LABELS[entry.acted_as_role] ?? entry.acted_as_role
                              : null;
                            return (
                              <div key={entry.id} className="flex items-start gap-3 px-4 py-3 hover:bg-muted/20">
                                <div className="w-7 h-7 rounded-full bg-primary/8 flex items-center justify-center shrink-0 mt-0.5">
                                  <UserIcon className="w-3.5 h-3.5 text-primary/60" />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-start justify-between gap-2">
                                    <div>
                                      <span className={`text-xs font-semibold ${colorCls}`}>{label}</span>
                                      <span className="text-xs text-muted-foreground ml-2">by {entry.user_name}</span>
                                      <span className="text-[10px] text-muted-foreground/60 ml-1">({roleLabel})</span>
                                      {actedAsLabel && (
                                        <span className="text-[10px] text-muted-foreground/60 ml-1">, acting as {actedAsLabel}</span>
                                      )}
                                    </div>
                                    <span className="text-[10px] text-muted-foreground/60 shrink-0 whitespace-nowrap">
                                      {formatDateTime(entry.created_at)}
                                    </span>
                                  </div>
                                  {entry.changes && Object.keys(entry.changes).length > 0 && (
                                    <div className="mt-1 flex flex-wrap gap-1.5">
                                      {Object.entries(entry.changes).slice(0, 4).map(([k, v]) => {
                                        const isDiff = typeof v === "object" && v !== null && "to" in v;
                                        const val = isDiff ? String((v as Record<string, unknown>).to) : String(v);
                                        const fromVal = isDiff ? String((v as Record<string, unknown>).from) : null;
                                        return (
                                          <span key={k} className="text-[10px] bg-muted px-1.5 py-0.5 rounded font-mono">
                                            {k.replace(/_/g, " ")}: {fromVal && fromVal !== "None" ? `${fromVal.slice(0, 20)} → ` : ""}{val.slice(0, 40)}
                                          </span>
                                        );
                                      })}
                                    </div>
                                  )}
                                  {entry.reason && (
                                    <p className="text-[11px] text-muted-foreground italic mt-1">Reason: {entry.reason}</p>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </TabsContent>
              )}

            </Tabs>
        </div>

        {/* ── Right rail — identity and history, constant across every tab */}
        <aside className="animate-rise flex flex-col gap-4">
          <OperationSummaryCard op={op} />
          <StatusTimeline events={timeline ?? []} isLoading={timelineLoading} />
        </aside>
      </div>

      {/* ── Assign Task Dialog */}
      {isBM && op && (
        <AssignTaskDialog
          operationId={id}
          operationType={op.type}
          open={showAssignTask}
          onClose={() => setShowAssignTask(false)}
          onCreated={() => {
            setShowAssignTask(false);
            qc.invalidateQueries({ queryKey: ["operation-tasks", id] });
          }}
        />
      )}

      {/* ── Transition confirmation dialog */}
      <Dialog open={!!showTransitionConfirm} onOpenChange={(v) => !v && setShowTransitionConfirm(null)}>
        <DialogContent className="sm:max-w-sm" aria-describedby={undefined}>
          <DialogHeader>
            <DialogTitle>{showTransitionConfirm?.label}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 mt-2">
            <p className="text-sm text-muted-foreground">
              Confirm transition to <span className="font-medium capitalize">{showTransitionConfirm?.to.replace(/_/g, " ")}</span>.
            </p>
            <div className="space-y-1.5">
              <Label className="text-xs">
                {showTransitionConfirm?.to === "completed" ? "Completion Notes (optional)" : "Reason (optional)"}
              </Label>
              <Textarea
                placeholder={
                  showTransitionConfirm?.to === "completed"
                    ? "Add final completion notes…"
                    : "Add a reason for this transition…"
                }
                rows={3}
                className="resize-none"
                value={transitionNotes}
                onChange={(e) => setTransitionNotes(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowTransitionConfirm(null)}>Cancel</Button>
            <Button
              variant={showTransitionConfirm?.destructive ? "destructive" : "default"}
              disabled={transitionMutation.isPending || approveFeedbackMutation.isPending}
              onClick={() => {
                if (!showTransitionConfirm) return;
                // Approving truck feedback is what activates the operation. Route this
                // step through the feedback-approve endpoint so the feedback record and
                // the operation status stay in sync — the generic transition only moves
                // the operation and would leave the feedback stuck as "pending".
                if (op?.status === "feedback_submitted" && showTransitionConfirm.to === "active") {
                  const pendingFb = feedbacks?.find(
                    (f) => f.status === "pending" || f.status === "resubmitted"
                  );
                  if (pendingFb) {
                    approveFeedbackMutation.mutate({
                      feedbackId: pendingFb.id,
                      comment: transitionNotes.trim() || undefined,
                    });
                    setShowTransitionConfirm(null);
                    return;
                  }
                }
                transitionMutation.mutate({
                  to_status: showTransitionConfirm.to,
                  reason: transitionNotes.trim() || undefined,
                  completion_notes: showTransitionConfirm.to === "completed"
                    ? transitionNotes.trim() || undefined
                    : undefined,
                });
              }}
            >
              {transitionMutation.isPending && <Spinner size={14} className="mr-1.5" />}
              Confirm
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Close Operation dialog — Expected vs Actual ROB, kept separate */}
      <Dialog open={showCloseDialog} onOpenChange={(v) => !v && resetCloseDialog()}>
        <DialogContent className="sm:max-w-sm" aria-describedby={undefined}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-primary" />Close Operation
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 mt-2">
            <p className="text-sm text-muted-foreground">
              This completes the operation. {op?.vessel_id ? "Record the vessel's Actual ROB if it's available — both figures are kept, never reconciled." : ""}
            </p>

            {op?.vessel_id && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Expected ROB (MT)</Label>
                  <div className="flex items-center h-9 px-3 rounded-md border bg-muted/50 text-sm text-muted-foreground tabular-nums">
                    {opVessel?.current_rob_mt ? parseFloat(opVessel.current_rob_mt).toLocaleString(undefined, { minimumFractionDigits: 3 }) : "—"}
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Actual ROB (MT)</Label>
                  <Input type="number" step="0.001" className="h-9 text-sm" placeholder="Optional" value={closeActualRob} onChange={(e) => setCloseActualRob(e.target.value)} />
                </div>
              </div>
            )}

            <div className="space-y-1.5">
              <Label className="text-xs">Completion Notes (optional)</Label>
              <Textarea rows={2} className="resize-none text-sm" placeholder="Add final completion notes…" value={closeCompletionNotes} onChange={(e) => setCloseCompletionNotes(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Reason <span className="text-destructive">*</span></Label>
              <Textarea rows={2} className="resize-none text-sm" placeholder="Why is this operation being closed now…" value={closeReason} onChange={(e) => setCloseReason(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={resetCloseDialog}>Cancel</Button>
            <Button
              disabled={!closeReason.trim() || closeOperationMutation.isPending}
              onClick={() => closeOperationMutation.mutate()}
            >
              {closeOperationMutation.isPending && <Spinner size={14} className="mr-1.5" />}
              Close Operation
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Safety Audit dialog */}
      <Dialog open={!!auditDialogTruckOpId} onOpenChange={(v) => { if (!v) setAuditDialogTruckOpId(null); }}>
        <DialogContent className="sm:max-w-lg" aria-describedby={undefined}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Shield className="w-4 h-4 text-primary" />
              {auditPhase === "pre" ? "Pre-Operation Safety Checklist (before loading)" : "Post-Operation Safety Checklist (before discharge)"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-1 max-h-[70vh] overflow-y-auto pr-1">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {HEADER_FIELDS_BY_PHASE[auditPhase].map((f) => (
                <div key={f.k} className="space-y-1">
                  <Label className="text-[10px] text-muted-foreground">{f.label}</Label>
                  <Input
                    className="h-8 text-xs"
                    value={auditHeader[f.k] ?? ""}
                    onChange={(e) => setAuditHeader((prev) => ({ ...prev, [f.k]: e.target.value }))}
                  />
                </div>
              ))}
            </div>

            <div className="space-y-1.5">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
                Checklist — tick each item that PASSES inspection
              </p>
              <div className="grid grid-cols-1 gap-1.5">
                {CHECKLIST_ITEMS_BY_PHASE[auditPhase].map((item) => {
                  const passed = auditChecklist[item] ?? false;
                  const checkedAt = auditItemTimestamps[item];
                  return (
                    <label key={item} className={`flex items-center gap-3 cursor-pointer rounded-lg border px-3 py-2.5 transition-colors ${
                      passed ? "border-emerald-300 bg-emerald-50" : "border-rose-200 bg-rose-50/50 hover:border-rose-300"
                    }`}>
                      <input
                        type="checkbox"
                        className="w-4 h-4 rounded border-border accent-emerald-600 cursor-pointer"
                        checked={passed}
                        onChange={(e) => toggleAuditItem(item, e.target.checked)}
                      />
                      <span className={`text-sm flex-1 ${passed ? "text-emerald-800" : "text-rose-700 font-medium"}`}>
                        {item}
                        {checkedAt && <span className="ml-2 text-[10px] text-muted-foreground font-normal">{formatDateTime(checkedAt)}</span>}
                      </span>
                      <span className={`text-xs font-bold shrink-0 ${passed ? "text-emerald-600" : "text-rose-500"}`}>
                        {passed ? "✓ PASS" : "✗ FAIL"}
                      </span>
                    </label>
                  );
                })}
              </div>
              {Object.values(auditChecklist).filter((v) => !v).length > 0 && (
                <div className="mt-2 flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                  <p className="text-xs text-amber-700 font-medium">
                    {Object.values(auditChecklist).filter((v) => !v).length} item(s) flagged — recorded for visibility, does not block submission
                  </p>
                </div>
              )}
            </div>

            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Overall Result</p>
              <div className="flex gap-3">
                <label className={`flex-1 flex items-center justify-center gap-2 rounded-lg border px-3 py-2.5 cursor-pointer text-sm font-medium transition-colors ${auditResult === "satisfactory" ? "border-emerald-500 bg-emerald-50 text-emerald-700" : "border-border text-muted-foreground hover:border-primary/50"}`}>
                  <input type="radio" className="sr-only" value="satisfactory" checked={auditResult === "satisfactory"} onChange={() => setAuditResult("satisfactory")} />
                  <ShieldCheck className="w-4 h-4" />
                  Satisfactory
                </label>
                <label className={`flex-1 flex items-center justify-center gap-2 rounded-lg border px-3 py-2.5 cursor-pointer text-sm font-medium transition-colors ${auditResult === "not_satisfactory" ? "border-rose-500 bg-rose-50 text-rose-700" : "border-border text-muted-foreground hover:border-primary/50"}`}>
                  <input type="radio" className="sr-only" value="not_satisfactory" checked={auditResult === "not_satisfactory"} onChange={() => setAuditResult("not_satisfactory")} />
                  <ShieldAlert className="w-4 h-4" />
                  Not Satisfactory
                </label>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Notes <span className="normal-case font-normal text-muted-foreground/60">(optional)</span>
              </Label>
              <Textarea
                placeholder="Any observations, equipment issues, or concerns to record…"
                rows={2}
                className="resize-none text-sm"
                value={auditNotes}
                onChange={(e) => setAuditNotes(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setAuditDialogTruckOpId(null)}>Cancel</Button>
            <Button
              disabled={submitAuditMutation.isPending}
              variant={auditResult === "not_satisfactory" ? "destructive" : "default"}
              onClick={() => auditDialogTruckOpId && submitAuditMutation.mutate({ truckOpId: auditDialogTruckOpId })}
            >
              {submitAuditMutation.isPending && <Spinner size={14} className="mr-1.5" />}
              Submit Audit
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── LO: Create new truck inline while sourcing (no matching plate found) */}
      <Dialog open={showCreateTruckDialog} onOpenChange={(v) => { if (!v) { setShowCreateTruckDialog(false); resetCreateTruckForm(); } }}>
        <DialogContent className="sm:max-w-md" aria-describedby={undefined}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Truck className="w-4 h-4 text-primary" />
              Create New Truck
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 mt-1 max-h-[70vh] overflow-y-auto pr-1">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Plate Number <span className="text-destructive">*</span></Label>
                <Input value={newTruckNumber} onChange={(e) => setNewTruckNumber(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Capacity (L) <span className="text-destructive">*</span></Label>
                <Input type="number" step="0.01" value={newTruckCapacity} onChange={(e) => setNewTruckCapacity(e.target.value)} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Chassis Number <span className="text-muted-foreground font-normal">optional</span></Label>
              <Input value={newTruckChassis} onChange={(e) => setNewTruckChassis(e.target.value)} />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Driver Name <span className="text-destructive">*</span></Label>
                <Input value={newTruckDriver} onChange={(e) => setNewTruckDriver(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Driver Phone <span className="text-destructive">*</span></Label>
                <Input value={newTruckPhone} onChange={(e) => setNewTruckPhone(e.target.value)} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Vendor <span className="text-muted-foreground font-normal">optional</span></Label>
              <Input value={newTruckVendor} onChange={(e) => setNewTruckVendor(e.target.value)} />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Photo <span className="text-muted-foreground font-normal">optional</span></Label>
                <label className="flex items-center justify-center rounded-md border border-dashed px-2 py-2 text-[11px] text-muted-foreground hover:border-primary hover:text-primary cursor-pointer truncate">
                  {newTruckPhotoFile ? newTruckPhotoFile.name : "Upload"}
                  <input type="file" accept="image/jpeg,image/png,image/webp" className="hidden"
                    onChange={(e) => setNewTruckPhotoFile(e.target.files?.[0] ?? null)} />
                </label>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Licence (PDF) <span className="text-muted-foreground font-normal">optional</span></Label>
                <label className="flex items-center justify-center rounded-md border border-dashed px-2 py-2 text-[11px] text-muted-foreground hover:border-primary hover:text-primary cursor-pointer truncate">
                  {newTruckLicenceFile ? newTruckLicenceFile.name : "Upload"}
                  <input type="file" accept="application/pdf" className="hidden"
                    onChange={(e) => setNewTruckLicenceFile(e.target.files?.[0] ?? null)} />
                </label>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Calibration Cert (PDF) <span className="text-muted-foreground font-normal">optional</span></Label>
                <label className="flex items-center justify-center rounded-md border border-dashed px-2 py-2 text-[11px] text-muted-foreground hover:border-primary hover:text-primary cursor-pointer truncate">
                  {newTruckCalibrationFile ? newTruckCalibrationFile.name : "Upload"}
                  <input type="file" accept="application/pdf" className="hidden"
                    onChange={(e) => setNewTruckCalibrationFile(e.target.files?.[0] ?? null)} />
                </label>
              </div>
            </div>
          </div>
          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => { setShowCreateTruckDialog(false); resetCreateTruckForm(); }}>Cancel</Button>
            <Button
              disabled={
                !newTruckNumber.trim() || !newTruckCapacity || parseFloat(newTruckCapacity) <= 0 ||
                !newTruckDriver.trim() || !newTruckPhone.trim() ||
                createTruckMutation.isPending
              }
              onClick={() => createTruckMutation.mutate()}
            >
              {createTruckMutation.isPending && <Spinner size={14} className="mr-1.5" />}
              Create & Nominate
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── BM: Create & Link BFL / Naval Clearance (More Actions shortcut) ── */}
      <CreateNavalClearanceDialog
        open={showCreateNc}
        onOpenChange={setShowCreateNc}
        onCreated={(nc) => createAndLinkNcMutation.mutate(nc.id)}
      />

      {/* ── BM: Edit Operation — editable at any phase, no status restriction ── */}
      <EditOperationDialog
        open={showEditOperation}
        onOpenChange={setShowEditOperation}
        operation={op}
      />

      {/* ── BM: Remove Truck dialog ── */}
      <ReasonGatedDialog
        open={!!removeTruckTarget}
        onOpenChange={(v) => { if (!v) { setRemoveTruckTarget(null); setRemoveTruckReason(""); } }}
        title="Remove Truck from Operation"
        icon={Trash2}
        description={
          removeTruckTarget
            ? `${removeTruckTarget.truck?.truck_number ?? "This truck"} will be removed from the operation. This can't be undone.`
            : undefined
        }
        reason={removeTruckReason}
        onReasonChange={setRemoveTruckReason}
        reasonPlaceholder="Why is this truck being removed…"
        confirmLabel="Remove Truck"
        destructive
        pending={removeTruckMutation.isPending}
        onConfirm={() => removeTruckMutation.mutate()}
      />

      {/* ── LO: Link Waybill dialog (waiver number + plate + driver, at waybill time) */}
      <Dialog open={!!waybillDialogTruckOpId} onOpenChange={(v) => { if (!v) setWaybillDialogTruckOpId(null); }}>
        <DialogContent className="sm:max-w-md" aria-describedby={undefined}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-primary" />
              Link Waybill
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 mt-1">
            <div className="space-y-1.5">
              <Label className="text-xs">Truck Waybill Number <span className="text-destructive">*</span></Label>
              <Select value={waybillWaiverId} onValueChange={setWaybillWaiverId}>
                <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Select a waiver number…" /></SelectTrigger>
                <SelectContent>
                  {availableWaivers?.map((w) => (
                    <SelectItem key={w.id} value={w.id}>
                      {w.waybill_truck_number}
                      {/* A waiver can cover multiple trucks — surface that it's already in use, not hide it. */}
                      {w.linked_trucks.length > 0 && ` (already on ${w.linked_trucks.length} truck${w.linked_trucks.length === 1 ? "" : "s"})`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Driver Name <span className="text-destructive">*</span></Label>
                <Input value={waybillDriver} onChange={(e) => setWaybillDriver(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Driver Phone <span className="text-destructive">*</span></Label>
                <Input value={waybillPhone} onChange={(e) => setWaybillPhone(e.target.value)} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Vendor <span className="text-muted-foreground font-normal">optional</span></Label>
              <Input value={waybillVendor} onChange={(e) => setWaybillVendor(e.target.value)} />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Waybill No. <span className="text-muted-foreground font-normal">optional</span></Label>
                <Input placeholder="e.g. WB 25615" value={waybillDocNumber} onChange={(e) => setWaybillDocNumber(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Internal Waybill # <span className="text-muted-foreground font-normal">optional</span></Label>
                <Input value={waybillNumber} onChange={(e) => setWaybillNumber(e.target.value)} />
              </div>
            </div>
          </div>
          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setWaybillDialogTruckOpId(null)}>Cancel</Button>
            <Button
              disabled={!waybillWaiverId || !waybillDriver.trim() || !waybillPhone.trim() || linkWaybillMutation.isPending}
              onClick={() => linkWaybillMutation.mutate()}
            >
              {linkWaybillMutation.isPending && <Spinner size={14} className="mr-1.5" />}
              Link Waybill
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── BM Waive Audit Item dialog */}
      {/* ── BM: Edit Discharge Record dialog */}
      <Dialog open={!!editDischargeId} onOpenChange={(v) => { if (!v) setEditDischargeId(null); }}>
        <DialogContent className="sm:max-w-md" aria-describedby={undefined}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Pencil className="w-4 h-4 text-primary" />
              Edit Discharge Record
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 mt-2">
            <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2.5">
              <p className="text-xs text-amber-800 font-semibold">Bunker Manager Edit</p>
              <p className="text-xs text-amber-700 mt-0.5">
                All changes will be logged in the audit trail as "Edited by BM". If already approved, ROB entries will be adjusted automatically.
              </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Quantity Discharged (L)</Label>
                <Input
                  type="number"
                  step="0.001"
                  className="h-8 text-xs"
                  placeholder="0.000"
                  value={editDischQty}
                  onChange={(e) => setEditDischQty(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Spillage (L) <span className="font-normal text-muted-foreground">(opt.)</span></Label>
                <Input
                  type="number"
                  step="0.001"
                  className="h-8 text-xs"
                  placeholder="0.000"
                  value={editDischSpillage}
                  onChange={(e) => setEditDischSpillage(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Temperature (°C) <span className="font-normal text-muted-foreground">(opt.)</span></Label>
                <Input
                  type="number"
                  step="0.1"
                  className="h-8 text-xs"
                  placeholder="e.g. 35.5"
                  value={editDischTemp}
                  onChange={(e) => setEditDischTemp(e.target.value)}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Delivered To (Vessel)</Label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <Select
                  value={editDischVesselMode}
                  onValueChange={(v) => setEditDischVesselMode(v as "system" | "other")}
                >
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="system">System Vessel</SelectItem>
                    <SelectItem value="other">Other (external)</SelectItem>
                  </SelectContent>
                </Select>
                {editDischVesselMode === "system" ? (
                  <Select value={editDischVesselId} onValueChange={setEditDischVesselId}>
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue placeholder="Select vessel…" />
                    </SelectTrigger>
                    <SelectContent>
                      {allVessels?.map((v) => (
                        <SelectItem key={v.id} value={v.id}>{v.vessel_name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <Input
                    className="h-8 text-xs"
                    placeholder="Vessel or client name…"
                    value={editDischVesselName}
                    onChange={(e) => setEditDischVesselName(e.target.value)}
                  />
                )}
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Notes <span className="font-normal text-muted-foreground">(opt.)</span></Label>
              <Textarea
                rows={2}
                className="resize-none text-xs"
                placeholder="Reason for edit or additional context…"
                value={editDischNotes}
                onChange={(e) => setEditDischNotes(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDischargeId(null)}>Cancel</Button>
            <Button
              disabled={editDischargeM.isPending}
              onClick={() => editDischargeM.mutate()}
            >
              {editDischargeM.isPending && <Spinner size={14} className="mr-1.5" />}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!waiverDialog} onOpenChange={(v) => { if (!v) { setWaiverDialog(null); setWaiverNotes(""); } }}>
        <DialogContent className="sm:max-w-sm" aria-describedby={undefined}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-amber-700">
              <AlertTriangle className="w-4 h-4" />
              Waive Failed Safety Item
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 mt-2">
            <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2.5">
              <p className="text-xs font-semibold text-amber-800">Failed item:</p>
              <p className="text-sm text-amber-900 mt-0.5 font-medium">{waiverDialog?.item}</p>
            </div>
            <p className="text-xs text-muted-foreground">
              By waiving this item, you confirm the operation may proceed despite this issue. This waiver is permanently recorded on the operation.
            </p>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Waiver Reason / Notes</Label>
              <Textarea
                placeholder="State the reason for waiving this safety issue…"
                rows={3}
                className="resize-none text-sm"
                value={waiverNotes}
                onChange={(e) => setWaiverNotes(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setWaiverDialog(null); setWaiverNotes(""); }}>Cancel</Button>
            <Button
              variant="default"
              className="bg-amber-600 hover:bg-amber-700"
              disabled={!waiverNotes.trim() || waiveItemMutation.isPending}
              onClick={() => waiverDialog && waiveItemMutation.mutate({
                truckOpId: waiverDialog.truckOpId,
                phase: waiverDialog.phase,
                item: waiverDialog.item,
                notes: waiverNotes,
              })}
            >
              {waiveItemMutation.isPending && <Spinner size={14} className="mr-1.5" />}
              Confirm Waiver
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Reopen dialog */}
      <Dialog open={showReopenDialog} onOpenChange={(v) => !v && setShowReopenDialog(false)}>
        <DialogContent className="sm:max-w-sm" aria-describedby={undefined}>
          <DialogHeader>
            <DialogTitle>Reopen Operation</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 mt-2">
            <p className="text-sm text-muted-foreground">
              This will create a new revision <strong>v{(op?.version ?? 1) + 1}</strong> of{" "}
              <span className="font-mono font-semibold">{op?.operation_number}</span>, linked to this
              operation family.
            </p>
            <div className="space-y-1.5">
              <Label className="text-xs">Revision Notes (optional)</Label>
              <Textarea
                placeholder="Why is this operation being reopened?…"
                rows={3}
                className="resize-none"
                value={reopenNotes}
                onChange={(e) => setReopenNotes(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowReopenDialog(false)}>Cancel</Button>
            <Button disabled={reopenMutation.isPending} onClick={() => reopenMutation.mutate()}>
              {reopenMutation.isPending && <Spinner size={14} className="mr-1.5" />}
              Create Revision
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── BM: Operation color picker ── */}
      <Dialog open={showColorPicker} onOpenChange={setShowColorPicker}>
        <DialogContent className="sm:max-w-xs" aria-describedby={undefined}>
          <DialogHeader><DialogTitle>Operation Color</DialogTitle></DialogHeader>
          <div className="grid grid-cols-5 gap-3 py-2">
            {Object.entries(OPERATION_COLOR_SWATCHES).map(([name, cls]) => (
              <button
                key={name}
                className={`w-9 h-9 rounded-full ${cls} ${op.color === name ? "ring-2 ring-offset-2 ring-primary" : ""}`}
                title={name}
                onClick={() => { setColorMutation.mutate(name); setShowColorPicker(false); }}
              />
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => { setColorMutation.mutate(null); setShowColorPicker(false); }}>
              Clear Color
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── BM: Link Naval Clearance dialog ── */}
      <Dialog open={showLinkNc} onOpenChange={(v) => { setShowLinkNc(v); if (!v) setLinkNcId(""); }}>
        <DialogContent className="sm:max-w-md" aria-describedby={undefined}>
          <DialogHeader><DialogTitle className="flex items-center gap-2"><Anchor className="w-4 h-4 text-primary" />Link Naval Clearance</DialogTitle></DialogHeader>
          <div className="space-y-3 mt-1">
            <Select value={linkNcId} onValueChange={setLinkNcId}>
              <SelectTrigger><SelectValue placeholder="Select Naval Clearance…" /></SelectTrigger>
              <SelectContent>
                {linkableClearances?.map((nc) => (
                  <SelectItem key={nc.id} value={nc.id}>
                    {nc.clearance_number}
                    <span className="ml-1.5 text-xs text-muted-foreground">
                      · {nc.products.join(", ")} · {parseFloat(nc.total_quantity_litres).toLocaleString()} L
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setShowLinkNc(false)}>Cancel</Button>
            <Button disabled={!linkNcId || linkNcMutation.isPending} onClick={() => linkNcMutation.mutate()}>
              {linkNcMutation.isPending && <Spinner size={14} className="mr-1.5" />}
              Link
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── BM: Unlink Naval Clearance dialog ── */}
      <Dialog open={showUnlinkNc} onOpenChange={(v) => { setShowUnlinkNc(v); if (!v) setUnlinkNcReason(""); }}>
        <DialogContent className="sm:max-w-sm" aria-describedby={undefined}>
          <DialogHeader><DialogTitle>Unlink Naval Clearance</DialogTitle></DialogHeader>
          <div className="space-y-3 mt-1">
            <Label className="text-xs">Reason <span className="text-destructive">*</span></Label>
            <Textarea
              rows={2} className="resize-none text-sm" placeholder="Why is this being unlinked…"
              value={unlinkNcReason} onChange={(e) => setUnlinkNcReason(e.target.value)}
            />
          </div>
          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setShowUnlinkNc(false)}>Cancel</Button>
            <Button
              variant="destructive"
              disabled={!unlinkNcReason.trim() || unlinkNcMutation.isPending}
              onClick={() => unlinkNcMutation.mutate()}
            >
              {unlinkNcMutation.isPending && <Spinner size={14} className="mr-1.5" />}
              Unlink
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── BM: Notify Clients — tick-to-send, defaults every row unticked ── */}
      <Dialog open={showNotifyDialog} onOpenChange={(v) => {
        setShowNotifyDialog(v);
        if (!v) {
          setTickedRecipients(new Set());
          setCustomMessage("");
          setNotifType("stage_update");
          setEtaEditId(null);
          setEtaEditValue("");
          setEtaEditReason("");
        }
      }}>
        <DialogContent className="sm:max-w-lg" aria-describedby={undefined}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Bell className="w-4 h-4 text-primary" />Notify Clients</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 mt-1 max-h-[65vh] overflow-y-auto pr-1">
            {new Set(Array.from(tickedRecipients).map((rid) => notifyRecipients?.find((r) => r.naval_clearance_vessel_id === rid)?.client_id)).size > 1 && (
              <div className="rounded-md bg-amber-50 border border-amber-200 px-3 py-2 text-xs text-amber-700 flex items-center gap-2">
                <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                This will notify more than one client organisation.
              </div>
            )}

            <div className="space-y-1.5">
              <Label className="text-xs">Notification Type</Label>
              <Select value={notifType} onValueChange={setNotifType}>
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="stage_update" className="text-xs">Stage Update</SelectItem>
                  <SelectItem value="eta_change" className="text-xs">ETA Change</SelectItem>
                  <SelectItem value="completion" className="text-xs">Completion</SelectItem>
                  <SelectItem value="general" className="text-xs">General</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Message (optional)</Label>
              <Textarea className="text-xs min-h-15 resize-none" placeholder="Additional message content…" value={customMessage} onChange={(e) => setCustomMessage(e.target.value)} />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Recipients — tick to select</Label>
              <div className="rounded-md border divide-y">
                {notifyRecipients?.length ? notifyRecipients.map((r) => (
                  <div key={r.naval_clearance_vessel_id} className="px-3 py-2 space-y-1.5">
                    <label className="flex items-start gap-2 text-xs cursor-pointer">
                      <input
                        type="checkbox"
                        checked={tickedRecipients.has(r.naval_clearance_vessel_id)}
                        onChange={(e) => setTickedRecipients((prev) => {
                          const next = new Set(prev);
                          if (e.target.checked) next.add(r.naval_clearance_vessel_id); else next.delete(r.naval_clearance_vessel_id);
                          return next;
                        })}
                      />
                      <span className="flex-1">
                        <span className="font-medium">{r.client_name ?? "—"}</span>
                        <span className="text-muted-foreground"> ({r.client_email ?? "—"})</span>
                        <br />
                        <span className="text-muted-foreground">{r.vessel_name}{r.imo_number ? ` · IMO ${r.imo_number}` : ""}</span>
                      </span>
                    </label>
                    <div className="pl-6 flex items-center gap-2 text-[11px] text-muted-foreground">
                      {etaEditId === r.naval_clearance_vessel_id ? (
                        <>
                          <Input type="datetime-local" className="h-6 text-[11px] w-40" value={etaEditValue} onChange={(e) => setEtaEditValue(e.target.value)} />
                          <Input className="h-6 text-[11px]" placeholder="Reason (e.g. weather)" value={etaEditReason} onChange={(e) => setEtaEditReason(e.target.value)} />
                          <Button size="sm" className="h-6 px-2 text-[11px]" disabled={!etaEditValue || setEtaMutation.isPending} onClick={() => setEtaMutation.mutate(r.naval_clearance_vessel_id)}>Save</Button>
                          <Button size="sm" variant="ghost" className="h-6 px-2 text-[11px]" onClick={() => setEtaEditId(null)}>Cancel</Button>
                        </>
                      ) : (
                        <>
                          <span>ETA: {r.current_eta ? formatDateTime(r.current_eta) : "not set"}</span>
                          <button className="text-primary underline" onClick={() => { setEtaEditId(r.naval_clearance_vessel_id); setEtaEditValue(""); setEtaEditReason(""); }}>
                            Update ETA
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                )) : (
                  <p className="text-xs text-muted-foreground text-center py-6">No client vessels on this operation's Naval Clearance</p>
                )}
              </div>
            </div>

            {notificationLog && notificationLog.length > 0 && (
              <div className="space-y-1">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Previously Sent</p>
                {notificationLog.map((l) => (
                  <div key={l.id} className="text-[11px] text-muted-foreground border-l-2 border-muted pl-2">
                    <span className="font-medium text-foreground">{l.recipient_name}</span> — {l.subject} · {formatDateTime(l.sent_at)}
                  </div>
                ))}
              </div>
            )}
          </div>
          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setShowNotifyDialog(false)}>Cancel</Button>
            <Button disabled={tickedRecipients.size === 0 || sendNotificationMutation.isPending} onClick={() => sendNotificationMutation.mutate()}>
              {sendNotificationMutation.isPending && <Spinner size={14} className="mr-1.5" />}
              Send to {tickedRecipients.size || 0} Recipient(s)
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── BM: Notify Staff — General stream, internal recipient picker ── */}
      <Dialog open={showNotifyStaffDialog} onOpenChange={(v) => { if (!v) resetNotifyStaffDialog(); else setShowNotifyStaffDialog(true); }}>
        <DialogContent className="sm:max-w-lg" aria-describedby={undefined}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Bell className="w-4 h-4 text-primary" />Notify Staff</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 mt-1 max-h-[65vh] overflow-y-auto pr-1">
            <p className="text-xs text-muted-foreground">
              A general update about this operation — separate from the automatic notifications staff already get for their own tasks.
            </p>

            <div className="space-y-1.5">
              <Label className="text-xs">Title</Label>
              <Input className="h-8 text-xs" placeholder="e.g. Operation delayed" value={staffNotifTitle} onChange={(e) => setStaffNotifTitle(e.target.value)} />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Message</Label>
              <Textarea className="text-xs min-h-15 resize-none" placeholder="Details for recipients…" value={staffNotifMessage} onChange={(e) => setStaffNotifMessage(e.target.value)} />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Recipients</Label>
              <label className="flex items-center gap-2 text-xs cursor-pointer">
                <input type="checkbox" checked={notifyAllStaff} onChange={(e) => setNotifyAllStaff(e.target.checked)} />
                All active staff
              </label>
              {!notifyAllStaff && (
                <div className="rounded-md border divide-y max-h-48 overflow-y-auto">
                  {eligibleStaff?.length ? eligibleStaff.map((u) => (
                    <label key={u.id} className="flex items-center gap-2 px-3 py-1.5 text-xs cursor-pointer">
                      <input
                        type="checkbox"
                        checked={tickedStaff.has(u.id)}
                        onChange={(e) => setTickedStaff((prev) => {
                          const next = new Set(prev);
                          if (e.target.checked) next.add(u.id); else next.delete(u.id);
                          return next;
                        })}
                      />
                      <span className="flex-1">{u.full_name}</span>
                      <span className="text-muted-foreground capitalize">{u.role.replace(/_/g, " ")}</span>
                    </label>
                  )) : (
                    <p className="text-xs text-muted-foreground text-center py-4">No staff found</p>
                  )}
                </div>
              )}
            </div>

            {staffNotificationLog && staffNotificationLog.length > 0 && (
              <div className="space-y-1">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Previously Sent</p>
                {staffNotificationLog.map((l) => (
                  <div key={l.id} className="text-[11px] text-muted-foreground border-l-2 border-muted pl-2">
                    <span className="font-medium text-foreground">{l.title}</span> — {l.recipients.length} recipient(s) · {formatDateTime(l.sent_at)}
                  </div>
                ))}
              </div>
            )}
          </div>
          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={resetNotifyStaffDialog}>Cancel</Button>
            <Button
              disabled={!staffNotifTitle.trim() || !staffNotifMessage.trim() || (!notifyAllStaff && tickedStaff.size === 0) || sendStaffNotificationMutation.isPending}
              onClick={() => sendStaffNotificationMutation.mutate()}
            >
              {sendStaffNotificationMutation.isPending && <Spinner size={14} className="mr-1.5" />}
              Send
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── BM: Edit Truck BDN dialog */}
      <Dialog open={!!editTruckBdnId} onOpenChange={(v) => { if (!v) setEditTruckBdnId(null); }}>
        <DialogContent className="sm:max-w-md" aria-describedby={undefined}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Pencil className="w-4 h-4 text-primary" />Edit Truck BDN</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 mt-1 max-h-[70vh] overflow-y-auto pr-1">
            <div className="space-y-1.5">
              <Label className="text-xs">Company Name</Label>
              <Input
                value={editTruckBdnForm.company_name ?? ""}
                onChange={(e) => setEditTruckBdnForm((f) => ({ ...f, company_name: e.target.value }))}
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Product Type</Label>
                <Input
                  value={editTruckBdnForm.product_type ?? ""}
                  onChange={(e) => setEditTruckBdnForm((f) => ({ ...f, product_type: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Discharge Location</Label>
                <Input
                  value={editTruckBdnForm.discharge_location ?? ""}
                  onChange={(e) => setEditTruckBdnForm((f) => ({ ...f, discharge_location: e.target.value }))}
                />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Quantity Loaded (L)</Label>
                <Input
                  type="number" step="0.001"
                  value={editTruckBdnForm.quantity_loaded_mt ?? ""}
                  onChange={(e) => setEditTruckBdnForm((f) => ({ ...f, quantity_loaded_mt: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Quantity Discharged (L)</Label>
                <Input
                  type="number" step="0.001"
                  value={editTruckBdnForm.quantity_discharged_mt ?? ""}
                  onChange={(e) => setEditTruckBdnForm((f) => ({ ...f, quantity_discharged_mt: e.target.value }))}
                />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Density</Label>
                <Input
                  type="number" step="0.0001"
                  value={editTruckBdnForm.density ?? ""}
                  onChange={(e) => setEditTruckBdnForm((f) => ({ ...f, density: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Temperature (°C)</Label>
                <Input
                  type="number" step="0.1"
                  value={editTruckBdnForm.temperature ?? ""}
                  onChange={(e) => setEditTruckBdnForm((f) => ({ ...f, temperature: e.target.value }))}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">VCF</Label>
                <Input
                  type="number" step="0.0001"
                  value={editTruckBdnForm.vcf ?? ""}
                  onChange={(e) => setEditTruckBdnForm((f) => ({ ...f, vcf: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">GOV</Label>
                <Input
                  type="number" step="0.01"
                  value={editTruckBdnForm.gov ?? ""}
                  onChange={(e) => setEditTruckBdnForm((f) => ({ ...f, gov: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">GSV</Label>
                <Input
                  type="number" step="0.01"
                  value={editTruckBdnForm.gsv ?? ""}
                  onChange={(e) => setEditTruckBdnForm((f) => ({ ...f, gsv: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">MTvac</Label>
                <Input
                  type="number" step="0.001"
                  value={editTruckBdnForm.mt_vacuum ?? ""}
                  onChange={(e) => setEditTruckBdnForm((f) => ({ ...f, mt_vacuum: e.target.value }))}
                />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Commenced Discharge</Label>
                <Input
                  type="datetime-local"
                  value={editTruckBdnForm.discharge_commenced_at ?? ""}
                  onChange={(e) => setEditTruckBdnForm((f) => ({ ...f, discharge_commenced_at: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Completed Discharge</Label>
                <Input
                  type="datetime-local"
                  value={editTruckBdnForm.discharge_completed_at ?? ""}
                  onChange={(e) => setEditTruckBdnForm((f) => ({ ...f, discharge_completed_at: e.target.value }))}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Date of Discharge Completion</Label>
              <Input
                type="date"
                value={editTruckBdnForm.discharge_completion_date ?? ""}
                onChange={(e) => setEditTruckBdnForm((f) => ({ ...f, discharge_completion_date: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Notes</Label>
              <Textarea
                rows={2}
                className="resize-none text-sm"
                value={editTruckBdnForm.notes ?? ""}
                onChange={(e) => setEditTruckBdnForm((f) => ({ ...f, notes: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Reason for edit <span className="text-destructive">*</span></Label>
              <Textarea
                rows={2}
                className="resize-none text-sm"
                placeholder="Why is this being changed…"
                value={editTruckBdnReason}
                onChange={(e) => setEditTruckBdnReason(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setEditTruckBdnId(null)}>Cancel</Button>
            <Button
              disabled={!editTruckBdnReason.trim() || editTruckBdnMutation.isPending}
              onClick={() => editTruckBdnMutation.mutate()}
            >
              {editTruckBdnMutation.isPending && <Spinner size={14} className="mr-1.5" />}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── BM: Edit Vessel BDN dialog */}
      <Dialog open={!!editVesselBdnId} onOpenChange={(v) => { if (!v) setEditVesselBdnId(null); }}>
        <DialogContent className="sm:max-w-md" aria-describedby={undefined}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Pencil className="w-4 h-4 text-primary" />Edit Vessel BDN</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 mt-1 max-h-[70vh] overflow-y-auto pr-1">
            <div className="space-y-1.5">
              <Label className="text-xs">Company Name</Label>
              <Input value={editVesselBdnForm.company_name ?? ""} onChange={(e) => setEditVesselBdnForm((f) => ({ ...f, company_name: e.target.value }))} />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Product Type</Label>
                <Input value={editVesselBdnForm.product_type ?? ""} onChange={(e) => setEditVesselBdnForm((f) => ({ ...f, product_type: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Discharge Location</Label>
                <Input value={editVesselBdnForm.discharge_location ?? ""} onChange={(e) => setEditVesselBdnForm((f) => ({ ...f, discharge_location: e.target.value }))} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Receiving Vessel</Label>
              <Input value={editVesselBdnForm.receiving_vessel ?? ""} onChange={(e) => setEditVesselBdnForm((f) => ({ ...f, receiving_vessel: e.target.value }))} />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Quantity Loaded (L)</Label>
                <Input type="number" step="0.01" value={editVesselBdnForm.quantity_loaded_litres ?? ""} onChange={(e) => setEditVesselBdnForm((f) => ({ ...f, quantity_loaded_litres: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Quantity Discharged (L)</Label>
                <Input type="number" step="0.01" value={editVesselBdnForm.quantity_discharged_litres ?? ""} onChange={(e) => setEditVesselBdnForm((f) => ({ ...f, quantity_discharged_litres: e.target.value }))} />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Density</Label>
                <Input type="number" step="0.0001" value={editVesselBdnForm.density ?? ""} onChange={(e) => setEditVesselBdnForm((f) => ({ ...f, density: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Temperature (°C)</Label>
                <Input type="number" step="0.1" value={editVesselBdnForm.temperature ?? ""} onChange={(e) => setEditVesselBdnForm((f) => ({ ...f, temperature: e.target.value }))} />
              </div>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">VCF</Label>
                <Input type="number" step="0.0001" value={editVesselBdnForm.vcf ?? ""} onChange={(e) => setEditVesselBdnForm((f) => ({ ...f, vcf: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">GOV</Label>
                <Input type="number" step="0.01" value={editVesselBdnForm.discharge_gov ?? ""} onChange={(e) => setEditVesselBdnForm((f) => ({ ...f, discharge_gov: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">GSV</Label>
                <Input type="number" step="0.01" value={editVesselBdnForm.discharge_gsv ?? ""} onChange={(e) => setEditVesselBdnForm((f) => ({ ...f, discharge_gsv: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">MTvac</Label>
                <Input type="number" step="0.001" value={editVesselBdnForm.discharge_mt_vacuum ?? ""} onChange={(e) => setEditVesselBdnForm((f) => ({ ...f, discharge_mt_vacuum: e.target.value }))} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Completed Discharge</Label>
              <Input type="datetime-local" value={editVesselBdnForm.discharge_completed_at ?? ""} onChange={(e) => setEditVesselBdnForm((f) => ({ ...f, discharge_completed_at: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Date of Discharge Completion</Label>
              <Input type="date" value={editVesselBdnForm.discharge_completion_date ?? ""} onChange={(e) => setEditVesselBdnForm((f) => ({ ...f, discharge_completion_date: e.target.value }))} />
            </div>
            <div className="space-y-2 rounded-lg border p-2.5">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Received Quantity (receiving vessel&apos;s own readings)</p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">GOV</Label>
                  <Input type="number" step="0.01" value={editVesselBdnForm.received_gov ?? ""} onChange={(e) => setEditVesselBdnForm((f) => ({ ...f, received_gov: e.target.value }))} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">GSV</Label>
                  <Input type="number" step="0.01" value={editVesselBdnForm.received_gsv ?? ""} onChange={(e) => setEditVesselBdnForm((f) => ({ ...f, received_gsv: e.target.value }))} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">MTvac</Label>
                  <Input type="number" step="0.001" value={editVesselBdnForm.received_mt_vacuum ?? ""} onChange={(e) => setEditVesselBdnForm((f) => ({ ...f, received_mt_vacuum: e.target.value }))} />
                </div>
              </div>
            </div>
            {op?.type === "full_operation" && (
              <div className="space-y-2 rounded-lg border p-2.5">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Truck ↔ Vessel Reconciliation (MT)</p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Discharged by Trucks</Label>
                    <Input type="number" disabled value={editVesselBdnForm.truck_discharged_total_mt ?? ""} className="bg-muted/40" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Received by Vessel <span className="text-destructive">*</span></Label>
                    <Input type="number" step="0.001" value={editVesselBdnForm.vessel_received_total_mt ?? ""} onChange={(e) => setEditVesselBdnForm((f) => ({ ...f, vessel_received_total_mt: e.target.value }))} />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Truck Variance</Label>
                    <Input type="number" disabled value={editVesselBdnForm.truck_variance_mt ?? ""} className="bg-muted/40" />
                  </div>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  Correcting Received by Vessel on an approved BDN also corrects the vessel&apos;s ROB ledger — the prior entry is reversed and reapplied with the new figure.
                </p>
              </div>
            )}
            <div className="space-y-1.5">
              <Label className="text-xs">Notes</Label>
              <Textarea rows={2} className="resize-none text-sm" value={editVesselBdnForm.notes ?? ""} onChange={(e) => setEditVesselBdnForm((f) => ({ ...f, notes: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Reason for edit <span className="text-destructive">*</span></Label>
              <Textarea rows={2} className="resize-none text-sm" placeholder="Why is this being changed…" value={editVesselBdnReason} onChange={(e) => setEditVesselBdnReason(e.target.value)} />
            </div>
          </div>
          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setEditVesselBdnId(null)}>Cancel</Button>
            <Button disabled={!editVesselBdnReason.trim() || editVesselBdnMutation.isPending} onClick={() => editVesselBdnMutation.mutate()}>
              {editVesselBdnMutation.isPending && <Spinner size={14} className="mr-1.5" />}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardShell>
  );
}

// ─── Helper component ────────────────────────────────────────────────────────

/**
 * One label/value pair in a definition list. `mono` for identifiers, `numeric`
 * for figures and timestamps, `wide` to span both columns of the Overview grid,
 * `muted` for editorial notes.
 */
function InfoItem({
  label,
  value,
  hint,
  mono = false,
  numeric = false,
  wide = false,
  muted = false,
}: {
  label: string;
  value: string;
  hint?: string;
  mono?: boolean;
  numeric?: boolean;
  wide?: boolean;
  muted?: boolean;
}) {
  return (
    <div className={cn("min-w-0", wide && "sm:col-span-2")}>
      <dt className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </dt>
      <dd
        className={cn(
          "mt-1 text-[13px] font-semibold text-foreground",
          mono && "font-mono",
          numeric && "tabular-nums",
          muted && "font-normal italic text-muted-foreground",
          wide && "leading-relaxed"
        )}
      >
        {value}
      </dd>
      {hint && <dd className="mt-0.5 truncate text-[11px] text-muted-foreground">{hint}</dd>}
    </div>
  );
}
