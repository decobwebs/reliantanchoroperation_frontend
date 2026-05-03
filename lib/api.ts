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

// ── Response interceptor: handle 401 ─────────────────────────────────────────
api.interceptors.response.use(
  (res) => res,
  async (error: AxiosError) => {
    const url = error.config?.url ?? "";
    const isAuthEndpoint = url.includes("/auth/login") || url.includes("/auth/bootstrap");
    if (error.response?.status === 401 && typeof window !== "undefined" && !isAuthEndpoint) {
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
