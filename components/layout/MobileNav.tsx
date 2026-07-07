"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, LogOut, Bell } from "lucide-react";
import { cn, getInitials } from "@/lib/utils";
import { ROLE_LABELS } from "@/lib/auth";
import { useAuth } from "@/hooks/useAuth";
import { NAV_ITEMS } from "@/components/layout/Sidebar";
import { Sheet, SheetContent, SheetTrigger, SheetTitle, SheetClose } from "@/components/ui/sheet";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import type { UserRole } from "@/types";

/**
 * Mobile-only slide-in navigation drawer (hidden at md+ where the desktop
 * Sidebar is shown). Reuses the exact same role-scoped NAV_ITEMS.
 */
export function MobileNav() {
  const { user, logout } = useAuth();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  if (!user) return null;

  const visibleItems = NAV_ITEMS.filter((item) =>
    item.roles.includes(user.role as UserRole)
  );

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  const rowClass = (href: string) =>
    cn(
      "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all",
      isActive(href)
        ? "bg-sidebar-primary text-sidebar-primary-foreground"
        : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
    );

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="md:hidden" aria-label="Open menu">
          <Menu className="w-5 h-5" />
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="p-0">
        {/* Brand */}
        <div className="flex items-center gap-3 px-4 py-5 border-b border-sidebar-border">
          <div className="shrink-0 w-9 h-9 rounded-lg bg-white flex items-center justify-center overflow-hidden ring-1 ring-sidebar-border">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.jpeg" alt="Reliant Anchor Logistics" className="w-full h-full object-contain" />
          </div>
          <SheetTitle className="text-sm font-bold tracking-tight text-sidebar-foreground">
            Reliant Anchor
          </SheetTitle>
        </div>

        {/* Navigation */}
        <nav className="flex-1 py-4 px-2 space-y-0.5 overflow-y-auto">
          {visibleItems.map((item) => {
            const Icon = item.icon;
            return (
              <SheetClose asChild key={item.href}>
                <Link href={item.href} className={rowClass(item.href)}>
                  <Icon className="w-4 h-4 shrink-0" />
                  <span className="truncate">{item.label}</span>
                </Link>
              </SheetClose>
            );
          })}
          <SheetClose asChild>
            <Link href="/notifications" className={rowClass("/notifications")}>
              <Bell className="w-4 h-4 shrink-0" />
              <span>Notifications</span>
            </Link>
          </SheetClose>
        </nav>

        {/* User + logout */}
        <div className="px-2 pb-4 pt-2 border-t border-sidebar-border">
          <div className="flex items-center gap-3 px-3 py-2">
            <Avatar className="w-7 h-7 shrink-0 bg-sidebar-primary">
              <AvatarFallback className="text-[11px] bg-sidebar-primary text-sidebar-primary-foreground">
                {getInitials(user.full_name)}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium truncate text-sidebar-foreground">{user.full_name}</p>
              <p className="text-[10px] text-sidebar-foreground/50 truncate">{ROLE_LABELS[user.role]}</p>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-sidebar-foreground/50 hover:text-sidebar-foreground hover:bg-sidebar-accent"
              onClick={() => { setOpen(false); logout(); }}
              aria-label="Sign out"
            >
              <LogOut className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
