"use client";

import { useEffect, useMemo, useState } from "react";
import { addDays, format, subDays } from "date-fns";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/context/AuthContext";
import { useCreateShift, useHrUsers, useShifts } from "@/hooks/domains/useHrQueries";
import { HubListPage } from "@/components/shared/hub-list-page";
import { ListFilterDate, ListFilterSelect } from "@/components/shared/list-filters";
import { BranchEmptyState } from "@/components/shared/branch-empty-state";
import { CreateShiftModal } from "@/components/hr/CreateShiftModal";
import { ShiftsSchedulePanel } from "@/components/hr/ShiftsSchedulePanel";
import { Button } from "@/components/ui/button";
import { getErrorMessage } from "@/lib/errors";
import {
  filterShifts,
  groupShiftsByUserId,
  summarizeShifts,
  type ShiftStatusFilter,
  type ShiftWithUser,
} from "@/lib/filters/shift-filters";
import { formatDate } from "@/lib/intl-date";
import { hubCtaClassName } from "@/lib/theme/hub-primitives";
import { hrSectionPanelClassName } from "@/lib/theme/hub-hr";
import { text } from "@/lib/theme/surface";
import { cn } from "@/lib/utils";
import type { ShiftStatus, User } from "@/types/api";
import { useSearchParams } from "next/navigation";

function toDateInputValue(date: Date): string {
  return format(date, "yyyy-MM-dd");
}

