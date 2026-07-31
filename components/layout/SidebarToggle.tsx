"use client";

import { PanelLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import { useSidebar } from "@/components/layout/SidebarContext";

/**
 * Desktop-only collapse control for the sidebar. Hidden below md, where
 * MobileNav's drawer trigger takes over.
 */
export function SidebarToggle({ className }: { className?: string }) {
  const { collapsed, toggle } = useSidebar();

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
      aria-pressed={collapsed}
      className={cn(
        "hidden h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-200/80 md:flex",
        "bg-card text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
        "dark:border-border",
        className
      )}
    >
      <PanelLeft className="h-4.5 w-4.5" strokeWidth={2} />
    </button>
  );
}
