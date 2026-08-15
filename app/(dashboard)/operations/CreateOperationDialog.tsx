"use client";

import { useCallback, useEffect } from "react";
import { useForm, useFieldArray, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQuery, useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Plus,
  Trash2,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { Spinner } from "@/components/ui/spinner";
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
import type { ApiResponse, User, Vessel, PFI, ProductType, OperationType, NavalClearance, VesselSourceType } from "@/types";
import { PRODUCT_TYPE_LABELS } from "@/types";
import { VESSEL_SOURCE_TYPE_LABELS } from "@/lib/utils";

// ─── Constants ───────────────────────────────────────────────────────────────

const ELIGIBLE_ROLES: Record<OperationType, string[]> = {
  truck_only:     ["ops_supervisor", "logistics_officer"],
  vessel_only:    ["ops_supervisor", "cargo_superintendent"],
  full_operation: ["ops_supervisor", "logistics_officer", "cargo_superintendent"],
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
  ops_supervisor:       "Ops Supervisor",
  logistics_officer:    "Logistics Officer",
  cargo_superintendent: "Marine Manager",
  finance_manager:      "Finance Manager",
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

const productSchema = z.object({
  product_type: z.string().min(1, "Select a product type"),
  quantity_mt:  z.number().positive("Must be positive"),
});

const pfiAllocationSchema = z.object({
  pfi_id:          z.string().min(1, "Select a PFI"),
  quantity_litres: z.number().positive("Must be positive"),
});

const schema = z.object({
  type:               z.enum(["full_operation", "vessel_only", "truck_only"]),
  // Vessel-only only — hard-required for that type, enforced via the submit
  // button's disabled state below (not Zod, matching the file's existing
  // pattern of business-logic requirements living in the submit gate).
  source_type:        z.enum(["truck", "terminal"]).optional(),
  products:            z.array(productSchema).min(1, "At least one product is required"),
  // Client and vessel are optional at creation — BM can come back and fill
  // them in later from the operation detail page.
  client_id:          z.string().optional(),
  vessel_id:          z.string().optional(),
  loading_location:   z.string().optional(),
  discharge_location: z.string().optional(),
  notes:              z.string().optional(),
  assignments:        z.array(assignmentSchema),
  pfi_allocations:    z.array(pfiAllocationSchema).optional(),
});

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
                  <Spinner size={12} />
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

// ─── Product row ──────────────────────────────────────────────────────────────

function ProductRow({
  index,
  onRemove,
  showRemove,
  register,
  setValue,
  watch,
  errors,
}: {
  index: number;
  onRemove: () => void;
  showRemove: boolean;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  register: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  setValue: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  watch: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  errors: any;
}) {
  const productType = watch(`products.${index}.product_type`);
  const rowErrors = errors?.products?.[index];

  return (
    <div className="rounded-lg border bg-muted/30 p-3 space-y-2.5">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
          Product {index + 1}
        </span>
        {showRemove && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-6 w-6 text-muted-foreground hover:text-destructive"
            onClick={onRemove}
          >
            <Trash2 className="w-3.5 h-3.5" />
          </Button>
        )}
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <Label className="text-xs">Product Type *</Label>
          <Select
            value={productType ?? ""}
            onValueChange={(v) => setValue(`products.${index}.product_type`, v)}
          >
            <SelectTrigger className="h-8 text-xs">
              <SelectValue placeholder="Select product…" />
            </SelectTrigger>
            <SelectContent>
              {PRODUCT_TYPES.map((pt) => (
                <SelectItem key={pt} value={pt} className="text-xs">
                  {PRODUCT_TYPE_LABELS[pt]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {rowErrors?.product_type && (
            <p className="text-[10px] text-destructive">{rowErrors.product_type.message}</p>
          )}
        </div>

        <div className="space-y-1">
          <Label className="text-xs">Quantity (L) *</Label>
          <Input
            type="number"
            step="0.001"
            className="h-8 text-xs"
            placeholder="e.g. 500"
            {...register(`products.${index}.quantity_mt`, {
              setValueAs: (v: string) =>
                v === "" || v === null || v === undefined ? undefined : Number(v),
            })}
          />
          {rowErrors?.quantity_mt && (
            <p className="text-[10px] text-destructive">{rowErrors.quantity_mt.message}</p>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── PFI allocation row ───────────────────────────────────────────────────────

function PfiAllocationRow({
  index,
  onRemove,
  unlinkedPfis,
  isPfisLoading,
  register,
  setValue,
  watch,
  errors,
}: {
  index: number;
  onRemove: () => void;
  unlinkedPfis: PFI[];
  isPfisLoading: boolean;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  register: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  setValue: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  watch: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  errors: any;
}) {
  const pfiId = watch(`pfi_allocations.${index}.pfi_id`);
  const rowErrors = errors?.pfi_allocations?.[index];
  const selectedPfi = unlinkedPfis.find((p) => p.id === pfiId);

  return (
    <div className="rounded-lg border bg-muted/30 p-3 space-y-2.5">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
          PFI {index + 1}
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

      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <Label className="text-xs">PFI *</Label>
          <Select
            value={pfiId ?? ""}
            onValueChange={(v) => setValue(`pfi_allocations.${index}.pfi_id`, v)}
          >
            <SelectTrigger className="h-8 text-xs">
              <SelectValue placeholder="Select PFI…" />
            </SelectTrigger>
            <SelectContent>
              {isPfisLoading ? (
                <div className="px-3 py-2 text-xs text-muted-foreground flex items-center gap-1.5">
                  <Spinner size={12} />
                  Loading PFIs…
                </div>
              ) : unlinkedPfis.length === 0 ? (
                <div className="px-3 py-2 text-xs text-muted-foreground">
                  No PFIs with remaining volume available
                </div>
              ) : (
                unlinkedPfis.map((p) => (
                  <SelectItem key={p.id} value={p.id} className="text-xs">
                    {p.pfi_number}
                    {p.remaining_litres != null
                      ? ` — ${parseFloat(p.remaining_litres).toLocaleString()} L left`
                      : ""}
                  </SelectItem>
                ))
              )}
            </SelectContent>
          </Select>
          {rowErrors?.pfi_id && (
            <p className="text-[10px] text-destructive">{rowErrors.pfi_id.message}</p>
          )}
        </div>

        <div className="space-y-1">
          <Label className="text-xs">Quantity (L) *</Label>
          <Input
            type="number"
            step="0.001"
            className="h-8 text-xs"
            placeholder="e.g. 5000"
            {...register(`pfi_allocations.${index}.quantity_litres`, {
              setValueAs: (v: string) =>
                v === "" || v === null || v === undefined ? undefined : Number(v),
            })}
          />
          {rowErrors?.quantity_litres && (
            <p className="text-[10px] text-destructive">{rowErrors.quantity_litres.message}</p>
          )}
          {selectedPfi?.remaining_litres != null && (
            <p className="text-[10px] text-muted-foreground">
              {parseFloat(selectedPfi.remaining_litres).toLocaleString()} L remaining
            </p>
          )}
        </div>
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
      type:            "full_operation",
      products:        [],
      assignments:     [],
      pfi_allocations: [],
    },
  });

  const { fields, append, remove } = useFieldArray({ control, name: "assignments" });
  const {
    fields: productFields,
    append: appendProduct,
    remove: removeProduct,
  } = useFieldArray({ control, name: "products" });
  const {
    fields: pfiAllocationFields,
    append: appendPfiAllocation,
    remove: removePfiAllocation,
  } = useFieldArray({ control, name: "pfi_allocations" });

  const opType = watch("type") as OperationType;
  const [navalClearanceIds, setNavalClearanceIds] = useState<string[]>([]);

  // Seed one empty product row when the dialog opens, so the form isn't
  // empty-by-default requiring an extra click.
  useEffect(() => {
    if (open && productFields.length === 0) {
      appendProduct({ product_type: "", quantity_mt: undefined as unknown as number });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Reset assignments when op type changes (roles may no longer be eligible)
  const prevType = watch("type");
  useEffect(() => {
    fields.forEach((_, i) => {
      setValue(`assignments.${i}.assigned_to`, "");
      setValue(`assignments.${i}.task_type`, "");
    });
    // Truck-only has no vessel — clear any previously chosen vessel so a stale
    // selection isn't submitted or shown after switching type. The Naval
    // Clearance picker is hidden for truck-only too, so a clearance picked
    // before switching would otherwise still get silently linked on submit.
    if (prevType === "truck_only") {
      setValue("vessel_id", "");
      setNavalClearanceIds([]);
    }
    // source_type only applies to vessel-only — clear it switching to any
    // other type so a stale value from an earlier vessel-only selection
    // can't get silently resubmitted (the backend rejects it outright).
    if (prevType !== "vessel_only") {
      setValue("source_type", undefined);
    }
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

  // ── Naval Clearances query (optional link — shown when not truck_only)
  const { data: navalClearances } = useQuery({
    queryKey: ["naval-clearances-picker"],
    queryFn: async () => {
      const res = await api.get<ApiResponse<NavalClearance[]>>("/naval-clearances");
      return (res.data.data ?? []).filter((nc) => nc.is_valid);
    },
    enabled: open && opType !== "truck_only",
  });

  // ── Unlinked PFIs query (source for the optional PFI-allocations picker)
  const { data: unlinkedPfis = [], isLoading: isPfisLoading } = useQuery({
    queryKey: ["pfis-unlinked"],
    queryFn: async () => {
      const res = await api.get<ApiResponse<PFI[]>>("/pfis", { params: { unlinked_only: true } });
      return res.data.data ?? [];
    },
    enabled: open,
  });

  const mutation = useMutation({
    mutationFn: async (data: FormData) => {
      const payload = {
        type:               data.type,
        source_type:        data.type === "vessel_only" ? data.source_type : undefined,
        products:           data.products,
        client_id:          data.client_id || undefined,
        vessel_id:          data.vessel_id || undefined,
        loading_location:   data.loading_location?.trim() || undefined,
        discharge_location: data.discharge_location?.trim() || undefined,
        notes:              data.notes?.trim() || undefined,
        assignments:        data.assignments.length > 0 ? data.assignments : undefined,
        pfi_allocations:    data.pfi_allocations?.length ? data.pfi_allocations : undefined,
      };
      const res = await api.post("/operations", payload);
      const operation = extractData<{ id: string }>(res);
      if (operation?.id) {
        for (const ncId of navalClearanceIds) {
          await api.post(`/operations/${operation.id}/link-naval-clearance`, { naval_clearance_id: ncId });
        }
      }
      return operation;
    },
    onSuccess: () => {
      toast.success("Operation created");
      reset();
      setNavalClearanceIds([]);
      onCreated();
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  const handleClose = useCallback(() => {
    reset();
    setNavalClearanceIds([]);
    onClose();
  }, [reset, onClose]);

  const addAssignment = () => {
    append({ assigned_to: "", task_type: "", priority: "normal", instructions: "" });
  };

  const addProduct = () => {
    appendProduct({ product_type: "", quantity_mt: undefined as unknown as number });
  };

  const addPfiAllocation = () => {
    appendPfiAllocation({ pfi_id: "", quantity_litres: undefined as unknown as number });
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

            {/* Source Type — vessel-only only, required, pure label (never pulls in truck UI) */}
            {opType === "vessel_only" && (
              <div className="space-y-1.5">
                <Label>Product Source <span className="text-destructive">*</span></Label>
                <Select
                  value={watch("source_type") ?? ""}
                  onValueChange={(v) => setValue("source_type", v as VesselSourceType)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select where the product comes from…" />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(VESSEL_SOURCE_TYPE_LABELS).map(([value, label]) => (
                      <SelectItem key={value} value={value}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-[11px] text-muted-foreground">
                  A label only — the vessel flow is identical either way.
                </p>
              </div>
            )}

            {/* Products */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label>Products <span className="text-destructive">*</span></Label>
                <Button type="button" variant="outline" size="sm" className="h-7 text-xs" onClick={addProduct}>
                  <Plus className="w-3.5 h-3.5 mr-1" />
                  Add Product
                </Button>
              </div>
              <div className="space-y-2.5">
                {productFields.map((field, i) => (
                  <ProductRow
                    key={field.id}
                    index={i}
                    showRemove={productFields.length > 1}
                    onRemove={() => removeProduct(i)}
                    register={register}
                    setValue={setValue}
                    watch={watch}
                    errors={errors}
                  />
                ))}
              </div>
              {errors.products?.message && (
                <p className="text-xs text-destructive">{errors.products.message}</p>
              )}
            </div>

            {/* Client */}
            <div className="space-y-1.5">
              <Label>
                Client
                <span className="ml-1 text-xs font-normal text-muted-foreground">(optional — can be set later)</span>
              </Label>
              <Select value={watch("client_id") ?? ""} onValueChange={(v) => setValue("client_id", v)}>
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
            </div>

            {/* Vessel (conditional) */}
            {needsVessel && (
              <div className="space-y-1.5">
                <Label>
                  Vessel
                  <span className="ml-1 text-xs font-normal text-muted-foreground">(optional — can be set later)</span>
                </Label>
                <Select value={watch("vessel_id") ?? ""} onValueChange={(v) => setValue("vessel_id", v)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select vessel…" />
                  </SelectTrigger>
                  <SelectContent>
                    {vessels?.map((v) => (
                      <SelectItem key={v.id} value={v.id}>
                        {v.vessel_name}
                        <span className="ml-1.5 text-xs text-muted-foreground">
                          · ROB: {parseFloat(v.current_rob_mt).toLocaleString()} L
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Naval Clearance (conditional, optional, never a gate) — an
                operation can hold more than one, so this picks and adds
                rather than replacing a single selection. */}
            {needsVessel && (
              <div className="space-y-1.5">
                <Label>
                  Naval Clearance
                  <span className="ml-1 text-xs font-normal text-muted-foreground">(optional — can be linked later, more than one allowed)</span>
                </Label>
                {navalClearanceIds.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mb-1.5">
                    {navalClearanceIds.map((ncId) => {
                      const nc = navalClearances?.find((n) => n.id === ncId);
                      return (
                        <span key={ncId} className="inline-flex items-center gap-1 rounded-full border bg-muted/40 px-2.5 py-1 text-xs">
                          {nc?.clearance_number ?? ncId.slice(0, 8)}
                          <button
                            type="button"
                            className="text-muted-foreground hover:text-destructive"
                            onClick={() => setNavalClearanceIds((ids) => ids.filter((id) => id !== ncId))}
                          >
                            ×
                          </button>
                        </span>
                      );
                    })}
                  </div>
                )}
                <Select
                  value=""
                  onValueChange={(v) => setNavalClearanceIds((ids) => (ids.includes(v) ? ids : [...ids, v]))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Add a Naval Clearance…" />
                  </SelectTrigger>
                  <SelectContent>
                    {navalClearances?.filter((nc) => !navalClearanceIds.includes(nc.id)).map((nc) => (
                      <SelectItem key={nc.id} value={nc.id}>
                        {nc.clearance_number}
                        <span className="ml-1.5 text-xs text-muted-foreground">
                          · {nc.products.join(", ")} · {parseFloat(nc.total_quantity_litres).toLocaleString()} L
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
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

          {/* ── Section 2b: PFI Allocations ──────────────────────────── */}
          <div className="space-y-3 border-t pt-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    PFI Allocations
                  </span>
                  <Badge variant="secondary" className="text-[10px] normal-case">optional</Badge>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Draw volume from existing PFIs now, or link them later.
                </p>
              </div>
              <Button type="button" variant="outline" size="sm" className="h-7 text-xs" onClick={addPfiAllocation}>
                <Plus className="w-3.5 h-3.5 mr-1" />
                Add PFI
              </Button>
            </div>

            {pfiAllocationFields.length === 0 ? (
              <div className="rounded-lg border border-dashed px-4 py-5 text-center text-xs text-muted-foreground">
                No PFIs linked yet — click &ldquo;Add PFI&rdquo; to allocate volume now,
                or do it later from the operation detail page.
              </div>
            ) : (
              <div className="space-y-2.5">
                {pfiAllocationFields.map((field, i) => (
                  <PfiAllocationRow
                    key={field.id}
                    index={i}
                    onRemove={() => removePfiAllocation(i)}
                    unlinkedPfis={unlinkedPfis}
                    isPfisLoading={isPfisLoading}
                    register={register}
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
            <Button
              type="submit"
              disabled={mutation.isPending || (opType === "vessel_only" && !watch("source_type"))}
            >
              {mutation.isPending && <Spinner size={16} className="mr-2" />}
              Create Operation
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
