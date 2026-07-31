import type { OperationStatus } from "@/types";

// Status pipeline — ordered happy-path stages per operation type. Finance
// (PFI/payment/invoice) is a standalone concern now, not part of this pipeline.
// Shared by the operation detail pipeline strip and the dashboard progress bars.
export const STATUS_PIPELINE: Record<string, string[]> = {
  truck_only: [
    "draft","tasks_assigned","awaiting_feedback","feedback_submitted",
    "active",
    "pending_completion","bdn_pending","bdn_approved","completed",
  ],
  vessel_only: [
    "draft","tasks_assigned","active",
    "vessel_operations","bdn_pending","bdn_approved",
    "completed",
  ],
  full_operation: [
    "draft","tasks_assigned","awaiting_feedback","feedback_submitted",
    "active",
    "vessel_operations","bdn_pending","bdn_approved",
    "completed",
  ],
};

export const PIPELINE_LABELS: Record<string, string> = {
  draft:               "Draft",
  tasks_assigned:      "Tasks",
  awaiting_feedback:   "Await FB",
  feedback_submitted:  "FB Submitted",
  active:              "Active",
  pending_completion:  "Pending Completion",
  vessel_operations:   "Vessel Ops",
  bdn_pending:         "BDN Pending",
  bdn_approved:        "BDN Approved",
  pfi_linked:          "PFI Linked",
  payment_processing:  "Payment",
  payment_confirmed:   "Paid",
  invoiced:            "Invoiced",
  completed:           "Completed",
};

// Statuses that sit outside the happy-path pipeline (the standalone finance
// track, plus terminal states). Approximate positions so a progress bar still
// reads sensibly instead of collapsing to 0%.
const OFF_PIPELINE_PROGRESS: Partial<Record<OperationStatus, number>> = {
  feedback_rejected: 30,
  pfi_linked: 60,
  payment_processing: 65,
  payment_confirmed: 75,
  invoiced: 90,
  completed: 100,
  archived: 100,
  cancelled: 0,
};

/**
 * How far an operation has travelled along its type's pipeline, 0–100.
 * Off-pipeline statuses fall back to an approximate position.
 */
export function operationProgress(type: string, status: string): number {
  const pipeline = STATUS_PIPELINE[type] ?? [];
  const idx = pipeline.indexOf(status);
  if (idx >= 0 && pipeline.length > 1) {
    return Math.round((idx / (pipeline.length - 1)) * 100);
  }
  return OFF_PIPELINE_PROGRESS[status as OperationStatus] ?? 0;
}

/**
 * `expected_volume_mt` is the legacy single-product scalar — it's null on
 * every operation created through the current multi-product flow, where the
 * real per-product quantities live in `products[]` instead. Resolve whichever
 * one the operation actually has, so pages don't show a blank/dash for
 * operations that do carry a real expected volume, just under the other field.
 */
export function resolveExpectedVolumeMt(op: {
  expected_volume_mt?: string | null;
  products?: { quantity_mt: string }[] | null;
}): number | null {
  if (op.expected_volume_mt) return parseFloat(op.expected_volume_mt);
  if (op.products?.length) {
    return op.products.reduce((sum, p) => sum + (parseFloat(p.quantity_mt) || 0), 0);
  }
  return null;
}
