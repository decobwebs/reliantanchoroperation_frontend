"use client";

import { Bell } from "lucide-react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { MobileNav } from "@/components/layout/MobileNav";
import type { ApiResponse, PaginatedData, Notification } from "@/types";

interface HeaderProps {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
}

export function Header({ title, subtitle, actions }: HeaderProps) {
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
