/**
 * Truck availability — labels, colours and the one rule for "can this truck
 * be sent". The server works availability out from each truck's live job
 * (app/services/truck_availability.py); the UI only displays it.
 */
import type { Truck, TruckAvailability } from "@/types";

export const AVAILABILITY_ORDER: TruckAvailability[] = [
  "available", "assigned", "in_transit", "discharging", "maintenance", "out_of_service",
];

export const AVAILABILITY_LABEL: Record<TruckAvailability, string> = {
  available: "Available",
  assigned: "Assigned",
  in_transit: "In Transit",
  discharging: "Discharging",
  maintenance: "Maintenance",
  out_of_service: "Out of Service",
};

export const AVAILABILITY_COLOR: Record<TruckAvailability, string> = {
  available:      "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300",
  assigned:       "bg-brand-100 text-brand-700 dark:bg-brand-500/15 dark:text-brand-300",
  in_transit:     "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300",
  discharging:    "bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300",
  maintenance:    "bg-orange-100 text-orange-700 dark:bg-orange-500/15 dark:text-orange-300",
  out_of_service: "bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300",
};

export const OWNERSHIP_LABEL: Record<"company" | "contractor", string> = {
  company: "Company",
  contractor: "Contractor",
};

/** What the truck is doing now. Falls back to the stored status for a
 *  response from a backend that predates availability. */
export function availabilityOf(t: Truck): TruckAvailability {
  return (t.availability ?? t.status) as TruckAvailability;
}

/** Maintenance and Out of Service trucks cannot be picked for a job. */
export function isUnfit(t: Truck): boolean {
  const a = availabilityOf(t);
  return a === "maintenance" || a === "out_of_service";
}

/** Busy on a job other than `operationId` — offered, but with a warning,
 *  because a truck often finishes early. */
export function busyElsewhere(t: Truck, operationId?: string): boolean {
  return !!t.current_operation_id && t.current_operation_id !== operationId;
}
