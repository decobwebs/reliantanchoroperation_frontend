"use client";

import { useCallback, useEffect } from "react";
import { useForm, useFieldArray, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQuery, useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2, Plus, Trash2, ChevronDown, ChevronUp } from "lucide-react";
import { api, getErrorMessage, extractData } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useState } from "react";
import type { ApiResponse, User, Vessel, ProductType, OperationType } from "@/types";
import { PRODUCT_TYPE_LABELS } from "@/types";

// ─── Constants ───────────────────────────────────────────────────────────────

const ELIGIBLE_ROLES: Record<OperationType, string[]> = {
  truck_only:     ["ops_supervisor", "logistics_officer"],
  vessel_only:    ["ops_supervisor", "marine_manager"],
  full_operation: ["ops_supervisor", "logistics_officer", "marine_manager"],
};

const ELIGIBLE_TASK_TYPES: Record<OperationType, { value: string; label: string }[]> = {
  truck_only: [
    { value: "truck_logistics", label: "Truck Logistics" },
  ],
  vessel_only: [
    { value: "vessel_operations", label: "Vessel Operations" },
    { value: "marine_discharge",  label: "Marine Discharge" },
  ],
  full_operation: [
    { value: "truck_logistics",   label: "Truck Logistics" },
    { value: "vessel_operations", label: "Vessel Operations" },
    { value: "marine_discharge",  label: "Marine Discharge" },
  ],
};

const ROLE_LABELS: Record<string, string> = {
  ops_supervisor:    "Ops Supervisor",
  logistics_officer: "Logistics Officer",
  marine_manager:    "Marine Manager",
  finance_manager:   "Finance Manager",
};

const PRIORITY_OPTIONS = [
  { value: "low",    label: "Low" },
  { value: "normal", label: "Normal" },
  { value: "high",   label: "High" },
  { value: "urgent", label: "Urgent" },
];

const PRODUCT_TYPES = Object.keys(PRODUCT_TYPE_LABELS) as ProductType[];

// ─── Schema ──────────────────────────────────────────────────────────────────

const assignmentSchema = z.object({
  assigned_to:  z.string().min(1, "Select a person"),
  task_type:    z.string().min(1, "Select task type"),
  priority:     z.string().min(1),
  instructions: z.string().optional(),
});

const schema = z
  .object({
    type:               z.enum(["full_operation", "vessel_only", "truck_only"]),
    product_type:       z.string().min(1, "Select a product type"),
    client_id:          z.string().min(1, "Select a client"),
    vessel_id:          z.string().optional(),
    loading_location:   z.string().optional(),
    discharge_location: z.string().optional(),
    expected_volume_mt: z.number().positive("Must be positive").optional(),
    currency:           z.string().min(3).max(3),
    notes:              z.string().optional(),
    assignments:        z.array(assignmentSchema),
  })
  .refine(
    (d) => {
      if (d.type !== "truck_only" && !d.vessel_id) return false;
      return true;
    },
    { message: "Vessel is required for this operation type", path: ["vessel_id"] }
  );

type FormData = z.infer<typeof schema>;

// ─── Props ───────────────────────────────────────────────────────────────────

interface Props {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}

// ─── Row-level role filter state ─────────────────────────────────────────────

