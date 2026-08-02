"use client";

import { useMemo, useState, useDeferredValue } from "react";
import { usePageChromeExtension } from "@/components/layout/PageChrome";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { useListUrlState } from "@/hooks/useListUrlState";
import { useAuth } from "@/context/AuthContext";
import {
  useCreateEquipment,
  useEquipment,
  useLogMaintenance,
} from "@/hooks/domains/useProcurementQueries";
import { HubListPage } from "@/components/shared/hub-list-page";
import { ListFilterSelect } from "@/components/shared/list-filters";
import { BranchEmptyState } from "@/components/shared/branch-empty-state";
import { RegisterEquipmentModal } from "@/components/assets/RegisterEquipmentModal";
import { LogMaintenanceModal } from "@/components/assets/LogMaintenanceModal";
import { EquipmentTable } from "@/components/assets/EquipmentTable";
import { Button } from "@/components/ui/button";
import {
  EQUIPMENT_TYPE_OPTIONS,
  type EquipmentHighlightFilter,
  type EquipmentStatusFilter,
  type EquipmentTypeFilter,
  filterEquipment,
  summarizeEquipment,
} from "@/lib/filters/equipment-filters";
import { getErrorMessage } from "@/lib/errors";
import type { Equipment, EquipmentStatus, EquipmentType } from "@/types/api";
import { assetsSectionPanelClassName } from "@/lib/theme/assets";
import { infoBannerClassName, infoBannerTextClassName } from "@/lib/theme/hub-banners";
import { hubCtaClassName } from "@/lib/theme/hub-primitives";

