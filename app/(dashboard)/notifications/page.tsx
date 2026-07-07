"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { Bell, Check, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { api, getErrorMessage } from "@/lib/api";
import { Header } from "@/components/layout/Header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatDateTime } from "@/lib/utils";
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
    <div>
      <Header
        title="Notifications"
        subtitle={unread > 0 ? `${unread} unread` : "All caught up"}
        actions={
          unread > 0 ? (
            <Button
              variant="outline"
              size="sm"
              onClick={() => markAllRead.mutate()}
              disabled={markAllRead.isPending}
            >
              <Check className="w-3.5 h-3.5 mr-1.5" />
              Mark all read
            </Button>
          ) : undefined
        }
      />

      <div className="p-6">
        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-7 h-7 animate-spin text-primary" />
          </div>
        ) : (
          <Card className="border-0 shadow-sm">
            <CardContent className="p-0">
              {notifications.length ? (
                <div className="divide-y">
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
                      className={`flex items-start gap-4 px-5 py-4 transition-colors ${
                        !n.is_read ? "bg-primary/5" : ""
                      } ${target ? "cursor-pointer hover:bg-muted/40" : ""}`}
                    >
                      <div
                        className={`mt-0.5 w-2 h-2 rounded-full flex-shrink-0 ${
                          !n.is_read ? "bg-primary" : "bg-transparent"
                        }`}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-sm font-medium">{n.title}</p>
                          <span className="text-[10px] text-muted-foreground flex-shrink-0 whitespace-nowrap">
                            {formatDateTime(n.created_at)}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {n.message}
                        </p>
                        {n.priority === "urgent" && (
                          <Badge variant="destructive" className="text-[10px] mt-1.5">
                            Urgent
                          </Badge>
                        )}
                      </div>
                      {!n.is_read && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 flex-shrink-0"
                          onClick={(e) => { e.stopPropagation(); markRead.mutate(n.id); }}
                        >
                          <Check className="w-3 h-3" />
                        </Button>
                      )}
                    </div>
                    );
                  })}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                  <Bell className="w-10 h-10 mb-3 opacity-30" />
                  <p className="text-sm">No notifications</p>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
