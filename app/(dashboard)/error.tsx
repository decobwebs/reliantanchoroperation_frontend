"use client";

import { RouteError } from "@/components/shared/RouteError";

// A fault inside any staff page is shown here, inside the dashboard layout,
// so the sidebar and header stay usable instead of the whole screen going blank.
export default function DashboardError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  return <RouteError error={error} retry={unstable_retry} />;
}
