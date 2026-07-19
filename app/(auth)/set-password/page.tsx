"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2, Eye, EyeOff, AlertCircle, CheckCircle2 } from "lucide-react";
import { api, getErrorMessage } from "@/lib/api";
import { completeSession } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

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
    <div className="min-h-screen flex items-center justify-center bg-linear-to-br from-[oklch(0.18_0.06_240)] via-[oklch(0.22_0.07_240)] to-[oklch(0.15_0.05_240)] p-4">
      <div
        className="absolute inset-0 opacity-5"
        style={{
          backgroundImage:
            "radial-gradient(circle at 1px 1px, white 1px, transparent 0)",
          backgroundSize: "32px 32px",
        }}
      />

      <div className="relative w-full max-w-md">
        <div className="flex flex-col items-center mb-8">
          <div className="flex items-center justify-center w-20 h-20 rounded-2xl bg-white mb-4 shadow-lg overflow-hidden">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.jpeg" alt="Reliant Anchor Logistics" className="w-full h-full object-contain p-1" />
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">
            Reliant Anchor
          </h1>
          <p className="text-sm text-white/50 mt-1">
            Operations Management System
          </p>
        </div>

        <Card className="border-0 shadow-2xl">
          {linkError ? (
            <CardContent className="pt-6 text-center space-y-3">
              <AlertCircle className="w-10 h-10 text-destructive mx-auto" />
              <CardTitle className="text-lg">Link invalid or expired</CardTitle>
              <CardDescription>
                This password-setup link is no longer valid. Ask your Bunker Manager
                to resend it, or use &ldquo;Forgot password&rdquo; on the sign-in page.
              </CardDescription>
              <Button className="w-full mt-2" onClick={() => router.push("/login")}>
                Back to sign in
              </Button>
            </CardContent>
          ) : success ? (
            <CardContent className="pt-6 text-center space-y-3">
              <CheckCircle2 className="w-10 h-10 text-emerald-600 mx-auto" />
              <CardTitle className="text-lg">Password set</CardTitle>
              <CardDescription>Signing you in…</CardDescription>
            </CardContent>
          ) : (
            <>
              <CardHeader className="pb-4">
                <CardTitle className="text-xl">Set your password</CardTitle>
                <CardDescription>
                  Choose a password for your Reliant Anchor account.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                  {submitError && (
                    <div className="flex items-start gap-2.5 rounded-md border border-destructive/40 bg-destructive/10 px-3.5 py-3 text-sm text-destructive">
                      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                      <span>{submitError}</span>
                    </div>
                  )}

                  <div className="space-y-1.5">
                    <Label htmlFor="password">New password</Label>
                    <div className="relative">
                      <Input
                        id="password"
                        type={showPassword ? "text" : "password"}
                        placeholder="••••••••"
                        autoComplete="new-password"
                        autoFocus
                        disabled={!tokens}
                        {...register("password")}
                        className={errors.password ? "border-destructive pr-10" : "pr-10"}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword((v) => !v)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                        tabIndex={-1}
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                    {errors.password && (
                      <p className="text-xs text-destructive">{errors.password.message}</p>
                    )}
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="confirm">Confirm password</Label>
                    <Input
                      id="confirm"
                      type={showPassword ? "text" : "password"}
                      placeholder="••••••••"
                      autoComplete="new-password"
                      disabled={!tokens}
                      {...register("confirm")}
                      className={errors.confirm ? "border-destructive" : ""}
                    />
                    {errors.confirm && (
                      <p className="text-xs text-destructive">{errors.confirm.message}</p>
                    )}
                  </div>

                  <Button
                    type="submit"
                    className="w-full font-semibold"
                    disabled={isSubmitting || !tokens}
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Setting password…
                      </>
                    ) : (
                      "Set password & sign in"
                    )}
                  </Button>
                </form>
              </CardContent>
            </>
          )}
        </Card>

        <div className="text-center mt-6">
          <p className="text-xs text-white/30">
            © {new Date().getFullYear()} Reliant Anchor Ltd. All rights reserved.
          </p>
        </div>
      </div>
    </div>
  );
}
