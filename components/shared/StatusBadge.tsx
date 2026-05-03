import { Badge } from "@/components/ui/badge";
import { STATUS_LABELS, STATUS_VARIANT, cn } from "@/lib/utils";
import type { OperationStatus } from "@/types";

// Extra CSS classes for semantic colour (supplements shadcn variant)
const STATUS_CLASS: Partial<Record<OperationStatus, string>> = {
  completed: "bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400",
  active: "bg-green-100 text-green-800 border-green-200 dark:bg-green-900/30 dark:text-green-400",
  pending_completion: "bg-orange-100 text-orange-800 border-orange-200",
  feedback_approved: "bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/30 dark:text-blue-400",
  payment_confirmed: "bg-blue-100 text-blue-800 border-blue-200",
  bdn_approved: "bg-blue-100 text-blue-800 border-blue-200",
  vessel_operations: "bg-indigo-100 text-indigo-800 border-indigo-200",
  pfi_linked: "bg-amber-100 text-amber-800 border-amber-200",
  payment_processing: "bg-amber-100 text-amber-800 border-amber-200",
  invoiced: "bg-purple-100 text-purple-800 border-purple-200",
  feedback_rejected: "bg-red-100 text-red-800 border-red-200",
  cancelled: "bg-red-100 text-red-800 border-red-200",
};

interface Props {
  status: OperationStatus;
  className?: string;
}

export function StatusBadge({ status, className }: Props) {
  return (
    <Badge
      variant={STATUS_VARIANT[status] ?? "secondary"}
      className={cn("text-xs font-medium", STATUS_CLASS[status], className)}
    >
      {STATUS_LABELS[status] ?? status}
    </Badge>
  );
}
