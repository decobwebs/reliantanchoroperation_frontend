"use client";

import { useState, useRef } from "react";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Truck, Loader2, PlusCircle, ChevronRight, ImagePlus, X } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { api, getErrorMessage } from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";
import { Header } from "@/components/layout/Header";
import { Card, CardContent } from "@/components/ui/card";
import { StatCard } from "@/components/shared/StatCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { ApiResponse, Truck as TruckType } from "@/types";

const STATUS_COLOR: Record<string, string> = {
  available:      "bg-emerald-100 text-emerald-700",
  assigned:       "bg-blue-100 text-blue-700",
  in_transit:     "bg-amber-100 text-amber-700",
  discharging:    "bg-purple-100 text-purple-700",
  maintenance:    "bg-orange-100 text-orange-700",
  out_of_service: "bg-red-100 text-red-700",
};

const truckSchema = z.object({
  truck_number:     z.string().min(1, "Truck number is required").trim(),
  capacity_mt:      z.string().min(1, "Capacity is required").refine((v) => !isNaN(parseFloat(v)) && parseFloat(v) > 0, "Must be a positive number"),
  driver_name:      z.string().optional(),
  driver_phone:     z.string().optional(),
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
  const { register, handleSubmit, reset, formState: { errors } } =
    useForm<TruckForm>({ resolver: zodResolver(truckSchema) });

  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
    onClose();
  };

  const mutation = useMutation({
    mutationFn: async (data: TruckForm) => {
      // Step 1: create the truck
      const res = await api.post<{ data: { id: string } }>("/trucks", {
        truck_number:     data.truck_number.trim(),
        capacity_mt:      parseFloat(data.capacity_mt),
        driver_name:      data.driver_name?.trim() || undefined,
        driver_phone:     data.driver_phone?.trim() || undefined,
        current_location: data.current_location?.trim() || undefined,
        notes:            data.notes?.trim() || undefined,
      });
      const truckId = res.data.data.id;

      // Step 2: upload photo if one was selected
      if (photoFile && truckId) {
        const form = new FormData();
        form.append("file", photoFile);
        await api.post(`/trucks/${truckId}/photo`, form, {
          headers: { "Content-Type": "multipart/form-data" },
        });
      }
    },
    onSuccess: () => {
      toast.success("Truck registered successfully");
      reset();
      clearPhoto();
      onCreated();
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) handleClose(); }}>
      <DialogContent className="sm:max-w-md" aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle>Register New Truck</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit((d) => mutation.mutate(d))} className="space-y-4 mt-2">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Truck Number <span className="text-destructive">*</span></Label>
              <Input placeholder="e.g. TRK-001" {...register("truck_number")} />
              {errors.truck_number && <p className="text-xs text-destructive">{errors.truck_number.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label>Capacity (MT) <span className="text-destructive">*</span></Label>
              <Input type="number" step="0.01" placeholder="e.g. 30" {...register("capacity_mt")} />
              {errors.capacity_mt && <p className="text-xs text-destructive">{errors.capacity_mt.message}</p>}
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Driver Name <span className="text-muted-foreground font-normal text-xs">(optional)</span></Label>
              <Input placeholder="Full name" {...register("driver_name")} />
            </div>
            <div className="space-y-1.5">
              <Label>Driver Phone <span className="text-muted-foreground font-normal text-xs">(optional)</span></Label>
              <Input placeholder="+234..." {...register("driver_phone")} />
            </div>
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

          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="outline" onClick={handleClose}>Cancel</Button>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending && <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />}
              Register Truck
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default function FleetPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const isBM = user?.role === "bunker_manager";

  const { data: trucks, isLoading } = useQuery({
    queryKey: ["trucks"],
    queryFn: async () => {
      const res = await api.get<ApiResponse<TruckType[]>>("/trucks?per_page=100");
      const d = res.data.data;
      return Array.isArray(d) ? d : (d as { items: TruckType[] }).items ?? [];
    },
  });

  const available = trucks?.filter((t) => t.status === "available").length ?? 0;
  const assigned  = trucks?.filter((t) => t.status === "assigned").length ?? 0;

  return (
    <div>
      <Header
        title="Fleet — Trucks"
        subtitle="Manage truck fleet"
        actions={
          isBM ? (
            <Button size="sm" onClick={() => setShowCreate(true)}>
              <PlusCircle className="w-4 h-4 mr-1.5" />
              Add Truck
            </Button>
          ) : undefined
        }
      />

      <div className="p-4 md:p-6 space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <StatCard title="Total Trucks" value={trucks?.length ?? 0} icon={Truck} color="blue" />
          <StatCard title="Available" value={available} icon={Truck} color="emerald" />
          <StatCard title="Assigned" value={assigned} icon={Truck} color="amber" />
        </div>

        <Card className="border-0 shadow-sm">
          <CardContent className="p-0">
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-7 h-7 animate-spin text-primary" />
              </div>
            ) : trucks?.length ? (
              <div className="divide-y">
                {trucks.map((truck) => (
                  <Link
                    key={truck.id}
                    href={`/fleet/${truck.id}`}
                    className="flex items-center justify-between px-5 py-4 hover:bg-muted/30 transition-colors group"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-bold font-mono tracking-tight">{truck.truck_number}</p>
                      <p className="text-xs text-muted-foreground mt-0.5 truncate">
                        {parseFloat(truck.capacity_mt).toLocaleString()} MT
                        {truck.driver_name ? ` · ${truck.driver_name}` : ""}
                        {truck.current_location ? ` · ${truck.current_location}` : ""}
                      </p>
                      <span
                        className={`inline-block mt-1.5 text-[11px] font-medium px-2 py-0.5 rounded-full capitalize ${
                          STATUS_COLOR[truck.status] ?? "bg-gray-100 text-gray-700"
                        }`}
                      >
                        {truck.status.replace(/_/g, " ")}
                      </span>
                    </div>
                    <ChevronRight className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0 ml-3" />
                  </Link>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center py-16 text-muted-foreground">
                <Truck className="w-10 h-10 mb-3 opacity-30" />
                <p className="text-sm">No trucks registered</p>
                {isBM && (
                  <Button size="sm" variant="outline" className="mt-3" onClick={() => setShowCreate(true)}>
                    <PlusCircle className="w-4 h-4 mr-1.5" />
                    Add First Truck
                  </Button>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

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
    </div>
  );
}
