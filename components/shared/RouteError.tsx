"use client";

import { useEffect } from "react";
import { AlertTriangle, RotateCw } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * A page that failed while drawing no longer takes the whole app with it.
 *
 * Until this existed the app had no error boundary at all, so any exception
 * anywhere replaced the entire screen — sidebar included — with Next.js's
 * built-in "This page couldn't load". Used by the dashboard and client-portal
 * `error.tsx` files, it keeps the surrounding layout and offers a retry.
 */

// What a browser says when it can't load a piece of the app that was replaced
// by a newer deploy (Chrome/webpack, Safari, Firefox wordings respectively).
const STALE_BUILD =
  /ChunkLoadError|Loading chunk [\w-]+ failed|Importing a module script failed|Failed to fetch dynamically imported module|error loading dynamically imported module/i;
const RELOAD_KEY = "raoms:stale-build-reload";

/**
 * Record what went wrong. Console only for now: Sentry is installed but has
 * no DSN in production, and importing it here pulled its server-side
 * instrumentation into this component's build. Once a DSN is set, report from
 * here with Sentry's captureException.
 */
export function reportError(error: Error & { digest?: string }) {
  console.error(error);
}

/**
 * After a deploy, a tab left open can ask for part of the app that no longer
 * exists. A single fresh load fixes that. Guarded so a genuine fault can never
 * cause a reload loop: at most one automatic reload a minute.
 */
export function reloadIfStaleBuild(error: Error): boolean {
  if (!STALE_BUILD.test(`${error?.name} ${error?.message}`)) return false;
  try {
    const last = Number(sessionStorage.getItem(RELOAD_KEY) || 0);
    if (Date.now() - last < 60_000) return false;
    sessionStorage.setItem(RELOAD_KEY, String(Date.now()));
  } catch {
    return false;
  }
  window.location.reload();
  return true;
}

export function RouteError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  useEffect(() => {
    reportError(error);
    reloadIfStaleBuild(error);
  }, [error]);

  return (
    <div className="flex min-h-[60vh] items-center justify-center px-4">
      <div className="w-full max-w-md rounded-2xl border bg-card p-6 text-center shadow-sm">
        <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300">
          <AlertTriangle className="h-5 w-5" />
        </div>
        <h2 className="mt-4 text-[15px] font-bold tracking-tight text-foreground">
          This section didn&apos;t load
        </h2>
        <p className="mt-1.5 text-[13px] text-muted-foreground">
          Something went wrong showing this page. The rest of the system is fine — try again,
          or reload if it keeps happening.
        </p>
        <div className="mt-5 flex justify-center gap-2">
          <Button onClick={() => retry()} className="gap-1.5">
            <RotateCw className="h-4 w-4" />
            Try again
          </Button>
          <Button variant="outline" onClick={() => window.location.reload()}>
            Reload page
          </Button>
        </div>
        {error?.digest && (
          <p className="mt-4 font-mono text-[10px] text-muted-foreground">Ref: {error.digest}</p>
        )}
      </div>
    </div>
  );
}
