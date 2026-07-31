"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { Bell, Check } from "lucide-react";
import { toast } from "sonner";
import { api, getErrorMessage } from "@/lib/api";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { PanelCard } from "@/components/dashboard/PanelCard";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { cn, formatDateTime } from "@/lib/utils";
import type { ApiResponse, PaginatedData, Notification } from "@/types";

export default function NotificationsPage() {
  const qc = useQueryClient();
  const router = useRouter();

  const { data, isLoading } = useQuery({
    queryKey: ["notifications"],
    queryFn: async () => {
      const res = await api.get<ApiResponse<PaginatedData<Notification>>>(
        "/notifications?per_page=50"
      );
      return res.data.data;
    },
  });

  const markAllRead = useMutation({
    mutationFn: () => api.put("/notifications/read-all"),
    onSuccess: () => {
      toast.success("All notifications marked as read");
      qc.invalidateQueries({ queryKey: ["notifications"] });
      qc.invalidateQueries({ queryKey: ["notifications-unread-count"] });
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  const markRead = useMutation({
    mutationFn: (id: string) => api.post(`/notifications/${id}/read`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["notifications"] });
      qc.invalidateQueries({ queryKey: ["notifications-unread-count"] });
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  // Where a notification points to. Prefer an explicit action_url, else the operation.
  const targetOf = (n: { action_url?: string | null; operation_id?: string | null }) =>
    n.action_url || (n.operation_id ? `/operations/${n.operation_id}` : null);

  const notifications = data?.items ?? [];
  const unread = notifications.filter((n) => !n.is_read).length;

  return (
    <DashboardShell
      icon={Bell}
      iconTone="blue"
      showRole={false}
      title="Notifications"
      subtitle={unread > 0 ? `${unread} unread` : "All caught up"}
      actions={
        unread > 0 ? (
          <Button
            variant="outline"
            className="h-10.5 gap-2 rounded-xl border-navy-100 px-4 text-[13px] font-semibold dark:border-border"
            onClick={() => markAllRead.mutate()}
            disabled={markAllRead.isPending}
          >
            <Check className="h-4 w-4" strokeWidth={2.5} />
            Mark all read
          </Button>
        ) : undefined
      }
    >
      {isLoading ? (
        <Skeleton className="h-96 w-full rounded-2xl" />
      ) : (
        <PanelCard
          icon={Bell}
          tone="blue"
          title="Inbox"
          subtitle={notifications.length ? `${notifications.length} total` : undefined}
          flush
          className="animate-rise"
        >
          {notifications.length ? (
            <div className="divide-y divide-border/70">
              {notifications.map((n) => {
                const target = targetOf(n);
                return (
                  <div
                    key={n.id}
                    role={target ? "button" : undefined}
                    tabIndex={target ? 0 : undefined}
                    onClick={() => {
                      if (!n.is_read) markRead.mutate(n.id);
                      if (target) router.push(target);
                    }}
                    className={cn(
                      "flex items-start gap-4 px-4 py-4 transition-colors lg:px-5",
                      !n.is_read && "bg-brand-50/60 dark:bg-brand-500/10",
                      target && "cursor-pointer hover:bg-muted/40"
                    )}
                  >
                    <span
                      aria-hidden="true"
                      className={cn(
                        "mt-1.5 h-2 w-2 shrink-0 rounded-full",
                        !n.is_read ? "bg-brand-500" : "bg-transparent"
                      )}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-[13px] font-semibold text-foreground">{n.title}</p>
                        <span className="shrink-0 whitespace-nowrap text-[11px] tabular-nums text-muted-foreground">
                          {formatDateTime(n.created_at)}
                        </span>
                      </div>
                      <p className="mt-0.5 text-[12.5px] text-muted-foreground">{n.message}</p>
                      {n.priority === "urgent" && (
                        <Badge variant="destructive" className="mt-1.5 rounded-lg text-[10px]">
                          Urgent
                        </Badge>
                      )}
                    </div>
                    {!n.is_read && (
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label="Mark as read"
                        className="h-7 w-7 shrink-0 text-muted-foreground hover:text-foreground"
                        onClick={(e) => { e.stopPropagation(); markRead.mutate(n.id); }}
                      >
                        <Check className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <Bell className="h-9 w-9 text-muted-foreground/25" strokeWidth={1.5} />
              <p className="mt-3 text-sm font-medium text-foreground">No notifications</p>
              <p className="mt-1 text-xs text-muted-foreground">You&apos;re all caught up.</p>
            </div>
          )}
        </PanelCard>
      )}
    </DashboardShell>
  );
}
