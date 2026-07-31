"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import {
  LogOut,
} from "lucide-react";
import { Spinner } from "@/components/ui/spinner";
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
      <div className="flex min-h-screen items-center justify-center">
        <Spinner size={32} className="text-brand-600" />
      </div>
    );
  }

  if (!user || user.role !== "client") return null;

  return (
    <TooltipProvider>
      <div className="min-h-screen bg-muted/30">
        {/* Top nav bar for clients — deliberately a lighter, simpler chrome
            than the internal Sidebar/DashboardShell, just recoloured to the
            brand navy gradient rather than restructured. */}
        <header className="brand-grad-sidebar sticky top-0 z-20 text-white shadow-md">
          <div className="mx-auto flex max-w-6xl items-center justify-between gap-2 px-4 py-3 md:px-6">
            <div className="flex min-w-0 items-center gap-2 md:gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-white ring-1 ring-white/20">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/logo-mark.png" alt="Reliant Anchor" className="h-full w-full object-contain" />
              </div>
              <span className="truncate text-[13px] font-bold tracking-tight">
                Reliant Anchor
              </span>
              <span className="hidden text-xs text-white/30 sm:inline">Client Portal</span>
            </div>

            <nav className="hidden items-center gap-1 md:flex">
              {NAV.map((n) => (
                <Link
                  key={n.href}
                  href={n.href}
                  className={cn(
                    "rounded-md px-3 py-1.5 text-[13px] font-medium transition-colors",
                    pathname === n.href
                      ? "bg-white/15 text-white"
                      : "text-white/70 hover:bg-white/10 hover:text-white"
                  )}
                >
                  {n.label}
                </Link>
              ))}
            </nav>

            <div className="flex items-center gap-3">
              <Avatar className="h-7 w-7">
                <AvatarFallback className="brand-grad-mark text-[11px] font-semibold text-white">
                  {getInitials(user.full_name)}
                </AvatarFallback>
              </Avatar>
              <span className="hidden text-xs text-white/70 sm:block">
                {user.full_name}
              </span>
              <Button
                variant="ghost"
                size="icon"
                aria-label="Log out"
                className="h-7 w-7 text-white/60 hover:bg-white/10 hover:text-white"
                onClick={logout}
              >
                <LogOut className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>

          {/* Mobile nav row — the desktop inline nav is hidden below md */}
          <div className="border-t border-white/10 md:hidden">
            <div className="mx-auto flex max-w-6xl gap-1 overflow-x-auto px-4 py-1.5">
              {NAV.map((n) => (
                <Link
                  key={n.href}
                  href={n.href}
                  className={cn(
                    "whitespace-nowrap rounded-md px-3 py-1.5 text-[13px] font-medium transition-colors",
                    pathname === n.href
                      ? "bg-white/15 text-white"
                      : "text-white/70 hover:bg-white/10 hover:text-white"
                  )}
                >
                  {n.label}
                </Link>
              ))}
            </div>
          </div>
        </header>

        <main className="mx-auto max-w-6xl px-4 py-6 md:px-6 md:py-8">{children}</main>
      </div>
    </TooltipProvider>
  );
}
