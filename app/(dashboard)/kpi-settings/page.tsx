"use client";

/**
 * KPI Settings — the Bunker Manager's control surface.
 *
 * Closes three gaps where the calculation existed but nothing could reach it:
 * editing targets, closing a month, and downloading the HR pack.
 *
 * The targets editor matters most. A core promise of this system is that
 * targets are *data the BM controls*, not numbers frozen into code — the job
 * documents disagree with each other, so someone has to be able to settle it
 * without a developer. Until this screen existed, that promise was not real.
 *
 * Every target change is reason-gated, matching the pattern used everywhere
 * else in RAOMS for corrective actions.
 */

import { useState } from "react";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  SlidersHorizontal, Lock, FileDown, RotateCcw, Pencil, AlertTriangle, Check,
} from "lucide-react";
import { api, getErrorMessage } from "@/lib/api";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { PanelCard } from "@/components/dashboard/PanelCard";
import { QueryError } from "@/components/shared/QueryError";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";
import type { ApiResponse } from "@/types";
import { num, periodOption, targetText, type KpiTarget } from "@/lib/kpi-admin";

const MIN_REASON = 10;

function TargetRow({ t, onEdit }: { t: KpiTarget; onEdit: (t: KpiTarget) => void }) {
  return (
    <div className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:gap-4">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="text-sm font-medium">{t.label}</span>
          {t.critical && (
            <span className="rounded-full bg-rose-500/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-rose-600">
              Critical
            </span>
          )}
          {t.is_overridden && (
            <span className="rounded-full bg-sky-500/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-sky-600">
              Changed
            </span>
          )}
        </div>
        <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{t.doc}</p>
        {t.is_overridden && t.override_reason && (
          <p className="mt-1 text-xs italic text-muted-foreground">
            “{t.override_reason}”
            {t.overridden_by ? ` — ${t.overridden_by}` : ""}
          </p>
        )}
      </div>

      <div className="flex shrink-0 items-baseline gap-4 sm:w-56 sm:justify-end">
        <div className="text-right">
          <p className="text-[10px] uppercase tracking-wide text-muted-foreground">In use</p>
          <p className="font-mono text-sm tabular-nums">
            {targetText({ target: t.effective_target, unit: t.unit, curve: t.curve })}
          </p>
        </div>
        {t.is_overridden && (
          <div className="text-right">
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Default</p>
            <p className="font-mono text-xs tabular-nums text-muted-foreground line-through">
              {targetText({ target: t.default_target, unit: t.unit, curve: t.curve })}
            </p>
          </div>
        )}
        <div className="text-right">
          <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Weight</p>
          <p className="font-mono text-sm tabular-nums">
            {num(t.weight * 100, { dp: 2 })}%
          </p>
        </div>
      </div>

      <Button
        variant="ghost"
        size="sm"
        onClick={() => onEdit(t)}
        className="shrink-0 self-start sm:self-auto"
      >
        <Pencil className="mr-1.5 h-3.5 w-3.5" />
        Change
      </Button>
    </div>
  );
}

