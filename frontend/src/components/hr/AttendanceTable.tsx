"use client";

import { useMemo } from "react";
import type { ColumnsType } from "antd/es/table";
import { DataTable } from "@/components/shared/data-table";
import {
  ListMobileCard,
  MobileListPagination,
  ResponsiveDataTableLayout,
} from "@/components/shared/responsive-data-table";
import {
  useServerTablePagination,
  type ServerPagination,
} from "@/hooks/useServerTablePagination";
import {
  type AttendanceRecordRow,
  isActiveRecord,
  isAttendanceLate,
} from "@/lib/filters/attendance-filters";
import { formatDate, formatTime } from "@/lib/intl-date";
import {
  attendanceLateRowClassName,
  attendanceLateTimeClassName,
  attendanceOnTimeClassName,
  hrMutedMetaClassName,
} from "@/lib/theme/hub-hr";
import { COL_WIDTH } from "@/lib/theme/data-table";
import { text } from "@/lib/theme/surface";
import { formatQuantity } from "@/lib/money";
import { cn } from "@/lib/utils";
import type { Shift } from "@/types/api";

type AttendanceTableProps = {
  attendance: AttendanceRecordRow[];
  serverPagination: ServerPagination;
  shifts: Shift[];
  isLoading: boolean;
  hasActiveFilters: boolean;
};

export function AttendanceTable({
  attendance,
  shifts,
  isLoading,
  hasActiveFilters,
  serverPagination,
}: AttendanceTableProps) {
  const emptyDescription = hasActiveFilters
    ? "No records match the current filters."
    : "Clock in to start tracking your attendance.";

  const { page } = serverPagination;
  const { tablePagination, totalPages, goToPage } = useServerTablePagination(
    serverPagination,
    "records",
  );

  const columns = useMemo(
    () =>
      [
        {
          title: "Date",
          dataIndex: "clockIn",
          key: "date",
          width: COL_WIDTH.date,
          render: (val: string) => (
            <span className={cn("font-medium", text.primary)}>{formatDate(val)}</span>
          ),
        },
        {
          title: "In",
          dataIndex: "clockIn",
          key: "in",
          width: 130,
          render: (val: string) => {
            const { isLate } = isAttendanceLate(val, shifts);
            return (
              <div className="flex items-center gap-2">
                <span className={isLate ? attendanceLateTimeClassName() : attendanceOnTimeClassName()}>
                  {formatTime(val)}
                </span>
                {isLate ? <span className={hrMutedMetaClassName("text-[var(--status-danger-fg)]")}>Late</span> : null}
              </div>
            );
          },
        },
        {
          title: "Out",
          dataIndex: "clockOut",
          key: "out",
          width: 130,
          render: (val: string | null) =>
            val ? (
              <span className={cn("tabular-nums", text.secondary)}>{formatTime(val)}</span>
            ) : (
              <span className={text.muted}>Active</span>
            ),
        },
        {
          title: "Branch",
          dataIndex: ["branch", "name"],
          key: "branch",
          responsive: ["md"],
          width: 200,
          render: (name: string) =>
            name ? (
              <span className={text.secondary}>{name}</span>
            ) : (
              <span className={text.muted}>—</span>
            ),
        },
        {
          title: "Hours",
          dataIndex: "totalHours",
          key: "hours",
          align: "right" as const,
          width: 100,
          render: (val: number | null, record: AttendanceRecordRow) =>
            val != null && val > 0 ? (
              <span className={cn("tabular-nums", text.primary)}>{formatQuantity(val)}</span>
            ) : isActiveRecord(record) ? (
              <span className={text.muted}>—</span>
            ) : (
              <span className={text.muted}>—</span>
            ),
        },
        { title: "", key: "spacer", render: () => null },
      ] as ColumnsType<AttendanceRecordRow>,
    [shifts],
  );

  const rowClassName = (record: AttendanceRecordRow) => {
    if (record.user?.role === "SUPER_ADMIN") return "";
    const { isLate } = isAttendanceLate(record.clockIn, shifts);
    return isLate ? attendanceLateRowClassName() : "";
  };

  return (
    <ResponsiveDataTableLayout
      mobile={
        isLoading ? (
          <ResponsiveDataTableLayout.Skeleton />
        ) : attendance.length === 0 ? (
          <ResponsiveDataTableLayout.Empty message={emptyDescription} />
        ) : (
          <>
            {attendance.map((record) => {
              const isLate =
                record.user?.role !== "SUPER_ADMIN" && isAttendanceLate(record.clockIn, shifts).isLate;

              return (
                <ListMobileCard
                  key={record.id}
                  className={isLate ? attendanceLateRowClassName("cursor-default") : undefined}
                >
                  <div className="mb-2 flex items-start justify-between gap-3">
                    <p className={cn("font-medium", text.primary)}>{formatDate(record.clockIn)}</p>
                    {record.totalHours != null && record.totalHours > 0 ? (
                      <span className={cn("shrink-0 tabular-nums text-sm font-medium", text.primary)}>
                        {formatQuantity(record.totalHours)}h
                      </span>
                    ) : null}
                  </div>
                  <dl className="grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <dt className={text.muted}>In</dt>
                      <dd className="flex items-center gap-2">
                        <span className={isLate ? attendanceLateTimeClassName() : attendanceOnTimeClassName()}>
                          {formatTime(record.clockIn)}
                        </span>
                        {isLate ? (
                          <span className={hrMutedMetaClassName("text-[var(--status-danger-fg)]")}>Late</span>
                        ) : null}
                      </dd>
                    </div>
                    <div>
                      <dt className={text.muted}>Out</dt>
                      <dd className={cn("tabular-nums", text.secondary)}>
                        {record.clockOut ? formatTime(record.clockOut) : "Active"}
                      </dd>
                    </div>
                  </dl>
                  {record.branch?.name ? (
                    <p className={cn("mt-2 text-sm", text.secondary)}>{record.branch.name}</p>
                  ) : null}
                </ListMobileCard>
              );
            })}
            {totalPages > 1 && (
              <MobileListPagination
                currentPage={page}
                totalPages={totalPages}
                onPrevious={() => goToPage(Math.max(1, page - 1))}
                onNext={() => goToPage(Math.min(totalPages, page + 1))}
              />
            )}
          </>
        )
      }
      desktop={
        <DataTable
          hideBorders
          pagination={tablePagination}
          columns={columns}
          dataSource={attendance}
          rowKey="id"
          loading={isLoading}
          emptyDescription={emptyDescription}
          rowClassName={rowClassName}
        />
      }
    />
  );
}
