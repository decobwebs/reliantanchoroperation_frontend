"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Eye,
  EyeOff,
  AlertCircle,
} from "lucide-react";
import { Spinner } from "@/components/ui/spinner";
import { useAuth } from "@/hooks/useAuth";
import { getErrorMessage } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const schema = z.object({
  email: z.string().email("Enter a valid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

type FormData = z.infer<typeof schema>;

const fieldClass =
  "h-11 rounded-lg border-border bg-card px-4 shadow-xs placeholder:text-muted-foreground/60";

export default function LoginPage() {
  const { login } = useAuth();
  const [showPassword, setShowPassword] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);
  // Read straight off the URL rather than useSearchParams(), which forces the
  // whole page behind a Suspense boundary just for one optional flag.
  const [expired, setExpired] = useState<string | null>(null);
  useEffect(() => {
    const fromUrl = new URLSearchParams(window.location.search).get("expired");
    const fromCookie = document.cookie
      .split("; ")
      .find((c) => c.startsWith("ra_session_ended="))
      ?.split("=")[1];
    if (fromCookie) {
      // Show it once, then clear — a stale banner on a later sign-in would be
      // confusing.
      document.cookie = "ra_session_ended=; Max-Age=0; path=/";
    }
    // Keep the first non-empty reading. In development React invokes effects
    // twice, and the second pass would otherwise read the cookie we just
    // cleared and blank the banner out again.
    setExpired((prev) => prev ?? fromUrl ?? fromCookie ?? null);
  }, []);
  const [shake, setShake] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({ resolver: zodResolver(schema) });

  async function onSubmit(data: FormData) {
    setLoginError(null);
    try {
      await login(data.email, data.password);
    } catch (err) {
      const msg = getErrorMessage(err);
      setLoginError(msg);
      setShake(true);
      setTimeout(() => setShake(false), 500);
    }
  }

  return (
    // bg-white rather than bg-background: the panel image's left edge is
    // #FEFEFE, so anything darker leaves a visible seam between the columns.
    <div className="min-h-screen bg-white lg:grid lg:grid-cols-2">
      {/* ── Form column ─────────────────────────────────────────────── */}
      <div className="flex min-h-screen flex-col px-6 py-10 sm:px-10">
        <div className="flex flex-1 items-center justify-center">
          <div
            className={`w-full max-w-[400px] ${
              shake ? "animate-[shake_0.4s_ease-in-out]" : ""
            }`}
          >
            {/* Brand lockup — the source PNG is the full stacked lockup, so the
                mark is zoomed to the anchor glyph (ink spans 40.5% down, half the
                canvas tall) and the wordmark is set in type instead. */}
            <div className="mb-12 flex items-center gap-4">
              <div className="h-14 w-14 shrink-0 overflow-hidden">
                <Image
                  src="/logo-mark-sm.png"
                  alt=""
                  width={160}
                  height={160}
                  priority
                  className="h-full w-full translate-y-[17%] scale-[1.75] object-cover"
                />
              </div>
              <div>
                <p className="text-2xl font-bold leading-none tracking-tight text-foreground">
                  Reliant Anchor
                </p>
                <p className="mt-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-brand-600">
                  Operations Management System
                </p>
              </div>
            </div>

            <h1 className="text-3xl font-bold tracking-tight text-foreground">
              Sign in to your account
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Enter your credentials to access the dashboard
            </p>

            <form onSubmit={handleSubmit(onSubmit)} className="mt-10 space-y-6">
              {expired && !loginError && (
                <div className="flex items-start gap-2.5 rounded-lg border border-amber-300 bg-amber-50 px-3.5 py-3 text-sm text-amber-800">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>
                    {expired === "idle"
                      ? "You were signed out after an hour of inactivity. Please sign in again."
                      : "Your session reached its 12-hour limit. Please sign in again."}
                  </span>
                </div>
              )}

              {loginError && (
                <div className="flex items-start gap-2.5 rounded-lg border border-destructive/40 bg-destructive/10 px-3.5 py-3 text-sm text-destructive">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>{loginError}</span>
                </div>
              )}

              {/* Email */}
              <div className="space-y-2">
                <Label htmlFor="email" className="text-[0.9375rem] font-semibold">
                  Email address
                </Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="you@reliantanchor.dev"
                  autoComplete="email"
                  autoFocus
                  {...register("email")}
                  className={`${fieldClass} ${errors.email ? "border-destructive" : ""}`}
                />
                {errors.email && (
                  <p className="text-xs text-destructive">{errors.email.message}</p>
                )}
              </div>

              {/* Password */}
              <div className="space-y-2">
                <Label htmlFor="password" className="text-[0.9375rem] font-semibold">
                  Password
                </Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="••••••••"
                    autoComplete="current-password"
                    {...register("password")}
                    className={`${fieldClass} pr-11 ${
                      errors.password ? "border-destructive" : ""
                    }`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground"
                    tabIndex={-1}
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
                {errors.password && (
                  <p className="text-xs text-destructive">{errors.password.message}</p>
                )}
              </div>

              <Button
                type="submit"
                className="h-11 w-full rounded-lg text-[0.9375rem] font-semibold"
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <>
                    <Spinner size={16} className="mr-2" />
                    Signing in…
                  </>
                ) : (
                  "Sign in"
                )}
              </Button>
            </form>
          </div>
        </div>

        {/* Footer */}
        <div className="mx-auto w-full max-w-[400px] pt-10">
          <p className="text-xs text-muted-foreground">
            © {new Date().getFullYear()} Reliant Anchor Ltd. All rights reserved.
          </p>
          <div className="mt-2 flex items-center gap-3 text-xs text-muted-foreground/70">
            <a href="/cookies" className="transition-colors hover:text-foreground">
              Cookies
            </a>
          </div>
        </div>
      </div>

      {/* ── Illustration column ─────────────────────────────────────── */}
      <div className="relative hidden lg:block">
        <Image
          src="/auth-panel.webp"
          alt=""
          fill
          priority
          sizes="50vw"
          /* The vessels sit low-right, so bias the crop away from empty sky. */
          className="object-cover object-[60%_75%]"
        />
      </div>
    </div>
  );
}
