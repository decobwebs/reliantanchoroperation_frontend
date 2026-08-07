"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { Sidebar } from "@/components/layout/Sidebar";
import { SidebarProvider } from "@/components/layout/SidebarContext";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import { ROLE_LABELS } from "@/lib/auth";
import {
  UserCog,
} from "lucide-react";
import { Spinner } from "@/components/ui/spinner";
import { SessionGuard } from "@/components/SessionGuard";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, loading, effectiveRole, isActingAs, clearActAs } = useAuth();
  const router = useRouter();
  const [clearing, setClearing] = useState(false);

  const handleSwitchBack = async () => {
    try {
      setClearing(true);
      await clearActAs();
    } finally {
      setClearing(false);
    }
  };

  useEffect(() => {
    if (!loading && !user) {
      router.push("/login");
    }
    // Clients should go to portal, not dashboard
    if (!loading && user?.role === "client") {
      router.push("/portal");
    }
  }, [user, loading, router]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Spinner size={32} className="text-primary" />
      </div>
    );
  }

  if (!user || user.role === "client") return null;

  return (
    <TooltipProvider>
      <SessionGuard />
      <SidebarProvider>
        <div className="flex h-screen overflow-hidden bg-shell">
          <Sidebar />
          <main className="flex-1 flex flex-col overflow-hidden">
            {isActingAs && (
              <div className="flex items-center justify-between gap-3 px-4 md:px-6 py-2 bg-amber-50 border-b border-amber-200 text-amber-800 shrink-0">
                <div className="flex items-center gap-2 min-w-0">
                  <UserCog className="w-4 h-4 shrink-0" />
                  <p className="text-xs md:text-sm font-medium truncate">
                    Acting as{" "}
                    <span className="font-semibold">
                      {ROLE_LABELS[effectiveRole ?? ""] ?? effectiveRole}
                    </span>
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 shrink-0 text-xs border-amber-300 bg-white/70 text-amber-800 hover:bg-amber-100 hover:text-amber-900"
                  onClick={handleSwitchBack}
                  disabled={clearing}
                >
                  {clearing && <Spinner size={12} className="mr-1.5" />}
                  Switch back to Bunker Manager
                </Button>
              </div>
            )}
            <div className="flex-1 overflow-y-auto scrollbar-slim bg-background">{children}</div>
          </main>
        </div>
      </SidebarProvider>
    </TooltipProvider>
  );
}
