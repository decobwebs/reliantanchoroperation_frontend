"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Settings2 } from "lucide-react";
import { toast } from "sonner";
import { api, getErrorMessage } from "@/lib/api";
import { ReasonGatedDialog } from "@/components/shared/ReasonGatedDialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Truck } from "@/types";

// Only these are set by hand. Assigned / In Transit / Discharging follow the
// truck's jobs, and the server refuses them here.
const MANUAL_STATUSES = [
  { value: "available", label: "Available (follows its jobs)" },
  { value: "maintenance", label: "Maintenance" },
  { value: "out_of_service", label: "Out of Service" },
];

const OWNERSHIP = [
  { value: "company", label: "Company-owned" },
  { value: "contractor", label: "Contractor" },
  { value: "unset", label: "Not set" },
];

/** Set a truck's hand-set status and who owns it. Every change needs a reason,
 *  recorded in the truck's audit trail. Mount it with a `key` that changes on
 *  each open so the form starts from the truck's current values. */
export function TruckSettingsDialog({
  truck,
  open,
  onOpenChange,
}: {
  truck: Truck;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const qc = useQueryClient();
  const manual = ["maintenance", "out_of_service"].includes(truck.status) ? truck.status : "available";
  const [status, setStatus] = useState(manual);
  const [ownership, setOwnership] = useState<string>(truck.ownership ?? "unset");
  const [reason, setReason] = useState("");

  const changed = status !== manual || ownership !== (truck.ownership ?? "unset");

  const save = useMutation({
    mutationFn: () =>
      api.put(`/trucks/${truck.id}`, {
        status,
        ownership: ownership === "unset" ? null : ownership,
        reason: reason.trim(),
      }),
    onSuccess: () => {
      toast.success("Truck updated");
      qc.invalidateQueries({ queryKey: ["truck-profile", truck.id] });
      qc.invalidateQueries({ queryKey: ["trucks"] });
      onOpenChange(false);
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  return (
    <ReasonGatedDialog
      open={open}
      onOpenChange={onOpenChange}
      title={`Truck settings — ${truck.truck_number}`}
      icon={Settings2}
      reason={reason}
      onReasonChange={setReason}
      confirmLabel="Save"
      pending={save.isPending}
      confirmDisabled={!changed}
      onConfirm={() => save.mutate()}
    >
      <div className="space-y-1.5">
        <Label>Status</Label>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            {MANUAL_STATUSES.map((s) => (
              <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-[11.5px] text-muted-foreground">
          Assigned, In Transit and Discharging update by themselves from the truck&apos;s jobs.
          A truck under Maintenance or Out of Service cannot be put on a job.
        </p>
      </div>
      <div className="space-y-1.5">
        <Label>Ownership</Label>
        <Select value={ownership} onValueChange={setOwnership}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            {OWNERSHIP.map((o) => (
              <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </ReasonGatedDialog>
  );
}
