"use client";

import { use } from "react";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Loader2,
  Truck,
  MapPin,
  User,
  Phone,
  BarChart3,
  Clock,
  Package,
  AlertTriangle,
} from "lucide-react";
import { api } from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";
import { Header } from "@/components/layout/Header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDate, formatDateTime } from "@/lib/utils";
import type { ApiResponse, TruckProfile } from "@/types";

const TRUCK_STATUS_VARIANT: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  available:   "default",
  assigned:    "secondary",
  in_transit:  "secondary",
  discharging: "secondary",
  maintenance: "destructive",
};

export default function TruckDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { user } = useAuth();
  const router  = useRouter();

  const isBM = user?.role === "bunker_manager";
  const isLO = user?.role === "logistics_officer";
  const isOS = user?.role === "ops_supervisor";

  const canView = isBM || isLO || isOS;

  const { data: profile, isLoading } = useQuery({
    queryKey: ["truck-profile", id],
    queryFn: async () => {
      const res = await api.get<ApiResponse<TruckProfile>>(`/trucks/${id}/profile`);
      return res.data.data;
    },
    enabled: canView,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-muted-foreground gap-2">
        <Truck className="w-10 h-10 opacity-30" />
        <p className="text-sm">Truck not found or no access.</p>
      </div>
    );
  }

  const { truck, stats, history } = profile;

  return (
    <div>
      <Header
        title={truck.truck_number}
        subtitle="Truck Profile"
        actions={
          <Button variant="outline" size="sm" onClick={() => router.back()}>
            <ArrowLeft className="w-4 h-4 mr-1.5" />
            Back
          </Button>
        }
      />

      <div className="p-4 md:p-6 space-y-6">

        {/* ── Top bar */}
        <div className="flex flex-wrap items-center gap-3">
          <Badge variant={TRUCK_STATUS_VARIANT[truck.status] ?? "outline"} className="text-sm px-3 py-1 capitalize">
            {truck.status.replace(/_/g, " ")}
          </Badge>
          {!truck.is_active && (
            <Badge variant="destructive" className="text-sm">Inactive</Badge>
          )}
          <span className="text-sm text-muted-foreground">
            Capacity: {parseFloat(truck.capacity_mt).toLocaleString()} MT
          </span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* ── Left: details + stats */}
          <div className="space-y-4">

            {/* Truck info */}
            <Card className="border-0 shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Truck className="w-4 h-4 text-primary" />
                  Truck Details
                </CardTitle>
              </CardHeader>
              <CardContent className="p-5 pt-0 space-y-3">
                <InfoRow icon={<Truck className="w-3.5 h-3.5" />} label="Truck No." value={truck.truck_number} mono />
                <InfoRow icon={<Package className="w-3.5 h-3.5" />} label="Capacity" value={`${parseFloat(truck.capacity_mt).toLocaleString()} MT`} />
                {truck.driver_name && (
                  <InfoRow icon={<User className="w-3.5 h-3.5" />} label="Driver" value={truck.driver_name} />
                )}
                {truck.driver_phone && (
                  <InfoRow icon={<Phone className="w-3.5 h-3.5" />} label="Phone" value={truck.driver_phone} />
                )}
                {truck.current_location && (
                  <InfoRow icon={<MapPin className="w-3.5 h-3.5" />} label="Location" value={truck.current_location} />
                )}
                <InfoRow icon={<Clock className="w-3.5 h-3.5" />} label="Registered" value={formatDate(truck.created_at)} />
                {truck.notes && (
                  <div className="pt-1 border-t">
                    <p className="text-xs text-muted-foreground italic">{truck.notes}</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Stats */}
            <Card className="border-0 shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <BarChart3 className="w-4 h-4 text-primary" />
                  Lifetime Stats
                </CardTitle>
              </CardHeader>
              <CardContent className="p-5 pt-0 grid grid-cols-2 gap-3">
                <StatBox label="Operations" value={String(stats.total_operations)} />
                <StatBox label="Loaded (MT)" value={parseFloat(stats.total_loaded_mt || "0").toLocaleString()} />
                <StatBox label="Discharged (MT)" value={parseFloat(stats.total_discharged_mt || "0").toLocaleString()} />
                <StatBox label="Variance (MT)" value={parseFloat(stats.total_variance_mt || "0").toLocaleString()} />
                {parseFloat(stats.total_spillage_mt || "0") > 0 && (
                  <StatBox
                    label="Spillage (MT)"
                    value={parseFloat(stats.total_spillage_mt).toLocaleString()}
                    warn
                  />
                )}
                {stats.efficiency_pct != null && (
                  <StatBox label="Efficiency" value={`${stats.efficiency_pct.toFixed(1)}%`} />
                )}
              </CardContent>
            </Card>
          </div>

          {/* ── Right: operation history */}
          <div className="lg:col-span-2">
            <Card className="border-0 shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Operation History ({history.length})</CardTitle>
              </CardHeader>
              <CardContent className="p-0 pb-2">
                {history.length === 0 ? (
                  <div className="flex flex-col items-center py-12 text-muted-foreground">
                    <Truck className="w-10 h-10 mb-3 opacity-30" />
                    <p className="text-sm">No operations on record yet</p>
                  </div>
                ) : (
                  <div className="divide-y">
                    {history.map((entry) => (
                      <div key={entry.id} className="px-5 py-3 space-y-1.5">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-sm font-mono font-semibold">{entry.operation_number}</p>
                            <p className="text-xs text-muted-foreground capitalize">
                              {entry.operation_type.replace(/_/g, " ")}
                              {entry.product_type ? ` · ${entry.product_type}` : ""}
                            </p>
                          </div>
                          <Badge
                            variant={entry.status === "completed" ? "default" : "secondary"}
                            className="text-xs capitalize shrink-0"
                          >
                            {entry.status}
                          </Badge>
                        </div>

                        <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-muted-foreground">
                          {entry.quantity_loaded_mt && (
                            <span>Loaded: {parseFloat(entry.quantity_loaded_mt).toLocaleString()} MT</span>
                          )}
                          {entry.quantity_discharged_mt && (
                            <span>Discharged: {parseFloat(entry.quantity_discharged_mt).toLocaleString()} MT</span>
                          )}
                          {entry.spillage_mt && parseFloat(entry.spillage_mt) > 0 && (
                            <span className="text-amber-600 flex items-center gap-0.5">
                              <AlertTriangle className="w-2.5 h-2.5" />
                              Spillage: {entry.spillage_mt} MT
                            </span>
                          )}
                          {entry.loading_location && <span>From: {entry.loading_location}</span>}
                          {entry.discharge_location && <span>To: {entry.discharge_location}</span>}
                          {entry.supervisor_name && (
                            <span>Supervisor: {entry.supervisor_name}</span>
                          )}
                        </div>

                        {entry.notes && (
                          <p className="text-xs text-muted-foreground italic">{entry.notes}</p>
                        )}

                        <p className="text-[10px] text-muted-foreground/60">
                          {formatDateTime(entry.created_at)}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Helper components ───────────────────────────────────────────────────────

function InfoRow({
  icon,
  label,
  value,
  mono = false,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="flex items-start gap-2">
      <span className="text-muted-foreground mt-0.5 shrink-0">{icon}</span>
      <div className="min-w-0">
        <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">{label}</p>
        <p className={`text-sm ${mono ? "font-mono font-semibold" : ""}`}>{value}</p>
      </div>
    </div>
  );
}

function StatBox({
  label,
  value,
  warn = false,
}: {
  label: string;
  value: string;
  warn?: boolean;
}) {
  return (
    <div className="rounded-md bg-muted/50 px-3 py-2.5">
      <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">{label}</p>
      <p className={`text-base font-semibold mt-0.5 ${warn ? "text-amber-600" : ""}`}>{value}</p>
    </div>
  );
}
