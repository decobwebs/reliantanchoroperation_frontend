"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  ClipboardList,
  CheckSquare,
  DollarSign,
  FileText,
  Truck,
  Ship,
  BarChart3,
  Users,
  LogOut,
  ChevronLeft,
  ChevronRight,
  ScrollText,
  Bell,
  BadgeCheck,
  UserCog,
  Check,
  Anchor,
  FileBadge2,
} from "lucide-react";
import { useState } from "react";
import { cn, getInitials } from "@/lib/utils";
import { ROLE_LABELS } from "@/lib/auth";
import { useAuth } from "@/hooks/useAuth";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { UserRole } from "@/types";

// The 4 roles a Bunker Manager may temporarily act as.
const ACT_AS_ROLES: { value: string; label: string }[] = [
  { value: "ops_supervisor", label: "Ops Supervisor" },
  { value: "logistics_officer", label: "Logistics Officer" },
  { value: "marine_manager", label: "Marine Manager" },
  { value: "finance_manager", label: "Finance Manager" },
];

export interface NavItem {
  href: string;
  label: string;
  icon: React.ElementType;
  roles: UserRole[];
}

// Role-scoped navigation — each role sees only what's relevant to their job.
// Exported so the mobile drawer (MobileNav) reuses the exact same list.
export const NAV_ITEMS: NavItem[] = [
  // ── Shared ──────────────────────────────────────────────────────────────
  {
    href: "/",
    label: "Dashboard",
    icon: LayoutDashboard,
    roles: ["bunker_manager", "ops_supervisor", "logistics_officer", "marine_manager", "finance_manager"],
  },

  // ── Operations management ────────────────────────────────────────────────
  {
    href: "/operations",
    label: "Operations",
    icon: ClipboardList,
    roles: ["bunker_manager", "ops_supervisor", "logistics_officer", "marine_manager", "finance_manager"],
  },

  // ── Task management ──────────────────────────────────────────────────────
  {
    href: "/tasks",
    label: "My Tasks",
    icon: CheckSquare,
    // finance_manager is never directly assigned tasks — they're auto-notified
    roles: ["ops_supervisor", "logistics_officer", "marine_manager"],
  },

  // ── Fleet ────────────────────────────────────────────────────────────────
  {
    href: "/fleet",
    label: "Trucks",
    icon: Truck,
    roles: ["bunker_manager", "ops_supervisor", "logistics_officer"],
  },
  {
    href: "/fleet/waivers",
    label: "Waivers",
    icon: BadgeCheck,
    roles: ["bunker_manager", "ops_supervisor", "logistics_officer"],
  },
  {
    href: "/fleet/vessels",
    label: "Vessels",
    icon: Ship,
    roles: ["bunker_manager", "ops_supervisor", "marine_manager"],
  },

  // ── Licences ─────────────────────────────────────────────────────────────
  {
    href: "/licences/ppdl",
    label: "PPDL",
    icon: FileBadge2,
    roles: ["bunker_manager", "marine_manager"],
  },
  {
    href: "/licences/bfl",
    label: "BFL",
    icon: FileBadge2,
    roles: ["bunker_manager", "marine_manager"],
  },
  {
    href: "/licences/naval-clearances",
    label: "Naval Clearances",
    icon: Anchor,
    roles: ["bunker_manager", "marine_manager"],
  },

  // ── Finance ──────────────────────────────────────────────────────────────
  {
    href: "/finance",
    label: "Finance",
    icon: DollarSign,
    roles: ["bunker_manager", "finance_manager"],
  },
  {
    href: "/pfi",
    label: "PFI",
    icon: FileText,
    roles: ["bunker_manager", "finance_manager"],
  },

  // ── Analytics & Admin ────────────────────────────────────────────────────
  {
    href: "/analytics",
    label: "Analytics",
    icon: BarChart3,
    roles: ["bunker_manager", "ops_supervisor", "finance_manager"],
  },
  {
    href: "/admin",
    label: "User Admin",
    icon: Users,
    roles: ["bunker_manager"],
  },
  {
    href: "/documents",
    label: "Document Hub",
    icon: FileText,
    roles: ["bunker_manager"],
  },
  {
    href: "/activity",
    label: "Activity Log",
    icon: ScrollText,
    roles: ["bunker_manager"],
  },
];

