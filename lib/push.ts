/**
 * Web push: registration, subscribe/unsubscribe, and the idempotent
 * re-sync used on every login and app open.
 *
 * No polling anywhere in this file — the VAPID key is fetched once and
 * memoised, and syncPush() is guarded to run at most once per tab session.
 * See app/providers.tsx for why that restraint matters on mobile.
 */
import { api, extractData } from "@/lib/api";
import type { ApiResponse } from "@/types";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";

// ── Feature/state detection ──────────────────────────────────────────────────

export function isPushSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

export function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  const nav = navigator as Navigator & { standalone?: boolean };
  return window.matchMedia("(display-mode: standalone)").matches || nav.standalone === true;
}

export function isIOS(): boolean {
  if (typeof window === "undefined") return false;
  const nav = navigator as Navigator & { MSStream?: unknown };
  return /iPad|iPhone|iPod/.test(navigator.userAgent) && !nav.MSStream;
}

export type PushPermission = NotificationPermission | "unsupported";

export interface PushState {
  supported: boolean;
  permission: PushPermission;
  standalone: boolean;
  ios: boolean;
  subscribed: boolean;
}

export async function getPushState(): Promise<PushState> {
  const supported = isPushSupported();
  const standalone = isStandalone();
  const ios = isIOS();
  if (!supported) {
    return { supported, permission: "unsupported", standalone, ios, subscribed: false };
  }
  const permission = Notification.permission;
  let subscribed = false;
  try {
    const reg = await navigator.serviceWorker.getRegistration("/");
    const sub = await reg?.pushManager.getSubscription();
    subscribed = !!sub;
  } catch {
    subscribed = false;
  }
  return { supported, permission, standalone, ios, subscribed };
}

// ── base64url -> Uint8Array, the standard snippet for applicationServerKey ────

export function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) outputArray[i] = rawData.charCodeAt(i);
  return outputArray;
}

// ── Service worker registration (single-flight) ──────────────────────────────

let _registerPromise: Promise<ServiceWorkerRegistration | null> | null = null;

export function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (!isPushSupported()) return Promise.resolve(null);
  if (!_registerPromise) {
    // The API origin rides the registration URL's query string — sw.js is a
    // static file with no build step, so process.env can't reach it there,
    // and pushsubscriptionchange can wake the worker with no page open to ask.
    const swUrl = `/sw.js?api=${encodeURIComponent(API_BASE)}`;
    _registerPromise = navigator.serviceWorker
      .register(swUrl, { scope: "/", updateViaCache: "none" })
      .catch((err) => {
        console.error("Service worker registration failed:", err);
        return null;
      });
  }
  return _registerPromise;
}

// ── VAPID public key (memoised — fetched once per page load) ─────────────────

let _vapidKeyPromise: Promise<string | null> | null = null;

export function getVapidPublicKey(): Promise<string | null> {
  if (!_vapidKeyPromise) {
    _vapidKeyPromise = api
      .get<ApiResponse<{ public_key: string; configured: boolean }>>("/push/vapid-public-key")
      .then((res) => {
        const data = extractData(res);
        return data.configured && data.public_key ? data.public_key : null;
      })
      .catch(() => null);
  }
  return _vapidKeyPromise;
}

// ── Subscribe / unsubscribe ───────────────────────────────────────────────────

async function postSubscription(sub: PushSubscription): Promise<void> {
  await api.post("/push/subscribe", sub.toJSON());
}

/**
 * The user-gesture handler. Order matters on iOS: Notification.requestPermission()
 * must be called synchronously, in the direct call stack of the click handler
 * that invokes this — Safari silently ignores a permission request made after
 * an `await`. Callers must invoke this directly from an onClick, not from
 * inside another async function that awaits first.
 */
export async function enablePush(): Promise<{ ok: boolean; reason?: string }> {
  if (!isPushSupported()) return { ok: false, reason: "unsupported" };

  const permission = await Notification.requestPermission();
  if (permission !== "granted") return { ok: false, reason: permission };

  const reg = await registerServiceWorker();
  if (!reg) return { ok: false, reason: "sw-failed" };
  await navigator.serviceWorker.ready;

  const key = await getVapidPublicKey();
  if (!key) return { ok: false, reason: "not-configured" };

  const existing = await reg.pushManager.getSubscription();
  const sub =
    existing ??
    (await reg.pushManager.subscribe({
      userVisibleOnly: true,
      // Cast needed under TS 5.7+, which made Uint8Array generic over
      // ArrayBufferLike — it no longer structurally satisfies BufferSource
      // even though this is exactly what the spec expects at runtime.
      applicationServerKey: urlBase64ToUint8Array(key) as BufferSource,
    }));

  await postSubscription(sub);
  return { ok: true };
}

export async function disablePush(): Promise<void> {
  if (!isPushSupported()) return;
  try {
    const reg = await navigator.serviceWorker.getRegistration("/");
    const sub = await reg?.pushManager.getSubscription();
    if (!sub) return;
    await api.delete("/push/subscribe", { data: { endpoint: sub.endpoint } });
    await sub.unsubscribe();
  } catch {
    // Best-effort — never let a failed unsubscribe block the caller.
  }
}

/**
 * Idempotent re-registration: safe to call on every login and every app open.
 * No-ops unless permission is already "granted" — it never triggers the
 * browser's permission prompt itself. Guarded so it runs at most once per tab
 * session, matching the no-request-storms rule the rest of this app follows
 * (see app/providers.tsx).
 */
const SYNC_FLAG = "raoms:push-synced";

export async function syncPush(): Promise<void> {
  if (!isPushSupported()) return;
  if (Notification.permission !== "granted") return;
  try {
    if (sessionStorage.getItem(SYNC_FLAG)) return;
  } catch {
    // sessionStorage unavailable (private mode edge cases) — proceed anyway,
    // worst case this runs more than once per tab.
  }

  try {
    const reg = await registerServiceWorker();
    if (!reg) return;
    await navigator.serviceWorker.ready;

    let sub = await reg.pushManager.getSubscription();
    if (!sub) {
      const key = await getVapidPublicKey();
      if (!key) return;
      // Silent — permission is already granted, so this never prompts.
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        // Cast needed under TS 5.7+, which made Uint8Array generic over
        // ArrayBufferLike — it no longer structurally satisfies BufferSource
        // even though this is exactly what the spec expects at runtime.
        applicationServerKey: urlBase64ToUint8Array(key) as BufferSource,
      });
    }
    await postSubscription(sub);
    try {
      sessionStorage.setItem(SYNC_FLAG, "1");
    } catch {
      /* ignore */
    }
  } catch (err) {
    console.error("syncPush failed:", err);
  }
}
