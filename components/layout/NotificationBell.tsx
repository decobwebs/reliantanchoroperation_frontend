"use client";

import Link from "next/link";
import { Bell } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import type { ApiResponse, PaginatedData, Notification } from "@/types";

/**
 * Unread-count bell. Shared by the classic page header and the Command Center
 * top bar so the polling query is registered once per query key.
 */
export function NotificationBell({ className }: { className?: string }) {
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

  const unread = data ?? 0;

  return (
    <Link
      href="/notifications"
      aria-label={unread > 0 ? `Notifications, ${unread} unread` : "Notifications"}
      className={cn(
        "relative flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200/80 bg-card",
        "text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
        "dark:border-border",
        className
      )}
    >
      <Bell className="h-4.5 w-4.5" strokeWidth={2} />
      {unread > 0 && (
        <span
          className={cn(
            "absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full px-1",
            "bg-rose-500 text-[10px] font-bold tabular-nums text-white ring-2 ring-background"
          )}
        >
          {unread > 99 ? "99+" : unread}
        </span>
      )}
    </Link>
  );
}
