"use client";

import { useMemo } from "react";
import type { TablePaginationConfig } from "antd/es/table";
import { HUB_LIST_PAGE_SIZE_OPTIONS } from "@/lib/theme/data-table";

export type ServerPagination = {
  page: number;
  pageSize: number;
  total: number;
  onChange: (page: number, pageSize: number) => void;
};

/**
 * antd pagination driven by a server-side window: the table renders exactly the
 * rows it was given and reports the server's `total`, so page counts stay honest
 * instead of describing the slice that happens to be loaded.
 */
export function useServerTablePagination(
  pagination: ServerPagination,
  itemLabel = "rows",
) {
  const { page, pageSize, total, onChange } = pagination;

  const tablePagination = useMemo<TablePaginationConfig>(
    () => ({
      current: page,
      pageSize,
      total,
      showSizeChanger: true,
      pageSizeOptions: [...HUB_LIST_PAGE_SIZE_OPTIONS],
      showTotal: (count, range) => `${range[0]}–${range[1]} of ${count} ${itemLabel}`,
      onChange,
      onShowSizeChange: (_current, size) => onChange(1, size),
    }),
    [page, pageSize, total, onChange, itemLabel],
  );

  return {
    tablePagination,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
    goToPage: (next: number) => onChange(next, pageSize),
  };
}
