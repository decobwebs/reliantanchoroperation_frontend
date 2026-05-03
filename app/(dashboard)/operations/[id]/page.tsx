"use client";

import { use, useState, useRef } from "react";
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
} from "lucide-react";
import { toast } from "sonner";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { api, getErrorMessage, extractData } from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";
import { Header } from "@/components/layout/Header";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
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
  formatDate,
  formatDateTime,
  formatRelative,
  OP_TYPE_LABELS,
} from "@/lib/utils";
import type {
  ApiResponse,
  Operation,
  OperationStatus,
  StatusHistory,
  Task,
  BDN,
  Document,
  TruckFeedback,
  TruckOperation,
  Truck as TruckRecord,
  PFI,
  Voucher,
  Payment,
  Invoice,
  User,
  Vessel,
  VesselDischargeEvent,
  TruckSafetyAudit,
  AuditResult,
  AuditLogEntry,
  AuditWaiver,
} from "@/types";
import { PRODUCT_TYPE_LABELS } from "@/types";

// ─── Constants ───────────────────────────────────────────────────────────────

const ROLE_LABELS: Record<string, string> = {
  ops_supervisor:    "Ops Supervisor",
  logistics_officer: "Logistics Officer",
  marine_manager:    "Marine Manager",
  finance_manager:   "Finance Manager",
};

const PRIORITY_OPTIONS = [
  { value: "low",    label: "Low" },
  { value: "normal", label: "Normal" },
  { value: "high",   label: "High" },
  { value: "urgent", label: "Urgent" },
];

