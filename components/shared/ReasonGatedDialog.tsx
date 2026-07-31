"use client";

import type { LucideIcon } from "lucide-react";
import { Spinner } from "@/components/ui/spinner";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

/**
 * A dialog whose confirm action is gated on a required reason — the recurring
 * "edit/deactivate/reject requires a justification" pattern across licences,
 * waivers, and finance. `children` renders any extra fields (quantity,
 * vessel, …) above the reason field; the reason itself is always owned by
 * this component so every consumer gets the same label, placeholder, and
 * disabled-until-filled behaviour for free.
 */
export function ReasonGatedDialog({
  open,
  onOpenChange,
  title,
  icon: Icon,
  description,
  children,
  reason,
  onReasonChange,
  reasonLabel = "Reason",
  reasonPlaceholder = "Why is this being changed…",
  confirmLabel,
  cancelLabel = "Cancel",
  destructive = false,
  pending,
  confirmDisabled = false,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  icon?: LucideIcon;
  description?: string;
  children?: React.ReactNode;
  reason: string;
  onReasonChange: (v: string) => void;
  reasonLabel?: string;
  reasonPlaceholder?: string;
  confirmLabel: string;
  cancelLabel?: string;
  /** Red confirm button, for deactivate/reject/remove flows. */
  destructive?: boolean;
  pending: boolean;
  /** Extra validation beyond "reason is non-empty" (e.g. other fields must be valid). */
  confirmDisabled?: boolean;
  onConfirm: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm" aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-[15px] font-bold tracking-tight">
            {Icon && (
              <Icon
                className={cn("h-4 w-4", destructive ? "text-destructive" : "text-brand-600")}
                strokeWidth={2.2}
              />
            )}
            {title}
          </DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>

        <div className="mt-1 space-y-3">
          {children}
          <div className="space-y-1.5">
            <Label className="text-xs">
              {reasonLabel} <span className="text-destructive">*</span>
            </Label>
            <Textarea
              rows={2}
              className="resize-none text-sm"
              placeholder={reasonPlaceholder}
              value={reason}
              onChange={(e) => onReasonChange(e.target.value)}
            />
          </div>
        </div>

        <DialogFooter className="mt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {cancelLabel}
          </Button>
          <Button
            variant={destructive ? "destructive" : "default"}
            disabled={!reason.trim() || pending || confirmDisabled}
            onClick={onConfirm}
          >
            {pending && <Spinner size={14} className="mr-1.5" />}
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