export default function AssetsPageClient() {
  const { user, activeBranchId } = useAuth();
  const branchIdNum = activeBranchId ? Number(activeBranchId) : undefined;

  const {
    data: equipmentData,
    isLoading,
    isError,
    error,
    refetch,
    isFetching,
  } = useEquipment(branchIdNum);
  const createMutation = useCreateEquipment();
  const maintMutation = useLogMaintenance();

  const { values, setValue, reset, isDefault } = useListUrlState({
    q: "",
    status: "ALL",
    type: "ALL",
    highlight: "ALL",
  });
  const search = values.q;
  const setSearch = (next: string) => setValue("q", next);
  const deferredSearch = useDeferredValue(search.trim().toLowerCase());
  const statusFilter = values.status as EquipmentStatusFilter;
  const typeFilter = values.type as EquipmentTypeFilter;
  const highlightFilter = values.highlight as EquipmentHighlightFilter;
  const [registerOpen, setRegisterOpen] = useState(false);
  const [maintenanceTarget, setMaintenanceTarget] = useState<Equipment | null>(null);

  const equipmentList = equipmentData ?? [];

  const summary = useMemo(() => summarizeEquipment(equipmentList), [equipmentList]);

  const filteredEquipment = useMemo(
    () =>
      filterEquipment(equipmentList, {
        statusFilter,
        typeFilter,
        highlightFilter,
        search: deferredSearch,
      }),
    [equipmentList, statusFilter, typeFilter, highlightFilter, deferredSearch],
  );

  const hasActiveFilters = !isDefault;


  const handleCreate = async (payload: {
    branchId: number;
    name: string;
    type: EquipmentType;
    serialNumber?: string;
    nextMaintenanceDate?: string;
  }) => {
    try {
      await createMutation.mutateAsync(payload);
      toast.success("Equipment registered");
      setRegisterOpen(false);
    } catch (err: unknown) {
      toast.error(getErrorMessage(err, "Failed to register equipment"));
      throw err;
    }
  };

  const handleLogMaintenance = async (payload: {
    id: number;
    data: {
      description: string;
      cost: number;
      performedBy?: string;
      date: string;
      nextMaintenanceDate?: string;
      newStatus?: EquipmentStatus;
    };
  }) => {
    try {
      await maintMutation.mutateAsync(payload);
      toast.success("Maintenance logged");
      setMaintenanceTarget(null);
    } catch (err: unknown) {
      toast.error(getErrorMessage(err, "Failed to log maintenance"));
      throw err;
    }
  };

  usePageChromeExtension(
    useMemo(
      () => ({
        actions: branchIdNum ? (
          <Button
            className={hubCtaClassName("assets", "min-h-[44px]")}
            onClick={() => setRegisterOpen(true)}
          >
            <Plus className="w-4 h-4 mr-2" aria-hidden />
            Register equipment
          </Button>
        ) : null,
      }),
      [branchIdNum],
    ),
  );

  if (!branchIdNum) {
    return (
      <BranchEmptyState description="Select a branch in the top bar to manage equipment." />
    );
  }

  return (
    <div className="space-y-4">
      <HubListPage className={assetsSectionPanelClassName()}>
        {!isLoading && !isError && summary.dueSoon > 0 && (
          <HubListPage.Banner>
            <div className={infoBannerClassName("py-3")}>
              <p className={infoBannerTextClassName()}>
                {summary.dueSoon} asset{summary.dueSoon === 1 ? "" : "s"} due for maintenance within
                7 days
              </p>
            </div>
          </HubListPage.Banner>
        )}

        <HubListPage.Error
          message={isError ? getErrorMessage(error, "Failed to load equipment.") : undefined}
          onRetry={() => void refetch()}
          loading={isFetching}
        />

        <HubListPage.Toolbar
          search={search}
          onSearchChange={setSearch}
          searchPlaceholder="Search name, serial, type…"
          showReset={hasActiveFilters}
          onReset={reset}
          filters={
            <>
              <ListFilterSelect
                value={statusFilter}
                onValueChange={(value) => setValue("status", value)}
                ariaLabel="Filter by status"
                widthClassName="w-full sm:w-[160px]"
                options={[
                  { value: "ALL", label: "All statuses" },
                  { value: "ACTIVE", label: "Active" },
                  { value: "MAINTENANCE", label: "In maintenance" },
                  { value: "BROKEN", label: "Broken" },
                  { value: "RETIRED", label: "Retired" },
                ]}
              />
              <ListFilterSelect
                value={typeFilter}
                onValueChange={(value) => setValue("type", value)}
                ariaLabel="Filter by type"
                widthClassName="w-full sm:w-[180px]"
                options={[
                  { value: "ALL", label: "All types" },
                  ...EQUIPMENT_TYPE_OPTIONS.map((option) => ({
                    value: option.value,
                    label: option.label,
                  })),
                ]}
              />
              <ListFilterSelect
                value={highlightFilter}
                onValueChange={(value) => setValue("highlight", value)}
                ariaLabel="Filter by maintenance schedule"
                widthClassName="w-full sm:w-[160px]"
                options={[
                  { value: "ALL", label: "All schedules" },
                  { value: "due-soon", label: "Due within 7 days" },
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
          filteredCount={filteredEquipment.length}
          totalCount={summary.total}
          itemLabel="asset"
          emptyLabel="No equipment yet"
        />

        <EquipmentTable
          equipment={filteredEquipment}
          loading={isLoading}
          hasActiveFilters={hasActiveFilters}
          onLogMaintenance={setMaintenanceTarget}
        />
      </HubListPage>

      <RegisterEquipmentModal
        open={registerOpen}
        onClose={() => setRegisterOpen(false)}
        branchId={branchIdNum}
        onSubmit={handleCreate}
        isSubmitting={createMutation.isPending}
      />

      <LogMaintenanceModal
        open={maintenanceTarget != null}
        onClose={() => setMaintenanceTarget(null)}
        equipment={maintenanceTarget}
        performedBy={user?.name ?? user?.email ?? undefined}
        onSubmit={handleLogMaintenance}
        isSubmitting={maintMutation.isPending}
      />
    </div>
  );
}
