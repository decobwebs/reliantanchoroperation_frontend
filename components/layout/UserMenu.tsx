"use client";

import { useState } from "react";
import Link from "next/link";
import { Bell, Check, ChevronDown, LogOut, UserCog } from "lucide-react";
import { cn, getInitials } from "@/lib/utils";
import { ROLE_LABELS } from "@/lib/auth";
import { useAuth } from "@/hooks/useAuth";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

// The 4 roles a Bunker Manager may temporarily act as.
const ACT_AS_ROLES: { value: string; label: string }[] = [
  { value: "ops_supervisor", label: "Ops Supervisor" },
  { value: "logistics_officer", label: "Logistics Officer" },
  { value: "marine_manager", label: "Marine Manager" },
  { value: "finance_manager", label: "Finance Manager" },
];

/**
 * Identity chip + account menu. Owns the act-as switcher (previously in the
 * sidebar) so every page that renders a header exposes it in one consistent
 * place.
 */
export function UserMenu({ className }: { className?: string }) {
  const { user, logout, effectiveRole, isActingAs, actAs, clearActAs } = useAuth();
  const [switching, setSwitching] = useState(false);

  if (!user) return null;

  // The switcher must stay reachable by the real BM even while acting as
  // another role — so this checks the real role, not effectiveRole.
  const isRealBM = user.role === "bunker_manager";
  const shownRole = ROLE_LABELS[effectiveRole ?? ""] ?? effectiveRole ?? "";

  const run = async (fn: () => Promise<void>) => {
    try {
      setSwitching(true);
      await fn();
    } finally {
      setSwitching(false);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className={cn(
          "flex items-center gap-2.5 rounded-full py-1 pl-1 pr-2.5 transition-colors",
          "hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          "focus-visible:ring-offset-2 disabled:opacity-60",
          className
        )}
        disabled={switching}
        aria-label="Account menu"
      >
        <Avatar className="h-9 w-9 shrink-0">
          <AvatarFallback
            className={cn(
              "text-xs font-semibold text-white",
              isActingAs
                ? "bg-[linear-gradient(140deg,var(--color-amber-600)_0%,var(--color-amber-700)_100%)]"
                : "brand-grad-mark"
            )}
          >
            {getInitials(user.full_name)}
          </AvatarFallback>
        </Avatar>
        <span className="hidden min-w-0 text-left sm:block">
          <span className="block max-w-[9rem] truncate text-[13px] font-semibold leading-tight text-foreground">
            {user.full_name}
          </span>
          <span
            className={cn(
              "block max-w-[9rem] truncate text-[11px] leading-tight",
              isActingAs ? "text-amber-600" : "text-muted-foreground"
            )}
          >
            {isActingAs ? `Acting as ${shownRole}` : shownRole}
          </span>
        </span>
        <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel className="pb-1">
          <span className="block truncate text-sm font-semibold">{user.full_name}</span>
          <span className="block truncate text-xs font-normal text-muted-foreground">
            {user.email}
          </span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />

        <DropdownMenuItem asChild className="text-xs">
          <Link href="/notifications">
            <Bell className="mr-2 h-3.5 w-3.5" />
            Notifications
          </Link>
        </DropdownMenuItem>

        {isRealBM && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuLabel className="flex items-center gap-1.5 text-xs font-normal text-muted-foreground">
              <UserCog className="h-3.5 w-3.5" />
              {isActingAs ? "Switch acted role" : "Act as…"}
            </DropdownMenuLabel>
            {ACT_AS_ROLES.map((r) => (
              <DropdownMenuItem
                key={r.value}
                disabled={switching}
                onSelect={(e) => {
                  e.preventDefault();
                  void run(() => actAs(r.value));
                }}
                className="justify-between text-xs"
              >
                {r.label}
                {effectiveRole === r.value && <Check className="h-3.5 w-3.5" />}
              </DropdownMenuItem>
            ))}
            {isActingAs && (
              <DropdownMenuItem
                disabled={switching}
                onSelect={(e) => {
                  e.preventDefault();
                  void run(clearActAs);
                }}
                className="text-xs text-amber-700 focus:bg-amber-50 focus:text-amber-700"
              >
                Switch back to Bunker Manager
              </DropdownMenuItem>
            )}
          </>
        )}

        <DropdownMenuSeparator />
        <DropdownMenuItem
          onSelect={() => void logout()}
          className="text-xs text-destructive focus:text-destructive"
        >
          <LogOut className="mr-2 h-3.5 w-3.5" />
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