function AssignmentRow({
  index,
  opType,
  staffUsers,
  isStaffLoading,
  onRemove,
  control,
  setValue,
  watch,
  errors,
}: {
  index: number;
  opType: OperationType;
  staffUsers: User[];
  isStaffLoading: boolean;
  onRemove: () => void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  control: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  setValue: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  watch: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  errors: any;
}) {
  const [roleFilter, setRoleFilter] = useState<string>("");
  const [showInstructions, setShowInstructions] = useState(false);

  const eligibleRoles = ELIGIBLE_ROLES[opType] ?? [];
  const eligibleTaskTypes = ELIGIBLE_TASK_TYPES[opType] ?? [];

  const filteredStaff = roleFilter
    ? staffUsers.filter((u) => u.role === roleFilter)
    : staffUsers.filter((u) => eligibleRoles.includes(u.role));

  const assignedTo = watch(`assignments.${index}.assigned_to`);
  const taskType   = watch(`assignments.${index}.task_type`);
  const priority   = watch(`assignments.${index}.priority`);

  const rowErrors = errors?.assignments?.[index];

  return (
    <div className="rounded-lg border bg-muted/30 p-3 space-y-2.5">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
          Assignment {index + 1}
        </span>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-6 w-6 text-muted-foreground hover:text-destructive"
          onClick={onRemove}
        >
          <Trash2 className="w-3.5 h-3.5" />
        </Button>
      </div>

      {/* Role filter + Person */}
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <Label className="text-xs">Filter by Role</Label>
          <Select
            value={roleFilter || "__all__"}
            onValueChange={(v) => {
              const next = v === "__all__" ? "" : v;
              setRoleFilter(next);
              setValue(`assignments.${index}.assigned_to`, "");
            }}
          >
            <SelectTrigger className="h-8 text-xs">
              <SelectValue placeholder="All roles" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">All eligible roles</SelectItem>
              {eligibleRoles.map((r) => (
                <SelectItem key={r} value={r}>{ROLE_LABELS[r] ?? r}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1">
          <Label className="text-xs">Person *</Label>
          <Select value={assignedTo} onValueChange={(v) => setValue(`assignments.${index}.assigned_to`, v)}>
            <SelectTrigger className="h-8 text-xs">
              <SelectValue placeholder="Select person…" />
            </SelectTrigger>
            <SelectContent>
              {isStaffLoading ? (
                <div className="px-3 py-2 text-xs text-muted-foreground flex items-center gap-1.5">
                  <Loader2 className="w-3 h-3 animate-spin" />
                  Loading staff…
                </div>
              ) : filteredStaff.length === 0 ? (
                <div className="px-3 py-2 text-xs text-muted-foreground">
                  No staff found for this role
                </div>
              ) : (
                filteredStaff.map((u) => (
                  <SelectItem key={u.id} value={u.id}>
                    <span className="font-medium">{u.full_name}</span>
                    <span className="ml-1.5 text-xs text-muted-foreground">
                      ({ROLE_LABELS[u.role] ?? u.role})
                    </span>
                  </SelectItem>
                ))
              )}
            </SelectContent>
          </Select>
          {rowErrors?.assigned_to && (
            <p className="text-[10px] text-destructive">{rowErrors.assigned_to.message}</p>
          )}
        </div>
      </div>

      {/* Task Type + Priority */}
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <Label className="text-xs">Task Type *</Label>
          <Select value={taskType} onValueChange={(v) => setValue(`assignments.${index}.task_type`, v)}>
            <SelectTrigger className="h-8 text-xs">
              <SelectValue placeholder="Select type…" />
            </SelectTrigger>
            <SelectContent>
              {eligibleTaskTypes.map((t) => (
                <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {rowErrors?.task_type && (
            <p className="text-[10px] text-destructive">{rowErrors.task_type.message}</p>
          )}
        </div>

        <div className="space-y-1">
          <Label className="text-xs">Priority</Label>
          <Select value={priority ?? "normal"} onValueChange={(v) => setValue(`assignments.${index}.priority`, v)}>
            <SelectTrigger className="h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PRIORITY_OPTIONS.map((p) => (
                <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Instructions toggle */}
      <div>
        <button
          type="button"
          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
          onClick={() => setShowInstructions((v) => !v)}
        >
          {showInstructions ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          {showInstructions ? "Hide instructions" : "Add instructions (optional)"}
        </button>
        {showInstructions && (
          <Controller
            control={control}
            name={`assignments.${index}.instructions`}
            render={({ field }) => (
              <Textarea
                {...field}
                placeholder="Specific instructions for this assignment…"
                rows={2}
                className="resize-none mt-1.5 text-xs"
              />
            )}
          />
        )}
      </div>
    </div>
  );
}

// ─── Main Dialog ─────────────────────────────────────────────────────────────

export function CreateOperationDialog({ open, onClose, onCreated }: Props) {
  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    control,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      type:        "full_operation",
      currency:    "USD",
      assignments: [],
    },
  });

  const { fields, append, remove } = useFieldArray({ control, name: "assignments" });

  const opType = watch("type") as OperationType;

  // Reset assignments when op type changes (roles may no longer be eligible)
  const prevType = watch("type");
  useEffect(() => {
    fields.forEach((_, i) => {
      setValue(`assignments.${i}.assigned_to`, "");
      setValue(`assignments.${i}.task_type`, "");
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prevType]);

  // ── Clients query
  const { data: clients } = useQuery({
    queryKey: ["users-clients"],
    queryFn: async () => {
      const res = await api.get<ApiResponse<User[]>>("/admin/users?role=client&per_page=100");
      const d = res.data.data;
      return Array.isArray(d) ? d : (d as unknown as { items: User[] }).items ?? [];
    },
    enabled: open,
  });

  // ── Staff users query (non-client, active)
  const { data: staffUsers = [], isLoading: isStaffLoading } = useQuery({
    queryKey: ["staff-users-all"],
    queryFn: async () => {
      const res = await api.get("/admin/users?per_page=100&is_active=true");
      const d = res.data?.data;
      const raw: User[] = Array.isArray(d) ? d : Array.isArray(d?.items) ? d.items : [];
      return raw.filter((u: User) => u.is_active && u.role !== "client");
    },
    enabled: open,
    staleTime: 0,
  });

  // ── Vessels query (shown when not truck_only)
  const { data: vessels } = useQuery({
    queryKey: ["vessels-list"],
    queryFn: async () => {
      const res = await api.get<ApiResponse<{ items: Vessel[] }>>("/vessels?per_page=100");
      const d = res.data.data;
      return Array.isArray(d) ? d : (d as { items: Vessel[] }).items ?? [];
    },
    enabled: open && opType !== "truck_only",
  });

  const mutation = useMutation({
    mutationFn: async (data: FormData) => {
      const payload = {
        type:               data.type,
        product_type:       data.product_type,
        client_id:          data.client_id,
        vessel_id:          data.vessel_id || undefined,
        loading_location:   data.loading_location?.trim() || undefined,
        discharge_location: data.discharge_location?.trim() || undefined,
        expected_volume_mt: data.expected_volume_mt,
        currency:           data.currency,
        notes:              data.notes?.trim() || undefined,
        assignments:        data.assignments.length > 0 ? data.assignments : undefined,
      };
      const res = await api.post("/operations", payload);
      return extractData(res);
    },
    onSuccess: () => {
      toast.success("Operation created");
      reset();
      onCreated();
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  const handleClose = useCallback(() => {
    reset();
    onClose();
  }, [reset, onClose]);

  const addAssignment = () => {
    append({ assigned_to: "", task_type: "", priority: "normal", instructions: "" });
  };

  const needsVessel = opType !== "truck_only";

  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto" aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle>Create New Operation</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit((d) => mutation.mutate(d))} className="space-y-5">

          {/* ── Section 1: Operation Details ────────────────────────── */}
          <div className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Operation Details
            </p>

            {/* Type */}
            <div className="space-y-1.5">
              <Label>Operation Type</Label>
              <Select
                defaultValue="full_operation"
                onValueChange={(v) => setValue("type", v as OperationType)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="full_operation">Full Operation (Trucks + Vessel)</SelectItem>
                  <SelectItem value="vessel_only">Vessel Only</SelectItem>
                  <SelectItem value="truck_only">Truck Only</SelectItem>
                </SelectContent>
              </Select>
              {errors.type && <p className="text-xs text-destructive">{errors.type.message}</p>}
            </div>

            {/* Product Type */}
            <div className="space-y-1.5">
              <Label>Product Type <span className="text-destructive">*</span></Label>
              <Select onValueChange={(v) => setValue("product_type", v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select product…" />
                </SelectTrigger>
                <SelectContent>
                  {PRODUCT_TYPES.map((pt) => (
                    <SelectItem key={pt} value={pt}>
                      {PRODUCT_TYPE_LABELS[pt]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.product_type && (
                <p className="text-xs text-destructive">{errors.product_type.message}</p>
              )}
            </div>

            {/* Client */}
            <div className="space-y-1.5">
              <Label>Client <span className="text-destructive">*</span></Label>
              <Select onValueChange={(v) => setValue("client_id", v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select client…" />
                </SelectTrigger>
                <SelectContent>
                  {clients?.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.full_name}
                      <span className="ml-1.5 text-xs text-muted-foreground">({c.email})</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.client_id && (
                <p className="text-xs text-destructive">{errors.client_id.message}</p>
              )}
            </div>

            {/* Vessel (conditional) */}
            {needsVessel && (
              <div className="space-y-1.5">
                <Label>
                  Vessel <span className="text-destructive">*</span>
                  <span className="ml-1 text-xs font-normal text-muted-foreground">
                    (required for {opType === "vessel_only" ? "Vessel Only" : "Full Operation"})
                  </span>
                </Label>
                <Select onValueChange={(v) => setValue("vessel_id", v)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select vessel…" />
                  </SelectTrigger>
                  <SelectContent>
                    {vessels?.map((v) => (
                      <SelectItem key={v.id} value={v.id}>
                        {v.vessel_name}
                        <span className="ml-1.5 text-xs text-muted-foreground">
                          · ROB: {parseFloat(v.current_rob_mt).toLocaleString()} MT
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.vessel_id && (
                  <p className="text-xs text-destructive">{errors.vessel_id.message}</p>
                )}
              </div>
            )}

            {/* Loading + Discharge locations */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>
                  {opType === "vessel_only" ? "Collection Point" : "Loading Location"}
                  <span className="ml-1 text-xs font-normal text-muted-foreground">(optional)</span>
                </Label>
                <Input
                  placeholder={opType === "vessel_only" ? "e.g. Apapa Terminal" : "e.g. NNPC Depot, Apapa"}
                  {...register("loading_location")}
                />
              </div>
              <div className="space-y-1.5">
                <Label>
                  Discharge Location
                  <span className="ml-1 text-xs font-normal text-muted-foreground">(optional)</span>
                </Label>
                <Input
                  placeholder="e.g. Lekki Tank Farm"
                  {...register("discharge_location")}
                />
              </div>
            </div>

            {/* Volume + Currency */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Expected Volume (MT)</Label>
                <Input
                  type="number"
                  step="0.001"
                  placeholder="e.g. 500"
                  {...register("expected_volume_mt", { valueAsNumber: true })}
                />
                {errors.expected_volume_mt && (
                  <p className="text-xs text-destructive">{errors.expected_volume_mt.message}</p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label>Currency</Label>
                <Select defaultValue="USD" onValueChange={(v) => setValue("currency", v)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="USD">USD</SelectItem>
                    <SelectItem value="NGN">NGN</SelectItem>
                    <SelectItem value="EUR">EUR</SelectItem>
                    <SelectItem value="GBP">GBP</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* ── Section 2: Staff Assignments ─────────────────────────── */}
          <div className="space-y-3 border-t pt-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Staff Assignments
                  </span>
                  <Badge variant="secondary" className="text-[10px] normal-case">optional</Badge>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Assign staff now to auto-advance the operation on creation.
                </p>
              </div>
              <Button type="button" variant="outline" size="sm" className="h-7 text-xs" onClick={addAssignment}>
                <Plus className="w-3.5 h-3.5 mr-1" />
                Add
              </Button>
            </div>

            {fields.length === 0 ? (
              <div className="rounded-lg border border-dashed px-4 py-5 text-center text-xs text-muted-foreground">
                No assignments yet — click &ldquo;Add&rdquo; to assign staff now,
                or do it later from the operation detail page.
              </div>
            ) : (
              <div className="space-y-2.5">
                {fields.map((field, i) => (
                  <AssignmentRow
                    key={field.id}
                    index={i}
                    opType={opType}
                    staffUsers={staffUsers}
                    isStaffLoading={isStaffLoading}
                    onRemove={() => remove(i)}
                    control={control}
                    setValue={setValue}
                    watch={watch}
                    errors={errors}
                  />
                ))}
              </div>
            )}
          </div>

          {/* ── Section 3: Notes ──────────────────────────────────────── */}
          <div className="space-y-1.5 border-t pt-4">
            <Label>Notes <span className="text-muted-foreground font-normal">(optional)</span></Label>
            <Textarea
              placeholder="Any operational notes or context…"
              rows={2}
              className="resize-none"
              {...register("notes")}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={handleClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Create Operation
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
