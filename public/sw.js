/* RAOMS service worker — push delivery and notification routing only.
 *
 * DELIBERATELY CACHES NOTHING but a static offline fallback page. The access
 * token lives only in a page-scoped JS variable (see lib/api.ts) and sessions
 * are capped at 12h absolute / 1h idle (see components/SessionGuard.tsx)
 * precisely because these are shared field devices — a Cache Storage copy of
 * an authenticated screen would outlive both. Operational data (BDN approval
 * state, truck status) must never be served stale either: the app already
 * polls every 20-30s for exactly that reason. /_next/static/* is already
 * content-hashed and immutably cached by the browser and the CDN, so caching
 * it again here would only add a thread hop for no benefit.
 *
 * The API origin arrives in the registration query string (see lib/push.ts)
 * because this file is static with no build step — process.env is not
 * available here — and because pushsubscriptionchange can wake this worker
 * with no client page open to ask for it.
 */

const API_BASE = new URL(self.location).searchParams.get("api") || "";
const OFFLINE_URL = "/offline.html";
const OFFLINE_CACHE = "raoms-offline-v1";

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(OFFLINE_CACHE)
      .then((c) => c.add(new Request(OFFLINE_URL, { cache: "reload" })))
      .catch(() => {})
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      for (const key of await caches.keys()) {
        if (key !== OFFLINE_CACHE) await caches.delete(key);
      }
      await self.clients.claim();
    })()
  );
});

// Navigation-only offline fallback. Everything else (API calls, assets)
// passes straight through untouched.
self.addEventListener("fetch", (event) => {
  if (event.request.mode !== "navigate") return;
  event.respondWith(
    fetch(event.request).catch(
      async () => (await caches.match(OFFLINE_URL)) || Response.error()
    )
  );
});

self.addEventListener("push", (event) => {
  let d = {};
  try {
    d = event.data ? event.data.json() : {};
  } catch {
    // DevTools' "Push" test button sends an unencrypted, possibly non-JSON
    // payload. Without this guard the handler throws and nothing is ever
    // shown, which looks exactly like "push is broken".
    d = { title: "RAOMS", body: event.data ? event.data.text() : "" };
  }

  event.waitUntil(
    self.registration.showNotification(d.title || "RAOMS", {
      body: d.body || "",
      icon: "/icons/icon-192.png",
      badge: "/icons/badge-96.png",
      tag: d.tag || "raoms",
      renotify: true,
      requireInteraction: d.priority === "urgent",
      data: { url: d.url || "/notifications" },
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = new URL(
    event.notification.data && event.notification.data.url
      ? event.notification.data.url
      : "/notifications",
    self.location.origin
  ).href;

  event.waitUntil(
    (async () => {
      const all = await self.clients.matchAll({
        type: "window",
        includeUncontrolled: true,
      });
      for (const c of all) {
        if (new URL(c.url).origin !== self.location.origin) continue;
        await c.focus();
        if ("navigate" in c) {
          try {
            await c.navigate(url);
            return;
          } catch {
            // fall through to postMessage
          }
        }
        // Safari has no Client.navigate — the page's own router does the hop
        // instead (see the "message" listener in components/PushRegistrar.tsx).
        c.postMessage({ type: "RAOMS_NAVIGATE", url });
        return;
      }
      await self.clients.openWindow(url);
    })()
  );
});

/* pushsubscriptionchange — the reason subscriptions silently die if this is
 * skipped. The browser can rotate the endpoint on its own (key rotation,
 * storage pressure, a push-service migration) and fires this event exactly
 * once. Miss it and the stored row points at an endpoint that will 410
 * forever while the user sees nothing at all, with no error anywhere. There is
 * no auth token reachable from here, which is why /push/rotate matches on the
 * old endpoint instead — see app/routers/push.py for why that's safe.
 * Safari fires this unreliably; lib/push.ts's sync-on-open is the real safety
 * net there. */
self.addEventListener("pushsubscriptionchange", (event) => {
  event.waitUntil(
    (async () => {
      const old =
        event.oldSubscription ||
        (await self.registration.pushManager.getSubscription());
      const appServerKey =
        (event.newSubscription && event.newSubscription.options && event.newSubscription.options.applicationServerKey) ||
        (old && old.options && old.options.applicationServerKey);
      if (!appServerKey || !API_BASE) return;

      const fresh =
        event.newSubscription ||
        (await self.registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: appServerKey,
        }));

      const body = fresh.toJSON();
      body.old_endpoint = old ? old.endpoint : null;

      await fetch(`${API_BASE}/push/rotate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }).catch(() => {});
    })()
  );
});
