"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Ship, MapPin, Gauge, AlertTriangle, CheckCircle2, Anchor, Loader2, PlusCircle } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { api, getErrorMessage } from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn, formatNumber } from "@/lib/utils";
import type { ApiResponse, Vessel } from "@/types";

const STATUS_CONFIG: Record<string, { label: string; color: string; Icon: React.ElementType }> = {
  available:      { label: "Available",      color: "text-emerald-700 bg-emerald-50 border-emerald-200 dark:text-emerald-300 dark:bg-emerald-500/15 dark:border-emerald-500/30", Icon: CheckCircle2 },
  in_operation:   { label: "In Operation",    color: "text-brand-700   bg-brand-50   border-brand-200   dark:text-brand-300   dark:bg-brand-500/15   dark:border-brand-500/30",   Icon: Anchor },
  maintenance:    { label: "Maintenance",     color: "text-amber-700   bg-amber-50   border-amber-200   dark:text-amber-300   dark:bg-amber-500/15   dark:border-amber-500/30",   Icon: AlertTriangle },
  out_of_service: { label: "Out of Service",  color: "text-rose-700    bg-rose-50    border-rose-200    dark:text-rose-300    dark:bg-rose-500/15    dark:border-rose-500/30",    Icon: AlertTriangle },
};

const vesselSchema = z.object({
  vessel_name:      z.string().min(1, "Vessel name is required").trim(),
  imo_number:       z.string().optional(),
  vessel_type:      z.string().optional(),
  flag_state:       z.string().optional(),
  capacity_mt:      z.string().optional().refine(
    (v) => !v || (!isNaN(parseFloat(v)) && parseFloat(v) > 0),
    "Must be a positive number"
  ),
  rob_threshold_mt: z.string().optional().refine(
    (v) => !v || (!isNaN(parseFloat(v)) && parseFloat(v) >= 0),
    "Must be a non-negative number"
  ),
  current_location: z.string().optional(),
});
type VesselForm = z.infer<typeof vesselSchema>;

