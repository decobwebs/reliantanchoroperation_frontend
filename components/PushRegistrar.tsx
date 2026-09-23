"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { registerServiceWorker, syncPush } from "@/lib/push";

/**
 * Renders nothing. Mounted only in the two authenticated shells
 * (app/(dashboard)/layout.tsx and app/portal/layout.tsx) — never in
 * app/providers.tsx, which also wraps /login: registering a service worker
 * for a signed-out visitor achieves nothing and would hit the /sw.js
 * unauthenticated-route rule on exactly the page that's hardest to debug it on.
 *
 * Follows the same "renders null, owns a side effect" pattern as
 * components/SessionGuard.tsx.
 */
export function PushRegistrar() {
  const router = useRouter();

  useEffect(() => {
    void registerServiceWorker();
    void syncPush();

    // Safari has no Client.navigate() from the service worker, so
    // notificationclick posts a message here instead — see public/sw.js.
    const onMessage = (event: MessageEvent) => {
      if (event.data?.type === "RAOMS_NAVIGATE" && typeof event.data.url === "string") {
        router.push(event.data.url);
      }
    };

    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.addEventListener("message", onMessage);
      return () => navigator.serviceWorker.removeEventListener("message", onMessage);
    }
  }, [router]);

  return null;
}
