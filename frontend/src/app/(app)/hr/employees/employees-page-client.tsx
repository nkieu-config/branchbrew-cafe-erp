"use client";

import { useCallback, useMemo, useState, useDeferredValue } from "react";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { useListUrlState } from "@/hooks/useListUrlState";
import { useAuth } from "@/context/AuthContext";
import { useHrUsers, useUpdateHourlyRate } from "@/hooks/domains/useHrQueries";
import { HubListPage } from "@/components/shared/hub-list-page";
import { ListFilterSelect } from "@/components/shared/list-filters";
import { BranchEmptyState } from "@/components/shared/branch-empty-state";
import { EditCompensationModal } from "@/components/hr/EditCompensationModal";
import { EmployeeDirectoryTable } from "@/components/hr/EmployeeDirectoryTable";
import { ButtonLink } from "@/components/ui/button-link";
import { getErrorMessage } from "@/lib/errors";
import {
  type EmployeeRateFilter,
  type EmployeeRoleFilter,
  type EmploymentTypeFilter,
  filterEmployees,
} from "@/lib/filters/employee-filters";
import { hubCtaClassName } from "@/lib/theme/hub-primitives";
import { hrSectionPanelClassName } from "@/lib/theme/hub-hr";
import type { User } from "@/types/api";

export default function EmployeesPageClient() {
  const { user, activeBranchId } = useAuth();
  const role = user?.role;
  const canEditCompensation = role === "SUPER_ADMIN" || role === "MANAGER";
  const canLinkPayroll = canEditCompensation;

  const branchIdNum = activeBranchId ? Number(activeBranchId) : undefined;

  const {
    data: usersData,
    isLoading,
    isError,
    error,
    refetch,
    isFetching,
  } = useHrUsers(branchIdNum);
  const updateHourlyRateMutation = useUpdateHourlyRate();

  const { values, setValue, reset, isDefault } = useListUrlState({
    q: "",
    role: "ALL",
    employment: "ALL",
    rate: "ALL",
  });
  const search = values.q;
  const setSearch = (next: string) => setValue("q", next);
  const deferredSearch = useDeferredValue(search.trim().toLowerCase());
  const roleFilter = values.role as EmployeeRoleFilter;
  const employmentTypeFilter = values.employment as EmploymentTypeFilter;
  const rateFilter = values.rate as EmployeeRateFilter;

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [hourlyRate, setHourlyRate] = useState("");

  const employees = usersData ?? [];

  const filteredEmployees = useMemo(
    () =>
      filterEmployees(employees, {
        search: deferredSearch,
        roleFilter,
        employmentTypeFilter,
        rateFilter,
      }),
    [employees, deferredSearch, roleFilter, employmentTypeFilter, rateFilter],
  );

  const hasActiveFilters = !isDefault;

  const handleEditRate = useCallback((record: User) => {
    setSelectedUser(record);
    setHourlyRate(record.hourlyRate != null && record.hourlyRate > 0 ? String(record.hourlyRate) : "");
    setIsModalOpen(true);
  }, []);

  const handleUpdateSubmit = async () => {
    if (!selectedUser) return;
    const rate = Number(hourlyRate);
    if (Number.isNaN(rate) || rate < 0) {
      toast.error("Hourly rate is required");
      return;
    }
    try {
      await updateHourlyRateMutation.mutateAsync({ userId: selectedUser.id, hourlyRate: rate });
      toast.success("Hourly rate updated successfully");
      setIsModalOpen(false);
      setSelectedUser(null);
    } catch (err: unknown) {
      toast.error(getErrorMessage(err, "Failed to update hourly rate"));
    }
  };

  const closeModal = useCallback(() => {
    setIsModalOpen(false);
    setSelectedUser(null);
  }, []);

  if (!activeBranchId) {
    return (
      <BranchEmptyState description="Select a branch in the top bar to view the employee directory." />
    );
  }

  return (
    <>
      {role === "SUPER_ADMIN" ? (
        <div className="mb-4 flex justify-end">
          <ButtonLink href="/organization/users" className={hubCtaClassName("hr")}>
            <Plus className="w-4 h-4 mr-2" aria-hidden />
            Add user
          </ButtonLink>
        </div>
      ) : null}

      <HubListPage className={hrSectionPanelClassName()}>
        <HubListPage.Error
          message={isError ? getErrorMessage(error, "Failed to load employees") : undefined}
          onRetry={() => void refetch()}
          loading={isFetching}
        />

        <HubListPage.Toolbar
          search={search}
          onSearchChange={setSearch}
          searchPlaceholder="Search name, email, role…"
          searchTestId="employees-search"
          showReset={hasActiveFilters}
          onReset={reset}
          filters={
            <>
              <ListFilterSelect
                value={roleFilter}
                onValueChange={(value) => setValue("role", value)}
                ariaLabel="Filter by role"
                widthClassName="w-full sm:w-[180px]"
                options={[
                  { value: "ALL", label: "All roles" },
                  { value: "SUPER_ADMIN", label: "Super Admin" },
                  { value: "MANAGER", label: "Manager" },
                  { value: "STAFF", label: "Staff" },
                ]}
              />
              <ListFilterSelect
                value={employmentTypeFilter}
                onValueChange={(value) => setValue("employment", value)}
                ariaLabel="Filter by employment type"
                widthClassName="w-full sm:w-[180px]"
                options={[
                  { value: "ALL", label: "All types" },
                  { value: "FULL_TIME", label: "Full time" },
                  { value: "PART_TIME", label: "Part time" },
                ]}
              />
              <ListFilterSelect
                value={rateFilter}
                onValueChange={(value) => setValue("rate", value)}
                ariaLabel="Filter by hourly rate"
                widthClassName="w-full sm:w-[180px]"
                options={[
                  { value: "ALL", label: "All rates" },
                  { value: "missing-rate", label: "Missing rate" },
                ]}
              />
            </>
          }
        />

        <HubListPage.Count
          isLoading={isLoading}
          isError={isError}
          isFetching={isFetching}
          hasActiveFilters={hasActiveFilters}
          filteredCount={filteredEmployees.length}
          totalCount={employees.length}
          itemLabel="employee"
          emptyLabel="No employees for this branch yet"
        />

        <EmployeeDirectoryTable
          employees={filteredEmployees}
          isLoading={isLoading}
          hasActiveFilters={hasActiveFilters}
          canEditCompensation={canEditCompensation}
          canLinkPayroll={canLinkPayroll}
          onEditRate={handleEditRate}
        />
      </HubListPage>

      <EditCompensationModal
        open={isModalOpen}
        user={selectedUser}
        hourlyRate={hourlyRate}
        onHourlyRateChange={setHourlyRate}
        onClose={closeModal}
        onSubmit={() => void handleUpdateSubmit()}
        isSubmitting={updateHourlyRateMutation.isPending}
      />
    </>
  );
}
