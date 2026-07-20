"use client";

import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
} from "react";
import { useRouter } from "next/navigation";
import { api, setAccessToken } from "@/lib/api";
import { login as apiLogin, logout as apiLogout, fetchMe } from "@/lib/auth";
import type { User } from "@/types";

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  effectiveRole: string | null;
  isActingAs: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  actAs: (role: string) => Promise<void>;
  clearActAs: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  // On mount: try to restore session from cookie via our route handler
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/auth/session");
        if (res.ok) {
          const { access_token } = await res.json();
          if (access_token) {
            setAccessToken(access_token);
            const me = await fetchMe();
            setUser(me);
          }
        }
      } catch {
        // No valid session
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const login = useCallback(
    async (email: string, password: string) => {
      const me = await apiLogin(email, password);
      setUser(me);
      // Route based on role, honoring a ?from= deep-link for staff when it is a
      // safe internal path (not the portal, not another absolute URL).
      if (me.role === "client") {
        router.push("/portal");
        return;
      }
      const from =
        typeof window !== "undefined"
          ? new URLSearchParams(window.location.search).get("from")
          : null;
      const safeFrom =
        from && from.startsWith("/") && !from.startsWith("//") && !from.startsWith("/portal")
          ? from
          : null;
      router.push(safeFrom ?? "/");
    },
    [router]
  );

  // Re-fetches /auth/me so `user` (and therefore `effectiveRole`) reflects the
  // latest acting-as state. Shared by actAs/clearActAs.
  const refreshUser = useCallback(async () => {
    const me = await fetchMe();
    setUser(me);
    return me;
  }, []);

  const actAs = useCallback(
    async (role: string) => {
      await api.post("/auth/act-as", { role });
      await refreshUser();
    },
    [refreshUser]
  );

  const clearActAs = useCallback(async () => {
    await api.post("/auth/act-as/clear");
    await refreshUser();
  }, [refreshUser]);

  const logout = useCallback(async () => {
    try {
      // Best-effort — a failed clear shouldn't block logout.
      await clearActAs();
    } catch {
      // ignore
    }
    await apiLogout();
    setUser(null);
    router.push("/login");
  }, [router, clearActAs]);

  const effectiveRole = user?.acting_as_role ?? user?.role ?? null;
  const isActingAs = !!user?.acting_as_role;

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        effectiveRole,
        isActingAs,
        login,
        logout,
        actAs,
        clearActAs,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