const ELIGIBLE_ROLES: Record<string, string[]> = {
  truck_only:     ["ops_supervisor", "logistics_officer"],
  vessel_only:    ["ops_supervisor", "marine_manager"],
  full_operation: ["ops_supervisor", "logistics_officer", "marine_manager"],
};

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
      return op.type === "truck_only"
        ? [{ to: "pfi_linked", label: "Link PFI" }]
        : [{ to: "vessel_operations", label: "Start Vessel Ops" }];
    case "pending_completion":
      return [
        { to: "completed", label: "Complete Operation" },
        { to: "active",    label: "Return to Active", destructive: true },
      ];
    case "vessel_operations":
      return [{ to: "bdn_pending",       label: "Mark BDN Pending" }];
    case "bdn_approved":
      return [{ to: "pfi_linked",        label: "Link PFI" }];
    case "pfi_linked":
      return [{ to: "payment_processing", label: "Process Payment" }];
    case "payment_processing":
      return [{ to: "payment_confirmed", label: "Confirm Payment" }];
    case "payment_confirmed":
      return [{ to: "invoiced",          label: "Mark Invoiced" }];
    case "invoiced":
      return [{ to: "completed",         label: "Complete Operation" }];
    default:
      return [];
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
      { k: "quantity_loaded_mt", label: "Quantity Loaded (MT)", type: "number" },
      { k: "waybill_number",     label: "Waybill Number",       type: "text",   optional: true },
    ]},
  { key: "arrived_discharge_at", label: "Arrived at Discharge Point",   description: "Truck reached discharge location",
    extras: [{ k: "discharge_location", label: "Discharge Location", type: "text", optional: true }] },
  { key: "discharge_start_at",   label: "Discharge Started",            description: "Product discharge commenced",
    extras: [{ k: "temperature_celsius", label: "Temperature (°C)", type: "number", optional: true }] },
  { key: "discharge_end_at",     label: "Discharge Completed",          description: "All product delivered",
    extras: [
      { k: "quantity_discharged_mt", label: "Quantity Discharged (MT)",    type: "number"               },
      { k: "temperature_celsius",    label: "Temperature (°C)",            type: "number", optional: true },
      { k: "spillage_mt",            label: "Spillage (MT)",               type: "number", optional: true },
      { k: "delivered_to",           label: "Delivered To (Vessel/Client)", type: "text",  optional: true },
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
              {mutation.isPending && <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />}
              Assign Task
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ─── Main page ───────────────────────────────────────────────────────────────

export default function OperationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { user } = useAuth();
  const router   = useRouter();
  const qc       = useQueryClient();

  const isBM = user?.role === "bunker_manager";
  const isFM = user?.role === "finance_manager";
  const isLO = user?.role === "logistics_officer";
  const isMM = user?.role === "marine_manager";
  const isOS = user?.role === "ops_supervisor";

  const canSeeTasks            = isBM || isOS || isLO || isMM;
  const canSeeBDN              = isBM || isMM;
  const canSeeFeedback         = isBM || isLO;
  const canSeeVesselDischarges = isBM || isMM || isOS;
  const canSeeFinance          = isBM || isFM;

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
  const [showDischargeForm, setShowDischargeForm] = useState(false);
  const [approvingFeedbackId, setApprovingFeedbackId] = useState<string | null>(null);
  const [approveComment,      setApproveComment]       = useState("");

  // LO feedback
  const [loSelectedTrucks, setLoSelectedTrucks] = useState<string[]>([]);
  const [loSummary,         setLoSummary]         = useState("");
  const [loNotes,           setLoNotes]           = useState("");

  // Vessel discharge form
  const [dischargeSource,  setDischargeSource]  = useState("");
  const [dischargeDest,    setDischargeDest]    = useState("");
  const [dischargeQty,     setDischargeQty]     = useState("");
  const [dischargeSpill,   setDischargeSpill]   = useState("");
  const [dischargeTemp,    setDischargeTemp]    = useState("");
  const [dischargeDensity, setDischargeDensity] = useState("");
  const [dischargeStartAt, setDischargeStartAt] = useState("");
  const [dischargeEndAt,   setDischargeEndAt]   = useState("");
  const [dischargeNotes,   setDischargeNotes]   = useState("");

  // ── Queries
  const { data: op, isLoading } = useQuery({
    queryKey: ["operation", id],
    queryFn: async () => {
      const res = await api.get<ApiResponse<Operation>>(`/operations/${id}`);
      return res.data.data;
    },
  });

  const { data: timeline } = useQuery({
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
    enabled: canSeeBDN,
  });

  const { data: truckOps } = useQuery({
    queryKey: ["operation-trucks", id],
    queryFn: async () => {
      const res = await api.get(`/operations/${id}/trucks`);
      const raw = res.data.data;
      const list = Array.isArray(raw) ? raw : ((raw as { items?: unknown[] })?.items ?? []);
      return list as TruckOperation[];
    },
    enabled: isLO || isBM || isOS,
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
  });

  const { data: payments, refetch: refetchPayments } = useQuery({
    queryKey: ["operation-payments", id],
    queryFn: async () => {
      const res = await api.get<ApiResponse<Payment[]>>(`/operations/${id}/payments`);
      return res.data.data ?? [];
    },
    enabled: canSeeFinance,
  });

  const { data: invoices, refetch: refetchInvoices } = useQuery({
    queryKey: ["operation-invoices", id],
    queryFn: async () => {
      const res = await api.get<ApiResponse<Invoice[]>>(`/operations/${id}/invoices`);
      return res.data.data ?? [];
    },
    enabled: canSeeFinance,
  });

  const { data: vouchers, refetch: refetchVouchers } = useQuery({
    queryKey: ["operation-vouchers", id],
    queryFn: async () => {
      const res = await api.get<ApiResponse<Voucher[]>>(`/operations/${id}/vouchers`);
      return res.data.data ?? [];
    },
    enabled: canSeeFinance,
  });

  const { data: feedbacks, refetch: refetchFeedbacks } = useQuery({
    queryKey: ["operation-feedback", id],
    queryFn: async () => {
      const res = await api.get<ApiResponse<TruckFeedback[]>>(`/operations/${id}/feedback`);
      return res.data.data;
    },
    enabled: canSeeFeedback,
  });

  const { data: vesselDischarges, refetch: refetchDischarges } = useQuery({
    queryKey: ["operation-vessel-discharges", id],
    queryFn: async () => {
      const res = await api.get<ApiResponse<VesselDischargeEvent[]>>(
        `/operations/${id}/vessel-discharges`
      );
      return res.data.data;
    },
    enabled: canSeeVesselDischarges,
  });

  const { data: vessels } = useQuery({
    queryKey: ["vessels-list"],
    queryFn: async () => {
      const res = await api.get<ApiResponse<{ items: Vessel[] }>>("/vessels?per_page=100");
      const d = res.data.data;
      return Array.isArray(d) ? d : (d as { items: Vessel[] }).items ?? [];
    },
    enabled: canSeeVesselDischarges && showDischargeForm,
  });

  const { data: versions } = useQuery({
    queryKey: ["operation-versions", id],
    queryFn: async () => {
      const res = await api.get<ApiResponse<Operation[]>>(`/operations/${id}/versions`);
      return res.data.data;
    },
    enabled: !!(op?.parent_operation_id || (op?.version && op.version > 1)),
  });

  const { data: fleetTrucks } = useQuery({
    queryKey: ["fleet-trucks"],
    queryFn: async () => {
      const res = await api.get<ApiResponse<TruckRecord[]>>("/trucks?active_only=true");
      const d = res.data.data;
      return Array.isArray(d) ? d : [];
    },
    enabled: isLO && op?.status === "awaiting_feedback",
  });

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
        comment ? { reason: comment } : {}
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
      const res = await api.post(`/operations/${id}/feedback`, {
        truck_ids:        loSelectedTrucks,
        readiness_summary: loSummary.trim(),
        truck_details:    loNotes.trim() ? { notes: loNotes.trim() } : {},
      });
      return res.data;
    },
    onSuccess: () => {
      toast.success("Feedback submitted");
      setLoSelectedTrucks([]);
      setLoSummary("");
      setLoNotes("");
      refetchFeedbacks();
      qc.invalidateQueries({ queryKey: ["operation", id] });
      qc.invalidateQueries({ queryKey: ["operation-timeline", id] });
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  // ── PFI state & mutations
  const [showPfiDialog, setShowPfiDialog] = useState(false);
  const [pfiMode,     setPfiMode]     = useState<"generate" | "upload">("generate");
  // Upload form
  const [pfiAmount,   setPfiAmount]   = useState("");
  const [pfiCurrency, setPfiCurrency] = useState("NGN");
  const [pfiSupplier, setPfiSupplier] = useState("");
  const [pfiDesc,     setPfiDesc]     = useState("");
  // Generate form
  const [genRate,       setGenRate]       = useState("");
  const [genValidity,   setGenValidity]   = useState("7");
  const [genTax,        setGenTax]        = useState("0");
  const [genExchange,   setGenExchange]   = useState("");
  const [genSupplier,   setGenSupplier]   = useState("");
  const [genDesc,       setGenDesc]       = useState("");
  const [genNotes,      setGenNotes]      = useState("");

  const closePfiDialog = () => {
    setShowPfiDialog(false);
    setPfiAmount(""); setPfiCurrency("NGN"); setPfiSupplier(""); setPfiDesc("");
    setGenRate(""); setGenValidity("7"); setGenTax("0"); setGenExchange("");
    setGenSupplier(""); setGenDesc(""); setGenNotes("");
  };

  const linkPfiMutation = useMutation({
    mutationFn: async () => {
      await api.post(`/operations/${id}/pfis`, {
        amount:        parseFloat(pfiAmount),
        currency:      pfiCurrency,
        supplier_name: pfiSupplier.trim() || undefined,
        description:   pfiDesc.trim()    || undefined,
      });
    },
    onSuccess: () => {
      toast.success("PFI linked successfully");
      closePfiDialog();
      refetchPfis();
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  const generatePfiMutation = useMutation({
    mutationFn: async () => {
      await api.post(`/operations/${id}/pfis/generate`, {
        rate_per_mt:   parseFloat(genRate),
        validity_days: parseInt(genValidity) || 7,
        tax_rate:      parseFloat(genTax) || 0,
        exchange_rate: genExchange ? parseFloat(genExchange) : undefined,
        supplier_name: genSupplier.trim() || undefined,
        description:   genDesc.trim()    || undefined,
        notes:         genNotes.trim()   || undefined,
      });
    },
    onSuccess: () => {
      toast.success("PFI generated and linked — Finance Manager notified");
      closePfiDialog();
      refetchPfis();
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  // ── Payment state & mutations (Finance Manager)
  const [showPaymentForm, setShowPaymentForm] = useState(false);
  const [payPfiId,        setPayPfiId]        = useState("");
  const [payAmount,       setPayAmount]       = useState("");
  const [payCurrency,     setPayCurrency]     = useState("NGN");
  const [payMethod,       setPayMethod]       = useState("bank_transfer");
  const [payRef,          setPayRef]          = useState("");
  const [payDate,         setPayDate]         = useState("");
  const [payNotes,        setPayNotes]        = useState("");

  const recordPaymentMutation = useMutation({
    mutationFn: async () => {
      await api.post(`/operations/${id}/payments`, {
        pfi_id:           payPfiId,
        amount:           parseFloat(payAmount),
        currency:         payCurrency,
        payment_method:   payMethod || undefined,
        payment_reference: payRef.trim() || undefined,
        payment_date:     payDate ? new Date(payDate).toISOString() : new Date().toISOString(),
        notes:            payNotes.trim() || undefined,
      });
    },
    onSuccess: () => {
      toast.success("Payment recorded");
      setShowPaymentForm(false);
      setPayPfiId(""); setPayAmount(""); setPayRef(""); setPayDate(""); setPayNotes("");
      refetchPayments();
      qc.invalidateQueries({ queryKey: ["operation", id] });
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  const confirmPaymentMutation = useMutation({
    mutationFn: async (paymentId: string) => {
      await api.post(`/operations/${id}/payments/${paymentId}/confirm`);
    },
    onSuccess: () => {
      toast.success("Payment confirmed — operation advanced");
      refetchPayments();
      qc.invalidateQueries({ queryKey: ["operation", id] });
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  // ── Invoice state & mutations (Finance Manager)
  const [showInvoiceForm, setShowInvoiceForm] = useState(false);
  const [invAmount,       setInvAmount]       = useState("");
  const [invCurrency,     setInvCurrency]     = useState("USD");
  const [invTax,          setInvTax]          = useState("0");
  const [invDueDate,      setInvDueDate]      = useState("");
  const [invNotes,        setInvNotes]        = useState("");

  const createInvoiceMutation = useMutation({
    mutationFn: async () => {
      await api.post(`/operations/${id}/invoices`, {
        amount:     parseFloat(invAmount),
        currency:   invCurrency,
        tax_amount: parseFloat(invTax) || 0,
        due_date:   invDueDate || undefined,
        notes:      invNotes.trim() || undefined,
        // bdn_id intentionally omitted for truck_only
      });
    },
    onSuccess: () => {
      toast.success("Invoice created");
      setShowInvoiceForm(false);
      setInvAmount(""); setInvTax("0"); setInvDueDate(""); setInvNotes("");
      refetchInvoices();
      qc.invalidateQueries({ queryKey: ["operation", id] });
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  const markInvoiceSentMutation = useMutation({
    mutationFn: async (invoiceId: string) => {
      await api.post(`/invoices/${invoiceId}/send`, {});
    },
    onSuccess: () => { toast.success("Invoice marked as sent"); refetchInvoices(); },
    onError:   (err) => toast.error(getErrorMessage(err)),
  });

  const markInvoicePaidMutation = useMutation({
    mutationFn: async (invoiceId: string) => {
      await api.post(`/invoices/${invoiceId}/mark-paid`, {});
    },
    onSuccess: () => {
      toast.success("Invoice marked as paid — operation completed");
      refetchInvoices();
      qc.invalidateQueries({ queryKey: ["operation", id] });
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  const cancelInvoiceMutation = useMutation({
    mutationFn: async (invoiceId: string) => {
      await api.post(`/invoices/${invoiceId}/cancel`, {});
    },
    onSuccess: () => { toast.success("Invoice cancelled"); refetchInvoices(); },
    onError:   (err) => toast.error(getErrorMessage(err)),
  });

  // ── PFI confirm-payment (FM marks PFI as paid, notifies BM)
  const confirmPfiPaymentMutation = useMutation({
    mutationFn: async ({ pfiId, receiptUrl }: { pfiId: string; receiptUrl?: string }) => {
      await api.post(`/pfis/${pfiId}/confirm-payment`, { receipt_url: receiptUrl || undefined });
    },
    onSuccess: () => {
      toast.success("PFI payment confirmed — Bunker Manager notified");
      refetchPfis();
      qc.invalidateQueries({ queryKey: ["operation", id] });
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  // ── Voucher state & mutations (Finance Manager records, BM approves)
  const [showVoucherForm, setShowVoucherForm] = useState(false);
  const [vCategory,       setVCategory]       = useState("port_fees");
  const [vAmount,         setVAmount]         = useState("");
  const [vCurrency,       setVCurrency]       = useState("NGN");
  const [vSupplier,       setVSupplier]       = useState("");
  const [vDescription,    setVDescription]    = useState("");
  const [vPayDate,        setVPayDate]        = useState("");
  const [vNotes,          setVNotes]          = useState("");

  const createVoucherMutation = useMutation({
    mutationFn: async () => {
      await api.post(`/operations/${id}/vouchers`, {
        category:      vCategory,
        amount:        parseFloat(vAmount),
        currency:      vCurrency,
        supplier_name: vSupplier.trim() || undefined,
        description:   vDescription.trim() || undefined,
        payment_date:  vPayDate ? new Date(vPayDate).toISOString() : undefined,
        notes:         vNotes.trim() || undefined,
      });
    },
    onSuccess: () => {
      toast.success("Expense voucher recorded");
      setShowVoucherForm(false);
      setVAmount(""); setVSupplier(""); setVDescription(""); setVPayDate(""); setVNotes("");
      setVCategory("port_fees"); setVCurrency("NGN");
      refetchVouchers();
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  const submitVoucherMutation = useMutation({
    mutationFn: async (voucherId: string) => {
      await api.post(`/vouchers/${voucherId}/submit`, {});
    },
    onSuccess: () => { toast.success("Voucher submitted for approval"); refetchVouchers(); },
    onError:   (err) => toast.error(getErrorMessage(err)),
  });

  const approveVoucherMutation = useMutation({
    mutationFn: async (voucherId: string) => {
      await api.post(`/vouchers/${voucherId}/approve`, {});
    },
    onSuccess: () => { toast.success("Voucher approved"); refetchVouchers(); },
    onError:   (err) => toast.error(getErrorMessage(err)),
  });

  const rejectVoucherMutation = useMutation({
    mutationFn: async ({ voucherId, reason }: { voucherId: string; reason: string }) => {
      await api.post(`/vouchers/${voucherId}/reject`, { reason });
    },
    onSuccess: () => { toast.success("Voucher rejected"); refetchVouchers(); },
    onError:   (err) => toast.error(getErrorMessage(err)),
  });

  // Inline rejection reason state
  const [rejectingVoucherId, setRejectingVoucherId] = useState<string | null>(null);
  const [voucherRejectReason, setVoucherRejectReason] = useState("");

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

  // ── Safety audit state
  const SAFETY_CHECKLIST_ITEMS = [
    "Brakes functional",
    "Tires in good condition",
    "Lights & signals working",
    "Fire extinguisher present & charged",
    "Driver license valid",
    "Vehicle registration valid",
    "Load securing equipment present",
    "No visible fuel/oil leaks",
  ];
  const [auditDialogTruckOpId, setAuditDialogTruckOpId] = useState<string | null>(null);
  const [auditChecklist, setAuditChecklist] = useState<Record<string, boolean>>({});
  const [auditResult, setAuditResult] = useState<AuditResult>("satisfactory");
  const [auditNotes, setAuditNotes] = useState("");

  const openAuditDialog = (truckOpId: string, existing?: TruckSafetyAudit) => {
    if (existing) {
      const map: Record<string, boolean> = {};
      existing.checklist.forEach((c) => { map[c.item] = c.passed; });
      setAuditChecklist(map);
      setAuditResult(existing.result);
      setAuditNotes(existing.notes ?? "");
    } else {
      const map: Record<string, boolean> = {};
      SAFETY_CHECKLIST_ITEMS.forEach((item) => { map[item] = false; });
      setAuditChecklist(map);
      setAuditResult("satisfactory");
      setAuditNotes("");
    }
    setAuditDialogTruckOpId(truckOpId);
  };

  const submitAuditMutation = useMutation({
    mutationFn: async ({ truckOpId }: { truckOpId: string }) => {
      const checklist = SAFETY_CHECKLIST_ITEMS.map((item) => ({
        item,
        passed: auditChecklist[item] ?? false,
      }));
      await api.post(`/operations/${id}/trucks/${truckOpId}/audit`, {
        result: auditResult,
        checklist,
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
    truckOpId: string; item: string;
  } | null>(null);
  const [waiverNotes, setWaiverNotes] = useState("");

  const waiveItemMutation = useMutation({
    mutationFn: async ({ truckOpId, item, notes }: { truckOpId: string; item: string; notes: string }) => {
      await api.post(`/operations/${id}/trucks/${truckOpId}/audit/waive`, {
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

  // CSV export of activity log
  const exportActivityCsv = () => {
    if (!activityLog?.length) return;
    const header = ["Timestamp", "User", "Role", "Action", "Entity", "Details"];
    const rows = activityLog.map((e) => [
      new Date(e.created_at).toLocaleString(),
      e.user_name,
      e.user_role,
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
    START_TRANSIT:          "Truck started transit",
    ARRIVE_DISCHARGE:       "Truck arrived at discharge",
    START_DISCHARGE:        "Discharge started",
    END_DISCHARGE:          "Discharge completed",
  };

  const ACTION_COLOR: Record<string, string> = {
    WAIVE_AUDIT_ITEM:    "text-amber-600",
    SUBMIT_SAFETY_AUDIT: "text-blue-600",
    SUBMIT_FEEDBACK:     "text-violet-600",
    APPROVE_FEEDBACK:    "text-emerald-600",
    REJECT_FEEDBACK:     "text-red-600",
    TRANSITION_STATUS:   "text-primary",
    UPLOAD_DOCUMENT:     "text-sky-600",
    UPDATE_TRUCK_OPERATION: "text-indigo-600",
  };

  // Initialize TruckOperation records from approved feedback truck_ids
  const initTrucksMutation = useMutation({
    mutationFn: async (truckIds: string[]) => {
      for (const truck_id of truckIds) {
        await api.post(`/operations/${id}/trucks`, { truck_id });
      }
    },
    onSuccess: () => {
      toast.success("Trucks initialized — you can now record progress");
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
      const payload: Record<string, unknown> = {};
      if (form.ts) payload[stageKey] = new Date(form.ts).toISOString();
      for (const extra of stage.extras) {
        if (form[extra.k]) {
          if (extra.k === "delivered_to") {
            // store as a note prefix
            payload.notes = `Delivered to: ${form[extra.k]}${form.notes ? `\n${form.notes}` : ""}`;
          } else {
            payload[extra.k] = extra.type === "number" ? parseFloat(form[extra.k]) : form[extra.k];
          }
        }
      }
      if (form.notes && !payload.notes) payload.notes = form.notes;
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

  const recordDischargeMutation = useMutation({
    mutationFn: async () => {
      const payload: Record<string, unknown> = {
        source_vessel_id: dischargeSource,
        quantity_mt:      parseFloat(dischargeQty),
      };
      if (dischargeDest && dischargeDest !== "__shore__") payload.destination_vessel_id = dischargeDest;
      if (dischargeSpill)   payload.spillage_mt            = parseFloat(dischargeSpill);
      if (dischargeTemp)    payload.temperature_celsius    = parseFloat(dischargeTemp);
      if (dischargeDensity) payload.density                = parseFloat(dischargeDensity);
      if (dischargeStartAt) payload.discharge_start_at     = new Date(dischargeStartAt).toISOString();
      if (dischargeEndAt)   payload.discharge_end_at       = new Date(dischargeEndAt).toISOString();
      if (dischargeNotes)   payload.notes                  = dischargeNotes.trim();
      const res = await api.post(`/operations/${id}/vessel-discharges`, payload);
      return extractData(res);
    },
    onSuccess: () => {
      toast.success("Discharge event recorded");
      setShowDischargeForm(false);
      setDischargeSource(""); setDischargeDest(""); setDischargeQty("");
      setDischargeSpill(""); setDischargeTemp(""); setDischargeDensity("");
      setDischargeStartAt(""); setDischargeEndAt(""); setDischargeNotes("");
      refetchDischarges();
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  // ── Render guards
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }
  if (!op) return null;

  const availableTransitions = isBM ? getAvailableTransitions(op) : [];
  const isReopenable         = isBM && REOPENABLE_STATUSES.includes(op.status);
  // Completion is now triggered from the Truck Reports tab when all stages are done

  // ── Page
  return (
    <div>
      <Header
        title={op.operation_number}
        subtitle={OP_TYPE_LABELS[op.type]}
        actions={
          <Button variant="outline" size="sm" onClick={() => router.back()}>
            <ArrowLeft className="w-4 h-4 mr-1.5" />
            Back
          </Button>
        }
      />

      <div className="p-6 space-y-6">

        {/* ── Top summary bar */}
        <div className="flex flex-wrap items-center gap-3">
          <StatusBadge status={op.status as OperationStatus} className="text-sm px-3 py-1" />
          <Badge variant="outline">{OP_TYPE_LABELS[op.type]}</Badge>
          {op.product_type && (
            <Badge variant="secondary" className="flex items-center gap-1">
              <Tag className="w-3 h-3" />
              {PRODUCT_TYPE_LABELS[op.product_type as keyof typeof PRODUCT_TYPE_LABELS] ?? op.product_type}
            </Badge>
          )}
          <Badge variant="outline">{op.currency}</Badge>
          {op.version > 1 && (
            <Badge variant="outline" className="flex items-center gap-1 text-blue-700 border-blue-300">
              <GitBranch className="w-3 h-3" />
              v{op.version}
            </Badge>
          )}
          {op.expected_volume_mt && (
            <span className="text-sm text-muted-foreground">
              {parseFloat(op.expected_volume_mt).toLocaleString()} MT expected
            </span>
          )}
          <span className="text-sm text-muted-foreground ml-auto">
            Created {formatRelative(op.created_at)}
          </span>
        </div>

        {/* ── BM: Pending Completion review card */}
        {isBM && op.status === "pending_completion" && (
          <Card className="border-orange-200 bg-orange-50/40 shadow-sm">
            <CardContent className="p-4 space-y-3">
              <div className="flex items-start gap-3">
                <ClipboardCheck className="w-5 h-5 text-orange-600 mt-0.5 shrink-0" />
                <div className="flex-1">
                  <p className="text-sm font-semibold text-orange-800">Completion Report Submitted</p>
                  {op.completion_notes ? (
                    <p className="text-sm text-orange-700 mt-1">{op.completion_notes}</p>
                  ) : (
                    <p className="text-xs text-muted-foreground mt-0.5">
                      No completion notes provided. Review the timeline for details.
                    </p>
                  )}
                </div>
              </div>
              <div className="flex gap-2 flex-wrap pt-1">
                <Button
                  size="sm"
                  className="bg-emerald-600 hover:bg-emerald-700"
                  disabled={transitionMutation.isPending}
                  onClick={() => setShowTransitionConfirm({ to: "completed", label: "Complete Operation" })}
                >
                  <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" />
                  Complete Operation
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={transitionMutation.isPending}
                  onClick={() => transitionMutation.mutate({ to_status: "active", reason: "Returned to active by BM" })}
                >
                  {transitionMutation.isPending
                    ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
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
              <Card className="border-emerald-200 bg-emerald-50/40 border-0 shadow-sm">
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
              <Card className="border-amber-200 bg-amber-50/40 border-0 shadow-sm">
                <CardContent className="p-4 flex items-center justify-between gap-4">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-semibold text-amber-800">PFI Required</p>
                      <p className="text-xs text-amber-700 mt-0.5">
                        Link a Proforma Invoice before this operation can be activated.
                      </p>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    className="shrink-0 bg-amber-600 hover:bg-amber-700"
                    onClick={() => setShowPfiDialog(true)}
                  >
                    Link PFI
                  </Button>
                </CardContent>
              </Card>
            );
          })()
        )}

        {/* ── BM: Standard transition card */}
        {isBM && availableTransitions.length > 0 && op.status !== "pending_completion" && (
          <Card className="border-primary/20 bg-primary/5 border-0 shadow-sm">
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
                {availableTransitions.map((t) => {
                  const isActivate = t.to === "active";
                  const pfiMissing = isActivate && op.type !== "truck_only" && (pfis?.length ?? 0) === 0;
                  return (
                  <Button
                    key={t.to}
                    size="sm"
                    variant={t.destructive ? "destructive" : "default"}
                    disabled={transitionMutation.isPending || pfiMissing}
                    title={pfiMissing ? "Link a PFI first" : undefined}
                    onClick={() => setShowTransitionConfirm(t)}
                  >
                    {transitionMutation.isPending
                      ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                      : <ChevronRight className="w-3.5 h-3.5 mr-1.5" />}
                    {t.label}
                  </Button>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}

        {/* ── Reopen button (BM only, completed/archived/cancelled) */}
        {isReopenable && (
          <Card className="border-blue-200 bg-blue-50/30 shadow-sm">
            <CardContent className="p-4 flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-semibold text-blue-800">Reopen this Operation</p>
                <p className="text-xs text-muted-foreground">
                  Creates a new revision (v{(op.version ?? 1) + 1}) linked to this operation.
                </p>
              </div>
              <Button
                size="sm"
                variant="outline"
                className="border-blue-300 text-blue-700 hover:bg-blue-50"
                onClick={() => setShowReopenDialog(true)}
              >
                <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
                Reopen as Revision
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Completion report is now handled via the Truck Reports tab progress tracker */}

        {/* ── Main grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-4">
            <Tabs defaultValue="overview">
              <TabsList className="flex-wrap h-auto">
                <TabsTrigger value="overview">Overview</TabsTrigger>

                {canSeeTasks && (
                  <TabsTrigger value="tasks">
                    Tasks
                    {tasks?.length ? (
                      <Badge variant="secondary" className="ml-1.5 h-4 px-1.5 text-[10px]">
                        {tasks.length}
                      </Badge>
                    ) : null}
                  </TabsTrigger>
                )}

                {canSeeFeedback && (
                  <TabsTrigger value="feedback">
                    Feedback
                    {feedbacks?.length ? (
                      <Badge
                        variant={feedbacks.some((f) => f.status === "pending") ? "default" : "secondary"}
                        className="ml-1.5 h-4 px-1.5 text-[10px]"
                      >
                        {feedbacks.length}
                      </Badge>
                    ) : null}
                  </TabsTrigger>
                )}

                {canSeeVesselDischarges && op.type !== "truck_only" && (
                  <TabsTrigger value="discharges">
                    <Ship className="w-3.5 h-3.5 mr-1" />
                    Discharges
                    {vesselDischarges?.length ? (
                      <Badge variant="secondary" className="ml-1.5 h-4 px-1.5 text-[10px]">
                        {vesselDischarges.length}
                      </Badge>
                    ) : null}
                  </TabsTrigger>
                )}

                {canSeeBDN && (
                  <TabsTrigger value="bdns">
                    BDNs
                    {bdns?.length ? (
                      <Badge variant="secondary" className="ml-1.5 h-4 px-1.5 text-[10px]">
                        {bdns.length}
                      </Badge>
                    ) : null}
                  </TabsTrigger>
                )}

                {(isLO || isBM || isOS) && op.type !== "vessel_only" && (
                  <TabsTrigger value="truck-reports">
                    <ClipboardList className="w-3.5 h-3.5 mr-1" />
                    Truck Reports
                    {truckOps?.length ? (
                      <Badge variant="secondary" className="ml-1.5 h-4 px-1.5 text-[10px]">
                        {truckOps.length}
                      </Badge>
                    ) : null}
                  </TabsTrigger>
                )}

                <TabsTrigger value="documents">
                  <Lock className="w-3 h-3 mr-1 opacity-60" />
                  Docs
                  {isBM && docs?.length ? (
                    <Badge variant="secondary" className="ml-1.5 h-4 px-1.5 text-[10px]">
                      {docs.length}
                    </Badge>
                  ) : null}
                </TabsTrigger>

                {isBM && (
                  <TabsTrigger value="activity">
                    <Activity className="w-3.5 h-3.5 mr-1" />
                    Activity
                    {activityLog?.length ? (
                      <Badge variant="secondary" className="ml-1.5 h-4 px-1.5 text-[10px]">
                        {activityLog.length}
                      </Badge>
                    ) : null}
                  </TabsTrigger>
                )}

                {canSeeFinance && (
                  <TabsTrigger value="finance">
                    <TrendingUp className="w-3.5 h-3.5 mr-1" />
                    Finance
                    {((pfis?.length ?? 0) + (invoices?.length ?? 0)) > 0 ? (
                      <Badge variant="secondary" className="ml-1.5 h-4 px-1.5 text-[10px]">
                        {(pfis?.length ?? 0) + (invoices?.length ?? 0)}
                      </Badge>
                    ) : null}
                  </TabsTrigger>
                )}
              </TabsList>

              {/* ── Overview tab */}
              <TabsContent value="overview" className="mt-4">
                <Card className="border-0 shadow-sm">
                  <CardContent className="p-5 grid grid-cols-2 gap-4">
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
                      label="Expected Volume"
                      value={op.expected_volume_mt ? `${parseFloat(op.expected_volume_mt).toLocaleString()} MT` : "—"}
                    />
                    <InfoItem
                      label="Actual Volume"
                      value={op.actual_volume_mt ? `${parseFloat(op.actual_volume_mt).toLocaleString()} MT` : "—"}
                    />
                    <InfoItem label="Version" value={`v${op.version ?? 1}`} />
                    <InfoItem label="Created" value={formatDate(op.created_at)} />
                    <InfoItem label="Last Updated" value={formatDateTime(op.updated_at)} />
                    <InfoItem label="Completed" value={op.completed_at ? formatDate(op.completed_at) : "—"} />
                    {op.version_notes && (
                      <div className="col-span-2">
                        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">Revision Notes</p>
                        <p className="text-sm italic text-muted-foreground">{op.version_notes}</p>
                      </div>
                    )}
                    {op.completion_notes && (
                      <div className="col-span-2">
                        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">Completion Notes</p>
                        <p className="text-sm">{op.completion_notes}</p>
                      </div>
                    )}
                    {op.notes && (
                      <div className="col-span-2">
                        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">Notes</p>
                        <p className="text-sm">{op.notes}</p>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Version history */}
                {versions && versions.length > 1 && (
                  <Card className="border-0 shadow-sm mt-4">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <GitBranch className="w-4 h-4" />
                        Operation Versions ({versions.length})
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="p-0 pb-2">
                      <div className="divide-y">
                        {versions.map((v) => (
                          <div
                            key={v.id}
                            className={`flex items-center justify-between px-5 py-2.5 cursor-pointer hover:bg-muted/50 transition-colors ${v.id === id ? "bg-primary/5" : ""}`}
                            onClick={() => v.id !== id && router.push(`/operations/${v.id}`)}
                          >
                            <div>
                              <p className="text-sm font-mono font-semibold">{v.operation_number}</p>
                              {v.version_notes && (
                                <p className="text-xs text-muted-foreground italic">{v.version_notes}</p>
                              )}
                            </div>
                            <div className="flex items-center gap-2">
                              <StatusBadge status={v.status} className="text-xs" />
                              {v.id === id && <Badge variant="secondary" className="text-[10px]">current</Badge>}
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
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
                  <Card className="border-0 shadow-sm">
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

              {/* ── Feedback tab */}
              {canSeeFeedback && (
                <TabsContent value="feedback" className="mt-4 space-y-3">
                  {/* LO submission form */}
                  {isLO && (
                    <Card className="border-0 shadow-sm">
                      <CardContent className="p-5 space-y-4">
                        {op.status !== "awaiting_feedback" ? (
                          <div className="flex flex-col items-center py-6 text-muted-foreground">
                            <Truck className="w-8 h-8 mb-2 opacity-30" />
                            <p className="text-sm font-medium">Feedback not yet requested</p>
                            <p className="text-xs mt-1 text-center max-w-xs">
                              The Bunker Manager must move the operation to{" "}
                              <span className="font-mono">Awaiting Feedback</span> before you can submit.
                            </p>
                          </div>
                        ) : (
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
                              {!fleetTrucks ? (
                                <div className="flex items-center gap-2 py-2 text-xs text-muted-foreground">
                                  <Loader2 className="w-3.5 h-3.5 animate-spin" /> Loading fleet…
                                </div>
                              ) : !fleetTrucks.length ? (
                                <p className="text-xs text-muted-foreground italic">No active trucks in fleet.</p>
                              ) : (
                                <div className="space-y-1 max-h-44 overflow-y-auto border rounded-md p-2">
                                  {fleetTrucks.map((truck) => {
                                    const checked = loSelectedTrucks.includes(truck.id);
                                    const cap = truck.capacity_mt ? `${parseFloat(truck.capacity_mt).toLocaleString()} MT` : "";
                                    return (
                                      <label key={truck.id} className="flex items-center gap-2.5 cursor-pointer text-sm px-1.5 py-1 rounded hover:bg-muted">
                                        <input
                                          type="checkbox"
                                          className="rounded"
                                          checked={checked}
                                          onChange={(e) =>
                                            setLoSelectedTrucks(e.target.checked
                                              ? [...loSelectedTrucks, truck.id]
                                              : loSelectedTrucks.filter((i) => i !== truck.id))
                                          }
                                        />
                                        <span className="font-medium">{truck.truck_number}</span>
                                        {cap && <span className="text-xs text-muted-foreground">· {cap}</span>}
                                        {truck.driver_name && (
                                          <span className="text-xs text-muted-foreground ml-auto">{truck.driver_name}</span>
                                        )}
                                      </label>
                                    );
                                  })}
                                </div>
                              )}
                              {loSelectedTrucks.length > 0 && (
                                <p className="text-xs text-emerald-600 font-medium">
                                  {loSelectedTrucks.length} truck{loSelectedTrucks.length > 1 ? "s" : ""} nominated
                                </p>
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
                                {submitFeedbackMutation.isPending && <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />}
                                Submit Feedback
                              </Button>
                            </div>
                          </>
                        )}

                        {!!feedbacks?.length && (
                          <div className="pt-4 border-t space-y-2">
                            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Your Submissions</p>
                            {feedbacks.map((fb) => (
                              <div key={fb.id} className="flex items-center justify-between text-sm px-3 py-2 rounded-md bg-muted/50">
                                <span className="text-xs text-muted-foreground truncate max-w-50">
                                  {fb.readiness_summary.slice(0, 60)}{fb.readiness_summary.length > 60 ? "…" : ""}
                                </span>
                                <Badge
                                  variant={fb.status === "approved" ? "default" : fb.status === "rejected" ? "destructive" : "secondary"}
                                  className="text-xs capitalize ml-2 shrink-0"
                                >
                                  {fb.status}
                                </Badge>
                              </div>
                            ))}
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  )}

                  {/* BM review panel */}
                  {isBM && !feedbacks?.length && (
                    <Card className="border-0 shadow-sm">
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
                        className={`border shadow-sm ${
                          isPending  ? "border-amber-200 bg-amber-50/30"
                          : isApproved ? "border-emerald-200 bg-emerald-50/20"
                          : "border-red-200 bg-red-50/20"
                        }`}
                      >
                        <CardContent className="p-5 space-y-4">
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className={`text-xs font-semibold px-2 py-0.5 rounded capitalize ${
                                  isPending  ? "bg-amber-100 text-amber-700"
                                  : isApproved ? "bg-emerald-100 text-emerald-700"
                                  : "bg-red-100 text-red-700"
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
                              <span className="text-xs text-red-700 flex items-center gap-1 shrink-0">
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
                              <div className="flex flex-wrap gap-1.5">
                                {(fb.truck_ids as string[]).map((tid) => {
                                  const truckOp = truckOps?.find((to) => to.truck_id === tid);
                                  const label   = truckOp?.truck?.truck_number ?? tid.slice(0, 8) + "…";
                                  return (
                                    <Link
                                      key={tid}
                                      href={`/trucks/${tid}`}
                                      className="text-[11px] bg-muted hover:bg-primary/10 px-2 py-0.5 rounded font-mono text-primary hover:underline transition-colors"
                                    >
                                      {label}
                                    </Link>
                                  );
                                })}
                              </div>
                            </div>
                          )}

                          {fb.rejection_reason && (
                            <div className="rounded-md bg-red-50 border border-red-200 px-3 py-2">
                              <p className="text-xs font-semibold text-red-700 flex items-center gap-1 mb-0.5">
                                <AlertTriangle className="w-3 h-3" /> Rejection Reason
                              </p>
                              <p className="text-xs text-red-700">{fb.rejection_reason}</p>
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
                                  {approveFeedbackMutation.isPending && <Loader2 className="w-3 h-3 mr-1 animate-spin" />}
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
                                  {rejectFeedbackMutation.isPending && <Loader2 className="w-3 h-3 mr-1 animate-spin" />}
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

              {/* ── Vessel Discharges tab */}
              {canSeeVesselDischarges && op.type !== "truck_only" && (
                <TabsContent value="discharges" className="mt-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-xs text-muted-foreground">
                      Vessel discharge events for this operation.
                    </p>
                    {(isBM || isMM || isOS) && (
                      <Button size="sm" onClick={() => setShowDischargeForm(true)}>
                        <PlusCircle className="w-4 h-4 mr-1.5" />
                        Record Discharge
                      </Button>
                    )}
                  </div>

                  {showDischargeForm && (
                    <Card className="border-0 shadow-sm">
                      <CardContent className="p-5 space-y-4">
                        <p className="text-sm font-semibold">New Discharge Event</p>

                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-1.5">
                            <Label className="text-xs">Source Vessel *</Label>
                            <Select value={dischargeSource} onValueChange={setDischargeSource}>
                              <SelectTrigger className="h-8 text-xs">
                                <SelectValue placeholder="Select vessel…" />
                              </SelectTrigger>
                              <SelectContent>
                                {vessels?.map((v) => (
                                  <SelectItem key={v.id} value={v.id}>
                                    {v.vessel_name}
                                    <span className="ml-1.5 text-xs text-muted-foreground">
                                      (ROB: {parseFloat(v.current_rob_mt).toLocaleString()} MT)
                                    </span>
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-1.5">
                            <Label className="text-xs">Destination Vessel <span className="text-muted-foreground">(optional)</span></Label>
                            <Select value={dischargeDest} onValueChange={setDischargeDest}>
                              <SelectTrigger className="h-8 text-xs">
                                <SelectValue placeholder="Shore / client (default)" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="__shore__">Shore / Client</SelectItem>
                                {vessels?.filter((v) => v.id !== dischargeSource).map((v) => (
                                  <SelectItem key={v.id} value={v.id}>{v.vessel_name}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        </div>

                        <div className="grid grid-cols-3 gap-3">
                          <div className="space-y-1.5">
                            <Label className="text-xs">Quantity (MT) *</Label>
                            <Input
                              type="number" step="0.001" placeholder="0.000" className="h-8 text-xs"
                              value={dischargeQty} onChange={(e) => setDischargeQty(e.target.value)}
                            />
                          </div>
                          <div className="space-y-1.5">
                            <Label className="text-xs">Spillage (MT)</Label>
                            <Input
                              type="number" step="0.001" placeholder="0.000" className="h-8 text-xs"
                              value={dischargeSpill} onChange={(e) => setDischargeSpill(e.target.value)}
                            />
                          </div>
                          <div className="space-y-1.5">
                            <Label className="text-xs">Temperature (°C)</Label>
                            <Input
                              type="number" step="0.1" placeholder="—" className="h-8 text-xs"
                              value={dischargeTemp} onChange={(e) => setDischargeTemp(e.target.value)}
                            />
                          </div>
                        </div>

                        <div className="grid grid-cols-3 gap-3">
                          <div className="space-y-1.5">
                            <Label className="text-xs">Density</Label>
                            <Input
                              type="number" step="0.001" placeholder="—" className="h-8 text-xs"
                              value={dischargeDensity} onChange={(e) => setDischargeDensity(e.target.value)}
                            />
                          </div>
                          <div className="space-y-1.5">
                            <Label className="text-xs">Start Time</Label>
                            <Input
                              type="datetime-local" className="h-8 text-xs"
                              value={dischargeStartAt} onChange={(e) => setDischargeStartAt(e.target.value)}
                            />
                          </div>
                          <div className="space-y-1.5">
                            <Label className="text-xs">End Time</Label>
                            <Input
                              type="datetime-local" className="h-8 text-xs"
                              value={dischargeEndAt} onChange={(e) => setDischargeEndAt(e.target.value)}
                            />
                          </div>
                        </div>

                        <div className="space-y-1.5">
                          <Label className="text-xs">Notes</Label>
                          <Textarea
                            placeholder="Any notes about this discharge event…"
                            rows={2}
                            className="resize-none text-xs"
                            value={dischargeNotes}
                            onChange={(e) => setDischargeNotes(e.target.value)}
                          />
                        </div>

                        <div className="flex gap-2 justify-end">
                          <Button size="sm" variant="outline" onClick={() => setShowDischargeForm(false)}>Cancel</Button>
                          <Button
                            size="sm"
                            disabled={!dischargeSource || !dischargeQty || recordDischargeMutation.isPending}
                            onClick={() => recordDischargeMutation.mutate()}
                          >
                            {recordDischargeMutation.isPending && <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />}
                            Record Discharge
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  <Card className="border-0 shadow-sm">
                    <CardContent className="p-0">
                      {vesselDischarges?.length ? (
                        <div className="divide-y">
                          {vesselDischarges.map((evt) => (
                            <div key={evt.id} className="px-5 py-3 space-y-1">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <Ship className="w-4 h-4 text-muted-foreground" />
                                  <span className="text-sm font-medium">
                                    {evt.source_vessel?.vessel_name ?? evt.source_vessel_id.slice(0, 8)}
                                    {evt.destination_vessel_id
                                      ? ` → ${evt.destination_vessel?.vessel_name ?? evt.destination_vessel_id.slice(0, 8)}`
                                      : " → Shore/Client"}
                                  </span>
                                </div>
                                <span className="text-sm font-semibold">
                                  {parseFloat(evt.quantity_mt).toLocaleString()} MT
                                </span>
                              </div>
                              <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-muted-foreground pl-6">
                                {evt.product_type && <span>Product: {evt.product_type}</span>}
                                {evt.spillage_mt && parseFloat(evt.spillage_mt) > 0 && (
                                  <span className="text-amber-600">Spillage: {evt.spillage_mt} MT</span>
                                )}
                                {evt.temperature_celsius && <span>Temp: {evt.temperature_celsius}°C</span>}
                                {evt.density && <span>Density: {evt.density}</span>}
                                {evt.discharge_start_at && <span>Start: {formatDateTime(evt.discharge_start_at)}</span>}
                                {evt.discharge_end_at && <span>End: {formatDateTime(evt.discharge_end_at)}</span>}
                              </div>
                              {evt.notes && (
                                <p className="text-xs text-muted-foreground italic pl-6">{evt.notes}</p>
                              )}
                              <p className="text-[10px] text-muted-foreground/60 pl-6">
                                Recorded {formatDateTime(evt.created_at)}
                              </p>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="flex flex-col items-center py-12 text-muted-foreground">
                          <Ship className="w-10 h-10 mb-3 opacity-30" />
                          <p className="text-sm">No discharge events recorded yet</p>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </TabsContent>
              )}

              {/* ── BDNs tab */}
              {canSeeBDN && (
                <TabsContent value="bdns" className="mt-4">
                  <Card className="border-0 shadow-sm">
                    <CardContent className="p-0">
                      {bdns?.length ? (
                        <div className="divide-y">
                          {bdns.map((bdn) => (
                            <div key={bdn.id} className="flex items-center justify-between px-5 py-3">
                              <div>
                                <p className="text-sm font-mono font-semibold">{bdn.bdn_number}</p>
                                <p className="text-xs text-muted-foreground">
                                  {parseFloat(bdn.quantity_delivered_mt).toLocaleString()} MT
                                  {bdn.product_type ? ` · ${bdn.product_type}` : ""}
                                  {" · "}{formatDate(bdn.delivery_date)}
                                </p>
                              </div>
                              <Badge
                                variant={bdn.status === "approved" ? "default" : bdn.status === "rejected" ? "destructive" : "secondary"}
                                className="text-xs"
                              >
                                {bdn.status}
                              </Badge>
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

              {/* ── Truck Reports tab — stage-by-stage progress tracker */}
              {(isLO || isBM || isOS) && op.type !== "vessel_only" && (
                <TabsContent value="truck-reports" className="mt-4 space-y-3">

                  {/* BM hidden file input for doc upload */}
                  {isBM && (
                    <input
                      ref={docFileRef}
                      type="file"
                      accept=".pdf,.jpg,.jpeg,.png,.webp,.csv,.txt,.docx,.xlsx"
                      className="hidden"
                      onChange={(e) => setDocFile(e.target.files?.[0] ?? null)}
                    />
                  )}

                  {!truckOps?.length ? (
                    <Card className="border-0 shadow-sm">
                      <CardContent className="flex flex-col items-center py-14 text-muted-foreground gap-1">
                        <Truck className="w-10 h-10 mb-2 opacity-30" />
                        <p className="text-sm font-medium">No trucks initialized for reporting</p>
                        {(() => {
                          const approvedFb = feedbacks?.find((f) => f.status === "approved");
                          const fbTruckIds: string[] = approvedFb
                            ? (approvedFb.truck_ids as string[]) ?? []
                            : [];
                          if (fbTruckIds.length > 0 && isLO) {
                            return (
                              <div className="mt-2 text-center space-y-2">
                                <p className="text-xs text-muted-foreground max-w-xs">
                                  {fbTruckIds.length} truck{fbTruckIds.length > 1 ? "s" : ""} from the approved feedback are ready to be initialized for progress reporting.
                                </p>
                                <Button
                                  size="sm"
                                  disabled={initTrucksMutation.isPending}
                                  onClick={() => initTrucksMutation.mutate(fbTruckIds)}
                                >
                                  {initTrucksMutation.isPending
                                    ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                                    : <PlusCircle className="w-3.5 h-3.5 mr-1.5" />}
                                  Initialize {fbTruckIds.length} Truck{fbTruckIds.length > 1 ? "s" : ""} for Reporting
                                </Button>
                              </div>
                            );
                          }
                          return (
                            <p className="text-xs mt-1 text-center max-w-xs opacity-70">
                              Trucks must be added to this operation before reporting can begin.
                            </p>
                          );
                        })()}
                      </CardContent>
                    </Card>
                  ) : (
                    truckOps.map((to) => {
                      const label = to.truck?.truck_number ?? to.truck_id.slice(0, 8);
                      const cap   = to.truck?.capacity_mt ? `${parseFloat(to.truck.capacity_mt).toLocaleString()} MT` : "";
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

                      const audit = to.safety_audit;
                      const auditPassed = audit?.result === "satisfactory";
                      const auditBlocked = !auditPassed; // Stage 1 is blocked until audit passes

                      return (
                        <Card key={to.id} className="border-0 shadow-sm overflow-hidden">
                          {/* Truck header */}
                          <div className="flex items-center justify-between px-5 py-3.5 border-b bg-muted/20">
                            <div className="flex items-center gap-3 min-w-0">
                              <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                                <Truck className="w-4 h-4 text-primary" />
                              </div>
                              <div>
                                <p className="text-sm font-bold font-mono tracking-tight">{label}</p>
                                {cap && <p className="text-xs text-muted-foreground">{cap}</p>}
                              </div>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              {to.status && (
                                <span className="text-[11px] font-medium px-2.5 py-0.5 rounded-full bg-primary/10 text-primary capitalize">
                                  {to.status.replace(/_/g, " ")}
                                </span>
                              )}
                              {/* BM: upload document for this truck */}
                              {isBM && (
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
                            </div>
                          </div>

                          {/* Safety Audit section */}
                          {(() => {
                            const failedItems = audit?.checklist.filter((c) => !c.passed) ?? [];
                            const waivedSet = new Set((audit?.waivers ?? []).map((w: AuditWaiver) => w.item));
                            const unwaivedFailed = failedItems.filter((c) => !waivedSet.has(c.item));
                            const hasWaivers = (audit?.waivers?.length ?? 0) > 0;

                            return (
                              <>
                                {/* Banner row */}
                                <div className={`flex items-center gap-2 px-5 py-2.5 border-b ${
                                  auditPassed ? "bg-emerald-50/50"
                                  : audit ? "bg-red-50/40"
                                  : "bg-amber-50/50"
                                }`}>
                                  {auditPassed
                                    ? <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                                    : audit
                                    ? <ShieldAlert className="w-3.5 h-3.5 text-red-600 shrink-0" />
                                    : <Shield className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                                  }
                                  <p className={`text-xs font-medium flex-1 ${
                                    auditPassed ? "text-emerald-700"
                                    : audit ? "text-red-700"
                                    : "text-amber-700"
                                  }`}>
                                    {auditPassed
                                      ? `Safety audit passed · ${audit?.conductor_name ?? ""}${audit?.conducted_at ? ` · ${formatDate(audit.conducted_at)}` : ""}`
                                      : audit
                                      ? `Safety audit FAILED — ${unwaivedFailed.length} unresolved issue${unwaivedFailed.length !== 1 ? "s" : ""}`
                                      : "Safety audit required before loading can begin"}
                                    {hasWaivers && !auditPassed && (
                                      <span className="ml-2 text-amber-600 font-semibold">
                                        ({(audit?.waivers?.length ?? 0)} waived by BM)
                                      </span>
                                    )}
                                  </p>
                                  {(isLO || isOS) && (
                                    <Button size="sm" variant={audit && !auditPassed ? "destructive" : "outline"}
                                      className="h-6 text-[11px] px-2 shrink-0"
                                      onClick={() => openAuditDialog(to.id, audit ?? undefined)}>
                                      {audit ? (auditPassed ? "Re-audit" : "Re-audit") : "Conduct Audit"}
                                    </Button>
                                  )}
                                </div>

                                {/* BM: detailed checklist breakdown (always visible when audit exists) */}
                                {isBM && audit && (
                                  <div className="px-5 py-3 border-b bg-muted/10 space-y-1.5">
                                    <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-2">
                                      Checklist — {audit.conductor_name} · {formatDateTime(audit.conducted_at)}
                                    </p>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-1">
                                      {audit.checklist.map((c) => {
                                        const waiver = (audit.waivers ?? []).find((w: AuditWaiver) => w.item === c.item);
                                        return (
                                          <div key={c.item} className={`flex items-start gap-2 text-xs rounded-md px-2.5 py-1.5 ${
                                            c.passed ? "bg-emerald-50 text-emerald-700"
                                            : waiver ? "bg-amber-50 text-amber-800"
                                            : "bg-red-50 text-red-700"
                                          }`}>
                                            <span className="shrink-0 mt-0.5 font-bold">
                                              {c.passed ? "✓" : waiver ? "⚠" : "✗"}
                                            </span>
                                            <div className="flex-1 min-w-0">
                                              <span>{c.item}</span>
                                              {!c.passed && !waiver && (
                                                <button
                                                  type="button"
                                                  className="ml-2 text-[10px] font-semibold underline text-red-600 hover:text-red-800"
                                                  onClick={() => { setWaiverDialog({ truckOpId: to.id, item: c.item }); setWaiverNotes(""); }}
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
                                      <p className="text-[11px] text-muted-foreground italic mt-2">
                                        Notes: {audit.notes}
                                      </p>
                                    )}
                                  </div>
                                )}

                                {/* Non-BM: failed items listed (LO/OS to see what failed) */}
                                {!isBM && audit && failedItems.length > 0 && (
                                  <div className="px-5 py-2 border-b bg-red-50/30">
                                    <p className="text-[10px] font-semibold text-red-600 mb-1">Failed items:</p>
                                    <div className="flex flex-wrap gap-1.5">
                                      {failedItems.map((c) => (
                                        <span key={c.item} className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                                          waivedSet.has(c.item) ? "bg-amber-100 text-amber-700" : "bg-red-100 text-red-700"
                                        }`}>
                                          {waivedSet.has(c.item) ? "⚠ " : "✗ "}{c.item}
                                        </span>
                                      ))}
                                    </div>
                                  </div>
                                )}
                              </>
                            );
                          })()}

                          {/* BM upload panel */}
                          {isBM && uploadingTruckId === to.id && (
                            <div className="px-5 py-3 border-b bg-blue-50/30 flex items-center gap-3 flex-wrap">
                              <button
                                type="button"
                                className="flex-1 min-w-0 flex items-center gap-2 text-xs text-muted-foreground border border-dashed border-border rounded-md px-3 py-2 hover:border-primary hover:text-primary transition-colors"
                                onClick={() => docFileRef.current?.click()}
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
                                  {uploadTruckDocMutation.isPending && <Loader2 className="w-3 h-3 mr-1 animate-spin" />}
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
                                        {/* Record button — LO/OS for next stage; Stage 1 blocked until audit passes */}
                                        {isNext && (isLO || isOS) && !isRecording && (
                                          <Button
                                            size="sm"
                                            className="h-7 text-xs shrink-0"
                                            disabled={idx === 0 && auditBlocked}
                                            title={idx === 0 && auditBlocked ? "Complete safety audit first" : undefined}
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
                                        </div>
                                      )}

                                      {/* Inline recording form */}
                                      {isRecording && (
                                        <div className="mt-2 space-y-2 rounded-md border bg-background p-3">
                                          <div className="grid grid-cols-2 gap-2">
                                            <div className="space-y-1 col-span-2 sm:col-span-1">
                                              <Label className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                                                {stage.label} Time <span className="text-destructive">*</span>
                                              </Label>
                                              <Input
                                                type="datetime-local"
                                                className="h-8 text-xs"
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
                                              disabled={!form.ts || recordStageMutation.isPending}
                                              onClick={() => recordStageMutation.mutate({ truckOpId: to.id, stageKey: stage.key, form })}
                                            >
                                              {recordStageMutation.isPending && <Loader2 className="w-3 h-3 mr-1 animate-spin" />}
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

                          {/* BM: operational data summary strip */}
                          {isBM && (to.quantity_loaded_mt || to.quantity_discharged_mt || to.waybill_number || to.spillage_mt) && (
                            <div className="px-5 py-3 border-t bg-slate-50/50 flex flex-wrap gap-x-6 gap-y-1.5">
                              {to.quantity_loaded_mt && (
                                <div className="text-xs">
                                  <span className="text-muted-foreground">Loaded: </span>
                                  <span className="font-semibold">{parseFloat(to.quantity_loaded_mt).toLocaleString()} MT</span>
                                </div>
                              )}
                              {to.quantity_discharged_mt && (
                                <div className="text-xs">
                                  <span className="text-muted-foreground">Discharged: </span>
                                  <span className="font-semibold">{parseFloat(to.quantity_discharged_mt).toLocaleString()} MT</span>
                                </div>
                              )}
                              {to.quantity_loaded_mt && to.quantity_discharged_mt && (
                                <div className="text-xs">
                                  <span className="text-muted-foreground">Variance: </span>
                                  <span className={`font-semibold ${
                                    parseFloat(to.quantity_discharged_mt) < parseFloat(to.quantity_loaded_mt)
                                    ? "text-red-600" : "text-emerald-600"
                                  }`}>
                                    {(parseFloat(to.quantity_discharged_mt) - parseFloat(to.quantity_loaded_mt)).toFixed(3)} MT
                                  </span>
                                </div>
                              )}
                              {to.spillage_mt && parseFloat(to.spillage_mt) > 0 && (
                                <div className="text-xs">
                                  <span className="text-muted-foreground">Spillage: </span>
                                  <span className="font-semibold text-red-600">{parseFloat(to.spillage_mt).toLocaleString()} MT</span>
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

                          {/* Submit for BM review — shown when all 7 stages done, only LO/OS */}
                          {firstPendingIdx === -1 && (isLO || isOS) && op.status === "active" && (
                            <div className="px-5 py-3 border-t bg-green-50/30 flex items-center justify-between gap-3">
                              <div className="flex items-center gap-2">
                                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                                <p className="text-sm font-medium text-emerald-800">All stages complete — ready for BM review</p>
                              </div>
                              <Button
                                size="sm"
                                className="bg-emerald-600 hover:bg-emerald-700 shrink-0"
                                disabled={submitCompletionMutation.isPending}
                                onClick={() => submitCompletionMutation.mutate()}
                              >
                                {submitCompletionMutation.isPending && <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />}
                                Submit for BM Review
                              </Button>
                            </div>
                          )}
                        </Card>
                      );
                    })
                  )}
                </TabsContent>
              )}

              {/* ── Documents tab */}
              <TabsContent value="documents" className="mt-4">
                <Card className="border-0 shadow-sm">
                  <CardContent className="p-0">
                    {!isBM ? (
                      <div className="flex flex-col items-center py-14 text-muted-foreground gap-3">
                        <Lock className="w-8 h-8 opacity-30" />
                        <div className="text-center">
                          <p className="text-sm font-medium">Documents are restricted</p>
                          <p className="text-xs mt-1 text-muted-foreground/70 max-w-xs">
                            Contact your Bunker Manager to request access to operation documents.
                          </p>
                        </div>
                      </div>
                    ) : docs?.length ? (
                      <div className="divide-y">
                        {docs.map((doc) => (
                          <div key={doc.id} className="flex items-center justify-between px-5 py-3">
                            <div className="flex items-center gap-3 min-w-0">
                              <FileText className="w-4 h-4 text-muted-foreground shrink-0" />
                              <div className="min-w-0">
                                <a
                                  href={doc.file_url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-sm font-medium text-primary hover:underline truncate block"
                                >
                                  {doc.file_name}
                                </a>
                                <p className="text-xs text-muted-foreground">
                                  {doc.document_type} · {formatDate(doc.created_at)}
                                </p>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground text-center py-8">No documents</p>
                    )}
                  </CardContent>
                </Card>
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

                  <Card className="border-0 shadow-sm">
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
                                    </div>
                                    <span className="text-[10px] text-muted-foreground/60 shrink-0 whitespace-nowrap">
                                      {formatDateTime(entry.created_at)}
                                    </span>
                                  </div>
                                  {entry.changes && Object.keys(entry.changes).length > 0 && (
                                    <div className="mt-1 flex flex-wrap gap-1.5">
                                      {Object.entries(entry.changes).slice(0, 4).map(([k, v]) => {
                                        const val = typeof v === "object" && v !== null && "to" in v
                                          ? String((v as Record<string, unknown>).to)
                                          : String(v);
                                        return (
                                          <span key={k} className="text-[10px] bg-muted px-1.5 py-0.5 rounded font-mono">
                                            {k.replace(/_/g, " ")}: {val.slice(0, 40)}
                                          </span>
                                        );
                                      })}
                                    </div>
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
              {/* ── Finance tab */}
              {canSeeFinance && (
                <TabsContent value="finance" className="mt-4 space-y-6">

                  {/* ── P&L Summary strip */}
                  {(() => {
                    const revenue = invoices?.reduce(
                      (s, inv) => inv.status !== "cancelled" ? s + parseFloat(inv.total_amount ?? "0") : s, 0
                    ) ?? 0;
                    const collected = invoices?.reduce(
                      (s, inv) => inv.status === "paid" ? s + parseFloat(inv.total_amount ?? "0") : s, 0
                    ) ?? 0;
                    const expenses = [
                      ...(payments?.map((p) => parseFloat(p.amount ?? "0")) ?? []),
                      ...(vouchers?.filter(v => v.status === "approved").map(v => parseFloat(v.amount ?? "0")) ?? []),
                    ].reduce((s, v) => s + v, 0);
                    const profit = revenue - expenses;
                    return (
                      <div className="grid grid-cols-2 gap-3">
                        <div className="grid grid-cols-2 gap-3 col-span-2 sm:col-span-1">
                          <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-3 text-center">
                            <p className="text-[9px] font-semibold uppercase tracking-wide text-emerald-700 mb-0.5">Revenue</p>
                            <p className="text-sm font-bold text-emerald-800 font-mono">
                              {revenue.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                            </p>
                            <p className="text-[9px] text-emerald-600 mt-0.5">
                              Collected: {collected.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                            </p>
                          </div>
                          <div className="rounded-xl border border-rose-200 bg-rose-50/60 p-3 text-center">
                            <p className="text-[9px] font-semibold uppercase tracking-wide text-rose-700 mb-0.5">Expenses</p>
                            <p className="text-sm font-bold text-rose-800 font-mono">
                              {expenses.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                            </p>
                            <p className="text-[9px] text-rose-600 mt-0.5">
                              Payments + approved vouchers
                            </p>
                          </div>
                        </div>
                        <div className={`rounded-xl border p-3 text-center col-span-2 sm:col-span-1 flex flex-col items-center justify-center ${profit >= 0 ? "border-violet-200 bg-violet-50/60" : "border-amber-200 bg-amber-50/60"}`}>
                          <div className="flex items-center gap-1.5 mb-0.5">
                            {profit >= 0
                              ? <TrendingUp className="w-3.5 h-3.5 text-violet-600" />
                              : <TrendingDown className="w-3.5 h-3.5 text-amber-600" />}
                            <p className={`text-[9px] font-semibold uppercase tracking-wide ${profit >= 0 ? "text-violet-700" : "text-amber-700"}`}>
                              {profit >= 0 ? "Gross Profit" : "Gross Loss"}
                            </p>
                          </div>
                          <p className={`text-base font-bold font-mono ${profit >= 0 ? "text-violet-800" : "text-amber-800"}`}>
                            {Math.abs(profit).toLocaleString("en-US", { minimumFractionDigits: 2 })}
                          </p>
                          {revenue > 0 && (
                            <p className={`text-[9px] mt-0.5 ${profit >= 0 ? "text-violet-600" : "text-amber-600"}`}>
                              {((profit / revenue) * 100).toFixed(1)}% margin
                            </p>
                          )}
                        </div>
                      </div>
                    );
                  })()}

                  {/* ── PFI Section */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <FileText className="w-4 h-4 text-primary" />
                        <h3 className="text-sm font-semibold">Proforma Invoices</h3>
                        {pfis?.length ? (
                          <Badge variant="secondary" className="text-[10px] h-4 px-1.5">{pfis.length}</Badge>
                        ) : null}
                      </div>
                      {isBM && (
                        <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setShowPfiDialog(true)}>
                          <PlusCircle className="w-3.5 h-3.5" />
                          Add PFI
                        </Button>
                      )}
                    </div>
                    <Card className="border-0 shadow-sm">
                      <CardContent className="p-0">
                        {pfis?.length ? (
                          <div className="divide-y">
                            {pfis.map((pfi) => {
                              const pfiStatusCls =
                                pfi.status === "paid" || pfi.status === "linked" || pfi.status === "completed"
                                  ? "bg-emerald-100 text-emerald-800 border-emerald-200"
                                  : pfi.status === "cancelled"
                                  ? "bg-muted text-muted-foreground border"
                                  : "bg-amber-100 text-amber-800 border-amber-200";
                              return (
                                <div key={pfi.id} className="px-5 py-3.5 space-y-2">
                                  <div className="flex items-center justify-between gap-4">
                                    <div className="min-w-0 flex-1">
                                      <div className="flex items-center gap-2 flex-wrap">
                                        <p className="text-sm font-mono font-semibold">{pfi.pfi_number}</p>
                                        <Badge className={`text-[10px] h-4 px-1.5 capitalize border ${pfiStatusCls}`}>
                                          {pfi.status.replace(/_/g, " ")}
                                        </Badge>
                                        {pfi.client_ref && (
                                          <span className="text-[10px] text-muted-foreground font-mono">ref: {pfi.client_ref}</span>
                                        )}
                                      </div>
                                      <p className="text-xs text-muted-foreground mt-0.5">
                                        <span className="font-semibold">{pfi.currency} {parseFloat(pfi.amount).toLocaleString("en-US", { minimumFractionDigits: 2 })}</span>
                                        {pfi.supplier_name && <span className="ml-2">· {pfi.supplier_name}</span>}
                                      </p>
                                      <p className="text-[10px] text-muted-foreground/60 mt-0.5">{formatDateTime(pfi.created_at)}</p>
                                    </div>
                                    <div className="flex items-center gap-2 shrink-0">
                                      {pfi.document_url && (
                                        <a href={pfi.document_url} target="_blank" rel="noopener noreferrer">
                                          <Button size="sm" variant="outline" className="gap-1 h-7 text-xs">
                                            <Download className="w-3 h-3" />PDF
                                          </Button>
                                        </a>
                                      )}
                                      {pfi.receipt_url && (
                                        <a href={pfi.receipt_url} target="_blank" rel="noopener noreferrer">
                                          <Button size="sm" variant="outline" className="gap-1 h-7 text-xs border-emerald-300 text-emerald-700">
                                            <CheckCircle2 className="w-3 h-3" />Receipt
                                          </Button>
                                        </a>
                                      )}
                                      {isFM && !["paid","linked","completed","cancelled"].includes(pfi.status) && (
                                        <Button
                                          size="sm"
                                          className="h-7 text-xs gap-1 bg-emerald-600 hover:bg-emerald-700"
                                          disabled={confirmPfiPaymentMutation.isPending}
                                          onClick={() => confirmPfiPaymentMutation.mutate({ pfiId: pfi.id })}
                                        >
                                          {confirmPfiPaymentMutation.isPending
                                            ? <Loader2 className="w-3 h-3 animate-spin" />
                                            : <BadgeCheck className="w-3 h-3" />}
                                          Confirm Paid
                                        </Button>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        ) : (
                          <div className="flex flex-col items-center py-8 text-muted-foreground">
                            <FileText className="w-7 h-7 mb-2 opacity-25" />
                            <p className="text-sm">No PFIs linked yet</p>
                            {isBM && <p className="text-xs mt-1 text-muted-foreground/70">Click "Add PFI" to generate or upload a proforma invoice</p>}
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  </div>

                  {/* ── Payments Section (client pays us) */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Wallet className="w-4 h-4 text-sky-600" />
                        <h3 className="text-sm font-semibold">Client Payments Received</h3>
                        {payments?.length ? (
                          <Badge variant="secondary" className="text-[10px] h-4 px-1.5">{payments.length}</Badge>
                        ) : null}
                      </div>
                      {isFM && !showPaymentForm && (pfis?.length ?? 0) > 0 && (
                        <Button size="sm" variant="outline" className="gap-1.5"
                          onClick={() => { setPayPfiId(pfis![0].id); setShowPaymentForm(true); }}>
                          <PlusCircle className="w-3.5 h-3.5" />Record Payment
                        </Button>
                      )}
                    </div>

                    {isFM && showPaymentForm && (
                      <Card className="border border-sky-200 bg-sky-50/30 shadow-sm">
                        <CardContent className="p-4 space-y-3">
                          <p className="text-xs font-semibold uppercase tracking-wide text-sky-700">Record Client Payment</p>
                          <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1">
                              <Label className="text-xs">PFI <span className="text-destructive">*</span></Label>
                              <Select value={payPfiId} onValueChange={setPayPfiId}>
                                <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Select PFI…" /></SelectTrigger>
                                <SelectContent>
                                  {pfis?.map((p) => (
                                    <SelectItem key={p.id} value={p.id} className="text-xs">
                                      {p.pfi_number} — {p.currency} {parseFloat(p.amount).toLocaleString()}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="space-y-1">
                              <Label className="text-xs">Currency</Label>
                              <Select value={payCurrency} onValueChange={setPayCurrency}>
                                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="NGN">NGN</SelectItem>
                                  <SelectItem value="USD">USD</SelectItem>
                                  <SelectItem value="EUR">EUR</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="space-y-1">
                              <Label className="text-xs">Amount <span className="text-destructive">*</span></Label>
                              <Input type="number" step="0.01" placeholder="0.00" className="h-8 text-xs"
                                value={payAmount} onChange={(e) => setPayAmount(e.target.value)} />
                            </div>
                            <div className="space-y-1">
                              <Label className="text-xs">Method</Label>
                              <Select value={payMethod} onValueChange={setPayMethod}>
                                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                                  <SelectItem value="cash">Cash</SelectItem>
                                  <SelectItem value="cheque">Cheque</SelectItem>
                                  <SelectItem value="wire_transfer">Wire Transfer</SelectItem>
                                  <SelectItem value="other">Other</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="space-y-1">
                              <Label className="text-xs">Reference</Label>
                              <Input placeholder="Transfer ref / cheque no." className="h-8 text-xs"
                                value={payRef} onChange={(e) => setPayRef(e.target.value)} />
                            </div>
                            <div className="space-y-1">
                              <Label className="text-xs">Payment Date <span className="text-destructive">*</span></Label>
                              <Input type="datetime-local" className="h-8 text-xs"
                                value={payDate} onChange={(e) => setPayDate(e.target.value)} />
                            </div>
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs">Notes</Label>
                            <Textarea rows={2} className="resize-none text-xs" placeholder="Any notes…"
                              value={payNotes} onChange={(e) => setPayNotes(e.target.value)} />
                          </div>
                          <div className="flex justify-end gap-2 pt-1">
                            <Button size="sm" variant="outline" onClick={() => setShowPaymentForm(false)}>Cancel</Button>
                            <Button size="sm"
                              disabled={!payPfiId || !payAmount || parseFloat(payAmount) <= 0 || !payDate || recordPaymentMutation.isPending}
                              onClick={() => recordPaymentMutation.mutate()}
                              className="gap-1.5 bg-sky-600 hover:bg-sky-700">
                              {recordPaymentMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle2 className="w-3 h-3" />}
                              Record Payment
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    )}

                    {isFM && !showPaymentForm && (pfis?.length ?? 0) === 0 && (
                      <div className="rounded-lg border border-amber-200 bg-amber-50/40 px-4 py-3 flex items-center gap-3">
                        <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                        <p className="text-xs text-amber-700">A PFI must be linked before recording a payment.</p>
                      </div>
                    )}

                    <Card className="border-0 shadow-sm">
                      <CardContent className="p-0">
                        {payments?.length ? (
                          <div className="divide-y">
                            {payments.map((pay) => (
                              <div key={pay.id} className="flex items-center justify-between px-5 py-3.5 gap-4">
                                <div className="min-w-0 flex-1">
                                  <p className="text-sm font-mono font-semibold">{pay.voucher_number}</p>
                                  <p className="text-xs text-muted-foreground mt-0.5">
                                    <span className="font-semibold">{pay.currency} {parseFloat(pay.amount).toLocaleString("en-US", { minimumFractionDigits: 2 })}</span>
                                    {pay.payment_method && <span className="ml-2 capitalize">· {pay.payment_method.replace(/_/g, " ")}</span>}
                                    {pay.payment_reference && <span className="ml-2 font-mono">· {pay.payment_reference}</span>}
                                  </p>
                                  <p className="text-[10px] text-muted-foreground/60 mt-0.5">{formatDateTime(pay.payment_date)}</p>
                                </div>
                                {isFM && op.status === "payment_processing" && (
                                  <Button size="sm" variant="outline"
                                    className="gap-1.5 h-7 text-xs border-emerald-300 text-emerald-700 hover:bg-emerald-50 shrink-0"
                                    disabled={confirmPaymentMutation.isPending}
                                    onClick={() => confirmPaymentMutation.mutate(pay.id)}>
                                    {confirmPaymentMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle2 className="w-3 h-3" />}
                                    Confirm
                                  </Button>
                                )}
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="flex flex-col items-center py-8 text-muted-foreground">
                            <Wallet className="w-7 h-7 mb-2 opacity-25" />
                            <p className="text-sm">No payments recorded</p>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  </div>

                  {/* ── Expense Vouchers Section (we pay out) */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Banknote className="w-4 h-4 text-rose-600" />
                        <h3 className="text-sm font-semibold">Expense Vouchers</h3>
                        {vouchers?.length ? (
                          <Badge variant="secondary" className="text-[10px] h-4 px-1.5">{vouchers.length}</Badge>
                        ) : null}
                      </div>
                      {isFM && !showVoucherForm && (
                        <Button size="sm" variant="outline" className="gap-1.5"
                          onClick={() => setShowVoucherForm(true)}>
                          <PlusCircle className="w-3.5 h-3.5" />Add Voucher
                        </Button>
                      )}
                    </div>

                    {isFM && showVoucherForm && (
                      <Card className="border border-rose-200 bg-rose-50/20 shadow-sm">
                        <CardContent className="p-4 space-y-3">
                          <p className="text-xs font-semibold uppercase tracking-wide text-rose-700">New Expense Voucher</p>
                          <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1 col-span-2">
                              <Label className="text-xs">Category <span className="text-destructive">*</span></Label>
                              <Select value={vCategory} onValueChange={setVCategory}>
                                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                  {[
                                    ["port_fees","Port Fees"],["demurrage","Demurrage"],["logistics","Logistics"],
                                    ["bunker_purchase","Bunker Purchase"],["labour","Labour"],["agency_fees","Agency Fees"],
                                    ["documentation","Documentation"],["customs","Customs"],["inspection","Inspection"],["other","Other"],
                                  ].map(([val, label]) => (
                                    <SelectItem key={val} value={val} className="text-xs">{label}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="space-y-1">
                              <Label className="text-xs">Amount <span className="text-destructive">*</span></Label>
                              <Input type="number" step="0.01" placeholder="0.00" className="h-8 text-xs"
                                value={vAmount} onChange={(e) => setVAmount(e.target.value)} />
                            </div>
                            <div className="space-y-1">
                              <Label className="text-xs">Currency</Label>
                              <Select value={vCurrency} onValueChange={setVCurrency}>
                                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="NGN">NGN</SelectItem>
                                  <SelectItem value="USD">USD</SelectItem>
                                  <SelectItem value="EUR">EUR</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="space-y-1">
                              <Label className="text-xs">Supplier / Payee</Label>
                              <Input placeholder="Vendor name" className="h-8 text-xs"
                                value={vSupplier} onChange={(e) => setVSupplier(e.target.value)} />
                            </div>
                            <div className="space-y-1">
                              <Label className="text-xs">Payment Date</Label>
                              <Input type="date" className="h-8 text-xs"
                                value={vPayDate} onChange={(e) => setVPayDate(e.target.value)} />
                            </div>
                            <div className="space-y-1 col-span-2">
                              <Label className="text-xs">Description</Label>
                              <Input placeholder="Brief description of the expense" className="h-8 text-xs"
                                value={vDescription} onChange={(e) => setVDescription(e.target.value)} />
                            </div>
                            <div className="space-y-1 col-span-2">
                              <Label className="text-xs">Notes</Label>
                              <Textarea rows={2} className="resize-none text-xs" placeholder="Any additional notes…"
                                value={vNotes} onChange={(e) => setVNotes(e.target.value)} />
                            </div>
                          </div>
                          <div className="flex justify-end gap-2 pt-1">
                            <Button size="sm" variant="outline" onClick={() => setShowVoucherForm(false)}>Cancel</Button>
                            <Button size="sm"
                              disabled={!vAmount || parseFloat(vAmount) <= 0 || createVoucherMutation.isPending}
                              onClick={() => createVoucherMutation.mutate()}
                              className="gap-1.5 bg-rose-600 hover:bg-rose-700">
                              {createVoucherMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Banknote className="w-3 h-3" />}
                              Save Voucher
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    )}

                    <Card className="border-0 shadow-sm">
                      <CardContent className="p-0">
                        {vouchers?.length ? (
                          <div className="divide-y">
                            {vouchers.map((v) => {
                              const vStatusCls =
                                v.status === "approved" ? "bg-emerald-100 text-emerald-800 border-emerald-200" :
                                v.status === "rejected" ? "bg-red-100 text-red-800 border-red-200" :
                                v.status === "submitted" ? "bg-sky-100 text-sky-800 border-sky-200" :
                                "bg-secondary text-secondary-foreground border";
                              return (
                                <div key={v.id} className="px-5 py-3.5 space-y-2">
                                  <div className="flex items-start justify-between gap-4">
                                    <div className="min-w-0 flex-1">
                                      <div className="flex items-center gap-2 flex-wrap">
                                        <p className="text-sm font-mono font-semibold">{v.voucher_number}</p>
                                        <Badge className={`text-[10px] h-4 px-1.5 capitalize border ${vStatusCls}`}>
                                          {v.status}
                                        </Badge>
                                        <Badge variant="outline" className="text-[10px] h-4 px-1.5 capitalize">
                                          {v.category.replace(/_/g, " ")}
                                        </Badge>
                                      </div>
                                      <p className="text-xs text-muted-foreground mt-0.5">
                                        <span className="font-semibold">{v.currency} {parseFloat(v.amount).toLocaleString("en-US", { minimumFractionDigits: 2 })}</span>
                                        {v.supplier_name && <span className="ml-2">· {v.supplier_name}</span>}
                                        {v.description && <span className="ml-2 italic text-muted-foreground/70">· {v.description}</span>}
                                      </p>
                                      {v.rejection_reason && (
                                        <p className="text-[10px] text-red-600 mt-0.5">Rejected: {v.rejection_reason}</p>
                                      )}
                                      <p className="text-[10px] text-muted-foreground/60 mt-0.5">{formatDateTime(v.created_at)}</p>
                                    </div>
                                    {v.receipt_url && (
                                      <a href={v.receipt_url} target="_blank" rel="noopener noreferrer" className="shrink-0">
                                        <Button size="sm" variant="outline" className="gap-1 h-7 text-xs">
                                          <Download className="w-3 h-3" />Receipt
                                        </Button>
                                      </a>
                                    )}
                                  </div>
                                  {/* FM actions */}
                                  {isFM && v.status === "draft" && (
                                    <Button size="sm" className="h-7 text-xs gap-1 bg-sky-600 hover:bg-sky-700"
                                      disabled={submitVoucherMutation.isPending}
                                      onClick={() => submitVoucherMutation.mutate(v.id)}>
                                      {submitVoucherMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <ChevronRight className="w-3 h-3" />}
                                      Submit for Approval
                                    </Button>
                                  )}
                                  {/* BM actions */}
                                  {isBM && v.status === "submitted" && (
                                    <div className="space-y-2">
                                      <div className="flex gap-2">
                                        <Button size="sm" className="h-7 text-xs gap-1 bg-emerald-600 hover:bg-emerald-700"
                                          disabled={approveVoucherMutation.isPending}
                                          onClick={() => approveVoucherMutation.mutate(v.id)}>
                                          {approveVoucherMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle2 className="w-3 h-3" />}
                                          Approve
                                        </Button>
                                        <Button size="sm" variant="outline"
                                          className="h-7 text-xs gap-1 text-destructive border-destructive/30"
                                          onClick={() => setRejectingVoucherId(rejectingVoucherId === v.id ? null : v.id)}>
                                          <XCircle className="w-3 h-3" />Reject
                                        </Button>
                                      </div>
                                      {rejectingVoucherId === v.id && (
                                        <div className="flex gap-2 items-end">
                                          <Input className="h-8 text-xs flex-1" placeholder="Rejection reason…"
                                            value={voucherRejectReason}
                                            onChange={(e) => setVoucherRejectReason(e.target.value)} />
                                          <Button size="sm" variant="destructive" className="h-8 text-xs shrink-0"
                                            disabled={!voucherRejectReason.trim() || rejectVoucherMutation.isPending}
                                            onClick={() => {
                                              rejectVoucherMutation.mutate({ voucherId: v.id, reason: voucherRejectReason });
                                              setRejectingVoucherId(null);
                                              setVoucherRejectReason("");
                                            }}>
                                            Confirm Reject
                                          </Button>
                                        </div>
                                      )}
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        ) : (
                          <div className="flex flex-col items-center py-8 text-muted-foreground">
                            <Banknote className="w-7 h-7 mb-2 opacity-25" />
                            <p className="text-sm">No expense vouchers</p>
                            {isFM && <p className="text-xs mt-1 text-muted-foreground/70">Record port fees, demurrage, logistics costs, etc.</p>}
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  </div>

                  {/* ── Invoices Section */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Receipt className="w-4 h-4 text-violet-600" />
                        <h3 className="text-sm font-semibold">Client Invoices</h3>
                        {invoices?.length ? (
                          <Badge variant="secondary" className="text-[10px] h-4 px-1.5">{invoices.length}</Badge>
                        ) : null}
                      </div>
                      {isFM && !showInvoiceForm && (
                        <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setShowInvoiceForm(true)}>
                          <PlusCircle className="w-3.5 h-3.5" />Create Invoice
                        </Button>
                      )}
                    </div>

                    {isFM && showInvoiceForm && (
                      <Card className="border border-violet-200 bg-violet-50/30 shadow-sm">
                        <CardContent className="p-4 space-y-3">
                          <p className="text-xs font-semibold uppercase tracking-wide text-violet-700">New Client Invoice</p>
                          <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1">
                              <Label className="text-xs">Amount <span className="text-destructive">*</span></Label>
                              <Input type="number" step="0.01" placeholder="0.00" className="h-8 text-xs"
                                value={invAmount} onChange={(e) => setInvAmount(e.target.value)} />
                            </div>
                            <div className="space-y-1">
                              <Label className="text-xs">Currency</Label>
                              <Select value={invCurrency} onValueChange={setInvCurrency}>
                                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="NGN">NGN</SelectItem>
                                  <SelectItem value="USD">USD</SelectItem>
                                  <SelectItem value="EUR">EUR</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="space-y-1">
                              <Label className="text-xs">Tax Amount</Label>
                              <Input type="number" step="0.01" min="0" placeholder="0.00" className="h-8 text-xs"
                                value={invTax} onChange={(e) => setInvTax(e.target.value)} />
                            </div>
                            <div className="space-y-1">
                              <Label className="text-xs">Due Date</Label>
                              <Input type="date" className="h-8 text-xs"
                                value={invDueDate} onChange={(e) => setInvDueDate(e.target.value)} />
                            </div>
                          </div>
                          {invAmount && parseFloat(invAmount) > 0 && (
                            <div className="rounded-lg border border-violet-200 bg-violet-50 px-3 py-2 flex justify-between items-center text-xs">
                              <span className="text-violet-700">Total Due</span>
                              <span className="font-bold font-mono text-violet-800">
                                {invCurrency} {(parseFloat(invAmount || "0") + parseFloat(invTax || "0")).toLocaleString("en-US", { minimumFractionDigits: 2 })}
                              </span>
                            </div>
                          )}
                          <div className="space-y-1">
                            <Label className="text-xs">Notes</Label>
                            <Textarea rows={2} className="resize-none text-xs" placeholder="Invoice notes…"
                              value={invNotes} onChange={(e) => setInvNotes(e.target.value)} />
                          </div>
                          <div className="flex justify-end gap-2 pt-1">
                            <Button size="sm" variant="outline" onClick={() => setShowInvoiceForm(false)}>Cancel</Button>
                            <Button size="sm"
                              disabled={!invAmount || parseFloat(invAmount) <= 0 || createInvoiceMutation.isPending}
                              onClick={() => createInvoiceMutation.mutate()}
                              className="gap-1.5 bg-violet-600 hover:bg-violet-700">
                              {createInvoiceMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Receipt className="w-3 h-3" />}
                              Create Invoice
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    )}

                    <Card className="border-0 shadow-sm">
                      <CardContent className="p-0">
                        {invoices?.length ? (
                          <div className="divide-y">
                            {invoices.map((inv) => {
                              const statusCls =
                                inv.status === "paid"      ? "bg-emerald-600 text-white" :
                                inv.status === "sent"      ? "bg-sky-600 text-white" :
                                inv.status === "overdue"   ? "bg-red-500 text-white" :
                                inv.status === "cancelled" ? "bg-muted text-muted-foreground border" :
                                "bg-secondary text-secondary-foreground";
                              return (
                                <div key={inv.id} className="px-5 py-3.5 space-y-2.5">
                                  <div className="flex items-start justify-between gap-3">
                                    <div className="min-w-0 flex-1">
                                      <div className="flex items-center gap-2 flex-wrap">
                                        <p className="text-sm font-mono font-semibold">{inv.invoice_number}</p>
                                        <Badge className={`text-[10px] h-4 px-1.5 capitalize ${statusCls}`}>{inv.status}</Badge>
                                        {inv.due_date && inv.status !== "paid" && inv.status !== "cancelled" && (
                                          <span className="text-[10px] text-muted-foreground">Due {formatDate(inv.due_date)}</span>
                                        )}
                                      </div>
                                      <p className="text-xs text-muted-foreground mt-0.5">
                                        <span className="font-semibold">{inv.currency} {parseFloat(inv.total_amount).toLocaleString("en-US", { minimumFractionDigits: 2 })}</span>
                                        {parseFloat(inv.tax_amount) > 0 && (
                                          <span className="ml-1 text-muted-foreground/60">(incl. tax {inv.currency} {parseFloat(inv.tax_amount).toLocaleString()})</span>
                                        )}
                                      </p>
                                      {inv.pdf_url && (
                                        <a href={inv.pdf_url} target="_blank" rel="noopener noreferrer"
                                          className="text-[10px] text-sky-600 underline underline-offset-2 mt-0.5 inline-block">
                                          View PDF
                                        </a>
                                      )}
                                      <p className="text-[10px] text-muted-foreground/60 mt-0.5">
                                        Created {formatDateTime(inv.created_at)}
                                        {inv.sent_at && ` · Sent ${formatDateTime(inv.sent_at)}`}
                                        {inv.paid_at && ` · Paid ${formatDateTime(inv.paid_at)}`}
                                      </p>
                                    </div>
                                  </div>
                                  {isFM && (
                                    <div className="flex gap-2 flex-wrap">
                                      {inv.status === "draft" && (
                                        <>
                                          <Button size="sm" className="h-7 text-xs gap-1 bg-sky-600 hover:bg-sky-700"
                                            disabled={markInvoiceSentMutation.isPending}
                                            onClick={() => markInvoiceSentMutation.mutate(inv.id)}>
                                            {markInvoiceSentMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <ChevronRight className="w-3 h-3" />}
                                            Mark Sent
                                          </Button>
                                          <Button size="sm" variant="outline"
                                            className="h-7 text-xs gap-1 text-destructive border-destructive/30 hover:bg-destructive/5"
                                            disabled={cancelInvoiceMutation.isPending}
                                            onClick={() => cancelInvoiceMutation.mutate(inv.id)}>
                                            <XCircle className="w-3 h-3" />Cancel
                                          </Button>
                                        </>
                                      )}
                                      {(inv.status === "sent" || inv.status === "overdue") && (
                                        <>
                                          <Button size="sm" className="h-7 text-xs gap-1 bg-emerald-600 hover:bg-emerald-700"
                                            disabled={markInvoicePaidMutation.isPending}
                                            onClick={() => markInvoicePaidMutation.mutate(inv.id)}>
                                            {markInvoicePaidMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle2 className="w-3 h-3" />}
                                            Mark Paid
                                          </Button>
                                          <Button size="sm" variant="outline"
                                            className="h-7 text-xs gap-1 text-destructive border-destructive/30 hover:bg-destructive/5"
                                            disabled={cancelInvoiceMutation.isPending}
                                            onClick={() => cancelInvoiceMutation.mutate(inv.id)}>
                                            <XCircle className="w-3 h-3" />Cancel
                                          </Button>
                                        </>
                                      )}
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        ) : (
                          <div className="flex flex-col items-center py-8 text-muted-foreground">
                            <Receipt className="w-7 h-7 mb-2 opacity-25" />
                            <p className="text-sm">No invoices yet</p>
                            {isFM && <p className="text-xs mt-1 text-muted-foreground/70">Create an invoice once payment is confirmed</p>}
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  </div>

                </TabsContent>
              )}

            </Tabs>
          </div>

          {/* ── Right: Status Timeline */}
          <div>
            <Card className="border-0 shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <Clock className="w-4 h-4 text-primary" />
                  Status Timeline
                  {timeline?.length ? (
                    <span className="ml-auto text-xs font-normal text-muted-foreground">{timeline.length} events</span>
                  ) : null}
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0 pb-4">
                {timeline?.length ? (
                  <ol className="relative px-5">
                    {timeline.map((entry, i) => {
                      const isLast = i === timeline.length - 1;
                      const isDraft        = entry.to_status === "draft";
                      const isCompleted    = entry.to_status === "completed";
                      const isRejected     = entry.to_status === "feedback_rejected" || entry.to_status === "cancelled";
                      const isApproval     = entry.to_status === "active" || entry.to_status === "feedback_approved" || entry.to_status === "bdn_approved" || entry.to_status === "payment_confirmed";
                      const dotColor = isCompleted ? "border-emerald-500 bg-emerald-500"
                        : isRejected   ? "border-red-500 bg-red-100"
                        : isApproval   ? "border-emerald-400 bg-emerald-50"
                        : isDraft      ? "border-muted-foreground/40 bg-muted"
                        : "border-primary bg-primary/10";
                      const labelColor = isCompleted ? "text-emerald-700 font-bold"
                        : isRejected   ? "text-red-600 font-semibold"
                        : isApproval   ? "text-emerald-700 font-semibold"
                        : "font-semibold";
                      return (
                        <li key={entry.id} className="relative pb-5 pl-7">
                          {!isLast && (
                            <div className={`absolute left-[5px] top-3 bottom-0 w-px ${isCompleted || isApproval ? "bg-emerald-200" : "bg-border"}`} />
                          )}
                          <div className={`absolute left-0 top-1.5 w-3 h-3 rounded-full border-2 ${dotColor}`} />
                          <div className="space-y-0.5">
                            <p className={`text-xs capitalize ${labelColor}`}>
                              {entry.to_status.replace(/_/g, " ")}
                            </p>
                            {entry.reason && (
                              <p className="text-[11px] text-muted-foreground leading-snug">{entry.reason}</p>
                            )}
                            <p className="text-[10px] text-muted-foreground/60">{formatDateTime(entry.created_at)}</p>
                          </div>
                        </li>
                      );
                    })}
                  </ol>
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-6">No history yet</p>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
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
              disabled={transitionMutation.isPending}
              onClick={() => {
                if (!showTransitionConfirm) return;
                transitionMutation.mutate({
                  to_status: showTransitionConfirm.to,
                  reason: transitionNotes.trim() || undefined,
                  completion_notes: showTransitionConfirm.to === "completed"
                    ? transitionNotes.trim() || undefined
                    : undefined,
                });
              }}
            >
              {transitionMutation.isPending && <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />}
              Confirm
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── PFI dialog (hybrid: generate or upload) */}
      <Dialog open={showPfiDialog} onOpenChange={(v) => { if (!v) closePfiDialog(); }}>
        <DialogContent className="sm:max-w-lg" aria-describedby={undefined}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-primary" />
              Proforma Invoice (PFI)
            </DialogTitle>
          </DialogHeader>

          <Tabs value={pfiMode} onValueChange={(v) => setPfiMode(v as "generate" | "upload")} className="mt-1">
            <TabsList className="w-full h-9">
              <TabsTrigger value="generate" className="flex-1 text-xs gap-1.5">
                <ClipboardCheck className="w-3.5 h-3.5" />
                Generate from Operation
              </TabsTrigger>
              <TabsTrigger value="upload" className="flex-1 text-xs gap-1.5">
                <UploadCloud className="w-3.5 h-3.5" />
                Manual Upload
              </TabsTrigger>
            </TabsList>

            {/* ── GENERATE tab ── */}
            <TabsContent value="generate" className="mt-3 space-y-3">
              {(() => {
                const type = op?.type;
                const st   = op?.status;
                const needsState =
                  type === "truck_only"    ? "active" :
                  type === "full_operation"? "bdn_approved" :
                  type === "vessel_only"   ? "bdn_approved" : null;
                const postPfi = ["pfi_linked","payment_processing","payment_confirmed","invoiced","completed","archived"];
                const isReady    = st === needsState;
                const isPastPfi  = postPfi.includes(st ?? "");
                const isBlocked  = !isReady && !isPastPfi;

                return isBlocked ? (
                  <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2.5 text-xs text-amber-800 flex items-start gap-2">
                    <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                    <span>
                      Operation is currently <strong>{st?.replace(/_/g, " ")}</strong>.
                      {needsState && <> A PFI can only be generated once the operation reaches <strong>{needsState.replace(/_/g, " ")}</strong>.</>}
                      {" "}Use the <strong>Manual Upload</strong> tab to attach an existing PFI document instead.
                    </span>
                  </div>
                ) : null;
              })()}
              {!op?.expected_volume_mt && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2.5 text-xs text-amber-800 flex items-start gap-2">
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                  <span>This operation has no <strong>expected volume</strong> set. Set it in the Overview tab before generating a PFI.</span>
                </div>
              )}
              <div className="bg-blue-50 border border-blue-200 rounded-lg px-3 py-2.5 text-xs text-blue-800">
                The system will pull <span className="font-semibold">operation details, client info, product, route, and volume</span>{" "}
                to generate a branded PDF. Enter the pricing details below.
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Rate per MT ({op?.currency}) <span className="text-destructive">*</span></Label>
                  <Input type="number" step="0.01" placeholder="e.g. 450.00"
                    value={genRate} onChange={(e) => setGenRate(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Validity (days)</Label>
                  <Input type="number" min="1" placeholder="7"
                    value={genValidity} onChange={(e) => setGenValidity(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Tax Rate (%)</Label>
                  <Input type="number" step="0.1" min="0" max="100" placeholder="0"
                    value={genTax} onChange={(e) => setGenTax(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Exchange Rate (to NGN) <span className="text-muted-foreground font-normal">optional</span></Label>
                  <Input type="number" step="0.01" placeholder={op?.currency !== "NGN" ? "e.g. 1580" : "N/A"}
                    disabled={op?.currency === "NGN"}
                    value={genExchange} onChange={(e) => setGenExchange(e.target.value)} />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">Supplier Name <span className="text-muted-foreground font-normal">optional</span></Label>
                <Input placeholder="Defaults to Reliant Anchor Logistics Ltd"
                  value={genSupplier} onChange={(e) => setGenSupplier(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Service Description <span className="text-muted-foreground font-normal">optional</span></Label>
                <Input placeholder="Auto-generated from product type if blank"
                  value={genDesc} onChange={(e) => setGenDesc(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Additional Notes <span className="text-muted-foreground font-normal">optional</span></Label>
                <Textarea rows={2} className="resize-none text-sm"
                  placeholder="Special payment terms, conditions…"
                  value={genNotes} onChange={(e) => setGenNotes(e.target.value)} />
              </div>

              {/* Live amount preview */}
              {genRate && op?.expected_volume_mt && (
                <div className="bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2.5 text-xs">
                  <div className="flex justify-between items-center">
                    <span className="text-emerald-700">Estimated Amount</span>
                    <span className="font-bold text-emerald-800 font-mono">
                      {op.currency}{" "}
                      {(parseFloat(genRate) * parseFloat(op.expected_volume_mt) * (1 + (parseFloat(genTax) || 0) / 100)).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </div>
                  <p className="text-emerald-600 mt-0.5">
                    {parseFloat(op.expected_volume_mt).toLocaleString()} MT × {op.currency} {parseFloat(genRate).toLocaleString()} /MT
                    {parseFloat(genTax) > 0 && ` + ${genTax}% tax`}
                  </p>
                </div>
              )}

              <DialogFooter>
                <Button variant="outline" onClick={closePfiDialog}>Cancel</Button>
                <Button
                  disabled={(() => {
                    if (!genRate || parseFloat(genRate) <= 0 || !op?.expected_volume_mt || generatePfiMutation.isPending) return true;
                    const needsState = op?.type === "truck_only" ? "active" : "bdn_approved";
                    const postPfi = ["pfi_linked","payment_processing","payment_confirmed","invoiced","completed","archived"];
                    return op?.status !== needsState && !postPfi.includes(op?.status ?? "");
                  })()}
                  onClick={() => generatePfiMutation.mutate()}
                  className="gap-1.5"
                >
                  {generatePfiMutation.isPending
                    ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    : <FileText className="w-3.5 h-3.5" />}
                  Generate PFI PDF
                </Button>
              </DialogFooter>
            </TabsContent>

            {/* ── UPLOAD tab ── */}
            <TabsContent value="upload" className="mt-3 space-y-3">
              <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2.5 text-xs text-amber-800">
                Manually enter the PFI details if you have a supplier-issued document. The system will still record all operation references.
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5 col-span-2 sm:col-span-1">
                  <Label className="text-xs">Total Amount <span className="text-destructive">*</span></Label>
                  <Input type="number" step="0.01" placeholder="e.g. 5000000"
                    value={pfiAmount} onChange={(e) => setPfiAmount(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Currency</Label>
                  <Select value={pfiCurrency} onValueChange={setPfiCurrency}>
                    <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="NGN">NGN</SelectItem>
                      <SelectItem value="USD">USD</SelectItem>
                      <SelectItem value="EUR">EUR</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Supplier Name <span className="text-muted-foreground font-normal">optional</span></Label>
                <Input placeholder="e.g. NNPC, Ardova…" value={pfiSupplier} onChange={(e) => setPfiSupplier(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Description <span className="text-muted-foreground font-normal">optional</span></Label>
                <Textarea rows={2} className="resize-none text-sm"
                  placeholder="Brief description of the PFI…"
                  value={pfiDesc} onChange={(e) => setPfiDesc(e.target.value)} />
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={closePfiDialog}>Cancel</Button>
                <Button
                  disabled={!pfiAmount || parseFloat(pfiAmount) <= 0 || linkPfiMutation.isPending}
                  onClick={() => linkPfiMutation.mutate()}
                  className="gap-1.5"
                >
                  {linkPfiMutation.isPending
                    ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    : <UploadCloud className="w-3.5 h-3.5" />}
                  Link PFI
                </Button>
              </DialogFooter>
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>

      {/* ── Safety Audit dialog */}
      <Dialog open={!!auditDialogTruckOpId} onOpenChange={(v) => { if (!v) setAuditDialogTruckOpId(null); }}>
        <DialogContent className="sm:max-w-lg" aria-describedby={undefined}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Shield className="w-4 h-4 text-primary" />
              Pre-Operation Safety Audit
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-1 max-h-[70vh] overflow-y-auto pr-1">
            <div className="space-y-1.5">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
                Checklist — tick each item that PASSES inspection
              </p>
              <div className="grid grid-cols-1 gap-1.5">
                {SAFETY_CHECKLIST_ITEMS.map((item) => {
                  const passed = auditChecklist[item] ?? false;
                  return (
                    <label key={item} className={`flex items-center gap-3 cursor-pointer rounded-lg border px-3 py-2.5 transition-colors ${
                      passed ? "border-emerald-300 bg-emerald-50" : "border-red-200 bg-red-50/50 hover:border-red-300"
                    }`}>
                      <input
                        type="checkbox"
                        className="w-4 h-4 rounded border-border accent-emerald-600 cursor-pointer"
                        checked={passed}
                        onChange={(e) => setAuditChecklist((prev) => ({ ...prev, [item]: e.target.checked }))}
                      />
                      <span className={`text-sm flex-1 ${passed ? "text-emerald-800" : "text-red-700 font-medium"}`}>{item}</span>
                      <span className={`text-xs font-bold shrink-0 ${passed ? "text-emerald-600" : "text-red-500"}`}>
                        {passed ? "✓ PASS" : "✗ FAIL"}
                      </span>
                    </label>
                  );
                })}
              </div>
              {Object.values(auditChecklist).filter((v) => !v).length > 0 && (
                <div className="mt-2 flex items-center gap-2 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                  <AlertTriangle className="w-3.5 h-3.5 text-red-600 shrink-0" />
                  <p className="text-xs text-red-700 font-medium">
                    {Object.values(auditChecklist).filter((v) => !v).length} item(s) failed — BM must waive each failed item before operation can proceed with known issues
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
                <label className={`flex-1 flex items-center justify-center gap-2 rounded-lg border px-3 py-2.5 cursor-pointer text-sm font-medium transition-colors ${auditResult === "not_satisfactory" ? "border-red-500 bg-red-50 text-red-700" : "border-border text-muted-foreground hover:border-primary/50"}`}>
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
              {submitAuditMutation.isPending && <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />}
              Submit Audit
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── BM Waive Audit Item dialog */}
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
                item: waiverDialog.item,
                notes: waiverNotes,
              })}
            >
              {waiveItemMutation.isPending && <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />}
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
              {reopenMutation.isPending && <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />}
              Create Revision
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Helper component ────────────────────────────────────────────────────────

function InfoItem({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div>
      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{label}</p>
      <p className={`text-sm mt-0.5 ${mono ? "font-mono font-semibold" : ""}`}>{value}</p>
    </div>
  );
}
