/**
 * Types for the per-person KPI endpoints (Phase 2).
 *
 * `num` and `age` are imported from kpi-command rather than copied — one
 * definition of "how a figure is written" across the KPI pages, so a blank
 * always means the same thing everywhere.
 *
 * Mirrors app/kpi/schemas_me.py on the backend.
 */

export { num, age } from "./kpi-command";

export interface MyMetric {
  key: string;
  label: string;
  unit: string;
  value?: number | null;
  score?: number | null;
  rating?: string | null;
  target?: number | null;
  weight: number;
  critical: boolean;
  sample_size?: number | null;
  /** Which of your records produced this — e.g. "Trucks you recorded". */
  attribution?: string | null;
  /** The job document and KPI the target came from. */
  doc: string;
  no_data_reason?: string | null;
  /** Present on judged measures: why this score, and who gave it. */
  grade_reason?: string | null;
  graded_by?: string | null;
}

export interface MyScorecard {
  period: string;
  user_id: string;
  full_name?: string | null;
  role: string;
  role_label: string;
  score?: number | null;
  rating?: string | null;
  metrics_measured: number;
  metrics_total: number;
  /** Share of your role's metric weight that had anything recorded. */
  coverage: number;
  /** True when too little was recorded to score you fairly. */
  insufficient_data: boolean;
  metrics: MyMetric[];
  team_median?: number | null;
  team_size: number;
  /** The month is still running, so these figures will keep moving. */
  provisional: boolean;
}

export interface LeaderboardRow {
  user_id: string;
  full_name?: string | null;
  role: string;
  role_label: string;
  score?: number | null;
  rating?: string | null;
  metrics_measured: number;
  metrics_total: number;
  coverage: number;
  insufficient_data: boolean;
}

export interface Leaderboard {
  period: string;
  provisional: boolean;
  rows: LeaderboardRow[];
  team_median?: number | null;
  scored_count: number;
  unscored_count: number;
}

/** The company's own four bands, mapped to the shared tone palette. */
/** The rating as a BAR colour, matching `ratingTone`'s text colour.
 *
 * Kept beside it so the two can never drift: a score printed amber with a
 * green bar beside it would be worse than no bar at all. */
export function ratingBar(rating?: string | null): string {
  switch (rating) {
    case "Excellent":
      return "bg-emerald-500";
    case "Good":
      return "bg-sky-500";
    case "Needs Improvement":
      return "bg-amber-500";
    case "Unsatisfactory":
      return "bg-rose-500";
    default:
      return "bg-muted-foreground/30";
  }
}

export function ratingTone(rating?: string | null): string {
  switch (rating) {
    case "Excellent":
      return "text-emerald-600";
    case "Good":
      return "text-sky-600";
    case "Needs Improvement":
      return "text-amber-600";
    case "Unsatisfactory":
      return "text-rose-500";
    default:
      return "text-muted-foreground";
  }
}

/** The last `count` months, newest first, as YYYY-MM. */
export function recentPeriods(count = 6): string[] {
  const out: string[] = [];
  const d = new Date();
  for (let i = 0; i < count; i++) {
    out.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
    d.setMonth(d.getMonth() - 1);
  }
  return out;
}

export function periodLabel(period: string): string {
  const [y, m] = period.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleString(undefined, {
    month: "long",
    year: "numeric",
  });
}

// ── Phase 4: monthly report, grading ─────────────────────────────────────

export interface ReportSection {
  heading: string;
  /** Where the figures came from, shown so the reader can trust them. */
  source: string;
  rows: [string, string][];
}

export interface MonthlyReport {
  period: string;
  generated_at: string;
  full_name?: string | null;
  role: string;
  score?: number | null;
  rating?: string | null;
  coverage: number;
  sections: ReportSection[];
  /** The parts only a person can write — the system must not invent them. */
  to_complete: string[];
}

export interface GradableMetric {
  metric_key: string;
  label: string;
  role: string;
  role_label: string;
  weight: number;
  doc: string;
  description: string;
}
