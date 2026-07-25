import { REPORT_ENDPOINTS } from "@/lib/endpoints/reports";
import { AUDIT_ENDPOINTS } from "@/lib/endpoints/accounting";
import { useQuery, useSuspenseQuery } from '@tanstack/react-query';
import { fetchAPI } from '@/lib/api';
import type { FoodCostActual } from '@/types/api';
import { analyticsKeys } from '@/lib/query-keys';

// ==========================================
// 📊 ANALYTICS & REPORTS HOOKS
// ==========================================
export const useAnalyticsSummary = (branchId?: string) => {
  return useQuery({
    queryKey: analyticsKeys.summary(branchId),
    queryFn: () => fetchAPI(REPORT_ENDPOINTS.executiveSummary(branchId)),
  });
};

export const useSalesTrends = (branchId?: string) => {
  const parsed =
    branchId && branchId !== 'ALL' ? Number(branchId) : undefined;
  return useQuery({
    queryKey: analyticsKeys.salesTrends(branchId),
    queryFn: () => fetchAPI(REPORT_ENDPOINTS.salesTrends(parsed)),
  });
};

export const useTopProducts = (branchId?: string) => {
  return useQuery({
    queryKey: analyticsKeys.topProducts(branchId),
    queryFn: () => fetchAPI(REPORT_ENDPOINTS.topProducts(branchId)),
  });
};

export const useAnalyticsSummarySuspense = (branchId?: string) => {
  return useSuspenseQuery({
    queryKey: analyticsKeys.summary(branchId),
    queryFn: () => fetchAPI(REPORT_ENDPOINTS.executiveSummary(branchId)),
  });
};

export const useTopProductsSuspense = (branchId?: string) => {
  return useSuspenseQuery({
    queryKey: analyticsKeys.topProducts(branchId),
    queryFn: () => fetchAPI(REPORT_ENDPOINTS.topProducts(branchId)),
  });
};

export const useSalesTrendsSuspense = (branchId?: string, days = 7) => {
  const parsed = branchId && branchId !== 'ALL' ? Number(branchId) : undefined;
  return useSuspenseQuery({
    queryKey: analyticsKeys.salesTrends(branchId, days),
    queryFn: () => fetchAPI(REPORT_ENDPOINTS.salesTrends(parsed, days)),
  });
};

export const useProfitLossSuspense = (branchId?: string) => {
  const parsed = branchId && branchId !== 'ALL' ? Number(branchId) : undefined;
  return useSuspenseQuery({
    queryKey: analyticsKeys.profitLoss(branchId),
    queryFn: () => fetchAPI(REPORT_ENDPOINTS.profitLoss(parsed)),
  });
};

export const useFoodCostActual = (branchId?: number) => {
  return useQuery<FoodCostActual>({
    queryKey: ['foodCostActual', branchId ?? 'ALL'],
    queryFn: () => fetchAPI(REPORT_ENDPOINTS.foodCostActual(branchId)),
  });
};

export const useAuditLogs = (limit: number = 100, offset: number = 0) => {
  return useQuery({
    queryKey: ['auditLogs', limit, offset],
    queryFn: () => fetchAPI(AUDIT_ENDPOINTS.logs(limit, offset)),
  });
};

