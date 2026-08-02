"use client";

import { useMemo } from "react";
import { Loader2, PlayCircle, StopCircle } from "lucide-react";
import { toast } from "sonner";
import { useListUrlState } from "@/hooks/useListUrlState";
import { ATTENDANCE_PAGE_SIZE_DEFAULT } from "@/lib/filters/attendance-filters";
import { useAuth } from "@/context/AuthContext";
import {
  useActiveClockIn,
  useAttendance,
  useClockIn,
  useClockOut,
  useMyShifts,
} from "@/hooks/domains/useHrQueries";
import { getErrorMessage } from "@/lib/errors";
import { HubListPage } from "@/components/shared/hub-list-page";
import { ListFilterDate, ListFilterRow, ListFilterSelect } from "@/components/shared/list-filters";
import { BranchEmptyState } from "@/components/shared/branch-empty-state";
import { Button } from "@/components/ui/button";
import { AttendanceActiveBanner } from "@/components/hr/AttendanceActiveBanner";
import { AttendanceTable } from "@/components/hr/AttendanceTable";
import {
  type AttendanceRecordRow,
  type AttendanceStatusFilter,
  filterAttendance,
} from "@/lib/filters/attendance-filters";
import { hubCtaClassName } from "@/lib/theme/hub-primitives";
import { hrSectionPanelClassName } from "@/lib/theme/hub-hr";
import { cn } from "@/lib/utils";
import type { Shift } from "@/types/api";

