"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, LogOut, Bell } from "lucide-react";
import { cn, getInitials } from "@/lib/utils";
import { ROLE_LABELS } from "@/lib/auth";
import { useAuth } from "@/hooks/useAuth";
import { NAV_ITEMS, activeNavHref, navRowClasses } from "@/components/layout/Sidebar";
import { Sheet, SheetContent, SheetTrigger, SheetTitle, SheetClose } from "@/components/ui/sheet";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import type { UserRole } from "@/types";

/**
 * Mobile-only slide-in navigation drawer (hidden at md+ where the desktop
 * Sidebar is shown). Reuses the exact same role-scoped NAV_ITEMS and row
 * styling so the two never drift apart.
 */
export function MobileNav({ className }: { className?: string }) {
  const { user, logout, effectiveRole, isActingAs } = useAuth();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  if (!user) return null;

  const visibleItems = NAV_ITEMS.filter((item) =>
    item.roles.includes((effectiveRole ?? user.role) as UserRole)
  );
  const activeHref = activeNavHref(pathname, visibleItems.map((i) => i.href));

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        {className ? (
          <button type="button" className={className} aria-label="Open menu">
            <Menu className="h-4.5 w-4.5" strokeWidth={2} />
          </button>
        ) : (
          <Button variant="ghost" size="icon" className="md:hidden" aria-label="Open menu">
            <Menu className="h-5 w-5" />
          </Button>
        )}
      </SheetTrigger>
      <SheetContent
        side="left"
        className="brand-grad-sidebar flex flex-col p-0"
      >
        {/* Brand */}
        <div className="flex items-center gap-3 px-4 py-5">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-white ring-2 ring-white/15">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo-email.png" alt="" className="h-full w-full object-contain" />
          </span>
          <div className="min-w-0">
            <SheetTitle className="truncate text-[15px] font-bold leading-tight tracking-tight text-white">
              Reliant Anchor
            </SheetTitle>
            <p className="truncate text-[11px] leading-tight text-sidebar-foreground/45">
              Operations
            </p>
          </div>
        </div>

        {/* Navigation */}
        <nav
          className="scrollbar-slim flex-1 space-y-1 overflow-y-auto px-3 py-2 text-sidebar-foreground"
          aria-label="Main navigation"
        >
          {visibleItems.map((item) => {
            const Icon = item.icon;
            const active = item.href === activeHref;
            return (
              <SheetClose asChild key={item.href}>
                <Link
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={navRowClasses(active)}
                >
                  <Icon className="h-4.5 w-4.5 shrink-0" strokeWidth={2} />
                  <span className="truncate">{item.label}</span>
                </Link>
              </SheetClose>
            );
          })}
          <SheetClose asChild>
            <Link
              href="/notifications"
              className={navRowClasses(pathname === "/notifications")}
            >
              <Bell className="h-4.5 w-4.5 shrink-0" strokeWidth={2} />
              <span>Notifications</span>
            </Link>
          </SheetClose>
        </nav>

        {/* User + logout */}
        <div className="border-t border-white/10 px-3 py-3">
          <div className="flex items-center gap-3 px-1">
            <Avatar className="h-9 w-9 shrink-0">
              <AvatarFallback className="brand-grad-mark text-[11px] font-semibold text-white">
                {getInitials(user.full_name)}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-semibold text-white">{user.full_name}</p>
              <p className="truncate text-[10px] text-sidebar-foreground/50">
                {isActingAs ? (
                  <>
                    {ROLE_LABELS[user.role]}
                    <span className="text-amber-400">
                      {" → "}
                      {ROLE_LABELS[effectiveRole ?? ""] ?? effectiveRole}
                    </span>
                  </>
                ) : (
                  ROLE_LABELS[user.role]
                )}
              </p>
            </div>
            <button
              type="button"
              className={cn(
                "flex h-8 w-8 items-center justify-center rounded-lg text-rose-300/80",
                "transition-colors hover:bg-rose-500/10 hover:text-rose-200"
              )}
              onClick={() => {
                setOpen(false);
                void logout();
              }}
              aria-label="Sign out"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
