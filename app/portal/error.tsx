"use client";

import { RouteError } from "@/components/shared/RouteError";

// Clients reach the portal on their phones too; a fault in one portal page
// stays inside the portal layout rather than blanking the screen.
export default function PortalError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  return <RouteError error={error} retry={unstable_retry} />;
}
