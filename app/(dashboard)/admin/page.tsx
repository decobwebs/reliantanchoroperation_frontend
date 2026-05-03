"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Users, UserPlus, Loader2, Phone } from "lucide-react";
import { toast } from "sonner";
import { api, getErrorMessage } from "@/lib/api";
import { Header } from "@/components/layout/Header";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { getInitials } from "@/lib/utils";
import type { ApiResponse, User } from "@/types";

const ROLE_COLOR: Record<string, string> = {
  bunker_manager: "bg-primary/10 text-primary",
  finance_manager: "bg-emerald-100 text-emerald-700",
  ops_supervisor: "bg-blue-100 text-blue-700",
  logistics_officer: "bg-amber-100 text-amber-700",
  marine_manager: "bg-purple-100 text-purple-700",
  client: "bg-gray-100 text-gray-700",
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
  password: z.string().min(8, "Password must be at least 8 characters"),
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
    onSuccess: () => {
      toast.success("User created successfully");
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
          <DialogTitle>Create User Account</DialogTitle>
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

          <div className="space-y-1.5">
            <Label htmlFor="password">Temporary Password</Label>
            <Input
              id="password"
              type="password"
              placeholder="Min 8 characters"
              {...register("password")}
            />
            {errors.password && (
              <p className="text-xs text-destructive">{errors.password.message}</p>
            )}
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending && <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />}
              Create User
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default function AdminPage() {
  const { data: users, isLoading } = useQuery({
    queryKey: ["admin-users"],
    queryFn: async () => {
      const res = await api.get<ApiResponse<User[]>>("/admin/users?per_page=100");
      const d = res.data.data;
      return Array.isArray(d) ? d : (d as { items: User[] }).items ?? [];
    },
  });

  return (
    <div>
      <Header
        title="User Management"
        subtitle={`${users?.length ?? 0} users registered`}
        actions={<CreateUserDialog />}
      />
      <div className="p-6">
        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-7 h-7 animate-spin text-primary" />
          </div>
        ) : (
          <Card className="border-0 shadow-sm">
            <CardContent className="p-0">
              {users?.length ? (
                <div className="divide-y">
                  {users.map((u) => (
                    <div key={u.id} className="flex items-center gap-4 px-5 py-4">
                      <Avatar className="w-9 h-9 shrink-0">
                        <AvatarFallback className="text-xs bg-primary/10 text-primary font-semibold">
                          {getInitials(u.full_name)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{u.full_name}</p>
                        <p className="text-xs text-muted-foreground truncate">{u.email}</p>
                      </div>

                      {u.phone ? (
                        <div className="hidden md:flex items-center gap-1 text-xs text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                          <Phone className="w-3 h-3" />
                          <span className="font-mono">{u.phone}</span>
                        </div>
                      ) : (
                        <span className="hidden md:block text-xs text-muted-foreground/50 italic">
                          No WhatsApp
                        </span>
                      )}

                      <span
                        className={`text-xs font-medium px-2 py-0.5 rounded ${ROLE_COLOR[u.role] ?? "bg-gray-100"}`}
                      >
                        {ROLE_LABELS[u.role] ?? u.role}
                      </span>
                      <Badge
                        variant={u.is_active ? "default" : "secondary"}
                        className="text-xs"
                      >
                        {u.is_active ? "Active" : "Inactive"}
                      </Badge>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center py-16 text-muted-foreground">
                  <Users className="w-10 h-10 mb-3 opacity-30" />
                  <p className="text-sm">No users found</p>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
