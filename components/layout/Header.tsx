"use client";

import { Bell, UserCog } from "lucide-react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";
import { ROLE_LABELS } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { MobileNav } from "@/components/layout/MobileNav";
import type { ApiResponse, PaginatedData, Notification } from "@/types";

interface HeaderProps {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
}

export function Header({ title, subtitle, actions }: HeaderProps) {
  const { user, effectiveRole, isActingAs } = useAuth();
  const { data } = useQuery({
    queryKey: ["notifications-unread-count"],
    queryFn: async () => {
      const res = await api.get<ApiResponse<PaginatedData<Notification>>>(
        "/notifications?is_read=false&per_page=1"
      );
      return res.data.data.total;
    },
    refetchInterval: 30_000,
  });

  const unreadCount = data ?? 0;

  return (
    <header className="flex items-center justify-between gap-2 px-4 md:px-6 py-3 md:py-4 border-b bg-background/95 backdrop-blur-sm sticky top-0 z-10">
      <div className="flex items-center gap-2 min-w-0">
        {/* Mobile menu trigger — hidden at md+ where the sidebar is shown */}
        <MobileNav />
        <div className="min-w-0">
          <h1 className="text-lg md:text-xl font-bold text-foreground truncate">{title}</h1>
          {subtitle && (
            <p className="text-xs md:text-sm text-muted-foreground truncate">{subtitle}</p>
          )}
        </div>
      </div>

      <div className="flex items-center gap-1.5 md:gap-2 shrink-0">
        {user && (
          <Tooltip delayDuration={200}>
            <TooltipTrigger asChild>
              <Badge
                variant="outline"
                className={
                  isActingAs
                    ? "gap-1.5 h-7 px-2.5 border-amber-300 bg-amber-50 text-amber-800 font-medium"
                    : "gap-1.5 h-7 px-2.5 border-border bg-muted/50 text-foreground/80 font-medium hidden sm:flex"
                }
              >
                <UserCog className="w-3.5 h-3.5" />
                {isActingAs
                  ? `Acting as ${ROLE_LABELS[effectiveRole ?? ""] ?? effectiveRole}`
                  : ROLE_LABELS[effectiveRole ?? ""] ?? effectiveRole}
              </Badge>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              {isActingAs
                ? `Real role: ${ROLE_LABELS[user.role] ?? user.role} — you're currently acting as ${ROLE_LABELS[effectiveRole ?? ""] ?? effectiveRole}`
                : `You're signed in as ${ROLE_LABELS[user.role] ?? user.role}`}
            </TooltipContent>
          </Tooltip>
        )}
        {actions}
        <Button variant="ghost" size="icon" className="relative" asChild>
          <Link href="/notifications">
            <Bell className="w-5 h-5" />
            {unreadCount > 0 && (
              <Badge
                className="absolute -top-1 -right-1 h-4 min-w-4 px-1 text-[10px] flex items-center justify-center"
                variant="destructive"
              >
                {unreadCount > 99 ? "99+" : unreadCount}
              </Badge>
            )}
          </Link>
        </Button>
      </div>
    </header>
  );
}