export function Sidebar() {
  const { user, logout, effectiveRole, isActingAs, actAs, clearActAs } = useAuth();
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [switching, setSwitching] = useState(false);

  if (!user) return null;

  // The switcher itself must always be reachable by the real BM, even while
  // acting as another role — so this checks the real role, not effectiveRole.
  const isRealBM = user.role === "bunker_manager";

  const handleActAs = async (role: string) => {
    try {
      setSwitching(true);
      await actAs(role);
    } finally {
      setSwitching(false);
    }
  };

  const handleClearActAs = async () => {
    try {
      setSwitching(true);
      await clearActAs();
    } finally {
      setSwitching(false);
    }
  };

  const visibleItems = NAV_ITEMS.filter((item) =>
    item.roles.includes((effectiveRole ?? user.role) as UserRole)
  );

  return (
    <aside
      className={cn(
        // Desktop-only: the mobile drawer (MobileNav) replaces this below md.
        "relative hidden md:flex flex-col h-full bg-sidebar text-sidebar-foreground transition-all duration-300 border-r border-sidebar-border",
        collapsed ? "w-16" : "w-60"
      )}
    >
      {/* Logo */}
      <div className="flex items-center gap-3 px-4 py-5 border-b border-sidebar-border">
        <div className="shrink-0 w-9 h-9 rounded-lg bg-white flex items-center justify-center overflow-hidden ring-1 ring-sidebar-border">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.jpeg" alt="Reliant Anchor Logistics" className="w-full h-full object-contain" />
        </div>
        {!collapsed && (
          <div className="overflow-hidden">
            <p className="text-sm font-bold tracking-tight text-sidebar-foreground truncate">
              Reliant Anchor
            </p>
            <p className="text-[10px] text-sidebar-foreground/50 truncate">
              Operations
            </p>
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-4 px-2 space-y-0.5 overflow-y-auto">
        {visibleItems.map((item) => {
          const Icon = item.icon;
          const isActive =
            item.href === "/"
              ? pathname === "/"
              : pathname.startsWith(item.href);

          const linkContent = (
            <Link
              href={item.href}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all",
                isActive
                  ? "bg-sidebar-primary text-sidebar-primary-foreground"
                  : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
              )}
            >
              <Icon className="w-4 h-4 shrink-0" />
              {!collapsed && <span className="truncate">{item.label}</span>}
            </Link>
          );

          if (collapsed) {
            return (
              <Tooltip key={item.href} delayDuration={0}>
                <TooltipTrigger asChild>{linkContent}</TooltipTrigger>
                <TooltipContent side="right">{item.label}</TooltipContent>
              </Tooltip>
            );
          }

          return <div key={item.href}>{linkContent}</div>;
        })}
      </nav>

      {/* Notifications shortcut */}
      <div className="px-2 pb-2 border-t border-sidebar-border pt-2">
        <Tooltip delayDuration={0}>
          <TooltipTrigger asChild>
            <Link
              href="/notifications"
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all",
                pathname === "/notifications"
                  ? "bg-sidebar-primary text-sidebar-primary-foreground"
                  : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
              )}
            >
              <Bell className="w-4 h-4 shrink-0" />
              {!collapsed && <span>Notifications</span>}
            </Link>
          </TooltipTrigger>
          {collapsed && <TooltipContent side="right">Notifications</TooltipContent>}
        </Tooltip>
      </div>

      {/* User profile + logout */}
      <div className="px-2 pb-4 pt-2 border-t border-sidebar-border">
        <div className="flex items-center gap-3 px-3 py-2">
          <Avatar className="w-7 h-7 shrink-0 bg-sidebar-primary">
            <AvatarFallback className="text-[11px] bg-sidebar-primary text-sidebar-primary-foreground">
              {getInitials(user.full_name)}
            </AvatarFallback>
          </Avatar>
          {!collapsed && (
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium truncate text-sidebar-foreground">
                {user.full_name}
              </p>
              <p className="text-[10px] text-sidebar-foreground/50 truncate">
                {isActingAs ? (
                  <>
                    {ROLE_LABELS[user.role]}
                    <span className="text-amber-400"> → {ROLE_LABELS[effectiveRole ?? ""] ?? effectiveRole}</span>
                  </>
                ) : (
                  ROLE_LABELS[user.role]
                )}
              </p>
            </div>
          )}
          {!collapsed && isRealBM && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-sidebar-foreground/50 hover:text-sidebar-foreground hover:bg-sidebar-accent"
                  disabled={switching}
                  title={isActingAs ? "Switch acted role" : "Act as another role"}
                >
                  <UserCog className="w-3.5 h-3.5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel className="text-xs text-muted-foreground">
                  {isActingAs ? "Switch acted role" : "Act as…"}
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                {ACT_AS_ROLES.map((r) => (
                  <DropdownMenuItem
                    key={r.value}
                    disabled={switching}
                    onClick={() => handleActAs(r.value)}
                    className="text-xs justify-between"
                  >
                    {r.label}
                    {effectiveRole === r.value && <Check className="w-3.5 h-3.5" />}
                  </DropdownMenuItem>
                ))}
                {isActingAs && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      disabled={switching}
                      onClick={handleClearActAs}
                      className="text-xs text-amber-700 focus:text-amber-700 focus:bg-amber-50"
                    >
                      Switch back to Bunker Manager
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
          {!collapsed && (
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-sidebar-foreground/50 hover:text-sidebar-foreground hover:bg-sidebar-accent"
              onClick={logout}
            >
              <LogOut className="w-3.5 h-3.5" />
            </Button>
          )}
        </div>
        {collapsed && (
          <Tooltip delayDuration={0}>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="w-full h-8 text-sidebar-foreground/50 hover:text-sidebar-foreground hover:bg-sidebar-accent"
                onClick={logout}
              >
                <LogOut className="w-4 h-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="right">Sign out</TooltipContent>
          </Tooltip>
        )}
      </div>

      {/* Collapse toggle */}
      <button
        onClick={() => setCollapsed((v) => !v)}
        className="absolute -right-3 top-6 z-10 w-6 h-6 rounded-full bg-sidebar-border border border-sidebar-border flex items-center justify-center hover:bg-sidebar-accent transition-colors"
      >
        {collapsed ? (
          <ChevronRight className="w-3 h-3 text-sidebar-foreground" />
        ) : (
          <ChevronLeft className="w-3 h-3 text-sidebar-foreground" />
        )}
      </button>
    </aside>
  );
}
