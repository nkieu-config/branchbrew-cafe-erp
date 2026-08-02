"use client";

import { useCallback, useEffect, useMemo, useState, useDeferredValue } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { CheckCircle, Plus, XCircle } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { HubListPage } from "@/components/shared/hub-list-page";
import { ListFilterSelect } from "@/components/shared/list-filters";
import { BranchEmptyState } from "@/components/shared/branch-empty-state";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { BulkActionBar } from "@/components/shared/bulk-action-bar";
import {
  LeaveRequestsTable,
  type LeaveConfirmAction,
} from "@/components/hr/LeaveRequestsTable";
import { RequestLeaveModal } from "@/components/hr/RequestLeaveModal";
import {
  useBulkUpdateLeaveStatus,
  useCreateLeave,
  useLeaveRequests,
  useUpdateLeaveStatus,
} from "@/hooks/domains/useHrQueries";
import { getErrorMessage } from "@/lib/errors";
import {
  type LeaveStatusFilter,
  type LeaveTypeFilter,
  filterLeaveRequests,
  summarizeLeaveRequests,
} from "@/lib/filters/leave-filters";
import { buildHrLeaveUrl, parseHrLeaveSearchParams } from "@/lib/hr-hub-url";
import { infoBannerClassName, infoBannerTextClassName } from "@/lib/theme/hub-banners";
import { hubCtaClassName } from "@/lib/theme/hub-primitives";
import { hrSectionPanelClassName } from "@/lib/theme/hub-hr";

