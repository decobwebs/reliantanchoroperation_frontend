"use client";

import { useMemo, useState, useRef } from "react";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Truck,
  PlusCircle,
  ChevronRight,
  ImagePlus,
  X,
  Search,
  Route,
  Wrench,
} from "lucide-react";
import { Spinner } from "@/components/ui/spinner";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { api, getErrorMessage } from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { PanelCard } from "@/components/dashboard/PanelCard";
import { StatCard } from "@/components/shared/StatCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import {
  AVAILABILITY_COLOR, AVAILABILITY_LABEL, AVAILABILITY_ORDER, OWNERSHIP_LABEL, availabilityOf,
} from "@/lib/trucks";
import type { ApiResponse, Truck as TruckType, TruckAvailability } from "@/types";

const truckSchema = z.object({
  truck_number:     z.string().min(1, "Truck number is required").trim(),
  capacity_mt:      z.string().min(1, "Capacity is required").refine((v) => !isNaN(parseFloat(v)) && parseFloat(v) > 0, "Must be a positive number"),
  ownership:        z.enum(["company", "contractor", "unset"]),
  chassis_number:   z.string().optional(),
  current_location: z.string().optional(),
  notes:            z.string().optional(),
});
type TruckForm = z.infer<typeof truckSchema>;

