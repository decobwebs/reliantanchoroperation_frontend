"use client";

import { useState } from "react";
import { AlertTriangle, Search } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { AVAILABILITY_LABEL, availabilityOf, busyElsewhere, isUnfit } from "@/lib/trucks";
import type { Truck } from "@/types";

/**
 * Pick trucks from the fleet register for a job. Used by the readiness report
 * and by Create Operation, so both apply the same rule:
 *
 *  - Maintenance / Out of Service trucks are not offered.
 *  - A truck busy on another job IS offered, marked "On RA-…", because a
 *    truck often finishes early — management's call, 29 Oct 2026.
 *
 * The fleet runs to hundreds of plates, so search matches plate or driver,
 * ignoring case and spaces ("kna 84" finds KNA84XA). Ticked trucks stay on
 * top so a search never hides what has already been picked.
 */
export function TruckPicker({
  trucks,
  selectedIds,
  onToggle,
  operationId,
  className,
}: {
  trucks: Truck[];
  selectedIds: string[];
  onToggle: (id: string) => void;
  /** The job being picked for, so its own trucks are not flagged as busy. */
  operationId?: string;
  className?: string;
}) {
  const [search, setSearch] = useState("");
  const squash = (v: string) => v.toLowerCase().replace(/\s+/g, "");
  const needle = squash(search);

  const pickable = trucks.filter((t) => t.is_active !== false && !isUnfit(t));
  const shown = pickable
    .filter((t) => selectedIds.includes(t.id)
      || !needle
      || squash(t.truck_number).includes(needle)
      || squash(t.driver_name ?? "").includes(needle))
    .sort((a, b) => Number(selectedIds.includes(b.id)) - Number(selectedIds.includes(a.id)));
  const pickedBusy = pickable.filter((t) => selectedIds.includes(t.id) && busyElsewhere(t, operationId));

  return (
    <div className={cn("space-y-2", className)}>
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search plate number or driver…"
          className="pl-9"
          autoComplete="off"
        />
      </div>
      <div className="max-h-44 divide-y overflow-y-auto rounded-lg border">
        {shown.map((truck) => {
          const busy = busyElsewhere(truck, operationId);
          const now = availabilityOf(truck);
          return (
            <label key={truck.id} className="flex cursor-pointer items-center gap-3 px-4 py-2.5 hover:bg-muted/40">
              <Checkbox checked={selectedIds.includes(truck.id)} onCheckedChange={() => onToggle(truck.id)} />
              <div className="min-w-0 flex-1">
                <p className="font-mono text-sm font-medium">{truck.truck_number}</p>
                <p className="text-xs text-muted-foreground">
                  {parseFloat(truck.capacity_mt).toLocaleString()} L
                  {truck.driver_name ? ` · ${truck.driver_name}` : ""}
                </p>
              </div>
              {busy ? (
                <span className="flex shrink-0 items-center gap-1 text-xs font-medium text-amber-700 dark:text-amber-300">
                  <AlertTriangle className="h-3.5 w-3.5" />
                  On {truck.current_operation_number}
                </span>
              ) : (
                <span className="shrink-0 text-xs text-muted-foreground">{AVAILABILITY_LABEL[now] ?? now}</span>
              )}
            </label>
          );
        })}
        {pickable.length === 0 && (
          <p className="py-4 text-center text-sm text-muted-foreground">
            No trucks can be picked — every truck is under maintenance or out of service.
          </p>
        )}
        {pickable.length > 0 && shown.length === 0 && (
          <p className="py-4 text-center text-sm text-muted-foreground">No truck matches &ldquo;{search}&rdquo;.</p>
        )}
      </div>
      {selectedIds.length > 0 && (
        <p className="text-xs text-muted-foreground">
          {selectedIds.length} truck{selectedIds.length > 1 ? "s" : ""} selected
        </p>
      )}
      {pickedBusy.length > 0 && (
        <p className="flex items-start gap-1.5 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:bg-amber-500/10 dark:text-amber-200">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          {pickedBusy.map((t) => t.truck_number).join(", ")} {pickedBusy.length > 1 ? "are" : "is"} still on another job.
          Make sure {pickedBusy.length > 1 ? "they will" : "it will"} be free in time.
        </p>
      )}
    </div>
  );
}
