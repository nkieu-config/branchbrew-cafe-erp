export const HR_ENDPOINTS = {
  clockIn: '/hr/clock-in',
  clockOut: '/hr/clock-out',
  attendanceMe: (window: { limit?: number; offset?: number } = {}) => {
    const params = new URLSearchParams();
    if (window.limit != null) params.set('limit', String(window.limit));
    if (window.offset != null) params.set('offset', String(window.offset));
    const query = params.toString();
    return query ? `/hr/attendance/me?${query}` : '/hr/attendance/me';
  },
  attendanceStatus: '/hr/attendance/status',
  shiftsByBranch: (branchId: number) => `/hr/shifts/branch/${branchId}`,
  shiftsMe: '/hr/shifts/me',
  createShift: '/hr/shifts',
  leave: (branchId?: number) => `/hr/leave${branchId ? `?branchId=${branchId}` : ''}`,
  leaveMe: '/hr/leave/me',
  createLeave: '/hr/leave',
  updateLeaveStatus: (id: number) => `/hr/leave/${id}/status`,
  bulkUpdateLeaveStatus: '/hr/leave/bulk-status',
  payrollRuns: (branchId: number) => `/hr/payroll-runs?branchId=${branchId}`,
  generatePayroll: '/hr/payroll/generate',
  approvePayrollRun: (id: number) => `/hr/payroll-runs/${id}/approve`,
  users: (branchId?: number) => `/hr/users${branchId ? `?branchId=${branchId}` : ''}`,
  updateHourlyRate: (userId: number) => `/hr/users/${userId}/rate`,
  createUser: '/hr/users',
  updateUser: (id: number) => `/hr/users/${id}`,
} as const;