function CreateVesselDialog({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}) {
  const { register, handleSubmit, reset, formState: { errors } } =
    useForm<VesselForm>({ resolver: zodResolver(vesselSchema) });

  const mutation = useMutation({
    mutationFn: async (data: VesselForm) => {
      const res = await api.post("/vessels", {
        vessel_name:      data.vessel_name.trim(),
        imo_number:       data.imo_number?.trim() || undefined,
        vessel_type:      data.vessel_type?.trim() || undefined,
        flag_state:       data.flag_state?.trim() || undefined,
        capacity_mt:      data.capacity_mt ? parseFloat(data.capacity_mt) : undefined,
        rob_threshold_mt: data.rob_threshold_mt ? parseFloat(data.rob_threshold_mt) : undefined,
        current_location: data.current_location?.trim() || undefined,
      });
      return res.data;
    },
    onSuccess: () => {
      toast.success("Vessel registered successfully");
      reset();
      onCreated();
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) { reset(); onClose(); } }}>
      <DialogContent className="sm:max-w-lg" aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-[15px] font-bold tracking-tight">
            <Ship className="h-4 w-4 text-brand-600" strokeWidth={2.2} />
            Register New Vessel
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit((d) => mutation.mutate(d))} className="space-y-4 mt-2">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2 space-y-1.5">
              <Label>Vessel Name <span className="text-destructive">*</span></Label>
              <Input placeholder="e.g. MV Reliant Star" {...register("vessel_name")} />
              {errors.vessel_name && <p className="text-xs text-destructive">{errors.vessel_name.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label>IMO Number <span className="text-muted-foreground font-normal text-xs">(optional)</span></Label>
              <Input placeholder="e.g. 9876543" {...register("imo_number")} />
            </div>
            <div className="space-y-1.5">
              <Label>Vessel Type <span className="text-muted-foreground font-normal text-xs">(optional)</span></Label>
              <Input placeholder="e.g. Bunker Tanker" {...register("vessel_type")} />
            </div>
            <div className="space-y-1.5">
              <Label>Flag State <span className="text-muted-foreground font-normal text-xs">(optional)</span></Label>
              <Input placeholder="e.g. Nigeria" {...register("flag_state")} />
            </div>
            <div className="space-y-1.5">
              <Label>Current Location <span className="text-muted-foreground font-normal text-xs">(optional)</span></Label>
              <Input placeholder="e.g. Apapa Port" {...register("current_location")} />
            </div>
            <div className="space-y-1.5">
              <Label>Capacity (L) <span className="text-muted-foreground font-normal text-xs">(optional)</span></Label>
              <Input type="number" step="0.01" placeholder="e.g. 5000" {...register("capacity_mt")} />
              {errors.capacity_mt && <p className="text-xs text-destructive">{errors.capacity_mt.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label>ROB Threshold (L) <span className="text-muted-foreground font-normal text-xs">(optional)</span></Label>
              <Input type="number" step="0.01" placeholder="e.g. 500" {...register("rob_threshold_mt")} />
              {errors.rob_threshold_mt && <p className="text-xs text-destructive">{errors.rob_threshold_mt.message}</p>}
              <p className="text-[10px] text-muted-foreground">Alert when ROB drops below this value</p>
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="outline" onClick={() => { reset(); onClose(); }}>Cancel</Button>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending && <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />}
              Register Vessel
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default function VesselsPage() {
  const { effectiveRole } = useAuth();
  const qc = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const isBM = effectiveRole === "bunker_manager";

  const { data: vessels, isLoading } = useQuery({
    queryKey: ["vessels"],
    queryFn: async () => {
      const res = await api.get<ApiResponse<Vessel[]>>("/vessels");
      return res.data.data;
    },
  });

  return (
    <DashboardShell
      icon={Ship}
      iconTone="blue"
      showRole={false}
      title="Vessels"
      subtitle="Fleet vessel registry and status"
      actions={
        isBM ? (
          <Button
            className="h-10.5 gap-2 rounded-xl px-4 text-[13px] font-semibold"
            onClick={() => setShowCreate(true)}
          >
            <PlusCircle className="h-4 w-4" strokeWidth={2.5} />
            Add Vessel
          </Button>
        ) : undefined
      }
    >
      {isLoading ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {[...Array(3)].map((_, i) => (
            <Skeleton key={i} className="h-52 rounded-2xl" />
          ))}
        </div>
      ) : vessels?.length === 0 ? (
        <Card className="animate-rise rounded-2xl border border-navy-100 shadow-[0_1px_2px_rgb(16_36_71/0.04)] dark:border-border">
          <CardContent className="flex flex-col items-center py-20 text-center">
            <Ship className="h-10 w-10 text-muted-foreground/25" strokeWidth={1.5} />
            <p className="mt-3 text-sm font-medium text-foreground">No vessels in the fleet registry</p>
            {isBM && (
              <Button size="sm" variant="outline" className="mt-3 rounded-lg" onClick={() => setShowCreate(true)}>
                <PlusCircle className="h-4 w-4" strokeWidth={2.5} />
                Add First Vessel
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {vessels?.map((vessel) => {
            const cfg = STATUS_CONFIG[vessel.status] ?? {
              label: vessel.status,
              color: "text-muted-foreground bg-muted border-border",
              Icon: Ship,
            };
            const StatusIcon = cfg.Icon;
            const robPct = vessel.capacity_mt
              ? Math.min(
                  100,
                  Math.round(
                    (parseFloat(vessel.current_rob_mt) / parseFloat(vessel.capacity_mt)) * 100
                  )
                )
              : 0;
            const lowRob =
              vessel.rob_threshold_mt &&
              parseFloat(vessel.current_rob_mt) <= parseFloat(vessel.rob_threshold_mt);

            return (
              <Link key={vessel.id} href={`/fleet/vessels/${vessel.id}`} className="group block animate-rise">
                <Card className="rounded-2xl border border-navy-100 shadow-[0_1px_2px_rgb(16_36_71/0.04)] transition-shadow hover:shadow-[0_16px_34px_-20px_rgba(16,24,40,0.45)] dark:border-border">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2.5">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-50 dark:bg-brand-500/15">
                        <Ship className="h-4.5 w-4.5 text-brand-600 dark:text-brand-300" strokeWidth={2} />
                      </div>
                      <div>
                        <CardTitle className="text-[14px] font-bold tracking-tight">{vessel.vessel_name}</CardTitle>
                        <p className="font-mono text-[11px] text-muted-foreground">{vessel.imo_number}</p>
                      </div>
                    </div>
                    <span className={cn("inline-flex items-center gap-1 rounded-full border px-2 py-1 text-[10.5px] font-semibold", cfg.color)}>
                      <StatusIcon className="h-3 w-3" />
                      {cfg.label}
                    </span>
                  </div>
                </CardHeader>

                <CardContent className="space-y-3">
                  {vessel.current_location && (
                    <div className="flex items-center gap-2 text-[13px]">
                      <MapPin className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                      <span className="truncate text-muted-foreground">{vessel.current_location}</span>
                    </div>
                  )}

                  <div>
                    <div className="mb-1.5 flex items-center justify-between">
                      <div className="flex items-center gap-1.5 text-[12px] text-muted-foreground">
                        <Gauge className="h-3.5 w-3.5" />
                        <span>ROB</span>
                        {lowRob && (
                          <Badge variant="destructive" className="h-4 rounded-md px-1.5 py-0 text-[10px]">Low</Badge>
                        )}
                      </div>
                      <span className="text-[12.5px] font-semibold tabular-nums text-foreground">
                        {formatNumber(parseFloat(vessel.current_rob_mt))} L
                      </span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                      <div
                        className={cn(
                          "h-full rounded-full transition-all",
                          lowRob ? "bg-rose-500" : robPct > 50 ? "bg-emerald-500" : "bg-amber-500"
                        )}
                        style={{ width: `${robPct}%` }}
                      />
                    </div>
                    <div className="mt-1 flex justify-between">
                      <span className="text-[10.5px] tabular-nums text-muted-foreground">0</span>
                      <span className="text-[10.5px] tabular-nums text-muted-foreground">
                        Cap: {vessel.capacity_mt ? formatNumber(parseFloat(vessel.capacity_mt)) : "—"} L
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between border-t border-border/70 pt-2.5 text-[12px] text-muted-foreground">
                    <span>{vessel.vessel_type ?? "—"}</span>
                    {vessel.flag_state && (
                      <span className="flex items-center gap-1.5">
                        <span className="h-2 w-2 rounded-full bg-muted-foreground/30" />
                        {vessel.flag_state}
                      </span>
                    )}
                  </div>
                </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      )}

      {isBM && (
        <CreateVesselDialog
          open={showCreate}
          onClose={() => setShowCreate(false)}
          onCreated={() => {
            setShowCreate(false);
            qc.invalidateQueries({ queryKey: ["vessels"] });
          }}
        />
      )}
    </DashboardShell>
  );
}
