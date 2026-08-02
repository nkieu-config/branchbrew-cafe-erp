import { CUSTOMER_ENDPOINTS, PROMOTION_ENDPOINTS } from "@/lib/endpoints/crm";
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchAPI } from '@/lib/api';

// ==========================================
// 👥 CRM HOOKS
// ==========================================
export const useCustomers = (window: {
  limit: number;
  offset: number;
  search?: string;
}) => {
  return useQuery({
    queryKey: ['customers', window],
    queryFn: () => fetchAPI(CUSTOMER_ENDPOINTS.list(window)),
    placeholderData: (previous) => previous,
  });
};

export const useCustomer360 = (id: number | null) => {
  return useQuery({
    queryKey: ['customer360', id],
    queryFn: () => fetchAPI(CUSTOMER_ENDPOINTS.detail360(id!)),
    enabled: !!id,
  });
};

export const useCreateCustomer = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: unknown) => fetchAPI(CUSTOMER_ENDPOINTS.create, { method: 'POST', body: JSON.stringify(data) }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['customers'] }),
  });
};

export const usePromotions = () => {
  return useQuery({
    queryKey: ['promotions'],
    queryFn: () => fetchAPI(PROMOTION_ENDPOINTS.list),
  });
};

export const useCreatePromotion = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: unknown) => fetchAPI(PROMOTION_ENDPOINTS.create, { method: 'POST', body: JSON.stringify(data) }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['promotions'] }),
  });
};

export const useTogglePromotion = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, isActive }: { id: number, isActive: boolean }) => fetchAPI(PROMOTION_ENDPOINTS.toggle(id), { method: 'PATCH', body: JSON.stringify({ isActive }) }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['promotions'] }),
  });
};

export const useUpdatePromotion = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: unknown }) =>
      fetchAPI(PROMOTION_ENDPOINTS.update(id), {
        method: 'PATCH',
        body: JSON.stringify(data),
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['promotions'] }),
  });
};

export const useDeletePromotion = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) =>
      fetchAPI(PROMOTION_ENDPOINTS.delete(id), { method: 'DELETE' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['promotions'] }),
  });
};

