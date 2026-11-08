/**
 * Shared pieces for the HR pages (/hr/*).
 *
 * Mirrors app/kpi/router_people.py on the backend. Every HR route only reads;
 * account changes stay on /admin with the Bunker Manager.
 */

import type { LeaderboardRow, MyScorecard } from "./kpi-me";
import { recentPeriods } from "./kpi-me";

export interface StaffMember {
  user_id: string;
  full_name: string;
  email: string;
  phone?: string | null;
  role: string;
  role_label: string;
  is_active: boolean;
  created_at?: string | null;
  last_login_at?: string | null;
}

export interface PersonScorecard extends MyScorecard {
  email: string;
  phone?: string | null;
  is_active: boolean;
  /** False for roles the KPI engine does not score (HR, Safety Officer). */
  scored_role: boolean;
}

/** Roles the pages may be opened by. The API enforces the same list. */
export const HR_VIEWER_ROLES = ["hr", "bunker_manager"];

/** The last full month. HR reviews a finished month, not one still running. */
export function lastFullMonth(): string {
  return recentPeriods(2)[1];
}

/** A login older than this is worth a look. */
export const IDLE_DAYS = 14;

export function daysSince(iso?: string | null): number | null {
  if (!iso) return null;
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
}

export function shortDate(iso?: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

/** "today", "3 days ago", "never". */
export function lastSeen(iso?: string | null): string {
  const d = daysSince(iso);
  if (d === null) return "Never logged in";
  if (d <= 0) return "Today";
  if (d === 1) return "Yesterday";
  return `${d} days ago`;
}

export function needsSupport(r: Pick<LeaderboardRow, "rating">): boolean {
  return r.rating === "Needs Improvement" || r.rating === "Unsatisfactory";
}

/** Middle score per role, from the scored rows only. */
export function roleMedians(rows: LeaderboardRow[]): Record<string, number | null> {
  const byRole: Record<string, number[]> = {};
  for (const r of rows) {
    if (r.score == null) continue;
    (byRole[r.role] ??= []).push(r.score);
  }
  const out: Record<string, number | null> = {};
  for (const r of rows) {
    const s = (byRole[r.role] ?? []).slice().sort((a, b) => a - b);
    if (s.length === 0) {
      out[r.role] = null;
      continue;
    }
    const mid = Math.floor(s.length / 2);
    out[r.role] = s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
  }
  return out;
}

/** Save rows as a CSV file the browser downloads. Opens cleanly in Excel. */
export function downloadCsv(filename: string, header: string[], rows: (string | number | null | undefined)[][]) {
  const cell = (v: string | number | null | undefined) => {
    const s = v == null ? "" : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const text = [header, ...rows].map((r) => r.map(cell).join(",")).join("\r\n");
  // The BOM makes Excel read names with accents correctly.
  const blob = new Blob(["﻿" + text], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
