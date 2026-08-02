import { ORDER_ENDPOINTS } from "@/lib/endpoints/orders";
import { PRODUCT_ENDPOINTS } from "@/lib/endpoints/products";
import { PROMOTION_ENDPOINTS, CUSTOMER_ENDPOINTS } from "@/lib/endpoints/crm";
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchAPI } from '@/lib/api';
import type { Order, OrderPage, OrderStatus } from '@/types/api';
import { KDS_STATUSES, mergeKdsOrders, normalizeKdsOrders } from '@/lib/kds-utils';
import {
  invalidateNavCounts,
  invalidatePosOrderSideEffects,
  orderKeys,
} from '@/lib/query-keys';
import type { OrderListWindow } from '@/lib/query-keys/orders';
import { retryBackoffMs, shouldRetryQuery } from '@/lib/api/retry-policy';

export const kdsOrdersQueryKey = (branchId?: number) => ['kdsOrders', branchId] as const;

export const useKdsOrders = (branchId?: number, isConnected = false) => {
  return useQuery({
    queryKey: kdsOrdersQueryKey(branchId),
    queryFn: () => fetchAPI(ORDER_ENDPOINTS.kds(branchId!)),
    enabled: !!branchId,
    refetchInterval: isConnected ? false : 30_000,
    select: normalizeKdsOrders,
  });
};

export const useUpdateKdsOrderStatus = (branchId?: number) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ orderId, status }: { orderId: number; status: string }) =>
      fetchAPI(ORDER_ENDPOINTS.updateStatus(orderId), {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      }),
    onMutate: async ({ orderId, status }) => {
      if (!branchId) return;
      await queryClient.cancelQueries({ queryKey: kdsOrdersQueryKey(branchId) });
      const previous = queryClient.getQueryData<Order[]>(kdsOrdersQueryKey(branchId));

      queryClient.setQueryData<Order[]>(kdsOrdersQueryKey(branchId), (old) => {
        const current = normalizeKdsOrders(old);
        if (status === 'COMPLETED' || !KDS_STATUSES.includes(status as OrderStatus)) {
          return current.filter((o) => o.id !== orderId);
        }
        return mergeKdsOrders(
          current.map((o) => (o.id === orderId ? { ...o, status: status as OrderStatus } : o)),
          [],
        );
      });

      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (branchId && context?.previous) {
        queryClient.setQueryData(kdsOrdersQueryKey(branchId), context.previous);
      }
    },
    onSettled: () => {
      if (branchId) {
        queryClient.invalidateQueries({ queryKey: kdsOrdersQueryKey(branchId) });
      }
      invalidateNavCounts(queryClient);
    },
  });
};

// ==========================================
// 🛒 POS HOOKS
// ==========================================
export const useProducts = () => {
  return useQuery({
    queryKey: orderKeys.products,
    queryFn: () => fetchAPI(PRODUCT_ENDPOINTS.list),
  });
};

export const useCreateOrder = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: unknown) => fetchAPI(ORDER_ENDPOINTS.create, { method: 'POST', body: JSON.stringify(data) }),
    retry: shouldRetryQuery,
    retryDelay: retryBackoffMs,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: orderKeys.root });
      invalidateNavCounts(queryClient);
    },
  });
};

export const useBranchOrders = (
  branchId: number | undefined,
  window: OrderListWindow,
) => {
  return useQuery({
    queryKey: orderKeys.branchList(branchId, window),
    queryFn: (): Promise<OrderPage> =>
      fetchAPI(ORDER_ENDPOINTS.list({ branchId, ...window })),
    enabled: !!branchId,
    placeholderData: (previous, previousQuery) =>
      previousQuery?.queryKey[1] === branchId ? previous : undefined,
  });
};

export const useVoidOrder = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (orderId: number) =>
      fetchAPI(ORDER_ENDPOINTS.void(orderId), { method: 'POST' }),
    onSuccess: () => {
      invalidatePosOrderSideEffects(queryClient);
    },
  });
};

export const useRefundOrder = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ orderId, reason }: { orderId: number; reason?: string }) =>
      fetchAPI(ORDER_ENDPOINTS.refund(orderId), {
        method: 'POST',
        body: JSON.stringify(reason ? { reason } : {}),
      }),
    onSuccess: () => {
      invalidatePosOrderSideEffects(queryClient);
    },
  });
};

export const useValidatePromotion = () => {
  return useMutation({
    mutationFn: ({ code, subtotal }: { code: string, subtotal: number }) => fetchAPI(PROMOTION_ENDPOINTS.validate, { method: 'POST', body: JSON.stringify({ code, subtotal }) }),
  });
};

export const useCustomerByPhone = () => {
  return useMutation({
    mutationFn: (phone: string) => fetchAPI(CUSTOMER_ENDPOINTS.byPhone(phone)),
  });
};

