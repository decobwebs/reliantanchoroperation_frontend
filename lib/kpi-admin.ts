/**
 * Types and helpers for the KPI admin surfaces — the operation scorecard,
 * the targets editor, month close and the HR pack.
 *
 * Mirrors app/kpi/schemas.py on the backend.
 */

export interface Metric {
  key: string;
  label: string;
  unit: string;
  value?: number | null;
  score?: number | null;
  rating?: string | null;
  target?: number | null;
  fail?: number | null;
  weight: number;
  critical: boolean;
  source: string; // "auto" | "graded"
  doc: string;
  description: string;
  sample_size?: number | null;
  no_data_reason?: string | null;
  target_overridden: boolean;
}

export interface RoleScore {
  role: string;
  role_label: string;
  score?: number | null;
  rating?: string | null;
  metrics: Metric[];
}

export interface Contributor {
  user_id: string;
  full_name?: string | null;
  role: string;
  role_label: string;
  involvement: string[];
}

export interface OperationScorecard {
  operation_id: string;
  operation_number?: string | null;
  operation_type?: string | null;
  status?: string | null;
  computed_at: string;
  overall_score?: number | null;
  overall_rating?: string | null;
  roles: RoleScore[];
  contributors: Contributor[];
}

export interface KpiTarget {
  metric_key: string;
  label: string;
  unit: string;
  role: string;
  role_label: string;
  curve: string;
  weight: number;
  critical: boolean;
  doc: string;
  description: string;
  effective_target?: number | null;
  effective_fail?: number | null;
  default_target?: number | null;
  default_fail?: number | null;
  is_overridden: boolean;
  overridden_at?: string | null;
  overridden_by?: string | null;
  override_reason?: string | null;
}

/**
 * An absent figure renders BLANK — never a dash, never a zero. "Measured, and
 * it is zero" and "we have no reading" are different facts, and a scorecard
 * that blurs them is worse than useless.
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

/** A measured value with its unit, formatted for the unit's own scale. */
export function metricValue(m: { value?: number | null; unit: string }): string {
  if (m.value === null || m.value === undefined) return "";
  const dp = m.unit === "%" ? 2 : m.unit === "hours" ? 1 : 0;
  const shown = num(m.value, { dp });
  if (!shown) return "";
  if (m.unit === "%") return `${shown}%`;
  if (m.unit === "count" || m.unit === "score") return shown;
  return `${shown} ${m.unit}`;
}

/** The target, phrased the way the curve actually reads. */
export function targetText(m: {
  target?: number | null;
  unit: string;
  curve?: string;
}): string {
  if (m.target === null || m.target === undefined) return "";
  const dp = m.unit === "%" ? (m.target < 1 ? 3 : 2) : m.unit === "hours" ? 0 : 0;
  const shown = num(m.target, { dp });
  const suffix =
    m.unit === "%" ? "%" : m.unit === "count" || m.unit === "score" ? "" : ` ${m.unit}`;
  const direction = m.curve === "rate" ? "≥" : "≤";
  return `${direction} ${shown}${suffix}`;
}

/** The company's four rating bands, as colour. */
export function ratingTone(rating?: string | null): {
  text: string;
  bg: string;
  bar: string;
} {
  switch (rating) {
    case "Excellent":
      return { text: "text-emerald-600", bg: "bg-emerald-500/10", bar: "bg-emerald-500" };
    case "Good":
      return { text: "text-sky-600", bg: "bg-sky-500/10", bar: "bg-sky-500" };
    case "Needs Improvement":
      return { text: "text-amber-600", bg: "bg-amber-500/10", bar: "bg-amber-500" };
    case "Unsatisfactory":
      return { text: "text-rose-600", bg: "bg-rose-500/10", bar: "bg-rose-500" };
    default:
      return { text: "text-muted-foreground", bg: "bg-muted", bar: "bg-muted-foreground/30" };
  }
}

/** 'YYYY-MM' for the given offset back from this month. */
export function periodOption(monthsBack: number): { value: string; label: string } {
  const d = new Date();
  d.setDate(1);
  d.setMonth(d.getMonth() - monthsBack);
  const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  const label = d.toLocaleDateString(undefined, { month: "long", year: "numeric" });
  return { value, label };
}

/** One measure inside an HR pack entry. Mirrors app/kpi/reports.py. */
export interface HrPackMetric {
  label: string;
  value?: number | null;
  unit: string;
  target?: number | null;
  score?: number | null;
  critical: boolean;
  attribution?: string | null;
  doc?: string | null;
  grade_reason?: string | null;
  graded_by?: string | null;
}

export interface HrPackPerson {
  user_id: string;
  full_name?: string | null;
  role_label: string;
  score?: number | null;
  rating?: string | null;
  coverage?: number | null;
  metrics_measured: number;
  metrics_total: number;
  metrics: HrPackMetric[];
}

export interface HrPack {
  period: string;
  generated_at: string;
  staff_total: number;
  scored: number;
  people: HrPackPerson[];
}

/** 'YYYY-MM' as a month a person would say out loud. */
export function periodLabel(period: string): string {
  const [y, m] = period.split("-").map(Number);
  if (!y || !m) return period;
  return new Date(y, m - 1, 1).toLocaleDateString(undefined, {
    month: "long",
    year: "numeric",
  });
}
