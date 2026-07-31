"use client";

import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import { StatusBadge } from "@/components/shared/StatusBadge";
import type { OperationStatus } from "@/types";

/** One of the outlined pills under the operation number. */
export function MetaChip({
  icon: Icon,
  children,
  className,
}: {
  icon?: LucideIcon;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-lg border border-navy-100 bg-card px-2.5 py-1.5",
        "text-[12px] font-medium text-foreground/80 dark:border-border",
        className
      )}
    >
      {Icon && <Icon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" strokeWidth={2} />}
      {children}
    </span>
  );
}

interface DetailHeaderProps {
  /** Where the back link goes, plus its label. */
  backHref: string;
  backLabel?: string;
  /** The operation number — set in mono, the page's primary identifier. */
  title: string;
  status: OperationStatus;
  /** MetaChip elements. */
  meta?: React.ReactNode;
  /** Buttons, right-aligned on the title row. */
  actions?: React.ReactNode;
}

/**
 * Detail-page header: back link, mono identifier + status, a row of meta chips,
 * and right-aligned actions.
 */
export function DetailHeader({
  backHref,
  backLabel = "Back to Operations",
  title,
  status,
  meta,
  actions,
}: DetailHeaderProps) {
  return (
    <header className="animate-rise">
      <Link
        href={backHref}
        className={cn(
          "inline-flex items-center gap-1.5 rounded text-[13px] font-medium text-brand-600",
          "transition-colors hover:text-brand-700",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        )}
      >
        <ArrowLeft className="h-3.5 w-3.5" strokeWidth={2.5} />
        {backLabel}
      </Link>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 flex-wrap items-center gap-3">
          <h1 className="font-mono text-[26px] font-extrabold leading-none tracking-tight text-foreground lg:text-[30px]">
            {title}
          </h1>
          <StatusBadge status={status} className="px-2.5 py-1 text-[12px]" />
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2.5">{actions}</div>}
      </div>

      {meta && <div className="mt-3 flex flex-wrap items-center gap-2">{meta}</div>}
    </header>
  );
}
