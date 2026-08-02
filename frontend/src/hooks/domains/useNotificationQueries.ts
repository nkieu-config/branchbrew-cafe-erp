import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchAPI } from "@/lib/api";
import {
  ACCOUNTING_ENDPOINTS,
  NOTIFICATION_ENDPOINTS,
} from "@/lib/endpoints/accounting";
import { NAV_COUNTS_QUERY_KEY } from "@/lib/nav-counts";
import type { AppNotification } from "@/types/api";

export const NOTIFICATIONS_QUERY_KEY = "notifications";

export function useNotifications(enabled = true) {
  return useQuery({
    queryKey: [NOTIFICATIONS_QUERY_KEY],
    queryFn: () => fetchAPI(NOTIFICATION_ENDPOINTS.list),
    enabled,
    staleTime: 30_000,
  });
}

function invalidateNotifications(
  queryClient: ReturnType<typeof useQueryClient>,
) {
  queryClient.invalidateQueries({ queryKey: [NOTIFICATIONS_QUERY_KEY] });
  queryClient.invalidateQueries({ queryKey: [NAV_COUNTS_QUERY_KEY] });
}

export function useMarkNotificationRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) =>
      fetchAPI(NOTIFICATION_ENDPOINTS.markRead(id), { method: "PATCH" }),
    onMutate: async (id: number) => {
      await queryClient.cancelQueries({ queryKey: [NOTIFICATIONS_QUERY_KEY] });
      const previous = queryClient.getQueryData<AppNotification[]>([
        NOTIFICATIONS_QUERY_KEY,
      ]);
      queryClient.setQueryData<AppNotification[]>(
        [NOTIFICATIONS_QUERY_KEY],
        (current) =>
          current?.map((notification) =>
            notification.id === id && !notification.readAt
              ? { ...notification, readAt: new Date().toISOString() }
              : notification,
          ),
      );
      return { previous };
    },
    onError: (_error, _id, context) => {
      if (context?.previous) {
        queryClient.setQueryData([NOTIFICATIONS_QUERY_KEY], context.previous);
      }
    },
    onSettled: () => invalidateNotifications(queryClient),
  });
}

export function useMarkAllNotificationsRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () =>
      fetchAPI(NOTIFICATION_ENDPOINTS.markAllRead, { method: "POST" }),
    onSuccess: () => invalidateNotifications(queryClient),
  });
}

export function useVatReport(branchId?: number | string) {
  return useQuery({
    queryKey: ["vatReport", branchId ?? "all"],
    queryFn: () => fetchAPI(ACCOUNTING_ENDPOINTS.vatReport(branchId)),
  });
}
