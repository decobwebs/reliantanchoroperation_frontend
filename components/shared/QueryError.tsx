"use client";

import { AlertTriangle, Lock, RefreshCw } from "lucide-react";
import axios from "axios";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

function statusOf(error: unknown): number | undefined {
  return axios.isAxiosError(error) ? error.response?.status : undefined;
}

/**
 * Friendly error state for a failed React Query. Distinguishes 403 (access
 * denied) from a generic failure, and offers a retry. Use in place of silently
 * rendering empty/zero data when `isError` is true.
 */
export function QueryError({
  error,
  onRetry,
  className,
}: {
  error?: unknown;
  onRetry?: () => void;
  className?: string;
}) {
  const status = statusOf(error);
  const forbidden = status === 403;

  return (
    <Card className={className}>
      <CardContent className="flex flex-col items-center justify-center gap-2 py-10 text-center">
        {forbidden ? (
          <Lock className="h-8 w-8 text-muted-foreground/60" />
        ) : (
          <AlertTriangle className="h-8 w-8 text-destructive/70" />
        )}
        <p className="text-sm font-semibold">
          {forbidden ? "You don't have access to this" : "Couldn't load this data"}
        </p>
        <p className="max-w-sm text-xs text-muted-foreground">
          {forbidden
            ? "Your role doesn't have permission to view this page. Contact your Bunker Manager if you think this is a mistake."
            : "Something went wrong fetching this information. Please try again."}
        </p>
        {!forbidden && onRetry && (
          <Button size="sm" variant="outline" className="mt-1" onClick={onRetry}>
            <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
            Retry
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
