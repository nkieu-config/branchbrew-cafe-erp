import { HR_ENDPOINTS } from "@/lib/endpoints/hr";
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchAPI } from '@/lib/api';
import { NAV_COUNTS_QUERY_KEY } from '@/lib/nav-counts';
import type { CreateUserPayload, UpdateUserPayload } from '@/types/api';

// ==========================================
// 👥 HR HOOKS
// ==========================================
export const useShifts = (role?: string, branchId?: number) => {
  return useQuery({
    queryKey: ['shifts', role, branchId],
    queryFn: () => {
      if ((role === 'SUPER_ADMIN' || role === 'MANAGER') && branchId) {
        return fetchAPI(HR_ENDPOINTS.shiftsByBranch(branchId));
      } else {
        return fetchAPI(HR_ENDPOINTS.shiftsMe);
      }
    },
    enabled: !!role,
  });
};

export const useCreateShift = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: {
      userId: number;
      branchId: number;
      startTime: string;
      endTime: string;
    }) =>
      fetchAPI(HR_ENDPOINTS.createShift, {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shifts'] });
    },
  });
};

export const useMyShifts = () => {
  return useQuery({
    queryKey: ['shifts', 'me'],
    queryFn: () => fetchAPI(HR_ENDPOINTS.shiftsMe),
  });
};

export const useAttendance = (window: { limit: number; offset: number }) => {
  return useQuery({
    queryKey: ['attendance', 'me', window],
    queryFn: () => fetchAPI(HR_ENDPOINTS.attendanceMe(window)),
    placeholderData: (previous) => previous,
  });
};

export const useActiveClockIn = (enabled = true) => {
  return useQuery({
    queryKey: ['attendance', 'status'],
    queryFn: () => fetchAPI(HR_ENDPOINTS.attendanceStatus),
    enabled,
  });
};

export const useClockIn = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (branchId: number) => fetchAPI(HR_ENDPOINTS.clockIn, { method: 'POST', body: JSON.stringify({ branchId }) }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['attendance'] }),
  });
};

export const useClockOut = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => fetchAPI(HR_ENDPOINTS.clockOut, { method: 'POST' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['attendance'] }),
  });
};

export const useHrUsers = (branchId?: number) => {
  return useQuery({
    queryKey: ['hrUsers', branchId],
    queryFn: () => fetchAPI(HR_ENDPOINTS.users(branchId)),
  });
};

export const useUpdateHourlyRate = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, hourlyRate }: { userId: number; hourlyRate: number }) => 
      fetchAPI(HR_ENDPOINTS.updateHourlyRate(userId), { method: 'PATCH', body: JSON.stringify({ hourlyRate }) }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['hrUsers'] }),
  });
};

export const useCreateUser = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateUserPayload) => fetchAPI(HR_ENDPOINTS.createUser, { method: 'POST', body: JSON.stringify(data) }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['hrUsers'] }),
  });
};

export const useUpdateUser = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: UpdateUserPayload) => fetchAPI(HR_ENDPOINTS.updateUser(id), { method: 'PATCH', body: JSON.stringify(data) }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['hrUsers'] }),
  });
};

// ==========================================
// 👥 HR (LEAVE & PAYROLL) HOOKS
// ==========================================
export const useLeaveRequests = (branchId?: number, isManagerOrAdmin?: boolean) => {
  return useQuery({
    queryKey: ['leaveRequests', branchId, isManagerOrAdmin],
    queryFn: () => isManagerOrAdmin ? fetchAPI(HR_ENDPOINTS.leave(branchId)) : fetchAPI(HR_ENDPOINTS.leaveMe),
  });
};

export const useCreateLeave = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: unknown) => fetchAPI(HR_ENDPOINTS.createLeave, { method: 'POST', body: JSON.stringify(data) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leaveRequests'] });
      queryClient.invalidateQueries({ queryKey: [NAV_COUNTS_QUERY_KEY] });
    },
  });
};

export const useUpdateLeaveStatus = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: number; status: string }) => fetchAPI(HR_ENDPOINTS.updateLeaveStatus(id), { method: 'PATCH', body: JSON.stringify({ status }) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leaveRequests'] });
      queryClient.invalidateQueries({ queryKey: [NAV_COUNTS_QUERY_KEY] });
    },
  });
};

export type BulkLeaveResult = {
  requested: number;
  succeeded: number[];
  failed: { id: number; reason: string }[];
};

export const useBulkUpdateLeaveStatus = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ ids, status }: { ids: number[]; status: string }): Promise<BulkLeaveResult> =>
      fetchAPI(HR_ENDPOINTS.bulkUpdateLeaveStatus, {
        method: 'PATCH',
        body: JSON.stringify({ ids, status }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leaveRequests'] });
      queryClient.invalidateQueries({ queryKey: [NAV_COUNTS_QUERY_KEY] });
    },
  });
};

export const usePayrollRuns = (branchId?: number) => {
  return useQuery({
    queryKey: ['payrollRuns', branchId],
    queryFn: () => fetchAPI(HR_ENDPOINTS.payrollRuns(branchId!)),
    enabled: !!branchId,
  });
};

export const useGeneratePayrollRun = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: { branchId: number; month: number; year: number }) => 
      fetchAPI(HR_ENDPOINTS.generatePayroll, { method: 'POST', body: JSON.stringify(data) }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['payrollRuns'] }),
  });
};

export const useApprovePayrollRun = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => fetchAPI(HR_ENDPOINTS.approvePayrollRun(id), { method: 'PATCH' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['payrollRuns'] }),
  });
};

