"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { Loader2, Anchor, Bell, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { getInitials } from "@/lib/utils";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { TooltipProvider } from "@/components/ui/tooltip";

const NAV = [
  { href: "/portal", label: "Dashboard" },
  { href: "/portal/operations", label: "My Operations" },
];

export default function PortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, loading, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!loading && !user) router.push("/login");
    if (!loading && user && user.role !== "client") router.push("/");
  }, [user, loading, router]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user || user.role !== "client") return null;

  return (
    <TooltipProvider>
      <div className="min-h-screen bg-muted/30">
        {/* Top nav bar for clients */}
        <header className="bg-[oklch(0.18_0.06_240)] text-white sticky top-0 z-20 shadow-md">
          <div className="max-w-6xl mx-auto px-6 py-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-[oklch(0.82_0.15_75)] flex items-center justify-center">
                <Anchor className="w-4 h-4 text-[oklch(0.15_0.025_240)]" />
              </div>
              <span className="font-bold text-sm tracking-tight">
                Reliant Anchor
              </span>
              <span className="text-white/30 text-xs">Client Portal</span>
            </div>

            <nav className="hidden md:flex items-center gap-1">
              {NAV.map((n) => (
                <Link
                  key={n.href}
                  href={n.href}
                  className={cn(
                    "px-3 py-1.5 rounded-md text-sm font-medium transition-colors",
                    pathname === n.href
                      ? "bg-white/15 text-white"
                      : "text-white/70 hover:text-white hover:bg-white/10"
                  )}
                >
                  {n.label}
                </Link>
              ))}
            </nav>

            <div className="flex items-center gap-3">
              <Avatar className="w-7 h-7 bg-[oklch(0.82_0.15_75)]">
                <AvatarFallback className="text-[11px] bg-[oklch(0.82_0.15_75)] text-[oklch(0.15_0.025_240)] font-semibold">
                  {getInitials(user.full_name)}
                </AvatarFallback>
              </Avatar>
              <span className="text-xs text-white/70 hidden sm:block">
                {user.full_name}
              </span>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-white/60 hover:text-white hover:bg-white/10"
                onClick={logout}
              >
                <LogOut className="w-3.5 h-3.5" />
              </Button>
            </div>
          </div>
        </header>

        <main className="max-w-6xl mx-auto px-6 py-8">{children}</main>
      </div>
    </TooltipProvider>
  );
}