export default function AttendancePageClient() {
  const { user, activeBranchId } = useAuth();
  const role = user?.role;

  const { values, setValue, reset, isDefault } = useListUrlState({
    status: "ALL",
    from: "",
    to: "",
    page: "1",
    size: String(ATTENDANCE_PAGE_SIZE_DEFAULT),
  });
  const statusFilter = values.status as AttendanceStatusFilter;
  const startDate = values.from;
  const endDate = values.to;
  const page = Math.max(1, Number(values.page) || 1);
  const pageSize = Number(values.size) || ATTENDANCE_PAGE_SIZE_DEFAULT;

  const listWindow = useMemo(
    () => ({
      limit: pageSize,
      offset: (page - 1) * pageSize,
      ...(startDate ? { from: startDate } : {}),
      ...(endDate ? { to: endDate } : {}),
    }),
    [page, pageSize, startDate, endDate],
  );

  const handlePageChange = (nextPage: number, nextPageSize: number) => {
    if (nextPageSize !== pageSize) {
      setValue("size", String(nextPageSize));
      setValue("page", "1");
      return;
    }
    setValue("page", String(nextPage));
  };

  const {
    data: attendanceData,
    isLoading,
    isError,
    error,
    refetch,
    isFetching,
  } = useAttendance(listWindow);
  const { data: shiftsData } = useMyShifts();
  const {
    data: activeClockIn,
    isLoading: loadingActive,
    isFetching: fetchingActive,
  } = useActiveClockIn();
  const clockInMutation = useClockIn();
  const clockOutMutation = useClockOut();

  const attendance = useMemo(
    () => (attendanceData?.items ?? []) as AttendanceRecordRow[],
    [attendanceData],
  );
  const totalAttendance = attendanceData?.total ?? 0;
  const shifts = (shiftsData ?? []) as Shift[];
  const isClockedIn = Boolean(activeClockIn);

  const startDateObj = startDate ? new Date(`${startDate}T00:00:00`) : null;
  const endDateObj = endDate ? new Date(`${endDate}T00:00:00`) : null;

  const filteredAttendance = useMemo(
    () =>
      filterAttendance(attendance, {
        statusFilter,
        startDate: startDateObj,
        endDate: endDateObj,
        shifts,
      }),
    [attendance, statusFilter, startDateObj, endDateObj, shifts],
  );

  const hasActiveFilters = !isDefault;

  const handleClockIn = async () => {
    if (!activeBranchId) {
      toast.error("Please select a branch before clocking in.");
      return;
    }
    try {
      await clockInMutation.mutateAsync(Number(activeBranchId));
      toast.success("Clocked in successfully!");
    } catch (err: unknown) {
      toast.error(getErrorMessage(err, "Failed to clock in"));
    }
  };

  const handleClockOut = async () => {
    try {
      await clockOutMutation.mutateAsync();
      toast.success("Clocked out successfully!");
    } catch (err: unknown) {
      toast.error(getErrorMessage(err, "Failed to clock out"));
    }
  };

  const needsBranchForClockIn = role === "SUPER_ADMIN" && !activeBranchId;
  const clockActionPending = clockInMutation.isPending || clockOutMutation.isPending;

  if (!activeBranchId) {
    return (
      <BranchEmptyState description="Select a branch in the top bar to clock in and view attendance records." />
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        {isClockedIn ? (
          <Button
            variant="destructive"
            className={cn(hubCtaClassName("hr"), "shadow-sm")}
            disabled={clockActionPending || loadingActive}
            onClick={() => void handleClockOut()}
          >
            {clockOutMutation.isPending ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin motion-reduce:animate-none" aria-hidden />
            ) : (
              <StopCircle className="w-4 h-4 mr-2" aria-hidden />
            )}
            Clock out
          </Button>
        ) : (
          <Button
            className={hubCtaClassName("hr")}
            disabled={needsBranchForClockIn || clockActionPending || loadingActive}
            onClick={() => void handleClockIn()}
          >
            {clockInMutation.isPending ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin motion-reduce:animate-none" aria-hidden />
            ) : (
              <PlayCircle className="w-4 h-4 mr-2" aria-hidden />
            )}
            Clock in
          </Button>
        )}
      </div>

      <HubListPage className={hrSectionPanelClassName()}>
        {isClockedIn && activeClockIn && (
          <HubListPage.Banner>
            <AttendanceActiveBanner
              clockIn={activeClockIn.clockIn}
              branchLabel={activeClockIn.branch?.name ?? "this branch"}
            />
          </HubListPage.Banner>
        )}

        <HubListPage.Error
          message={isError ? getErrorMessage(error, "Failed to load attendance records") : undefined}
          onRetry={() => void refetch()}
          loading={isFetching}
        />

        <HubListPage.Toolbar
          showReset={hasActiveFilters}
          onReset={reset}
          filters={
            <ListFilterRow>
              <ListFilterSelect
                value={statusFilter}
                onValueChange={(value) => setValue("status", value)}
                ariaLabel="Filter by attendance status"
                widthClassName="w-full sm:w-[180px]"
                options={[
                  { value: "ALL", label: "All statuses" },
                  { value: "active", label: "Active session" },
                  { value: "late", label: "Late" },
                  { value: "on-time", label: "On time" },
                ]}
              />
              <ListFilterDate
                value={startDate}
                onChange={(value) => setValue("from", value)}
                ariaLabel="From date"
                className="w-full sm:w-[160px]"
              />
              <ListFilterDate
                value={endDate}
                onChange={(value) => setValue("to", value)}
                ariaLabel="To date"
                className="w-full sm:w-[160px]"
                min={startDate || undefined}
              />
            </ListFilterRow>
          }
        />

        <HubListPage.Count
          isLoading={isLoading}
          isError={isError}
          isFetching={isFetching || fetchingActive}
          hasActiveFilters={hasActiveFilters}
          filteredCount={filteredAttendance.length}
          totalCount={totalAttendance}
          itemLabel="record"
        />

        <AttendanceTable
          serverPagination={{
            page,
            pageSize,
            total: totalAttendance,
            onChange: handlePageChange,
          }}
          attendance={filteredAttendance}
          shifts={shifts}
          isLoading={isLoading}
          hasActiveFilters={hasActiveFilters}
        />
      </HubListPage>
    </div>
  );
}
