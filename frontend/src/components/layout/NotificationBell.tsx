"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Bell, CheckCheck, Loader2 } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useSocket } from "@/context/SocketContext";
import { useNavCounts } from "@/hooks/useNavCounts";
import {
  NOTIFICATIONS_QUERY_KEY,
  useMarkAllNotificationsRead,
  useMarkNotificationRead,
  useNotifications,
} from "@/hooks/domains/useNotificationQueries";
import { NAV_COUNTS_QUERY_KEY } from "@/lib/nav-counts";
import { topbarActionButtonClassName } from "@/lib/theme/shell";
import { formatDateTime } from "@/lib/intl-date";
import { text } from "@/lib/theme/surface";
import { cn } from "@/lib/utils";
import type { AppNotification } from "@/types/api";

export function NotificationBell() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { socket } = useSocket();
  const [open, setOpen] = useState(false);

  const { data: counts } = useNavCounts();
  const unread = counts?.unreadNotifications ?? 0;

  const {
    data: notifications = [],
    isLoading,
  } = useNotifications(open) as {
    data?: AppNotification[];
    isLoading: boolean;
  };

  const markRead = useMarkNotificationRead();
  const markAllRead = useMarkAllNotificationsRead();

  useEffect(() => {
    if (!socket) return;
    const handleNotification = (payload: { title?: string }) => {
      queryClient.invalidateQueries({ queryKey: [NOTIFICATIONS_QUERY_KEY] });
      queryClient.invalidateQueries({ queryKey: [NAV_COUNTS_QUERY_KEY] });
      if (payload?.title) toast.message(payload.title);
    };
    socket.on("notificationCreated", handleNotification);
    return () => {
      socket.off("notificationCreated", handleNotification);
    };
  }, [socket, queryClient]);

  const handleItemClick = (notification: AppNotification) => {
    if (!notification.readAt) {
      markRead.mutate(notification.id);
    }
    if (notification.link) {
      setOpen(false);
      router.push(notification.link);
    }
  };

  return (
    <>
      <button
        type="button"
        className={cn(topbarActionButtonClassName({ active: open }), "relative")}
        aria-label={
          unread > 0 ? `Notifications — ${unread} unread` : "Notifications"
        }
        title="Notifications"
        onClick={() => setOpen(true)}
      >
        <Bell className="h-4 w-4" aria-hidden />
        {unread > 0 ? (
          <span
            aria-hidden
            className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-semibold leading-none text-destructive-foreground"
          >
            {unread > 9 ? "9+" : unread}
          </span>
        ) : null}
      </button>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="right" className="flex w-full flex-col gap-0 sm:max-w-md">
        <SheetHeader className="border-b pb-3">
          <div className="flex items-center justify-between gap-2 pr-8">
            <SheetTitle>Notifications</SheetTitle>
            {unread > 0 ? (
              <Button
                variant="ghost"
                size="sm"
                disabled={markAllRead.isPending}
                aria-busy={markAllRead.isPending || undefined}
                onClick={() => markAllRead.mutate()}
              >
                {markAllRead.isPending ? (
                  <Loader2
                    className="mr-1 h-4 w-4 animate-spin motion-reduce:animate-none"
                    aria-hidden
                  />
                ) : (
                  <CheckCheck className="mr-1 h-4 w-4" aria-hidden />
                )}
                {markAllRead.isPending ? "Marking…" : "Mark all read"}
              </Button>
            ) : null}
          </div>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto">
          {isLoading ? (
            <div className="space-y-3 p-4">
              <Skeleton className="h-14 w-full" />
              <Skeleton className="h-14 w-full" />
              <Skeleton className="h-14 w-full" />
            </div>
          ) : notifications.length === 0 ? (
            <p className={cn("p-6 text-center text-sm", text.muted)}>
              No notifications yet — alerts about stock, approvals, and
              maintenance will show up here.
            </p>
          ) : (
            <ul className="divide-y divide-border/60">
              {notifications.map((notification) => (
                <li key={notification.id}>
                  <button
                    type="button"
                    className={cn(
                      "flex w-full flex-col gap-0.5 px-4 py-3 text-left transition-colors hover:bg-muted/50",
                      !notification.readAt && "bg-muted/30",
                    )}
                    onClick={() => handleItemClick(notification)}
                  >
                    <span className="flex items-start justify-between gap-2">
                      <span
                        className={cn(
                          "text-sm",
                          notification.readAt
                            ? text.secondary
                            : cn("font-medium", text.primary),
                        )}
                      >
                        {notification.title}
                      </span>
                      {!notification.readAt ? (
                        <span
                          aria-hidden
                          className="mt-1 h-2 w-2 shrink-0 rounded-full bg-destructive"
                        />
                      ) : null}
                    </span>
                    {notification.body ? (
                      <span className={cn("text-xs", text.muted)}>
                        {notification.body}
                      </span>
                    ) : null}
                    <span className={cn("text-xs tabular-nums", text.muted)}>
                      {formatDateTime(notification.createdAt)}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
