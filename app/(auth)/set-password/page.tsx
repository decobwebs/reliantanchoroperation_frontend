"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2, Eye, EyeOff, AlertCircle, CheckCircle2 } from "lucide-react";
import { api, getErrorMessage } from "@/lib/api";
import { completeSession } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const schema = z
  .object({
    password: z.string().min(8, "Password must be at least 8 characters"),
    confirm: z.string(),
  })
  .refine((d) => d.password === d.confirm, {
    message: "Passwords do not match",
    path: ["confirm"],
  });

type FormData = z.infer<typeof schema>;

// Matches the login page's field treatment exactly, for visual parity.
const fieldClass =
  "h-11 rounded-lg border-border bg-card px-4 shadow-xs placeholder:text-muted-foreground/60";

/**
 * Landing page for the "set your password" link a Bunker Manager's invite email
 * (or a forgot-password reset) points to. Supabase's /verify endpoint redirects
 * here with access_token/refresh_token/type in the URL FRAGMENT (not a query
 * string), so we read window.location.hash — not useSearchParams — and this
 * needs no Suspense boundary as a result.
 */
export default function SetPasswordPage() {
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);
  const [tokens, setTokens] = useState<{ access: string; refresh: string | null } | null>(null);
  const [linkError, setLinkError] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({ resolver: zodResolver(schema) });

  useEffect(() => {
    const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
    const accessToken = hash.get("access_token");
    const refreshToken = hash.get("refresh_token");
    const type = hash.get("type");

    if (!accessToken || (type && type !== "recovery" && type !== "invite")) {
      setLinkError(true);
      return;
    }
    setTokens({ access: accessToken, refresh: refreshToken });
    // Clear the sensitive tokens from the visible URL/browser history.
    window.history.replaceState(null, "", window.location.pathname);
  }, []);

  async function onSubmit(data: FormData) {
    if (!tokens) return;
    setSubmitError(null);
    try {
      await api.post("/auth/reset-password", {
        token: tokens.access,
        new_password: data.password,
      });
      const user = await completeSession(tokens.access, tokens.refresh);
      setSuccess(true);
      setTimeout(() => {
        router.push(user.role === "client" ? "/portal" : "/");
      }, 1200);
    } catch (err) {
      setSubmitError(getErrorMessage(err));
    }
  }

  return (
    // Same bg-white + split-screen treatment as the login page, for visual
    // parity — the panel image's left edge is #FEFEFE, so anything darker
    // leaves a visible seam between the columns.
    <div className="min-h-screen bg-white lg:grid lg:grid-cols-2">
      {/* ── Form column ─────────────────────────────────────────────── */}
      <div className="flex min-h-screen flex-col px-6 py-10 sm:px-10">
        <div className="flex flex-1 items-center justify-center">
          <div className="w-full max-w-[400px]">
            <div className="mb-12 flex items-center gap-4">
              <div className="h-14 w-14 shrink-0 overflow-hidden">
                <Image
                  src="/logo-mark.png"
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

            {linkError ? (
              <div className="space-y-3 text-center">
                <AlertCircle className="mx-auto h-10 w-10 text-destructive" />
                <h1 className="text-2xl font-bold tracking-tight text-foreground">Link invalid or expired</h1>
                <p className="text-sm text-muted-foreground">
                  This password-setup link is no longer valid. Ask your Bunker Manager
                  to resend it, or use &ldquo;Forgot password&rdquo; on the sign-in page.
                </p>
                <Button className="mt-2 h-11 w-full rounded-lg text-[0.9375rem] font-semibold" onClick={() => router.push("/login")}>
                  Back to sign in
                </Button>
              </div>
            ) : success ? (
              <div className="space-y-3 text-center">
                <CheckCircle2 className="mx-auto h-10 w-10 text-emerald-600" />
                <h1 className="text-2xl font-bold tracking-tight text-foreground">Password set</h1>
                <p className="text-sm text-muted-foreground">Signing you in…</p>
              </div>
            ) : (
              <>
                <h1 className="text-3xl font-bold tracking-tight text-foreground">
                  Set your password
                </h1>
                <p className="mt-2 text-sm text-muted-foreground">
                  Choose a password for your Reliant Anchor account.
                </p>

                <form onSubmit={handleSubmit(onSubmit)} className="mt-10 space-y-6">
                  {submitError && (
                    <div className="flex items-start gap-2.5 rounded-lg border border-destructive/40 bg-destructive/10 px-3.5 py-3 text-sm text-destructive">
                      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                      <span>{submitError}</span>
                    </div>
                  )}

                  <div className="space-y-2">
                    <Label htmlFor="password" className="text-[0.9375rem] font-semibold">
                      New password
                    </Label>
                    <div className="relative">
                      <Input
                        id="password"
                        type={showPassword ? "text" : "password"}
                        placeholder="••••••••"
                        autoComplete="new-password"
                        autoFocus
                        disabled={!tokens}
                        {...register("password")}
                        className={`${fieldClass} pr-11 ${errors.password ? "border-destructive" : ""}`}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword((v) => !v)}
                        className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground"
                        tabIndex={-1}
                        aria-label={showPassword ? "Hide password" : "Show password"}
                      >
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                    {errors.password && (
                      <p className="text-xs text-destructive">{errors.password.message}</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="confirm" className="text-[0.9375rem] font-semibold">
                      Confirm password
                    </Label>
                    <Input
                      id="confirm"
                      type={showPassword ? "text" : "password"}
                      placeholder="••••••••"
                      autoComplete="new-password"
                      disabled={!tokens}
                      {...register("confirm")}
                      className={`${fieldClass} ${errors.confirm ? "border-destructive" : ""}`}
                    />
                    {errors.confirm && (
                      <p className="text-xs text-destructive">{errors.confirm.message}</p>
                    )}
                  </div>

                  <Button
                    type="submit"
                    className="h-11 w-full rounded-lg text-[0.9375rem] font-semibold"
                    disabled={isSubmitting || !tokens}
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Setting password…
                      </>
                    ) : (
                      "Set password & sign in"
                    )}
                  </Button>
                </form>
              </>
            )}
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
          src="/auth-panel.png"
          alt=""
          fill
          priority
          sizes="50vw"
          className="object-cover object-[60%_75%]"
        />
      </div>
    </div>
  );
}
