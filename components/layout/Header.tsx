"use client";

import { MobileNav } from "@/components/layout/MobileNav";
import { NotificationBell } from "@/components/layout/NotificationBell";
import { SidebarToggle } from "@/components/layout/SidebarToggle";
import { UserMenu } from "@/components/layout/UserMenu";

interface HeaderProps {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
}

/**
 * Standard page header. The Command Center dashboard uses CommandBar instead,
 * but both share the same bell and account menu.
 */
export function Header({ title, subtitle, actions }: HeaderProps) {
  return (
    <header className="sticky top-0 z-10 flex items-center justify-between gap-2 border-b bg-background/95 px-4 py-3 backdrop-blur-sm md:px-6 md:py-4">
      <div className="flex min-w-0 items-center gap-2">
        {/* Mobile menu trigger — hidden at md+ where the sidebar is shown */}
        <MobileNav />
        <SidebarToggle className="mr-1 h-9 w-9" />
        <div className="min-w-0">
          <h1 className="truncate text-lg font-bold text-foreground md:text-xl">{title}</h1>
          {subtitle && (
            <p className="truncate text-xs text-muted-foreground md:text-sm">{subtitle}</p>
          )}
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-1.5 md:gap-2">
        {actions}
        <NotificationBell className="h-9 w-9 md:h-10 md:w-10" />
        <UserMenu />
      </div>
    </header>
  );
}