export default function KpiSettingsPage() {
  const { user, effectiveRole } = useAuth();
  const canSee = user && effectiveRole ? effectiveRole === "bunker_manager" : true;
  const qc = useQueryClient();

  const [editing, setEditing] = useState<KpiTarget | null>(null);
  const [targetVal, setTargetVal] = useState("");
  const [failVal, setFailVal] = useState("");
  const [reason, setReason] = useState("");
  const [saveError, setSaveError] = useState<string | null>(null);

  const [closePeriod, setClosePeriod] = useState(periodOption(1).value);
  const [closeConfirm, setCloseConfirm] = useState(false);
  const [closeResult, setCloseResult] = useState<string | null>(null);

  const { data: targets, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["kpi-targets"],
    enabled: canSee,
    refetchOnWindowFocus: false,
    queryFn: async () => {
      // Returns a bare array, not an object with a `targets` key.
      const res = await api.get<ApiResponse<KpiTarget[]>>("/kpi/targets");
      return res.data.data ?? [];
    },
  });

  const saveTarget = useMutation({
    mutationFn: async () => {
      if (!editing) return;
      await api.put("/kpi/targets", {
        metric_key: editing.metric_key,
        target_value: targetVal === "" ? null : Number(targetVal),
        fail_value: failVal === "" ? null : Number(failVal),
        reason,
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["kpi-targets"] });
      setEditing(null);
      setSaveError(null);
    },
    onError: (e) => setSaveError(getErrorMessage(e)),
  });

  const closeMonth = useMutation({
    mutationFn: async () => {
      const res = await api.post<ApiResponse<{ subjects_written?: number }>>(
        `/kpi/snapshots/close?period=${closePeriod}`
      );
      return res.data.data;
    },
    onSuccess: (d) => {
      setCloseConfirm(false);
      setCloseResult(
        `${closePeriod} closed. ${d?.subjects_written ?? 0} staff scores frozen.`
      );
    },
    onError: (e) => {
      setCloseConfirm(false);
      setCloseResult(getErrorMessage(e));
    },
  });

  const openEdit = (t: KpiTarget) => {
    setEditing(t);
    setTargetVal(t.effective_target?.toString() ?? "");
    setFailVal(t.effective_fail?.toString() ?? "");
    setReason("");
    setSaveError(null);
  };

  const shell = {
    icon: SlidersHorizontal,
    iconTone: "violet" as const,
    showRole: false,
    title: "KPI Settings",
    subtitle: "Targets, month close, and the HR pack",
  };

  if (user && !canSee) {
    return (
      <DashboardShell {...shell} subtitle="Restricted">
        <QueryError error={{ isAxiosError: true, response: { status: 403 } }} />
      </DashboardShell>
    );
  }
  if (isError) {
    return (
      <DashboardShell {...shell}>
        <QueryError error={error} onRetry={() => refetch()} />
      </DashboardShell>
    );
  }

  // Group by role so the page reads the way the job documents do.
  const byRole = new Map<string, KpiTarget[]>();
  (targets ?? []).forEach((t) => {
    if (!byRole.has(t.role_label)) byRole.set(t.role_label, []);
    byRole.get(t.role_label)!.push(t);
  });

  const periods = [0, 1, 2, 3, 4, 5].map(periodOption);
  const reasonOk = reason.trim().length >= MIN_REASON;

  return (
    <DashboardShell {...shell}>
      {/* ── month close ── */}
      <PanelCard
        icon={Lock}
        tone="amber"
        title="Close a month"
        subtitle="Freezes every score for that month, permanently"
      >
        <div className="space-y-3">
          <p className="max-w-prose text-sm leading-relaxed text-muted-foreground">
            Closing a month writes each person&apos;s score into the record and locks
            it, so a later correction to an old record cannot quietly restate what
            somebody scored. Team trends on the Command Center appear once a month
            is closed.
          </p>
          <div className="flex items-start gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
            <p className="text-sm leading-snug text-amber-900 dark:text-amber-200">
              This records scored judgments about named staff and locks them. It is a
              management decision, not a routine action.
            </p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
            <div className="flex-1">
              <Label htmlFor="close-period" className="text-xs">Month</Label>
              <select
                id="close-period"
                value={closePeriod}
                onChange={(e) => { setClosePeriod(e.target.value); setCloseResult(null); }}
                className="mt-1 h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                {periods.map((p) => (
                  <option key={p.value} value={p.value}>{p.label}</option>
                ))}
              </select>
            </div>
            <Button
              onClick={() => setCloseConfirm(true)}
              disabled={closeMonth.isPending}
              className="shrink-0"
            >
              <Lock className="mr-1.5 h-4 w-4" />
              Close {closePeriod}
            </Button>
          </div>
          {closeResult && (
            <p className="flex items-start gap-2 text-sm text-muted-foreground">
              <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
              {closeResult}
            </p>
          )}
        </div>
      </PanelCard>

      {/* ── HR pack ── */}
      <PanelCard
        icon={FileDown}
        tone="emerald"
        title="HR grading pack"
        subtitle="Every staff member's scores and evidence for one month"
      >
        <div className="space-y-3">
          <p className="max-w-prose text-sm leading-relaxed text-muted-foreground">
            Your Operations Manager job document names HR as the grader. This pack
            gives them the figures and the evidence behind each one, so grading is
            done from records rather than memory. Opens as a page you can read and
            print; the raw data is available from there too.
          </p>
          <Button asChild className="w-full sm:w-auto">
            <Link href="/kpi-settings/hr-pack">
              <FileDown className="mr-1.5 h-4 w-4" />
              Open HR pack
            </Link>
          </Button>
        </div>
      </PanelCard>

      {/* ── targets ── */}
      {isLoading ? (
        <>
          <Skeleton className="h-64 rounded-2xl" />
          <Skeleton className="h-64 rounded-2xl" />
        </>
      ) : (
        Array.from(byRole.entries()).map(([roleLabel, rows]) => (
          <PanelCard
            key={roleLabel}
            icon={SlidersHorizontal}
            tone="blue"
            title={roleLabel}
            subtitle={`${rows.length} measures · weights total ${num(
              rows.reduce((s, r) => s + r.weight, 0) * 100,
              { dp: 0 }
            )}%`}
            flush
          >
            <div className="divide-y divide-border/60">
              {rows.map((t) => (
                <TargetRow key={t.metric_key} t={t} onEdit={openEdit} />
              ))}
            </div>
          </PanelCard>
        ))
      )}

      <p className="pt-1 text-xs leading-relaxed text-muted-foreground">
        Targets come from your own job documents. Where a document stated no target,
        a proposal was used and is marked in the guide. Changing a target here takes
        effect immediately and is recorded with your reason.
      </p>

      {/* ── edit dialog: reason-gated, matching the house pattern ── */}
      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing?.label}</DialogTitle>
            <DialogDescription className="text-xs leading-relaxed">
              {editing?.description}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="rounded-lg bg-muted/50 px-3 py-2 text-xs leading-relaxed text-muted-foreground">
              <strong>From your documents:</strong> {editing?.doc}
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <Label htmlFor="target" className="text-xs">
                  Target {editing?.unit ? `(${editing.unit})` : ""}
                </Label>
                <Input
                  id="target"
                  type="number"
                  step="any"
                  value={targetVal}
                  onChange={(e) => setTargetVal(e.target.value)}
                  className="mt-1"
                />
                <p className="mt-1 text-[11px] text-muted-foreground">
                  Default {editing?.default_target ?? "—"}
                </p>
              </div>
              <div>
                <Label htmlFor="fail" className="text-xs">Scores zero at</Label>
                <Input
                  id="fail"
                  type="number"
                  step="any"
                  value={failVal}
                  onChange={(e) => setFailVal(e.target.value)}
                  className="mt-1"
                />
                <p className="mt-1 text-[11px] text-muted-foreground">
                  Default {editing?.default_fail ?? "—"}
                </p>
              </div>
            </div>

            <div>
              <Label htmlFor="reason" className="text-xs">
                Why are you changing this? <span className="text-rose-500">*</span>
              </Label>
              <Textarea
                id="reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Recorded against this change and shown to anyone it affects."
                rows={3}
                className="mt-1"
              />
              <p
                className={cn(
                  "mt-1 text-[11px]",
                  reasonOk ? "text-muted-foreground" : "text-amber-600"
                )}
              >
                {reasonOk
                  ? "Recorded with your name and the time."
                  : `At least ${MIN_REASON} characters — ${reason.trim().length} so far.`}
              </p>
            </div>

            {saveError && (
              <p className="text-sm text-rose-600">{saveError}</p>
            )}
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            {editing?.is_overridden && (
              <Button
                variant="ghost"
                onClick={() => {
                  setTargetVal(editing.default_target?.toString() ?? "");
                  setFailVal(editing.default_fail?.toString() ?? "");
                }}
                className="mr-auto"
              >
                <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
                Restore default
              </Button>
            )}
            <Button variant="outline" onClick={() => setEditing(null)}>
              Cancel
            </Button>
            <Button
              onClick={() => saveTarget.mutate()}
              disabled={!reasonOk || saveTarget.isPending}
            >
              {saveTarget.isPending ? "Saving…" : "Save target"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── month close confirmation ── */}
      <Dialog open={closeConfirm} onOpenChange={setCloseConfirm}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Close {closePeriod}?</DialogTitle>
            <DialogDescription className="leading-relaxed">
              This freezes every staff score for that month. Once frozen, later
              corrections to old records will not change what anyone scored.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setCloseConfirm(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => closeMonth.mutate()}
              disabled={closeMonth.isPending}
            >
              {closeMonth.isPending ? "Closing…" : "Yes, close the month"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardShell>
  );
}
