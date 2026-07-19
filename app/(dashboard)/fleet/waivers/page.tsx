"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2, PlusCircle, FileWarning } from "lucide-react";
import { toast } from "sonner";
import { api, getErrorMessage } from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";
import { Header } from "@/components/layout/Header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { formatDateTime } from "@/lib/utils";
import type { ApiResponse, TruckWaiver } from "@/types";

export default function WaiversPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const canAdd = user?.role === "ops_supervisor";
  const [bulkText, setBulkText] = useState("");

  const { data: waivers, isLoading } = useQuery({
    queryKey: ["truck-waivers"],
    queryFn: async () => {
      const res = await api.get<ApiResponse<TruckWaiver[]>>("/trucks/waivers");
      return res.data.data ?? [];
    },
  });

  const available = waivers?.filter((w) => w.status === "available").length ?? 0;
  const linked = waivers?.filter((w) => w.status === "linked").length ?? 0;

  const bulkAddMutation = useMutation({
    mutationFn: async () => {
      const numbers = bulkText
        .split(/[\n,]/)
        .map((n) => n.trim())
        .filter(Boolean);
      const res = await api.post<ApiResponse<{ created: string[]; skipped_duplicates: string[] }>>(
        "/trucks/waivers/bulk",
        { waybill_truck_numbers: numbers },
      );
      return res.data.data;
    },
    onSuccess: (data) => {
      toast.success(
        `${data.created.length} waiver number(s) added` +
          (data.skipped_duplicates.length ? `, ${data.skipped_duplicates.length} duplicate(s) skipped` : ""),
      );
      setBulkText("");
      qc.invalidateQueries({ queryKey: ["truck-waivers"] });
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  return (
    <div>
      <Header title="Waiver Numbers" subtitle="Regulatory / BFL truck numbers — added in bulk before sourcing starts" />

      <div className="p-4 md:p-6 space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Card className="border-0 shadow-sm">
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">Available</p>
              <p className="text-2xl font-bold text-emerald-700">{available}</p>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-sm">
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">Linked to a truck</p>
              <p className="text-2xl font-bold">{linked}</p>
            </CardContent>
          </Card>
        </div>

        {canAdd && (
          <Card className="border-0 shadow-sm">
            <CardContent className="p-4 space-y-3">
              <p className="text-sm font-semibold">Add waiver numbers in bulk</p>
              <p className="text-xs text-muted-foreground">
                Paste one number per line (or comma-separated) — e.g. 25 at a time. Duplicates are skipped automatically.
              </p>
              <Textarea
                rows={6}
                className="resize-none font-mono text-xs"
                placeholder={"MKA 442 ZD\nABJ 690 XB\nABC 245 XC\n…"}
                value={bulkText}
                onChange={(e) => setBulkText(e.target.value)}
              />
              <div className="flex justify-end">
                <Button
                  size="sm"
                  className="gap-1.5"
                  disabled={!bulkText.trim() || bulkAddMutation.isPending}
                  onClick={() => bulkAddMutation.mutate()}
                >
                  {bulkAddMutation.isPending
                    ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    : <PlusCircle className="w-3.5 h-3.5" />}
                  Add Numbers
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        <Card className="border-0 shadow-sm">
          <CardContent className="p-0">
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-7 h-7 animate-spin text-primary" />
              </div>
            ) : waivers?.length ? (
              <div className="divide-y">
                {waivers.map((w) => (
                  <div key={w.id} className="flex items-center justify-between px-5 py-3 text-sm">
                    <span className="font-mono font-semibold">{w.waybill_truck_number}</span>
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-muted-foreground">{formatDateTime(w.created_at)}</span>
                      <Badge
                        variant="outline"
                        className={w.status === "available"
                          ? "border-emerald-300 text-emerald-700 bg-emerald-50"
                          : "border-muted text-muted-foreground"}
                      >
                        {w.status}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center py-12 text-muted-foreground gap-1">
                <FileWarning className="w-7 h-7 mb-1 opacity-25" />
                <p className="text-sm font-medium">No waiver numbers yet</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
