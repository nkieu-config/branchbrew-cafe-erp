"use client";

import React, { useEffect, useRef } from "react";
import { Table, Skeleton } from "antd";
import type { TableProps } from "antd";
import { useTheme } from "next-themes";
import { Inbox } from "lucide-react";
import { AntdProvider } from "@/providers/AntdProvider";
import { QueryErrorBanner } from "@/components/shared/query-error-banner";
import { dataTableContainerClassName, dataTableEmptyIconClassName, dataTableEmptyTextClassName, dataTableSkeletonClassName } from "@/lib/theme/data-table";

interface DataTableProps<RecordType extends object = object> extends TableProps<RecordType> {
  containerClassName?: string;
  hideBorders?: boolean;
  emptyDescription?: string;
  /** Optional call-to-action rendered under the empty-state text (e.g. a create button). */
  emptyAction?: React.ReactNode;
  /** When true, shows recoverable error banner above the table shell. */
  isError?: boolean;
  errorMessage?: string;
  onRetry?: () => void;
  retryLoading?: boolean;
}

function TableEmptyState({
  description,
  action,
}: {
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="py-12 text-center">
      <Inbox className={dataTableEmptyIconClassName()} />
      <p className={dataTableEmptyTextClassName()}>{description}</p>
      {action && <div className="mt-4 flex justify-center">{action}</div>}
    </div>
  );
}

export function DataTable<RecordType extends object = object>({
  containerClassName = "",
  hideBorders = false,
  emptyDescription = "No records found.",
  emptyAction,
  isError = false,
  errorMessage = "Failed to load data.",
  onRetry,
  retryLoading = false,
  locale,
  ...props
}: DataTableProps<RecordType>) {
  const { resolvedTheme } = useTheme();
  const tableThemeKey = resolvedTheme ?? "light";
  const shellRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const scrollAreas = shellRef.current?.querySelectorAll<HTMLElement>(
      ".ant-table-content, .ant-table-body",
    );
    scrollAreas?.forEach((el) => {
      if (el.getAttribute("tabindex") == null) {
        el.tabIndex = 0;
        el.setAttribute("role", "group");
        el.setAttribute("aria-label", "Scrollable table");
      }
    });
  });

  if (
    props.loading &&
    !isError &&
    (!props.dataSource || (Array.isArray(props.dataSource) && props.dataSource.length === 0))
  ) {
    return (
      <AntdProvider>
        <div className={dataTableSkeletonClassName({ hideBorders }, containerClassName)}>
          <Skeleton active paragraph={{ rows: 5 }} />
        </div>
      </AntdProvider>
    );
  }

  return (
    <AntdProvider>
      <div className="space-y-3">
      {isError && (
        <QueryErrorBanner
          message={errorMessage}
          onRetry={onRetry}
          loading={retryLoading}
        />
      )}
      <div ref={shellRef} className={dataTableContainerClassName({ hideBorders }, containerClassName)}>
        <Table
          key={tableThemeKey}
          pagination={{
            placement: ["bottomEnd"],
            showSizeChanger: true,
            ...props.pagination,
          }}
          scroll={{ x: "max-content", ...props.scroll }}
          locale={{
            emptyText: <TableEmptyState description={emptyDescription} action={emptyAction} />,
            ...locale,
          }}
          {...props}
        />
      </div>
      </div>
    </AntdProvider>
  );
}
