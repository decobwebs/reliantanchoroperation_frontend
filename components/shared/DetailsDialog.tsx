"use client";

import { FileJson } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

/**
 * Raw-payload viewer for audit/diff data — replaces a native
 * `<details><pre>{JSON}</pre></details>` disclosure with a proper dialog so
 * long JSON gets a scrollable, keyboard-dismissible surface instead of
 * pushing the table row open inline.
 */
export function DetailsDialog({
  open,
  onOpenChange,
  title = "Event Details",
  json,
  meta,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
  json: unknown;
  /** Small chips/lines above the payload — status code, duration, user agent. */
  meta?: React.ReactNode;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl" aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-[15px] font-bold tracking-tight">
            <FileJson className="h-4 w-4 text-brand-600" strokeWidth={2} />
            {title}
          </DialogTitle>
        </DialogHeader>

        {meta && <div className="flex flex-wrap items-center gap-2 text-[12px]">{meta}</div>}

        <pre
          className={cn(
            "max-h-[60vh] overflow-auto rounded-xl border border-navy-100 bg-muted/30 p-3.5",
            "font-mono text-[11.5px] leading-relaxed text-foreground/85 dark:border-border"
          )}
        >
          {JSON.stringify(json, null, 2)}
        </pre>
      </DialogContent>
    </Dialog>
  );
}
