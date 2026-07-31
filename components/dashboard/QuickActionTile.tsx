"use client";

import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { TONE_TILE_CLASSES, type AccentTone } from "./tones";

interface QuickActionTileProps {
  href: string;
  label: string;
  description: string;
  icon: LucideIcon;
  tone?: AccentTone;
}

export function QuickActionTile({
  href,
  label,
  description,
  icon: Icon,
  tone = "blue",
}: QuickActionTileProps) {
  return (
    <Link
      href={href}
      className={cn(
        "group flex items-start gap-3 rounded-xl border border-slate-200/80 bg-card p-3",
        "transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/25",
        "hover:shadow-[0_12px_24px_-16px_rgba(16,24,40,0.5)] dark:border-border",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
      )}
    >
      <span
        className={cn(
          "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg transition-transform duration-200 group-hover:scale-105",
          TONE_TILE_CLASSES[tone]
        )}
      >
        <Icon className="h-4 w-4" strokeWidth={2} />
      </span>
      <span className="min-w-0">
        <span className="block truncate text-[13px] font-semibold leading-tight text-foreground">
          {label}
        </span>
        <span className="mt-0.5 block truncate text-[11px] text-muted-foreground">
          {description}
        </span>
      </span>
    </Link>
  );
}
