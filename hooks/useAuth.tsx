"use client";

import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
} from "react";
import { useRouter } from "next/navigation";
import { setAccessToken } from "@/lib/api";
import { login as apiLogin, logout as apiLogout, fetchMe } from "@/lib/auth";
import type { User } from "@/types";

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
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

  const logout = useCallback(async () => {
    await apiLogout();
    setUser(null);
    router.push("/login");
  }, [router]);

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
