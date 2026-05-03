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
import { Header } from "@/components/layout/Header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatNumber } from "@/lib/utils";
import type { ApiResponse, Vessel } from "@/types";

const STATUS_CONFIG: Record<string, { label: string; color: string; Icon: React.ElementType }> = {
  available:      { label: "Available",     color: "text-emerald-600 bg-emerald-50 border-emerald-200", Icon: CheckCircle2 },
  in_operation:   { label: "In Operation",  color: "text-blue-600   bg-blue-50   border-blue-200",    Icon: Anchor },
  maintenance:    { label: "Maintenance",   color: "text-amber-600  bg-amber-50  border-amber-200",   Icon: AlertTriangle },
  out_of_service: { label: "Out of Service",color: "text-red-600    bg-red-50    border-red-200",     Icon: AlertTriangle },
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
          <DialogTitle>Register New Vessel</DialogTitle>
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
              <Label>Capacity (MT) <span className="text-muted-foreground font-normal text-xs">(optional)</span></Label>
              <Input type="number" step="0.01" placeholder="e.g. 5000" {...register("capacity_mt")} />
              {errors.capacity_mt && <p className="text-xs text-destructive">{errors.capacity_mt.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label>ROB Threshold (MT) <span className="text-muted-foreground font-normal text-xs">(optional)</span></Label>
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
  const { user } = useAuth();
  const qc = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const isBM = user?.role === "bunker_manager";

  const { data: vessels, isLoading } = useQuery({
    queryKey: ["vessels"],
    queryFn: async () => {
      const res = await api.get<ApiResponse<Vessel[]>>("/vessels");
      return res.data.data;
    },
  });

  return (
    <div>
      <Header
        title="Vessels"
        subtitle="Fleet vessel registry and status"
        actions={
          isBM ? (
            <Button size="sm" onClick={() => setShowCreate(true)}>
              <PlusCircle className="w-4 h-4 mr-1.5" />
              Add Vessel
            </Button>
          ) : undefined
        }
      />

      <div className="p-6">
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-52 rounded-xl bg-muted animate-pulse" />
            ))}
          </div>
        ) : vessels?.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
            <Ship className="w-12 h-12 mb-3 opacity-30" />
            <p className="text-sm">No vessels in the fleet registry</p>
            {isBM && (
              <Button size="sm" variant="outline" className="mt-3" onClick={() => setShowCreate(true)}>
                <PlusCircle className="w-4 h-4 mr-1.5" />
                Add First Vessel
              </Button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
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
                <Link key={vessel.id} href={`/fleet/vessels/${vessel.id}`} className="block group">
                  <Card className="border-0 shadow-sm hover:shadow-md transition-shadow group-hover:border-primary/20">
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2.5">
                        <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                          <Ship className="w-4.5 h-4.5 text-primary" />
                        </div>
                        <div>
                          <CardTitle className="text-sm font-semibold">{vessel.vessel_name}</CardTitle>
                          <p className="text-[11px] text-muted-foreground font-mono">{vessel.imo_number}</p>
                        </div>
                      </div>
                      <span className={`inline-flex items-center gap-1 text-[11px] font-medium px-2 py-1 rounded-full border ${cfg.color}`}>
                        <StatusIcon className="w-3 h-3" />
                        {cfg.label}
                      </span>
                    </div>
                  </CardHeader>

                  <CardContent className="space-y-3">
                    {vessel.current_location && (
                      <div className="flex items-center gap-2 text-sm">
                        <MapPin className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                        <span className="text-muted-foreground truncate">{vessel.current_location}</span>
                      </div>
                    )}

                    <div>
                      <div className="flex justify-between items-center mb-1.5">
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                          <Gauge className="w-3.5 h-3.5" />
                          <span>ROB</span>
                          {lowRob && (
                            <Badge variant="destructive" className="text-[10px] px-1.5 py-0 h-4">Low</Badge>
                          )}
                        </div>
                        <span className="text-xs font-semibold tabular-nums">
                          {formatNumber(parseFloat(vessel.current_rob_mt))} MT
                        </span>
                      </div>
                      <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${
                            lowRob ? "bg-red-500" : robPct > 50 ? "bg-emerald-500" : "bg-amber-500"
                          }`}
                          style={{ width: `${robPct}%` }}
                        />
                      </div>
                      <div className="flex justify-between mt-1">
                        <span className="text-[10px] text-muted-foreground">0</span>
                        <span className="text-[10px] text-muted-foreground">
                          Cap: {vessel.capacity_mt ? formatNumber(parseFloat(vessel.capacity_mt)) : "—"} MT
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-1 border-t text-xs text-muted-foreground">
                      <span>{vessel.vessel_type ?? "—"}</span>
                      {vessel.flag_state && (
                        <span className="flex items-center gap-1">
                          <span className="w-2 h-2 rounded-full bg-muted-foreground/30" />
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
      </div>

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
    </div>
  );
}
