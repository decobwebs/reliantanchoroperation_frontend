import { api, setAccessToken, extractData } from "./api";
import { syncPush } from "./push";
import type { AuthTokens, User } from "@/types";

export async function login(email: string, password: string): Promise<User> {
  const res = await api.post<{ data: AuthTokens }>("/auth/login", {
    email,
    password,
  });
  const tokens = extractData(res);

  // Store in memory
  setAccessToken(tokens.access_token);

  // Persist session via Next.js route handler (sets httpOnly cookie)
  await fetch("/api/auth/session", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
    }),
  });

  // Fetch user profile
  const meRes = await api.get<{ data: User }>("/auth/me");
  const user = extractData(meRes);

  // Fire-and-forget — must never block the post-login redirect. On a shared
  // field device this browser's push endpoint is the same regardless of who
  // signs in; the backend's upsert reassigns it to this user, so whoever was
  // signed in before stops receiving on it from this moment.
  void syncPush();

  return user;
}

/**
 * Persist a session from tokens we already hold (e.g. the recovery tokens
 * Supabase appends to the /set-password redirect) — same effect as login(),
 * without re-submitting credentials.
 */
export async function completeSession(
  accessToken: string,
  refreshToken?: string | null
): Promise<User> {
  setAccessToken(accessToken);
  await fetch("/api/auth/session", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ access_token: accessToken, refresh_token: refreshToken }),
  });
  const user = await fetchMe();
  void syncPush();
  return user;
}

// Deliberately does NOT unsubscribe this device from push. Signing out ends
// the session, not the subscription — the whole point of push is reaching a
// user who isn't in the app, and a subscription outliving the session is what
// makes that work. The trade-off: on a device shared between people, the
// PREVIOUS user's alerts keep arriving here until someone else signs in and
// syncPush() (called from login(), above) reassigns the endpoint to them. If
// you're tempted to add disablePush() here to "fix" that: don't — that was a
// deliberate product decision, not an oversight. The explicit "turn off
// notifications" switch on /notifications is the only thing that should call
// disablePush().
export async function logout(): Promise<void> {
  try {
    await api.post("/auth/logout");
  } catch {
    // Ignore errors — clear session regardless
  }
  setAccessToken(null);
  await fetch("/api/auth/logout", { method: "POST" });
}

export async function fetchMe(): Promise<User> {
  const res = await api.get<{ data: User }>("/auth/me");
  return extractData(res);
}

// Role helpers
// Display names only. The stored role values never change — renaming a role
// is a labelling decision, and rewriting them would orphan every existing row.
export const ROLE_LABELS: Record<string, string> = {
  bunker_manager: "Bunker Manager",
  ops_supervisor: "Ops Supervisor",
  logistics_officer: "Truck Operation",
  cargo_superintendent: "Marine Operations",
  finance_manager: "Finance Manager",
  client: "Client",
  marine_operator: "Marine Operator",
};

export function isStaff(role: string): boolean {
  return role !== "client";
}

export function canAccessAnalytics(role: string): boolean {
  return ["bunker_manager", "finance_manager", "ops_supervisor"].includes(role);
}

export function canManageFinance(role: string): boolean {
  return ["bunker_manager", "finance_manager"].includes(role);
}
