"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { setAccessToken } from "@/lib/api";

/**
 * Enforces the session limits in the browser: a 12-hour ceiling from login and
 * a 60-minute idle timeout.
 *
 * The cookie route is what actually decides validity — this only decides when
 * to stop waiting and send the user to /login, so a tampered-with client can
 * gain nothing but a stale screen.
 *
 * Two jobs:
 *   1. Bump `last_seen` when the user is genuinely active, throttled so real
 *      use costs at most one small request every few minutes.
 *   2. Poll for expiry, including while the tab sat in the background — a
 *      timer alone would miss a laptop that was asleep.
 */

const HEARTBEAT_THROTTLE_MS = 5 * 60 * 1000; // at most one bump per 5 min
const POLL_MS = 60 * 1000; // re-check expiry every minute
const ACTIVITY_EVENTS = ["mousedown", "keydown", "scroll", "touchstart"] as const;

export function SessionGuard() {
  const router = useRouter();
  const lastBeat = useRef(0);
  const endedRef = useRef(false);

  useEffect(() => {
    let cancelled = false;

    const endSession = async (reason: "absolute" | "idle") => {
      if (endedRef.current) return;
      endedRef.current = true;
      setAccessToken(null);
      await fetch("/api/auth/logout", { method: "POST" }).catch(() => {});
      // A query flag rather than a toast: the redirect unmounts everything, so
      // the message has to survive on the URL to be seen at all.
      router.replace(`/login?expired=${reason}`);
    };

    const beat = async (force = false) => {
      const now = Date.now();
      if (!force && now - lastBeat.current < HEARTBEAT_THROTTLE_MS) return;
      lastBeat.current = now;
      try {
        const res = await fetch("/api/auth/session", { method: "PATCH" });
        if (cancelled) return;
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          if (body?.expired) await endSession(body.expired);
        }
      } catch {
        // Offline or a transient failure — the next poll re-checks.
      }
    };

    const check = async () => {
      try {
        const res = await fetch("/api/auth/session");
        if (cancelled) return;
        const body = await res.json().catch(() => ({}));
        if (body?.expired) await endSession(body.expired);
      } catch {
        /* ignore — retried on the next tick */
      }
    };

    const onActivity = () => void beat();
    const onVisible = () => {
      // Coming back to the tab is the moment a stale session shows up, so
      // check before bumping — otherwise returning after two hours away would
      // refresh `last_seen` and hide the very timeout we want to enforce.
      if (document.visibilityState === "visible") void check();
    };

    ACTIVITY_EVENTS.forEach((e) => window.addEventListener(e, onActivity, { passive: true }));
    document.addEventListener("visibilitychange", onVisible);
    const poll = setInterval(() => void check(), POLL_MS);

    return () => {
      cancelled = true;
      ACTIVITY_EVENTS.forEach((e) => window.removeEventListener(e, onActivity));
      document.removeEventListener("visibilitychange", onVisible);
      clearInterval(poll);
    };
  }, [router]);

  return null;
}
