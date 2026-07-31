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
  ScrollText,
  Bell,
  BadgeCheck,
  Anchor,
  FileBadge2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { useSidebar } from "@/components/layout/SidebarContext";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { UserRole } from "@/types";

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

/** Shared active-route test — `/` must match exactly, everything else by prefix. */
export function isNavItemActive(href: string, pathname: string): boolean {
  return href === "/" ? pathname === "/" : pathname.startsWith(href);
}

/** Nav row styling, shared with the mobile drawer so both stay in lockstep. */
export function navRowClasses(active: boolean): string {
  return cn(
    "group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium",
    "transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2",
    "focus-visible:ring-sidebar-ring focus-visible:ring-offset-2 focus-visible:ring-offset-sidebar",
    active
      ? "brand-grad-active text-white shadow-[0_10px_22px_-12px_rgb(14_121_200/0.85)]"
      : "text-sidebar-foreground/55 hover:bg-white/[0.06] hover:text-sidebar-foreground"
  );
}

export function Sidebar() {
  const { user, logout, effectiveRole } = useAuth();
  const pathname = usePathname();
  const { collapsed } = useSidebar();

  if (!user) return null;

  const visibleItems = NAV_ITEMS.filter((item) =>
    item.roles.includes((effectiveRole ?? user.role) as UserRole)
  );

  return (
    <aside
      className={cn(
        // Desktop-only: the mobile drawer (MobileNav) replaces this below md.
        "relative z-20 hidden h-full shrink-0 flex-col bg-sidebar text-sidebar-foreground md:flex",
        "brand-grad-sidebar",
        "transition-[width] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]",
        collapsed ? "w-19" : "w-62"
      )}
    >
      {/* Brand */}
      <div className={cn("flex items-center gap-3 px-4 py-5", collapsed && "justify-center px-0")}>
        <span className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-white ring-2 ring-white/15">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/logo-mark.png"
            alt=""
            className="h-full w-full object-contain"
          />
        </span>
        {!collapsed && (
          <div className="min-w-0">
            <p className="truncate text-[15px] font-bold leading-tight tracking-tight text-white">
              Reliant Anchor
            </p>
            <p className="truncate text-[11px] leading-tight text-sidebar-foreground/45">
              Operations
            </p>
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav
        className="scrollbar-slim flex-1 space-y-1 overflow-y-auto px-3 py-2 text-sidebar-foreground"
        aria-label="Main navigation"
      >
        {visibleItems.map((item) => {
          const Icon = item.icon;
          const active = isNavItemActive(item.href, pathname);

          const link = (
            <Link
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={cn(navRowClasses(active), collapsed && "justify-center px-0")}
            >
              <Icon className="h-4.5 w-4.5 shrink-0" strokeWidth={2} />
              {!collapsed && <span className="truncate">{item.label}</span>}
            </Link>
          );

          if (collapsed) {
            return (
              <Tooltip key={item.href} delayDuration={0}>
                <TooltipTrigger asChild>{link}</TooltipTrigger>
                <TooltipContent side="right">{item.label}</TooltipContent>
              </Tooltip>
            );
          }
          return <div key={item.href}>{link}</div>;
        })}
      </nav>

      {/* Utility rows */}
      <div className="space-y-1 px-3 pb-5 pt-2">
        <Tooltip delayDuration={0}>
          <TooltipTrigger asChild>
            <Link
              href="/notifications"
              aria-current={pathname === "/notifications" ? "page" : undefined}
              className={cn(
                navRowClasses(pathname === "/notifications"),
                collapsed && "justify-center px-0"
              )}
            >
              <Bell className="h-4.5 w-4.5 shrink-0" strokeWidth={2} />
              {!collapsed && <span className="truncate">Notifications</span>}
            </Link>
          </TooltipTrigger>
          {collapsed && <TooltipContent side="right">Notifications</TooltipContent>}
        </Tooltip>

        <Tooltip delayDuration={0}>
          <TooltipTrigger asChild>
            <button
              type="button"
              onClick={logout}
              className={cn(
                "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium",
                "text-rose-300/80 transition-colors hover:bg-rose-500/10 hover:text-rose-200",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400/60",
                collapsed && "justify-center px-0"
              )}
            >
              <LogOut className="h-4.5 w-4.5 shrink-0" strokeWidth={2} />
              {!collapsed && <span>Log out</span>}
            </button>
          </TooltipTrigger>
          {collapsed && <TooltipContent side="right">Log out</TooltipContent>}
        </Tooltip>
      </div>
    </aside>
  );
}
