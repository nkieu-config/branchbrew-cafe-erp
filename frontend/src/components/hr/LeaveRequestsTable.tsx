"use client";

import { useCallback, useMemo } from "react";
import type { ColumnsType } from "antd/es/table";
import { CheckCircle, XCircle } from "lucide-react";
import { DataTable } from "@/components/shared/data-table";
import {
  ListMobileCard,
  PaginatedMobileList,
  ResponsiveDataTableLayout,
} from "@/components/shared/responsive-data-table";
import { StatusBadge, leaveStatusTone } from "@/components/shared/status-badge";
import { TableActionButton } from "@/components/shared/table-action-button";
import {
  leaveDurationDays,
  leaveStatusLabel,
  leaveTypeLabel,
} from "@/lib/filters/leave-filters";
import { formatDateRange } from "@/lib/intl-date";
import { useHubListPagination } from "@/hooks/useHubListPagination";
import { tableCellMutedClassName } from "@/lib/theme/feedback";
import { tableActionAccentClassName } from "@/lib/theme/hub-primitives";
import { hrMutedMetaClassName } from "@/lib/theme/hub-hr";
import { text } from "@/lib/theme/surface";
import { cn } from "@/lib/utils";
import type { LeaveRequest, LeaveType } from "@/types/api";

export type LeaveConfirmAction = {
  id: number;
  type: "approve" | "reject";
  staffName: string;
  dateRange: string;
};

type LeaveRequestsTableProps = {
  leaveRequests: LeaveRequest[];
  isManagerOrAdmin: boolean;
  isLoading: boolean;
  hasActiveFilters: boolean;
  onConfirmAction: (action: LeaveConfirmAction) => void;
  selectedIds?: number[];
  onSelectionChange?: (ids: number[]) => void;
};