export default function LeavePageClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { activeBranchId, user } = useAuth();
  const role = user?.role;
  const isManagerOrAdmin = role === "SUPER_ADMIN" || role === "MANAGER";
  const branchIdNum = activeBranchId ? Number(activeBranchId) : undefined;

  const initialStatus = parseHrLeaveSearchParams(searchParams).statusFilter;

  const {
    data: leaveRequests = [],
    isLoading,
    isError,
    error,
    refetch,
    isFetching,
  } = useLeaveRequests(branchIdNum, isManagerOrAdmin);

  const updateLeaveStatusMutation = useUpdateLeaveStatus();
  const createLeaveMutation = useCreateLeave();

  const [statusFilter, setStatusFilter] = useState<LeaveStatusFilter>(initialStatus);
  const [typeFilter, setTypeFilter] = useState<LeaveTypeFilter>("ALL");
  const [search, setSearch] = useState("");
  const deferredSearch = useDeferredValue(search.trim().toLowerCase());

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [confirmAction, setConfirmAction] = useState<LeaveConfirmAction | null>(null);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [bulkAction, setBulkAction] = useState<"approve" | "reject" | null>(null);
  const bulkLeaveMutation = useBulkUpdateLeaveStatus();

  const leaveStatusParam = searchParams.get("status");

  useEffect(() => {
    setStatusFilter(parseHrLeaveSearchParams(
      new URLSearchParams(leaveStatusParam ? `status=${leaveStatusParam}` : ""),
    ).statusFilter);
  }, [leaveStatusParam]);

  const summary = useMemo(() => summarizeLeaveRequests(leaveRequests), [leaveRequests]);

  const filteredLeaveRequests = useMemo(
    () =>
      filterLeaveRequests(leaveRequests, {
        statusFilter,
        typeFilter,
        search: deferredSearch,
      }),
    [leaveRequests, statusFilter, typeFilter, deferredSearch],
  );

  const hasActiveFilters =
    statusFilter !== "ALL" || typeFilter !== "ALL" || search.trim().length > 0;

  const setStatusFilterAndUrl = useCallback(
    (next: LeaveStatusFilter) => {
      setStatusFilter(next);
      router.replace(
        buildHrLeaveUrl(next === "ALL" ? undefined : { status: next }),
        { scroll: false },
      );
    },
    [router],
  );

  const handleCreateLeave = async (payload: {
    type: string;
    startDate: string;
    endDate: string;
    reason: string;
  }) => {
    if (new Date(payload.startDate) > new Date(payload.endDate)) {
      toast.error("End date must be on or after start date");
      return;
    }
    try {
      await createLeaveMutation.mutateAsync(payload);
      toast.success("Leave requested successfully");
      setIsModalOpen(false);
    } catch (err: unknown) {
      toast.error(getErrorMessage(err, "Failed to request leave"));
    }
  };

  const handleConfirmStatusUpdate = async () => {
    if (!confirmAction) return;
    const status = confirmAction.type === "approve" ? "APPROVED" : "REJECTED";
    try {
      await updateLeaveStatusMutation.mutateAsync({ id: confirmAction.id, status });
      toast.success(`Leave ${status.toLowerCase()}`);
      setConfirmAction(null);
    } catch (err: unknown) {
      toast.error(getErrorMessage(err, "Failed to update leave status"));
    }
  };

  const handleBulkDecision = async () => {
    if (!bulkAction || selectedIds.length === 0) return;
    const status = bulkAction === "approve" ? "APPROVED" : "REJECTED";
    try {
      const result = await bulkLeaveMutation.mutateAsync({ ids: selectedIds, status });
      if (result.failed.length === 0) {
        toast.success(`${result.succeeded.length} requests ${status.toLowerCase()}`);
      } else {
        toast.warning(
          `${result.succeeded.length} of ${result.requested} ${status.toLowerCase()} — ${result.failed.length} could not be processed: ${result.failed[0].reason}`,
        );
      }
      setSelectedIds(result.failed.map((failure) => failure.id));
      setBulkAction(null);
    } catch (err: unknown) {
      toast.error(getErrorMessage(err, "Failed to update leave requests"));
    }
  };

  if (!activeBranchId) {
    return (
      <BranchEmptyState description="Select a branch in the top bar to view and manage leave requests." />
    );
  }

  return (
    <>
      <div className="mb-4 flex justify-end">
        <Button className={hubCtaClassName("hr")} onClick={() => setIsModalOpen(true)}>
          <Plus className="w-4 h-4 mr-2" aria-hidden />
          Request leave
        </Button>
      </div>

      <HubListPage className={hrSectionPanelClassName()}>
        {isManagerOrAdmin && summary.pending > 0 && initialStatus === "PENDING" && (
          <HubListPage.Banner>
            <div className={infoBannerClassName("py-3")}>
              <p className={infoBannerTextClassName()}>
                {summary.pending} request{summary.pending === 1 ? "" : "s"} awaiting approval
              </p>
            </div>
          </HubListPage.Banner>
        )}

        <HubListPage.Error
          message={isError ? getErrorMessage(error, "Failed to load leave requests") : undefined}
          onRetry={() => void refetch()}
          loading={isFetching}
        />

        <HubListPage.Toolbar
          search={isManagerOrAdmin ? search : undefined}
          onSearchChange={isManagerOrAdmin ? setSearch : undefined}
          searchPlaceholder="Search staff or reason…"
          showReset={hasActiveFilters}
          onReset={() => {
            setStatusFilterAndUrl("ALL");
            setTypeFilter("ALL");
            setSearch("");
          }}
          filters={
            <>
              <ListFilterSelect
                value={statusFilter}
                onValueChange={(value) => setStatusFilterAndUrl(value as LeaveStatusFilter)}
                ariaLabel="Filter by leave status"
                widthClassName="w-full sm:w-[180px]"
                options={[
                  { value: "ALL", label: "All statuses" },
                  { value: "PENDING", label: "Pending" },
                  { value: "APPROVED", label: "Approved" },
                  { value: "REJECTED", label: "Rejected" },
                ]}
              />
              <ListFilterSelect
                value={typeFilter}
                onValueChange={(value) => setTypeFilter(value as LeaveTypeFilter)}
                ariaLabel="Filter by leave type"
                widthClassName="w-full sm:w-[180px]"
                options={[
                  { value: "ALL", label: "All types" },
                  { value: "SICK", label: "Sick leave" },
                  { value: "ANNUAL", label: "Annual leave" },
                  { value: "UNPAID", label: "Unpaid leave" },
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
          filteredCount={filteredLeaveRequests.length}
          totalCount={leaveRequests.length}
          itemLabel="request"
          emptyLabel="No leave requests yet"
        />

        <BulkActionBar
          selectedCount={selectedIds.length}
          itemLabel="request"
          onClear={() => setSelectedIds([])}
        >
          <Button
            type="button"
            size="sm"
            onClick={() => setBulkAction("approve")}
            disabled={bulkLeaveMutation.isPending}
          >
            <CheckCircle className="mr-1.5 h-4 w-4" aria-hidden />
            Approve selected
          </Button>
          <Button
            type="button"
            size="sm"
            variant="destructive"
            onClick={() => setBulkAction("reject")}
            disabled={bulkLeaveMutation.isPending}
          >
            <XCircle className="mr-1.5 h-4 w-4" aria-hidden />
            Reject selected
          </Button>
        </BulkActionBar>

        <LeaveRequestsTable
          leaveRequests={filteredLeaveRequests}
          isManagerOrAdmin={isManagerOrAdmin}
          isLoading={isLoading}
          hasActiveFilters={hasActiveFilters}
          onConfirmAction={setConfirmAction}
          selectedIds={selectedIds}
          onSelectionChange={setSelectedIds}
        />
      </HubListPage>

      <RequestLeaveModal
        open={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSubmit={handleCreateLeave}
        isSubmitting={createLeaveMutation.isPending}
      />

      <ConfirmDialog
        open={confirmAction !== null}
        onOpenChange={(open) => !open && setConfirmAction(null)}
        title={confirmAction?.type === "approve" ? "Approve leave?" : "Reject leave?"}
        description={
          confirmAction
            ? `${confirmAction.staffName} · ${confirmAction.dateRange}`
            : undefined
        }
        confirmLabel={confirmAction?.type === "approve" ? "Approve" : "Reject"}
        destructive={confirmAction?.type === "reject"}
        loading={updateLeaveStatusMutation.isPending}
        onConfirm={handleConfirmStatusUpdate}
      />

      <ConfirmDialog
        open={bulkAction !== null}
        onOpenChange={(open) => !open && setBulkAction(null)}
        title={
          bulkAction === "approve"
            ? `Approve ${selectedIds.length} leave requests?`
            : `Reject ${selectedIds.length} leave requests?`
        }
        description="Each request is decided on its own — any that were already decided are reported back and stay selected."
        confirmLabel={bulkAction === "approve" ? "Approve all" : "Reject all"}
        destructive={bulkAction === "reject"}
        loading={bulkLeaveMutation.isPending}
        onConfirm={handleBulkDecision}
      />
    </>
  );
}
