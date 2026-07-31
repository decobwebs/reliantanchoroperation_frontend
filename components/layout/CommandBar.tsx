"use client";

import { useEffect, useState } from "react";
import { MapPin } from "lucide-react";
import { cn } from "@/lib/utils";
import { SidebarToggle } from "@/components/layout/SidebarToggle";
import { MobileNav } from "@/components/layout/MobileNav";
import { GlobalSearch } from "@/components/layout/GlobalSearch";
import { NotificationBell } from "@/components/layout/NotificationBell";
import { UserMenu } from "@/components/layout/UserMenu";

/** Where the operation is run from — a fixed label, not a geolocation lookup. */
const OPS_BASE = "Lagos, NG";

function LocalClock() {
  const [now, setNow] = useState<string | null>(null);

  // Rendered client-side only: server and client clocks would disagree and
  // trip hydration.
  useEffect(() => {
    const tick = () =>
      setNow(
        new Intl.DateTimeFormat("en-GB", {
          hour: "2-digit",
          minute: "2-digit",
          timeZone: "Africa/Lagos",
        }).format(new Date())
      );
    tick();
    const id = setInterval(tick, 30_000);
    return () => clearInterval(id);
  }, []);

  return (
    <span className="tabular-nums">{now ?? "--:--"}</span>
  );
}

/**
 * Command Center top bar: sidebar toggle, global search, ops-base clock,
 * notifications and the account menu.
 */
export function CommandBar() {
  return (
    <div className="flex items-center gap-3 px-4 py-3.5 lg:gap-4 lg:px-6">
      {/* Mobile: opens the nav drawer. Desktop: collapses the sidebar. */}
      <MobileNav
        className={cn(
          "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-200/80",
          "bg-card text-muted-foreground transition-colors hover:bg-muted hover:text-foreground md:hidden",
          "dark:border-border"
        )}
      />
      <SidebarToggle />

      <GlobalSearch className="min-w-0 max-w-xl flex-1" />

      <div className="ml-auto flex shrink-0 items-center gap-2 lg:gap-3">
        <span
          className={cn(
            "hidden items-center gap-2 rounded-xl border border-slate-200/80 bg-card px-3 py-2.5",
            "text-xs font-medium text-muted-foreground xl:flex dark:border-border"
          )}
        >
          <MapPin className="h-3.5 w-3.5 text-sky-500" strokeWidth={2.5} />
          {OPS_BASE}
          <span className="text-border">•</span>
          <LocalClock />
        </span>
        <NotificationBell />
        <UserMenu />
      </div>
    </div>
  );
}
