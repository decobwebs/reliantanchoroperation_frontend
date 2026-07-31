"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Users,
  UserPlus,
  Phone,
} from "lucide-react";
import { Spinner } from "@/components/ui/spinner";
import { toast } from "sonner";
import { api, getErrorMessage } from "@/lib/api";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { PanelCard } from "@/components/dashboard/PanelCard";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ROLE_LABELS } from "@/lib/auth";
import { cn, getInitials } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { QueryError } from "@/components/shared/QueryError";
import type { ApiResponse, User } from "@/types";

// One distinct colour per role, all drawn from the shared tones.ts palette —
// `slate` (added for this page) is the neutral sixth alongside the five
// meaning-carrying tones, since a role isn't inherently good/bad/pending.
const ROLE_COLOR: Record<string, string> = {
  bunker_manager:     "bg-navy-100 text-navy-800 dark:bg-navy-500/20 dark:text-navy-200",
  finance_manager:    "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300",
  ops_supervisor:     "bg-brand-100 text-brand-700 dark:bg-brand-500/15 dark:text-brand-300",
  logistics_officer:  "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300",
  marine_manager:     "bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300",
  client:             "bg-slate-100 text-slate-700 dark:bg-slate-500/15 dark:text-slate-300",
};

const STAFF_ROLES = [
  "bunker_manager",
  "finance_manager",
  "ops_supervisor",
  "logistics_officer",
  "marine_manager",
  "client",
] as const;

const createUserSchema = z.object({
  full_name: z.string().min(2, "Name must be at least 2 characters"),
  email: z.string().email("Invalid email"),
  role: z.enum(STAFF_ROLES),
});

type CreateUserForm = z.infer<typeof createUserSchema>;

function CreateUserDialog() {
  const [open, setOpen] = useState(false);
  const [phone, setPhone] = useState("");
  const qc = useQueryClient();
  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors },
  } = useForm<CreateUserForm>({
    resolver: zodResolver(createUserSchema),
    defaultValues: { role: "logistics_officer" },
  });

  const mutation = useMutation({
    mutationFn: async (data: CreateUserForm) => {
      const res = await api.post("/admin/users", {
        ...data,
        phone: phone.trim() || undefined,
      });
      return res.data;
    },
    onSuccess: (res) => {
      const emailSent = res?.data?.email_sent;
      if (emailSent === false) {
        toast.warning(
          "User created, but the password-setup email could not be sent. " +
          "Check email configuration and ask them to use “Forgot password” instead."
        );
      } else {
        toast.success("User created — a password-setup email has been sent");
      }
      qc.invalidateQueries({ queryKey: ["admin-users"] });
      reset();
      setPhone("");
      setOpen(false);
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <UserPlus className="w-4 h-4 mr-1.5" />
          New User
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md" aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-[15px] font-bold tracking-tight">
            <UserPlus className="h-4 w-4 text-brand-600" strokeWidth={2.2} />
            Create User Account
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit((d) => mutation.mutate(d))} className="space-y-4 mt-2">
          <div className="space-y-1.5">
            <Label htmlFor="full_name">Full Name</Label>
            <Input id="full_name" placeholder="John Smith" {...register("full_name")} />
            {errors.full_name && (
              <p className="text-xs text-destructive">{errors.full_name.message}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              placeholder="user@reliantanchor.dev"
              {...register("email")}
            />
            {errors.email && (
              <p className="text-xs text-destructive">{errors.email.message}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label>Role</Label>
            <Select
              value={watch("role")}
              onValueChange={(v) => setValue("role", v as CreateUserForm["role"])}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select role" />
              </SelectTrigger>
              <SelectContent>
                {STAFF_ROLES.map((r) => (
                  <SelectItem key={r} value={r}>
                    {ROLE_LABELS[r] ?? r}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.role && (
              <p className="text-xs text-destructive">{errors.role.message}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="phone">
              WhatsApp Phone{" "}
              <span className="text-muted-foreground font-normal">(optional)</span>
            </Label>
            <div className="relative">
              <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <Input
                id="phone"
                type="tel"
                placeholder="+2348012345678"
                className="pl-9"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
            </div>
            <p className="text-[11px] text-muted-foreground">
              Used for WhatsApp workflow notifications. User must first text the Twilio sandbox keyword.
            </p>
          </div>

          <div className="rounded-md border border-primary/20 bg-primary/5 px-3 py-2.5 text-[11px] text-muted-foreground">
            No password is set here. Once created, this person will receive an email
            with a secure link to choose their own password.
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending && <Spinner size={16} className="mr-1.5" />}
              Create User
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default function AdminPage() {
  const { user, effectiveRole } = useAuth();
  const isBM = effectiveRole === "bunker_manager";

  const { data: users, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["admin-users"],
    enabled: isBM,
    queryFn: async () => {
      const res = await api.get<ApiResponse<User[]>>("/admin/users?per_page=100");
      const d = res.data.data;
      return Array.isArray(d) ? d : (d as { items: User[] }).items ?? [];
    },
  });

  if (user && !isBM) {
    return (
      <DashboardShell icon={Users} iconTone="blue" showRole={false} title="User Management" subtitle="Restricted">
        <QueryError error={{ isAxiosError: true, response: { status: 403 } }} />
      </DashboardShell>
    );
  }

  return (
    <DashboardShell
      icon={Users}
      iconTone="blue"
      showRole={false}
      title="User Management"
      subtitle={`${users?.length ?? 0} users registered`}
      actions={<CreateUserDialog />}
    >
      {isError ? (
        <QueryError error={error} onRetry={() => refetch()} />
      ) : isLoading ? (
        <Skeleton className="h-96 w-full rounded-2xl" />
      ) : (
        <PanelCard icon={Users} tone="blue" title="Registry" flush className="animate-rise">
          {users?.length ? (
            <div className="divide-y divide-border/70">
              {users.map((u) => (
                <div key={u.id} className="flex items-center gap-4 px-4 py-4 lg:px-5">
                  <Avatar className="h-9 w-9 shrink-0">
                    <AvatarFallback className="bg-brand-50 text-xs font-semibold text-brand-700 dark:bg-brand-500/15 dark:text-brand-300">
                      {getInitials(u.full_name)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-semibold text-foreground">{u.full_name}</p>
                    <p className="truncate text-[12px] text-muted-foreground">{u.email}</p>
                  </div>

                  {u.phone ? (
                    <div className="hidden items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[11px] text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/15 dark:text-emerald-300 md:flex">
                      <Phone className="h-3 w-3" />
                      <span className="font-mono">{u.phone}</span>
                    </div>
                  ) : (
                    <span className="hidden text-[11px] italic text-muted-foreground/50 md:block">
                      No WhatsApp
                    </span>
                  )}

                  <span
                    className={cn("rounded-md px-2 py-0.5 text-[11px] font-semibold", ROLE_COLOR[u.role] ?? "bg-muted text-muted-foreground")}
                  >
                    {ROLE_LABELS[u.role] ?? u.role}
                  </span>
                  <Badge
                    variant={u.is_active ? "default" : "secondary"}
                    className="rounded-md text-[11px]"
                  >
                    {u.is_active ? "Active" : "Inactive"}
                  </Badge>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center py-16 text-center">
              <Users className="h-9 w-9 text-muted-foreground/25" strokeWidth={1.5} />
              <p className="mt-3 text-sm font-medium text-foreground">No users found</p>
            </div>
          )}
        </PanelCard>
      )}
    </DashboardShell>
  );
}
