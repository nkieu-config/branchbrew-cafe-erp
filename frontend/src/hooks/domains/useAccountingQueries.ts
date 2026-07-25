import { ACCOUNTING_ENDPOINTS } from "@/lib/endpoints/accounting";
import { PRODUCTION_ENDPOINTS } from "@/lib/endpoints/production";
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchAPI } from '@/lib/api';
import type { TrialBalance } from '@/types/accounting';

// ==========================================
// 💰 ACCOUNTING HOOKS
// ==========================================
export const useLedger = (branchId?: string) => {
  return useQuery({
    queryKey: ['ledger', branchId],
    queryFn: () => fetchAPI(ACCOUNTING_ENDPOINTS.profitLoss(branchId)),
  });
};

export const useJournalEntries = (branchId?: string) => {
  return useQuery({
    queryKey: ['journalEntries', branchId],
    queryFn: () => fetchAPI(ACCOUNTING_ENDPOINTS.journalEntries(branchId)),
  });
};

export const useTrialBalance = (branchId?: string, asOf?: string) => {
  return useQuery<TrialBalance>({
    queryKey: ['trialBalance', branchId ?? 'ALL', asOf ?? 'latest'],
    queryFn: () => fetchAPI(ACCOUNTING_ENDPOINTS.trialBalance(branchId, asOf)),
  });
};

export const useAccounts = () => {
  return useQuery({
    queryKey: ['accounts'],
    queryFn: () => fetchAPI(ACCOUNTING_ENDPOINTS.accounts),
  });
};


export const useProductionBOMs = () => {
  return useQuery({
    queryKey: ['productionBOMs'],
    queryFn: () => fetchAPI(PRODUCTION_ENDPOINTS.boms),
  });
};

export const useCreateProductionBOM = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: unknown) => fetchAPI(PRODUCTION_ENDPOINTS.createBom, { method: 'POST', body: JSON.stringify(data) }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['productionBOMs'] }),
  });
};

