/**
 * Axios API client.
 * – Auto-injects Bearer token from the in-memory store (populated after login).
 * – On 401 → clears session and redirects to /login (client-side only).
 * – Token is kept in a module-level variable (not localStorage) and is also
 *   set as an httpOnly cookie by our Next.js route handler for SSR reads.
 */
import axios, { AxiosError, InternalAxiosRequestConfig } from "axios";

const BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";

// In-memory token store (cleared on page refresh — refresh handled by cookie)
let _accessToken: string | null = null;

export function setAccessToken(token: string | null) {
  _accessToken = token;
}

export function getAccessToken(): string | null {
  return _accessToken;
}

export const api = axios.create({
  baseURL: BASE_URL,
  timeout: 60_000,
  headers: { "Content-Type": "application/json" },
});

// ── Request interceptor: inject Bearer token ──────────────────────────────────
api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  if (_accessToken) {
    config.headers.Authorization = `Bearer ${_accessToken}`;
  }
  return config;
});

// ── Token refresh (single-flight) ────────────────────────────────────────────
// The session cookie stores a refresh_token that outlives the access token.
// On a 401 we exchange it for a fresh access token and retry the request once,
// instead of dumping the user to /login the moment the access token expires.
let _refreshing: Promise<string | null> | null = null;

async function refreshAccessToken(): Promise<string | null> {
  try {
    const sessRes = await fetch("/api/auth/session");
    if (!sessRes.ok) return null;
    const { refresh_token } = await sessRes.json();
    if (!refresh_token) return null;
    // Call the backend directly (bare axios) so this request skips the interceptor.
    const res = await axios.post(
      `${BASE_URL}/auth/refresh`,
      { refresh_token },
      { headers: { "Content-Type": "application/json" }, timeout: 30_000 }
    );
    const tokens = res.data?.data;
    if (!tokens?.access_token) return null;
    setAccessToken(tokens.access_token);
    await fetch("/api/auth/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token ?? refresh_token,
      }),
    }).catch(() => {});
    return tokens.access_token;
  } catch {
    return null;
  }
}

// ── Response interceptor: refresh-on-401, else logout ─────────────────────────
api.interceptors.response.use(
  (res) => res,
  async (error: AxiosError) => {
    const original = error.config as
      | (InternalAxiosRequestConfig & { _retried?: boolean })
      | undefined;
    const url = original?.url ?? "";
    // Never try to refresh the auth endpoints themselves (avoids loops).
    const isAuthEndpoint =
      url.includes("/auth/login") ||
      url.includes("/auth/bootstrap") ||
      url.includes("/auth/refresh");

    if (
      error.response?.status === 401 &&
      typeof window !== "undefined" &&
      !isAuthEndpoint &&
      original &&
      !original._retried
    ) {
      original._retried = true;
      if (!_refreshing) {
        _refreshing = refreshAccessToken().finally(() => {
          _refreshing = null;
        });
      }
      const newToken = await _refreshing;
      if (newToken) {
        original.headers = original.headers ?? {};
        original.headers.Authorization = `Bearer ${newToken}`;
        return api(original);
      }
      // Refresh failed → session is truly dead; sign out.
      setAccessToken(null);
      await fetch("/api/auth/logout", { method: "POST" }).catch(() => {});
      window.location.href = "/login";
    }
    return Promise.reject(error);
  }
);

// ── Typed helpers ─────────────────────────────────────────────────────────────

export function extractData<T>(response: { data: { data: T } }): T {
  return response.data.data;
}

export function getErrorMessage(error: unknown): string {
  if (axios.isAxiosError(error)) {
    const body = error.response?.data as
      | { message?: string; errors?: string[] }
      | undefined;
    if (body?.errors?.length) return body.errors[0];
    if (body?.message) return body.message;
    return error.message;
  }
  if (error instanceof Error) return error.message;
  return "An unexpected error occurred";
}