export default function ShiftsPageClient() {
  const { user, activeBranchId } = useAuth();
  const role = user?.role;
  const searchParams = useSearchParams();
  const shiftDateParam = searchParams.get("date");
  const shiftEmployeeParam = searchParams.get("employee");
  const shiftEmployeeId = useMemo(() => {
    if (!shiftEmployeeParam) return null;
    const id = Number(shiftEmployeeParam);
    return Number.isFinite(id) && id > 0 ? id : null;
  }, [shiftEmployeeParam]);
  const shiftDateFromUrl =
    shiftDateParam && /^\d{4}-\d{2}-\d{2}$/.test(shiftDateParam) ? shiftDateParam : null;

  const branchIdNum = activeBranchId ? Number(activeBranchId) : undefined;

  const {
    data: shiftsData = [],
    isLoading,
    isError,
    error,
    refetch,
    isFetching,
  } = useShifts(role, branchIdNum);
  const { data: employees = [], isLoading: loadingEmployees } = useHrUsers(branchIdNum);
  const createShiftMutation = useCreateShift();

  const [selectedDate, setSelectedDate] = useState(() => shiftDateFromUrl ?? toDateInputValue(new Date()));
  const [statusFilter, setStatusFilter] = useState<ShiftStatusFilter>("ALL");
  const [employeeFilterId, setEmployeeFilterId] = useState<number | null>(shiftEmployeeId);
  const [isModalOpen, setIsModalOpen] = useState(false);

  useEffect(() => {
    if (shiftDateFromUrl) setSelectedDate(shiftDateFromUrl);
    setEmployeeFilterId(shiftEmployeeId);
  }, [shiftDateFromUrl, shiftEmployeeId]);

  const selectedDateObj = useMemo(() => new Date(`${selectedDate}T12:00:00`), [selectedDate]);

  const filteredShifts = useMemo(
    () =>
      filterShifts(shiftsData as ShiftWithUser[], {
        date: selectedDateObj,
        statusFilter,
        employeeId: employeeFilterId,
      }),
    [shiftsData, selectedDateObj, statusFilter, employeeFilterId],
  );

  const summary = useMemo(() => summarizeShifts(filteredShifts), [filteredShifts]);
  const ganttRows = useMemo(() => groupShiftsByUserId(filteredShifts), [filteredShifts]);

  const hasActiveFilters = statusFilter !== "ALL" || employeeFilterId != null;
  const shiftDateLabel = formatDate(selectedDateObj);

  const handleCreateShift = async (payload: {
    userId: number;
    branchId: number;
    startTime: string;
    endTime: string;
  }) => {
    try {
      await createShiftMutation.mutateAsync(payload);
      toast.success("Shift scheduled");
      setIsModalOpen(false);
    } catch (err: unknown) {
      toast.error(getErrorMessage(err, "Failed to schedule shift"));
    }
  };

  if (!activeBranchId || !branchIdNum) {
    return (
      <BranchEmptyState description="Select a branch in the top bar to view and manage shift schedules." />
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button className={hubCtaClassName("hr")} onClick={() => setIsModalOpen(true)} data-testid="hr-schedule-shift">
          <Plus className="w-4 h-4 mr-2" aria-hidden />
          Schedule shift
        </Button>
      </div>

      <HubListPage className={hrSectionPanelClassName()}>
        <HubListPage.Error
          message={isError ? getErrorMessage(error, "Failed to load shifts") : undefined}
          onRetry={() => void refetch()}
          loading={isFetching}
        />

        <HubListPage.Toolbar
          showReset={hasActiveFilters}
          onReset={() => {
            setStatusFilter("ALL");
            setEmployeeFilterId(null);
          }}
          filters={
            <>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="min-h-[44px] min-w-[44px] shrink-0"
                  aria-label="Previous day"
                  onClick={() =>
                    setSelectedDate(toDateInputValue(subDays(selectedDateObj, 1)))
                  }
                >
                  <ChevronLeft className="w-4 h-4" aria-hidden />
                </Button>
                <ListFilterDate
                  value={selectedDate}
                  onChange={setSelectedDate}
                  ariaLabel="Shift date"
                  className="w-full sm:w-[160px]"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="min-h-[44px] min-w-[44px] shrink-0"
                  aria-label="Next day"
                  onClick={() =>
                    setSelectedDate(toDateInputValue(addDays(selectedDateObj, 1)))
                  }
                >
                  <ChevronRight className="w-4 h-4" aria-hidden />
                </Button>
              </div>
              <ListFilterSelect
                value={statusFilter}
                onValueChange={(value) => setStatusFilter(value as ShiftStatusFilter)}
                ariaLabel="Filter by shift status"
                widthClassName="w-full sm:w-[180px]"
                options={[
                  { value: "ALL", label: "All statuses" },
                  ...(["SCHEDULED", "COMPLETED", "ABSENT", "CANCELLED"] as ShiftStatus[]).map(
                    (status) => ({
                      value: status,
                      label: status.charAt(0) + status.slice(1).toLowerCase(),
                    }),
                  ),
                ]}
              />
              {employees.length > 0 && (
                <ListFilterSelect
                  value={employeeFilterId != null ? String(employeeFilterId) : "ALL"}
                  onValueChange={(value) => {
                    setEmployeeFilterId(value === "ALL" ? null : Number(value));
                  }}
                  ariaLabel="Filter by employee"
                  widthClassName="w-full sm:w-[200px]"
                  options={[
                    { value: "ALL", label: "All employees" },
                    ...employees.map((employee: User) => ({
                      value: String(employee.id),
                      label: employee.name ?? employee.email,
                    })),
                  ]}
                />
              )}
            </>
          }
        />

        <HubListPage.Count isLoading={isLoading} isError={isError} isFetching={isFetching}>
          <span className={cn("tabular-nums", text.secondary)}>
            {summary.total > 0
              ? `${summary.total} shift${summary.total === 1 ? "" : "s"} · ${shiftDateLabel}`
              : `${shiftDateLabel} — no shifts`}
          </span>
        </HubListPage.Count>

        <ShiftsSchedulePanel
          isLoading={isLoading}
          isError={isError}
          ganttRows={ganttRows}
          hasActiveFilters={hasActiveFilters}
          shiftDateLabel={shiftDateLabel}
          onScheduleShift={() => setIsModalOpen(true)}
        />
      </HubListPage>

      <CreateShiftModal
        open={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        employees={employees}
        loadingEmployees={loadingEmployees}
        branchId={branchIdNum}
        defaultDate={selectedDate}
        onSubmit={handleCreateShift}
        isSubmitting={createShiftMutation.isPending}
      />
    </div>
  );
}