export function LeaveRequestsTable({
  leaveRequests,
  isManagerOrAdmin,
  isLoading,
  hasActiveFilters,
  onConfirmAction,
  selectedIds,
  onSelectionChange,
}: LeaveRequestsTableProps) {
  const emptyDescription = hasActiveFilters
    ? "No leave requests match the current filters."
    : isManagerOrAdmin
      ? "No leave requests for this branch yet."
      : "Submit a leave request to get started.";

  const listPagination = useHubListPagination(
    { pageSize: 10 },
    `${leaveRequests.length}-${hasActiveFilters}`,
  );

  const renderLeaveActions = useCallback(
    (req: LeaveRequest) => {
      if (!isManagerOrAdmin || req.status !== "PENDING") return null;

      return (
        <div className="flex justify-end gap-1">
          <TableActionButton
            icon={CheckCircle}
            label={`Approve leave for ${req.user?.name ?? "employee"}`}
            iconOnly
            onClick={() =>
              onConfirmAction({
                id: req.id,
                type: "approve",
                staffName: req.user?.name ?? "Employee",
                dateRange: formatDateRange(req.startDate, req.endDate),
              })
            }
            className={tableActionAccentClassName("emerald")}
          />
          <TableActionButton
            icon={XCircle}
            label={`Reject leave for ${req.user?.name ?? "employee"}`}
            iconOnly
            onClick={() =>
              onConfirmAction({
                id: req.id,
                type: "reject",
                staffName: req.user?.name ?? "Employee",
                dateRange: formatDateRange(req.startDate, req.endDate),
              })
            }
            destructive
          />
        </div>
      );
    },
    [isManagerOrAdmin, onConfirmAction],
  );

  const columns = useMemo(
    () =>
      [
        ...(isManagerOrAdmin
          ? [
              {
                title: "Staff",
                key: "staff",
                render: (_: unknown, req: LeaveRequest) => (
                  <div className="min-w-0">
                    <div className={cn("truncate font-medium", text.primary)}>
                      {req.user?.name ?? `Employee #${req.userId}`}
                    </div>
                    {req.user?.email && (
                      <div className={cn("text-xs truncate", tableCellMutedClassName())}>
                        {req.user.email}
                      </div>
                    )}
                  </div>
                ),
              },
            ]
          : []),
        {
          title: "Type",
          dataIndex: "type",
          key: "type",
          render: (type: LeaveType) => (
            <span className={hrMutedMetaClassName()}>{leaveTypeLabel(type)}</span>
          ),
        },
        {
          title: "Dates",
          key: "dates",
          render: (_: unknown, req: LeaveRequest) => {
            const days = leaveDurationDays(req.startDate, req.endDate);
            return (
              <div className="min-w-0">
                <div className={cn("font-medium", text.primary)}>
                  {formatDateRange(req.startDate, req.endDate)}
                </div>
                <div className={cn("text-xs tabular-nums", text.muted)}>
                  {days} day{days === 1 ? "" : "s"}
                </div>
              </div>
            );
          },
        },
        {
          title: "Reason",
          dataIndex: "reason",
          key: "reason",
          responsive: ["lg"],
          render: (reason: string | null | undefined) =>
            reason?.trim() ? (
              <span className={cn("line-clamp-2 text-sm", text.secondary)}>{reason}</span>
            ) : (
              <span className={text.muted}>—</span>
            ),
        },
        {
          title: "Status",
          dataIndex: "status",
          key: "status",
          render: (status: string) => (
            <StatusBadge tone={leaveStatusTone(status)}>{leaveStatusLabel(status)}</StatusBadge>
          ),
        },
        ...(isManagerOrAdmin
          ? [
              {
                title: "",
                key: "actions",
                align: "right" as const,
                width: 80,
                render: (_: unknown, req: LeaveRequest) => renderLeaveActions(req),
              },
            ]
          : []),
      ] as ColumnsType<LeaveRequest>,
    [isManagerOrAdmin, renderLeaveActions],
  );

  const rowSelection = useMemo(() => {
    if (!onSelectionChange || !isManagerOrAdmin) return undefined;
    return {
      selectedRowKeys: selectedIds ?? [],
      onChange: (keys: React.Key[]) => onSelectionChange(keys.map(Number)),
      getCheckboxProps: (req: LeaveRequest) => ({
        disabled: req.status !== "PENDING",
        name: `leave-${req.id}`,
      }),
    };
  }, [onSelectionChange, isManagerOrAdmin, selectedIds]);

  return (
    <ResponsiveDataTableLayout
      mobile={
        isLoading ? (
          <ResponsiveDataTableLayout.Skeleton />
        ) : leaveRequests.length === 0 ? (
          <ResponsiveDataTableLayout.Empty message={emptyDescription} />
        ) : (
          <PaginatedMobileList
            items={leaveRequests}
            pageSize={listPagination.pageSize}
            page={listPagination.currentPage}
            onPageChange={listPagination.setCurrentPage}
          >
            {(req) => {
              const days = leaveDurationDays(req.startDate, req.endDate);

              return (
                <ListMobileCard>
                  <div className="mb-2 flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      {isManagerOrAdmin ? (
                        <>
                          <p className={cn("truncate font-medium", text.primary)}>
                            {req.user?.name ?? `Employee #${req.userId}`}
                          </p>
                          {req.user?.email ? (
                            <p className={cn("truncate text-xs", tableCellMutedClassName())}>
                              {req.user.email}
                            </p>
                          ) : null}
                          <p className={cn("mt-1 text-sm", hrMutedMetaClassName())}>
                            {leaveTypeLabel(req.type)}
                          </p>
                        </>
                      ) : (
                        <p className={cn("font-medium", text.primary)}>{leaveTypeLabel(req.type)}</p>
                      )}
                    </div>
                    <StatusBadge tone={leaveStatusTone(req.status)} className="shrink-0">
                      {leaveStatusLabel(req.status)}
                    </StatusBadge>
                  </div>
                  <p className={cn("font-medium", text.primary)}>
                    {formatDateRange(req.startDate, req.endDate)}
                  </p>
                  <p className={cn("mb-2 text-xs tabular-nums", text.muted)}>
                    {days} day{days === 1 ? "" : "s"}
                  </p>
                  {req.reason?.trim() ? (
                    <p className={cn("mb-2 line-clamp-2 text-sm", text.secondary)}>{req.reason}</p>
                  ) : null}
                  {renderLeaveActions(req)}
                </ListMobileCard>
              );
            }}
          </PaginatedMobileList>
        )
      }
      desktop={
        <DataTable
          hideBorders
          pagination={listPagination.tablePagination}
          rowSelection={rowSelection}
          columns={columns}
          dataSource={leaveRequests}
          rowKey="id"
          loading={isLoading}
          emptyDescription={emptyDescription}
        />
      }
    />
  );
}
