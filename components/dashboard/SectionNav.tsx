"use client";

/**
 * Jump navigation for a long dashboard.
 *
 * The Command Center is ten panels deep — roughly six phone screens. Finding
 * the vendor league meant scrolling past everything above it, every time.
 *
 * Why fixed rather than a sticky bar: `DashboardShell` wraps its content in an
 * `overflow-hidden` box to clip the panel's rounded corners, and an
 * overflow-hidden ancestor makes `position: sticky` stick to a box that never
 * scrolls — so a sticky bar would silently behave as static. Fixed positions
 * against the viewport instead and is unaffected. Changing the shell was the
 * alternative, and it is shared by every page in the app.
 *
 * Counts sit beside each section so the menu answers "is there anything in the
 * fleet league?" without going there. A section with nothing in it is dimmed
 * rather than hidden — its absence is information too, and a menu whose items
 * move around between refreshes is harder to learn.
 */

import { useEffect, useRef, useState } from "react";
import { List, X } from "lucide-react";
import { cn } from "@/lib/utils";

export interface NavSection {
  id: string;
  label: string;
  /** Shown as a badge. `undefined` means "not a countable section". */
  count?: number | null;
  /** Draws the badge in red — used for anything urgent. */
  urgent?: boolean;
}

export function SectionNav({ sections }: { sections: NavSection[] }) {
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  // Close on Escape, and on a click anywhere outside the menu.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    const onClick = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("keydown", onKey);
    // Deferred so the click that opened the menu does not immediately close it.
    const t = window.setTimeout(() => document.addEventListener("click", onClick), 0);
    return () => {
      document.removeEventListener("keydown", onKey);
      window.clearTimeout(t);
      document.removeEventListener("click", onClick);
    };
  }, [open]);

  const jump = (id: string) => {
    const el = document.getElementById(id);
    if (!el) return;
    // scrollIntoView finds the real scrolling ancestor for us — which here is
    // a div inside the layout, not the window.
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    el.scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "start" });
    setOpen(false);
  };

  return (
    <div
      ref={panelRef}
      className="fixed bottom-5 right-4 z-50 flex flex-col items-end gap-2 print:hidden lg:bottom-6 lg:right-6"
    >
      {open && (
        <div
          role="menu"
          aria-label="Jump to a section"
          className="max-h-[60vh] w-60 overflow-y-auto rounded-xl border border-border bg-card p-1.5 shadow-xl"
        >
          {sections.map((s) => {
            const empty = s.count === 0;
            return (
              <button
                key={s.id}
                role="menuitem"
                onClick={() => jump(s.id)}
                className={cn(
                  "flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2.5 text-left text-sm transition-colors",
                  "hover:bg-muted focus-visible:bg-muted focus-visible:outline-none",
                  empty && "text-muted-foreground"
                )}
              >
                <span className="min-w-0 truncate">{s.label}</span>
                {s.count !== null && s.count !== undefined && (
                  <span
                    className={cn(
                      "shrink-0 rounded-full px-2 py-0.5 font-mono text-[11px] tabular-nums",
                      s.urgent && s.count > 0
                        ? "bg-rose-500/15 text-rose-600"
                        : empty
                          ? "bg-muted text-muted-foreground"
                          : "bg-muted text-foreground"
                    )}
                  >
                    {s.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}

      <button
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-label={open ? "Close the section menu" : "Jump to a section"}
        className={cn(
          "flex items-center gap-2 rounded-full border border-border bg-card px-4 py-3 shadow-lg transition-colors",
          "hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          // A comfortable tap target on a phone, where this gets used most.
          "min-h-[44px]"
        )}
      >
        {open ? <X className="h-4 w-4" /> : <List className="h-4 w-4" />}
        <span className="text-sm font-medium">{open ? "Close" : "Sections"}</span>
      </button>
    </div>
  );
}
