/**
 * Types for the Command Center endpoint (KPI Phase 3).
 *
 * Deliberately a Phase-3-only module rather than a shared KPI client: Phase 2
 * is building "My Performance" in parallel and owns any shared helper. Keeping
 * these apart means neither session has to edit the other's file.
 *
 * Mirrors app/kpi/schemas_command.py on the backend.
 */

export type Severity = "critical" | "warning" | "info";

export interface AttentionItem {
  kind: string;
  severity: Severity;
  title: string;
  subtitle?: string | null;
  operation_id?: string | null;
  operation_number?: string | null;
  since?: string | null;
  age_hours?: number | null;
}

export interface LiveOperation {
  operation_id: string;
  operation_number: string;
  operation_type?: string | null;
  status?: string | null;
  idle_hours?: number | null;
  last_event_at?: string | null;
}

export interface ProductVolume {
  product_type: string;
  mt_vacuum?: number | null;
}

export interface VolumePulse {
  mt_delivered_this_month?: number | null;
  mt_delivered_last_month?: number | null;
  /**
   * True when the recorded vessel figures are litres-scale rather than
   * tonnes. While set, the UI must not print an MT(vac) label — see the
   * data warning the endpoint returns alongside it.
   */
  vessel_figures_suspect: boolean;
  vessel_unit_label: string;
  litres_trucked_this_month?: number | null;
  litres_trucked_last_month?: number | null;
  by_product: ProductVolume[];
}

export interface WorstOperation {
  operation_id: string;
  operation_number: string;
  loss_pct: number;
  litres_lost?: number | null;
}

export interface VendorLeagueRow {
  vendor_name: string;
  trips: number;
  trucks: number;
  avg_litres_lost?: number | null;
  over_cap_trips: number;
  over_cap_pct?: number | null;
}

export interface LossWatch {
  truck_loss_pct_this_month?: number | null;
  avg_litres_lost_per_truck?: number | null;
  loss_cap_litres?: number | null;
  trucks_over_cap: number;
  trucks_measured: number;
  worst_operations: WorstOperation[];
  /** An estimate, never an invoiced amount — `price_basis` says how it was derived. */
  litres_lost_this_month?: number | null;
  naira_lost_estimate?: number | null;
  price_per_litre?: number | null;
  price_basis?: string | null;
}

export interface FigureDiscrepancy {
  bdn_number: string;
  operation_id?: string | null;
  operation_number?: string | null;
  submitted_by?: string | null;
  field: string;
  submitted?: number | null;
  system_recorded?: number | null;
  litres_gap?: number | null;
  gap_pct?: number | null;
  naira_gap?: number | null;
}

export interface RolePulse {
  role: string;
  role_label: string;
  score?: number | null;
  rating?: string | null;
}

export interface TeamPulse {
  available: boolean;
  unavailable_reason?: string | null;
  period?: string | null;
  roles: RolePulse[];
}

export interface FleetLeagueRow {
  truck_id: string;
  truck_number: string;
  trips: number;
  avg_litres_lost?: number | null;
  avg_discharge_hours?: number | null;
  over_cap_trips: number;
}

export interface LicenceRunway {
  product_type: string;
  remaining_litres?: number | null;
  avg_monthly_litres?: number | null;
  days_left?: number | null;
  severity?: "critical" | "warning" | "ok" | null;
}

export interface MoneyStrip {
  currency: string;
  collected_this_month?: number | null;
  outstanding_invoices?: number | null;
  invoices_outstanding_count: number;
  vouchers_pending: number;
}

export interface CommandCenter {
  generated_at: string;
  attention: AttentionItem[];
  attention_total: number;
  live_operations: LiveOperation[];
  volume: VolumePulse;
  loss: LossWatch;
  team: TeamPulse;
  fleet: FleetLeagueRow[];
  vendors: VendorLeagueRow[];
  discrepancies: FigureDiscrepancy[];
  licences: LicenceRunway[];
  money: MoneyStrip;
  degraded: string[];
  data_warnings: string[];
}

/**
 * An absent figure renders BLANK — never a dash, never a zero, never a stray
 * unit. That is the house rule for quantities across RAOMS, and it matters
 * most here: "measured, and it is zero" and "we have no reading" are
 * different facts, and a dashboard that blurs them is worse than useless.
 */
export function num(
  value: number | null | undefined,
  opts: { dp?: number; unit?: string } = {}
): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "";
  const { dp = 0, unit } = opts;
  const text = value.toLocaleString(undefined, {
    minimumFractionDigits: dp,
    maximumFractionDigits: dp,
  });
  return unit ? `${text} ${unit}` : text;
}

/** Hours as something a person reads at a glance. Blank when unknown. */
export function age(hours: number | null | undefined): string {
  if (hours === null || hours === undefined || Number.isNaN(hours)) return "";
  if (hours < 1) return `${Math.round(hours * 60)}m`;
  if (hours < 48) return `${Math.round(hours)}h`;
  return `${Math.round(hours / 24)}d`;
}

/** Percentage change against last month. Null when there is nothing to compare. */
export function deltaPct(
  current: number | null | undefined,
  previous: number | null | undefined
): number | null {
  if (!current || !previous) return null;
  return ((current - previous) / previous) * 100;
}
