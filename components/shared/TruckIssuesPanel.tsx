"use client";

import { useState } from "react";
import Link from "next/link";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, CheckCircle2, PlusCircle, Wrench } from "lucide-react";
import { toast } from "sonner";
import { api, getErrorMessage } from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";
import { PanelCard } from "@/components/dashboard/PanelCard";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { cn, formatDateTime } from "@/lib/utils";
import type { TruckIssue, TruckIssueSeverity } from "@/types";

const SEVERITY_STYLE: Record<TruckIssueSeverity, string> = {
  low: "border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-500/30 dark:bg-slate-500/15 dark:text-slate-300",
  medium: "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/15 dark:text-amber-300",
  high: "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/15 dark:text-rose-300",
};

const SEVERITY_LABEL: Record<TruckIssueSeverity, string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
};

export function TruckIssuesPanel({
  truckId,
  truckNumber,
  issues,
}: {
  truckId: string;
  truckNumber: string;
  issues: TruckIssue[];
}) {
  const qc = useQueryClient();
  const { effectiveRole } = useAuth();

  const canReport =
    effectiveRole === "bunker_manager" ||
    effectiveRole === "logistics_officer" ||
    effectiveRole === "ops_supervisor";
  const canResolve = effectiveRole === "bunker_manager";

  const [reportOpen, setReportOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [severity, setSeverity] = useState<TruckIssueSeverity>("medium");
  const [description, setDescription] = useState("");

  const [resolving, setResolving] = useState<TruckIssue | null>(null);
  const [resolutionNotes, setResolutionNotes] = useState("");

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["truck-profile", truckId] });
    qc.invalidateQueries({ queryKey: ["truck-issues", truckId] });
  };

  const reportMutation = useMutation({
    mutationFn: async () => {
      const res = await api.post(`/trucks/${truckId}/issues`, {
        title: title.trim(),
        severity,
        description: description.trim() || null,
      });
      return res.data;
    },
    onSuccess: () => {
      toast.success("Issue reported");
      setReportOpen(false);
      setTitle("");
      setSeverity("medium");
      setDescription("");
      refresh();
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  const resolveMutation = useMutation({
    mutationFn: async (issueId: string) => {
      const res = await api.post(`/truck-issues/${issueId}/resolve`, {
        resolution_notes: resolutionNotes.trim() || null,
      });
      return res.data;
    },
    onSuccess: () => {
      toast.success("Issue resolved");
      setResolving(null);
      setResolutionNotes("");
      refresh();
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  const open = issues.filter((i) => i.status === "open");
  const resolved = issues.filter((i) => i.status === "resolved");

  return (
    <>
      <PanelCard
        icon={Wrench}
        tone={open.length > 0 ? "amber" : "blue"}
        title={`Reported Issues (${issues.length})`}
        subtitle={
          open.length > 0
            ? `${open.length} still open on ${truckNumber}`
            : "No open issues on this truck"
        }
        action={
          canReport ? (
            <Button
              size="sm"
              variant="outline"
              className="h-8 rounded-lg text-xs font-semibold"
              onClick={() => setReportOpen(true)}
            >
              <PlusCircle className="h-3.5 w-3.5" />
              Report Issue
            </Button>
          ) : undefined
        }
        flush
      >
        {issues.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-16 text-center">
            <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-muted">
              <CheckCircle2 className="h-7 w-7 text-muted-foreground/40" />
            </span>
            <p className="text-sm font-medium text-foreground">No issues reported</p>
            <p className="text-xs text-muted-foreground">
              Problems noticed on this truck will be kept here.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-border/70">
            {[...open, ...resolved].map((issue) => (
              <div
                key={issue.id}
                className={cn(
                  "px-4 py-4 transition-colors hover:bg-muted/30 lg:px-5",
                  issue.status === "resolved" && "opacity-70"
                )}
              >
                <div className="mb-1.5 flex flex-wrap items-start justify-between gap-2">
                  <div className="flex min-w-0 items-center gap-2">
                    {issue.status === "open" ? (
                      <AlertTriangle className="h-4 w-4 shrink-0 text-amber-500" />
                    ) : (
                      <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" />
                    )}
                    <p className="text-[13.5px] font-semibold text-foreground">{issue.title}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <span
                      className={cn(
                        "rounded-full border px-2 py-0.5 text-[10px] font-semibold",
                        SEVERITY_STYLE[issue.severity]
                      )}
                    >
                      {SEVERITY_LABEL[issue.severity]}
                    </span>
                    <span
                      className={cn(
                        "rounded-full px-2.5 py-0.5 text-[11px] font-semibold capitalize",
                        issue.status === "open"
                          ? "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300"
                          : "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300"
                      )}
                    >
                      {issue.status}
                    </span>
                  </div>
                </div>

                {issue.description && (
                  <p className="mb-2 text-[12px] leading-relaxed text-muted-foreground">
                    {issue.description}
                  </p>
                )}

                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
                  <span>
                    Reported by{" "}
                    <span className="font-semibold text-foreground">
                      {issue.reported_by_name ?? "Unknown"}
                    </span>{" "}
                    · {formatDateTime(issue.created_at)}
                  </span>
                  {issue.operation_number && issue.operation_id && (
                    <Link
                      href={`/operations/${issue.operation_id}`}
                      className="font-mono font-semibold text-brand-600 hover:underline"
                    >
                      {issue.operation_number}
                    </Link>
                  )}
                  {issue.status === "open" && canResolve && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="ml-auto h-7 rounded-lg text-xs"
                      onClick={() => {
                        setResolving(issue);
                        setResolutionNotes("");
                      }}
                    >
                      <CheckCircle2 className="h-3 w-3" />
                      Mark Resolved
                    </Button>
                  )}
                </div>

                {issue.status === "resolved" && (
                  <p className="mt-2 rounded bg-emerald-50 px-2.5 py-1.5 text-[11px] text-emerald-800 dark:bg-emerald-500/10 dark:text-emerald-300">
                    Resolved by{" "}
                    <span className="font-semibold">{issue.resolved_by_name ?? "Unknown"}</span>
                    {issue.resolved_at && ` · ${formatDateTime(issue.resolved_at)}`}
                    {issue.resolution_notes && ` — ${issue.resolution_notes}`}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </PanelCard>

      {/* Report a new issue */}
      <Dialog open={reportOpen} onOpenChange={setReportOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Wrench className="h-4 w-4 text-amber-600" />
              Report an Issue
            </DialogTitle>
            <DialogDescription>
              Record a problem with {truckNumber}. It stays on the truck&apos;s profile for future
              reference.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="issue-title">What is the problem?</Label>
              <Input
                id="issue-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Faulty brake lights"
                maxLength={200}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="issue-severity">Severity</Label>
              <Select
                value={severity}
                onValueChange={(v) => setSeverity(v as TruckIssueSeverity)}
              >
                <SelectTrigger id="issue-severity">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low — note it, truck still usable</SelectItem>
                  <SelectItem value="medium">Medium — needs attention soon</SelectItem>
                  <SelectItem value="high">High — truck should not run</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="issue-description">Details (optional)</Label>
              <Textarea
                id="issue-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="What happened, where, and anything the next person should know…"
                rows={4}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setReportOpen(false)}>
              Cancel
            </Button>
            <Button
              disabled={!title.trim() || reportMutation.isPending}
              onClick={() => reportMutation.mutate()}
            >
              {reportMutation.isPending && <Spinner size={14} />}
              Report Issue
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Resolve an issue */}
      <Dialog open={resolving !== null} onOpenChange={(o) => !o && setResolving(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              Mark Resolved
            </DialogTitle>
            <DialogDescription>{resolving?.title}</DialogDescription>
          </DialogHeader>

          <div className="space-y-1.5">
            <Label htmlFor="resolution-notes">How was it resolved? (optional)</Label>
            <Textarea
              id="resolution-notes"
              value={resolutionNotes}
              onChange={(e) => setResolutionNotes(e.target.value)}
              placeholder="Brake lights replaced at the yard…"
              rows={3}
            />
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setResolving(null)}>
              Cancel
            </Button>
            <Button
              disabled={resolveMutation.isPending}
              onClick={() => resolving && resolveMutation.mutate(resolving.id)}
            >
              {resolveMutation.isPending && <Spinner size={14} />}
              Mark Resolved
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
