import { api, setAccessToken, extractData } from "./api";
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
  return extractData(meRes);
}

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
export const ROLE_LABELS: Record<string, string> = {
  bunker_manager: "Bunker Manager",
  ops_supervisor: "Ops Supervisor",
  logistics_officer: "Logistics Officer",
  marine_manager: "Marine Manager",
  finance_manager: "Finance Manager",
  client: "Client",
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
