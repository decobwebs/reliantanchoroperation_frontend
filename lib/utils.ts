import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { format, formatDistanceToNow } from "date-fns";
import type { OperationStatus } from "@/types";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function toUtcDate(date: string): Date {
  // Append Z if no timezone info so JS treats it as UTC (not local time)
  const s = /[Z+]/.test(date) ? date : date + "Z";
  return new Date(s);
}

export function formatDate(date: string | null | undefined): string {
  if (!date) return "—";
  return format(toUtcDate(date), "dd MMM yyyy");
}

export function formatDateTime(date: string | null | undefined): string {
  if (!date) return "—";
  return format(toUtcDate(date), "dd MMM yyyy, HH:mm");
}

/** Year-less day + time — for dense rails and steppers where the year is noise. */
export function formatDayTime(date: string | null | undefined): string {
  if (!date) return "—";
  return format(toUtcDate(date), "dd MMM, HH:mm");
}

export function formatRelative(date: string | null | undefined): string {
  if (!date) return "—";
  return formatDistanceToNow(toUtcDate(date), { addSuffix: true });
}

export function formatCurrency(
  amount: string | number | null | undefined,
  currency = "USD"
): string {
  if (amount == null) return "—";
  const num = typeof amount === "string" ? parseFloat(amount) : amount;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
  }).format(num);
}

export function formatNumber(val: string | number | null | undefined): string {
  if (val == null) return "—";
  const num = typeof val === "string" ? parseFloat(val) : val;
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 3 }).format(num);
}

export const STATUS_LABELS: Record<OperationStatus, string> = {
  draft: "Draft",
  tasks_assigned: "Tasks Assigned",
  awaiting_feedback: "Awaiting Feedback",
  feedback_submitted: "Feedback Submitted",
  feedback_approved: "Feedback Approved",
  feedback_rejected: "Feedback Rejected",
  active: "Active",
  pending_completion: "Pending Completion",
  pfi_linked: "PFI Linked",
  payment_processing: "Payment Processing",
  payment_confirmed: "Payment Confirmed",
  vessel_operations: "Vessel Ops",
  bdn_pending: "BDN Pending",
  bdn_approved: "BDN Approved",
  invoiced: "Invoiced",
  completed: "Completed",
  archived: "Archived",
  cancelled: "Cancelled",
};

export const STATUS_VARIANT: Record<
  OperationStatus,
  "default" | "secondary" | "destructive" | "outline"
> = {
  draft: "secondary",
  tasks_assigned: "secondary",
  awaiting_feedback: "outline",
  feedback_submitted: "outline",
  feedback_approved: "default",
  feedback_rejected: "destructive",
  active: "default",
  pending_completion: "outline",
  pfi_linked: "default",
  payment_processing: "default",
  payment_confirmed: "default",
  vessel_operations: "default",
  bdn_pending: "outline",
  bdn_approved: "default",
  invoiced: "default",
  completed: "default",
  archived: "secondary",
  cancelled: "destructive",
};

export const OP_TYPE_LABELS: Record<string, string> = {
  full_operation: "Full Operation",
  vessel_only: "Vessel Only",
  truck_only: "Truck Only",
};

// Vessel-only only — a pure label, never a gate. "terminal"'s human label
// ("TMS") isn't finalized; this is the one place to change it later.
export const VESSEL_SOURCE_TYPE_LABELS: Record<string, string> = {
  truck: "TTS (Truck-to-Ship)",
  terminal: "TMS (Terminal-to-Ship)",
};

export const OPERATION_COLOR_SWATCHES: Record<string, string> = {
  red:    "bg-red-500",
  orange: "bg-orange-500",
  amber:  "bg-amber-500",
  green:  "bg-emerald-500",
  teal:   "bg-teal-500",
  blue:   "bg-blue-500",
  indigo: "bg-indigo-500",
  purple: "bg-purple-500",
  pink:   "bg-pink-500",
  gray:   "bg-gray-500",
};

export function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}
