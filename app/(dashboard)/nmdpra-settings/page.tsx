"use client";

import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { FileSpreadsheet, Save } from "lucide-react";
import { api, getErrorMessage } from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { PanelCard } from "@/components/dashboard/PanelCard";
import { QueryError } from "@/components/shared/QueryError";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import type { ApiResponse } from "@/types";

/** One of the twelve columns that reads the same on every row of the sheet. */
interface SettingField {
  key: string;
  col: string;
  label: string;
  hint: string;
}

/**
 * The NMDPRA operation sheet repeats twelve values on every single row —
 * company name, MDOGISP, facility licences and so on. They are typed here
 * once instead of on every export, and the field list comes from the server
 * so the columns can never drift apart from the file it builds.
 */
export default function NmdpraSettingsPage() {
  const { user, effectiveRole } = useAuth();
  const isBM = (effectiveRole ?? user?.role) === "bunker_manager";
  // Only what has been typed this visit. Anything untouched reads straight
  // from the server, so a save elsewhere is never overwritten by a stale copy
  // held in this component.
  const [edits, setEdits] = useState<Record<string, string>>({});

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["nmdpra-settings"],
    queryFn: async () => {
      const res = await api.get<ApiResponse<{ fields: SettingField[]; values: Record<string, string> }>>(
        "/nmdpra/settings"
      );
      return res.data.data;
    },
    enabled: isBM,
  });

  const save = useMutation({
    mutationFn: async () => {
      await api.put("/nmdpra/settings", { values: { ...(data?.values ?? {}), ...edits } });
    },
    onSuccess: () => {
      toast.success("Saved — every operation sheet will use these values");
      setEdits({});
      refetch();
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  if (user && !isBM) {
    return (
      <DashboardShell icon={FileSpreadsheet} iconTone="blue" showRole={false} title="Operation Sheet" subtitle="Restricted">
        <QueryError error={{ isAxiosError: true, response: { status: 403 } }} />
      </DashboardShell>
    );
  }

  const fields = data?.fields ?? [];
  const valueOf = (key: string) => edits[key] ?? data?.values?.[key] ?? "";
  const filled = fields.filter((f) => valueOf(f.key).trim() !== "").length;
  const dirty = Object.keys(edits).length > 0;

  return (
    <DashboardShell
      icon={FileSpreadsheet}
      iconTone="blue"
      showRole={false}
      title="Operation Sheet Settings"
      subtitle={
        fields.length
          ? `${filled} of ${fields.length} filled in · used on every operation's NMDPRA sheet`
          : "Values repeated on every row of the NMDPRA sheet"
      }
    >
      {isError ? (
        <QueryError error={error} onRetry={() => refetch()} />
      ) : isLoading ? (
        <Skeleton className="h-96 w-full rounded-2xl" />
      ) : (
        <PanelCard icon={FileSpreadsheet} tone="blue" title="Same on every row" className="animate-rise">
          <p className="mb-4 max-w-3xl text-[13px] text-muted-foreground">
            These twelve columns carry the same value on every truck row of the
            regulator&apos;s sheet. Fill them in once here and every operation&apos;s
            download uses them. Anything left blank simply comes out as an empty
            cell — nothing is invented.
          </p>

          <div className="grid gap-x-5 gap-y-4 sm:grid-cols-2">
            {fields.map((f) => (
              <div key={f.key} className="min-w-0 space-y-1.5">
                <Label className="flex items-baseline gap-2 text-xs">
                  <span className="font-semibold">{f.label}</span>
                  <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
                    column {f.col}
                  </span>
                </Label>
                <Input
                  className="h-9 text-sm"
                  value={valueOf(f.key)}
                  placeholder={f.hint}
                  onChange={(e) => setEdits((v) => ({ ...v, [f.key]: e.target.value }))}
                />
              </div>
            ))}
          </div>

          <div className="mt-6 flex items-center gap-3">
            <Button disabled={!dirty || save.isPending} onClick={() => save.mutate()}>
              {save.isPending ? <Spinner size={14} className="mr-1.5" /> : <Save className="mr-1.5 h-4 w-4" />}
              Save
            </Button>
            {dirty && <span className="text-[12px] text-muted-foreground">Unsaved changes</span>}
          </div>
        </PanelCard>
      )}
    </DashboardShell>
  );
}
