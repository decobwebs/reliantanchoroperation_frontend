"use client";

import type { LucideIcon } from "lucide-react";
import { Search, X } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

/* ── Search field ────────────────────────────────────────────────────────── */

export function FilterSearch({
  value,
  onChange,
  placeholder = "Search…",
  className,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  className?: string;
}) {
  return (
    <div className={cn("relative min-w-0 flex-1", className)}>
      <Search
        className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
        aria-hidden="true"
      />
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
        className={cn(
          "h-11 w-full rounded-xl border border-navy-100 bg-card pl-10 pr-10 text-sm",
          "text-foreground placeholder:text-muted-foreground/80",
          "transition-colors focus:border-brand-400 focus:outline-none focus:ring-4 focus:ring-brand-500/10",
          "dark:border-border",
          "[&::-webkit-search-cancel-button]:hidden"
        )}
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange("")}
          aria-label="Clear search"
          className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}

/* ── Select ──────────────────────────────────────────────────────────────── */

export interface FilterOption {
  value: string;
  label: string;
}

export function FilterSelect({
  value,
  onChange,
  options,
  label,
  icon: Icon,
  className,
}: {
  value: string;
  onChange: (v: string) => void;
  options: FilterOption[];
  label: string;
  icon?: LucideIcon;
  className?: string;
}) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger
        aria-label={label}
        className={cn(
          "h-11 gap-2 rounded-xl border-navy-100 bg-card text-[13px] font-medium",
          "focus:ring-4 focus:ring-brand-500/10 focus:ring-offset-0 dark:border-border",
          className
        )}
      >
        {Icon && <Icon className="h-4 w-4 shrink-0 text-muted-foreground" strokeWidth={2} />}
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {options.map((o) => (
          <SelectItem key={o.value} value={o.value} className="text-[13px]">
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

/* ── Bar ─────────────────────────────────────────────────────────────────── */

/** Rounded toolbar that holds a search field plus a row of filter selects. */
export function FilterBar({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-3 rounded-2xl border border-navy-100 bg-card p-3",
        "shadow-[0_1px_2px_rgb(16_36_71/0.04)] dark:border-border",
        className
      )}
    >
      {children}
    </div>
  );
}