function CreateTruckDialog({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}) {
  const { register, handleSubmit, reset, watch, setValue, formState: { errors } } =
    useForm<TruckForm>({ resolver: zodResolver(truckSchema), defaultValues: { ownership: "unset" } });

  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [licenceFile, setLicenceFile] = useState<File | null>(null);
  const [calibrationFile, setCalibrationFile] = useState<File | null>(null);
  const licenceInputRef = useRef<HTMLInputElement>(null);
  const calibrationInputRef = useRef<HTMLInputElement>(null);

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPhotoFile(file);
    setPhotoPreview(URL.createObjectURL(file));
  };

  const clearPhoto = () => {
    setPhotoFile(null);
    setPhotoPreview(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleClose = () => {
    reset();
    clearPhoto();
    setLicenceFile(null);
    setCalibrationFile(null);
    if (licenceInputRef.current) licenceInputRef.current.value = "";
    if (calibrationInputRef.current) calibrationInputRef.current.value = "";
    onClose();
  };

  const mutation = useMutation({
    mutationFn: async (data: TruckForm) => {
      // Step 1: create the truck
      const res = await api.post<{ data: { id: string } }>("/trucks", {
        truck_number:     data.truck_number.trim(),
        capacity_mt:      parseFloat(data.capacity_mt),
        ownership:        data.ownership === "unset" ? undefined : data.ownership,
        chassis_number:   data.chassis_number?.trim() || undefined,
        current_location: data.current_location?.trim() || undefined,
        notes:            data.notes?.trim() || undefined,
      });
      const truckId = res.data.data.id;

      // Step 2: upload photo/documents if selected
      if (photoFile && truckId) {
        const form = new FormData();
        form.append("file", photoFile);
        await api.post(`/trucks/${truckId}/photo`, form, {
          headers: { "Content-Type": "multipart/form-data" },
        });
      }
      if (licenceFile && truckId) {
        const form = new FormData();
        form.append("file", licenceFile);
        await api.post(`/trucks/${truckId}/documents/licence`, form, {
          headers: { "Content-Type": "multipart/form-data" },
        });
      }
      if (calibrationFile && truckId) {
        const form = new FormData();
        form.append("file", calibrationFile);
        await api.post(`/trucks/${truckId}/documents/calibration_cert`, form, {
          headers: { "Content-Type": "multipart/form-data" },
        });
      }
    },
    onSuccess: () => {
      toast.success("Truck registered successfully");
      reset();
      clearPhoto();
      setLicenceFile(null);
      setCalibrationFile(null);
      onCreated();
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) handleClose(); }}>
      <DialogContent className="sm:max-w-md" aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-[15px] font-bold tracking-tight">
            <Truck className="h-4 w-4 text-brand-600" strokeWidth={2.2} />
            Register New Truck
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit((d) => mutation.mutate(d))} className="space-y-4 mt-2">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Truck Number <span className="text-destructive">*</span></Label>
              <Input placeholder="e.g. TRK-001" {...register("truck_number")} />
              {errors.truck_number && <p className="text-xs text-destructive">{errors.truck_number.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label>Capacity (L) <span className="text-destructive">*</span></Label>
              <Input type="number" step="0.01" placeholder="e.g. 40000" {...register("capacity_mt")} />
              {errors.capacity_mt && <p className="text-xs text-destructive">{errors.capacity_mt.message}</p>}
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Ownership</Label>
            <Select value={watch("ownership")} onValueChange={(v) => setValue("ownership", v as TruckForm["ownership"])}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="company">Company-owned</SelectItem>
                <SelectItem value="contractor">Contractor</SelectItem>
                <SelectItem value="unset">Not sure yet</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Chassis Number <span className="text-muted-foreground font-normal text-xs">(optional)</span></Label>
            <Input placeholder="e.g. WVW..." {...register("chassis_number")} />
          </div>
          <div className="space-y-1.5">
            <Label>Current Location <span className="text-muted-foreground font-normal text-xs">(optional)</span></Label>
            <Input placeholder="e.g. Lagos Depot" {...register("current_location")} />
          </div>
          <div className="space-y-1.5">
            <Label>Notes <span className="text-muted-foreground font-normal text-xs">(optional)</span></Label>
            <Textarea placeholder="Any additional notes..." className="resize-none" rows={2} {...register("notes")} />
          </div>

          {/* Photo upload */}
          <div className="space-y-1.5">
            <Label>Truck Photo <span className="text-muted-foreground font-normal text-xs">(optional)</span></Label>
            {photoPreview ? (
              <div className="relative w-full h-32 rounded-lg overflow-hidden border border-border">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={photoPreview} alt="Preview" className="w-full h-full object-cover" />
                <button
                  type="button"
                  onClick={clearPhoto}
                  className="absolute top-1.5 right-1.5 bg-black/60 rounded-full p-0.5 text-white hover:bg-black/80 transition-colors"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center gap-2 w-full rounded-lg border border-dashed border-border px-3 py-4 text-sm text-muted-foreground hover:border-primary hover:text-primary transition-colors"
              >
                <ImagePlus className="w-4 h-4" />
                Click to upload photo (JPEG, PNG, WebP)
              </button>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={handlePhotoChange}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Truck Licence (PDF) <span className="text-muted-foreground font-normal text-xs">(optional)</span></Label>
              <button
                type="button"
                onClick={() => licenceInputRef.current?.click()}
                className="flex items-center gap-2 w-full rounded-lg border border-dashed border-border px-3 py-2.5 text-xs text-muted-foreground hover:border-primary hover:text-primary transition-colors truncate"
              >
                {licenceFile ? licenceFile.name : "Click to upload PDF"}
              </button>
              <input
                ref={licenceInputRef}
                type="file"
                accept="application/pdf"
                className="hidden"
                onChange={(e) => setLicenceFile(e.target.files?.[0] ?? null)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Calibration Certificate (PDF) <span className="text-muted-foreground font-normal text-xs">(optional)</span></Label>
              <button
                type="button"
                onClick={() => calibrationInputRef.current?.click()}
                className="flex items-center gap-2 w-full rounded-lg border border-dashed border-border px-3 py-2.5 text-xs text-muted-foreground hover:border-primary hover:text-primary transition-colors truncate"
              >
                {calibrationFile ? calibrationFile.name : "Click to upload PDF"}
              </button>
              <input
                ref={calibrationInputRef}
                type="file"
                accept="application/pdf"
                className="hidden"
                onChange={(e) => setCalibrationFile(e.target.files?.[0] ?? null)}
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="outline" onClick={handleClose}>Cancel</Button>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending && <Spinner size={16} className="mr-1.5" />}
              Register Truck
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default function FleetPage() {
  const { effectiveRole } = useAuth();
  const qc = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const isBM = effectiveRole === "bunker_manager";

  const { data: trucks, isLoading } = useQuery({
    queryKey: ["trucks"],
    queryFn: async () => {
      const res = await api.get<ApiResponse<TruckType[]>>("/trucks?per_page=100");
      const d = res.data.data;
      return Array.isArray(d) ? d : (d as { items: TruckType[] }).items ?? [];
    },
  });

  const [filter, setFilter] = useState<TruckAvailability | "all">("all");
  const [owner, setOwner] = useState<"all" | "company" | "contractor" | "unset">("all");
  const [search, setSearch] = useState("");

  const counts = useMemo(() => {
    const c = Object.fromEntries(AVAILABILITY_ORDER.map((a) => [a, 0])) as Record<TruckAvailability, number>;
    for (const t of trucks ?? []) c[availabilityOf(t)] = (c[availabilityOf(t)] ?? 0) + 1;
    return c;
  }, [trucks]);
  const onJob = counts.assigned + counts.in_transit + counts.discharging;

  // Plate, driver or operation, ignoring case and spaces ("kna 84" finds KNA84XA).
  const squash = (v: string) => v.toLowerCase().replace(/\s+/g, "");
  const needle = squash(search);
  const shown = (trucks ?? []).filter((t) => {
    if (filter !== "all" && availabilityOf(t) !== filter) return false;
    if (owner !== "all" && (t.ownership ?? "unset") !== owner) return false;
    if (needle && !squash(t.truck_number).includes(needle) && !squash(t.driver_name ?? "").includes(needle)
        && !squash(t.current_operation_number ?? "").includes(needle)) return false;
    return true;
  });

  const chips: { key: TruckAvailability | "all"; label: string; n: number }[] = [
    { key: "all", label: "All", n: trucks?.length ?? 0 },
    ...AVAILABILITY_ORDER.map((a) => ({ key: a, label: AVAILABILITY_LABEL[a], n: counts[a] })),
  ];

  return (
    <DashboardShell
      icon={Truck}
      iconTone="blue"
      showRole={false}
      title="Fleet — Trucks"
      subtitle="Every company and contractor truck, and where each one is now"
      actions={
        isBM ? (
          <Button
            className="h-10.5 gap-2 rounded-xl px-4 text-[13px] font-semibold"
            onClick={() => setShowCreate(true)}
          >
            <PlusCircle className="h-4 w-4" strokeWidth={2.5} />
            Add Truck
          </Button>
        ) : undefined
      }
    >
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard title="Total Trucks" value={trucks?.length ?? 0} icon={Truck} color="blue" />
        <StatCard title="Available" value={counts.available} icon={Truck} color="emerald" />
        <StatCard
          title="On a Job"
          value={onJob}
          subtitle={`${counts.assigned} assigned · ${counts.in_transit} in transit · ${counts.discharging} discharging`}
          icon={Route}
          color="amber"
        />
        <StatCard title="Maintenance / Out" value={counts.maintenance + counts.out_of_service} icon={Wrench} color="red" />
      </div>

      {isLoading ? (
        <Skeleton className="h-96 w-full rounded-2xl" />
      ) : (
        <PanelCard icon={Truck} tone="blue" title="Registry" flush className="animate-rise">
          <div className="space-y-3 border-b border-border/70 px-4 py-3 lg:px-5">
            <div className="flex flex-wrap gap-1.5">
              {chips.map((c) => (
                <button
                  key={c.key}
                  type="button"
                  onClick={() => setFilter(c.key)}
                  className={cn(
                    "rounded-full border px-2.5 py-1 text-[11.5px] font-semibold transition-colors",
                    filter === c.key
                      ? "border-brand-600 bg-brand-600 text-white"
                      : "border-border text-muted-foreground hover:bg-muted/50",
                  )}
                >
                  {c.label} <span className="tabular-nums opacity-80">{c.n}</span>
                </button>
              ))}
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <div className="relative flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search plate, driver or operation…"
                  className="pl-9"
                />
              </div>
              <Select value={owner} onValueChange={(v) => setOwner(v as typeof owner)}>
                <SelectTrigger className="sm:w-48"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All owners</SelectItem>
                  <SelectItem value="company">Company-owned</SelectItem>
                  <SelectItem value="contractor">Contractor</SelectItem>
                  <SelectItem value="unset">Ownership not set</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <p className="text-[11.5px] text-muted-foreground">{shown.length} shown</p>
          </div>
          {shown.length ? (
            <div className="divide-y divide-border/70">
              {shown.map((truck) => {
                const now = availabilityOf(truck);
                return (
                  <Link
                    key={truck.id}
                    href={`/fleet/${truck.id}`}
                    className="group flex items-center justify-between px-4 py-4 transition-colors hover:bg-muted/40 lg:px-5"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="font-mono text-[14px] font-bold tracking-tight text-foreground">{truck.truck_number}</p>
                      <p className="mt-0.5 truncate text-[12.5px] text-muted-foreground">
                        <span className="tabular-nums">{parseFloat(truck.capacity_mt).toLocaleString()} L</span>
                        {truck.driver_name ? ` · ${truck.driver_name}` : ""}
                        {truck.current_location ? ` · ${truck.current_location}` : ""}
                      </p>
                      <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                        <span className={cn("rounded-full px-2 py-0.5 text-[10.5px] font-semibold", AVAILABILITY_COLOR[now] ?? "bg-muted text-muted-foreground")}>
                          {AVAILABILITY_LABEL[now] ?? now}
                        </span>
                        {truck.current_operation_number && (
                          <span className="rounded-full border border-border px-2 py-0.5 font-mono text-[10.5px] font-semibold text-foreground">
                            On {truck.current_operation_number}
                          </span>
                        )}
                        {truck.ownership && (
                          <span className="rounded-full bg-muted px-2 py-0.5 text-[10.5px] font-medium text-muted-foreground">
                            {OWNERSHIP_LABEL[truck.ownership]}
                          </span>
                        )}
                      </div>
                    </div>
                    <ChevronRight className="ml-3 h-4 w-4 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
                  </Link>
                );
              })}
            </div>
          ) : trucks?.length ? (
            <p className="py-12 text-center text-sm text-muted-foreground">No trucks match these filters.</p>
          ) : (
            <div className="flex flex-col items-center py-16 text-center">
              <Truck className="h-9 w-9 text-muted-foreground/25" strokeWidth={1.5} />
              <p className="mt-3 text-sm font-medium text-foreground">No trucks registered</p>
              {isBM && (
                <Button size="sm" variant="outline" className="mt-3 rounded-lg" onClick={() => setShowCreate(true)}>
                  <PlusCircle className="h-4 w-4" strokeWidth={2.5} />
                  Add First Truck
                </Button>
              )}
            </div>
          )}
        </PanelCard>
      )}

      {isBM && (
        <CreateTruckDialog
          open={showCreate}
          onClose={() => setShowCreate(false)}
          onCreated={() => {
            setShowCreate(false);
            qc.invalidateQueries({ queryKey: ["trucks"] });
          }}
        />
      )}
    </DashboardShell>
  );
}
