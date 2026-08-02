"use client";

import { Fragment, useMemo } from "react";
import type { ColumnsType } from "antd/es/table";
import { Ban, RotateCcw } from "lucide-react";
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
import { StatusBadge, formatStatusLabel, orderStatusTone } from "@/components/shared/status-badge";
import { TableActionButton } from "@/components/shared/table-action-button";
import { formatCurrency } from "@/lib/money";
import { formatQueueNumber } from "@/lib/queue";
import { isOrderToday, isTerminalOrderStatus } from "@/lib/filters/pos-order-filters";
import { formatDateTime } from "@/lib/intl-date";
import { tableRowDividerClassName } from "@/lib/theme/color-helpers";
import { tableCellMutedClassName } from "@/lib/theme/feedback";
import { posQueueHighlightClassName } from "@/lib/theme/immersive";
import { text } from "@/lib/theme/surface";
import { typeHeadingClassName } from "@/lib/theme/typography";
import { cn } from "@/lib/utils";
import type { Order, OrderStatus } from "@/types/api";

type PosOrdersTableProps = {
  orders: Order[];
  loading: boolean;
  hasActiveFilters: boolean;
  canManage: boolean;
  serverPagination: ServerPagination;
  onVoid: (order: Order) => void;
  onRefund: (order: Order) => void;
};

function OrderMobileActions({
  row,
  canManage,
  onVoid,
  onRefund,
}: {
  row: Order;
  canManage: boolean;
  onVoid: (order: Order) => void;
  onRefund: (order: Order) => void;
}) {
  if (!canManage || isTerminalOrderStatus(row.status)) return null;

  if (isOrderToday(row.createdAt)) {
    return (
      <TableActionButton icon={Ban} label="Void" destructive onClick={() => onVoid(row)} />
    );
  }

  if (row.status === "COMPLETED") {
    return (
      <TableActionButton
        icon={RotateCcw}
        label="Refund"
        tone="amber"
        onClick={() => onRefund(row)}
      />
    );
  }

  return null;
}

function OrderLineItems({ row }: { row: Order }) {
  const items = row.items ?? [];
  if (items.length === 0) {
    return <p className={cn("text-xs", text.muted)}>No line items.</p>;
  }

  return (
    <ul className="mt-2 space-y-2 border-t border-[var(--table-row-border)] pt-2 text-sm">
      {items.map((item) => (
        <li
          key={item.id}
          className={tableRowDividerClassName(
            "flex flex-wrap items-baseline justify-between gap-2 border-b pb-2 last:border-0 last:pb-0",
          )}
        >
          <div className="min-w-0">
            <span className={text.primary}>
              {item.product?.name ?? `Product #${item.productId}`}
            </span>
            {item.notes ? (
              <span className={cn("block text-xs", text.muted)}>{item.notes}</span>
            ) : null}
          </div>
          <span className="shrink-0 font-mono tabular-nums">
            {item.quantity} × {formatCurrency(item.price)}
          </span>
        </li>
      ))}
    </ul>
  );
}

export function PosOrdersTable({
  orders,
  loading,
  hasActiveFilters,
  canManage,
  serverPagination,
  onVoid,
  onRefund,
}: PosOrdersTableProps) {
  const emptyDescription = hasActiveFilters
    ? "No orders match your filters."
    : "No orders in the selected period.";

  const { page } = serverPagination;
  const { tablePagination, totalPages, goToPage } = useServerTablePagination(
    serverPagination,
    "orders",
  );

  const columns = useMemo(
    () =>
      [
        {
          title: "Queue",
          dataIndex: "queueNumber",
          key: "queue",
          render: (n: number | null) => (
            <span className={posQueueHighlightClassName()}>{formatQueueNumber(n)}</span>
          ),
        },
        {
          title: "Order #",
          dataIndex: "id",
          key: "id",
          responsive: ["md"],
          render: (id: number) => (
            <span className={cn("font-mono", tableCellMutedClassName())}>#{id}</span>
          ),
        },
        {
          title: "Date",
          dataIndex: "createdAt",
          key: "date",
          responsive: ["lg"],
          render: (v: string) => (
            <span className="whitespace-nowrap tabular-nums">{formatDateTime(v)}</span>
          ),
        },
        {
          title: "Status",
          dataIndex: "status",
          key: "status",
          render: (status: OrderStatus) => (
            <StatusBadge tone={orderStatusTone(status)}>{formatStatusLabel(status)}</StatusBadge>
          ),
        },
        {
          title: "Payment",
          dataIndex: "paymentMethod",
          key: "payment",
          responsive: ["md"],
          render: (v: string) => v?.replace("_", " ") ?? "-",
        },
        {
          title: "Net",
          dataIndex: "netAmount",
          key: "net",
          align: "right" as const,
          render: (v: number | string) => (
            <span className={typeHeadingClassName("font-mono tabular-nums")}>
              {formatCurrency(v)}
            </span>
          ),
        },
        {
          title: "Items",
          key: "items",
          responsive: ["lg"],
          render: (_: unknown, row: Order) => row.items?.length ?? 0,
        },
        {
          title: "Actions",
          key: "actions",
          align: "right" as const,
          render: (_: unknown, row: Order) => (
            <OrderMobileActions
              row={row}
              canManage={canManage}
              onVoid={onVoid}
              onRefund={onRefund}
            />
          ),
        },
      ] satisfies ColumnsType<Order>,
    [canManage, onVoid, onRefund],
  );

  const expandedRow = (row: Order) => (
    <ul className="space-y-2 py-2 text-sm">
      {(row.items ?? []).map((item) => (
        <li
          key={item.id}
          className={tableRowDividerClassName(
            "flex flex-wrap items-baseline justify-between gap-2 border-b pb-2 last:border-0",
          )}
        >
          <div>
            <span className={text.primary}>
              {item.product?.name ?? `Product #${item.productId}`}
            </span>
            {item.notes && (
              <span className={cn("block text-xs", text.muted)}>{item.notes}</span>
            )}
            {item.modifiers?.map((mod) => (
              <span key={mod.id} className={cn("block text-xs", text.muted)}>
                {mod.optionName}
              </span>
            ))}
          </div>
          <span className="shrink-0 font-mono tabular-nums">
            {item.quantity} × {formatCurrency(item.price)}
          </span>
        </li>
      ))}
      {(row.items?.length ?? 0) === 0 && (
        <li className={text.muted}>No line items returned for this order.</li>
      )}
    </ul>
  );

  return (
    <ResponsiveDataTableLayout
      mobile={
        loading ? (
          <ResponsiveDataTableLayout.Skeleton />
        ) : orders.length === 0 ? (
          <ResponsiveDataTableLayout.Empty message={emptyDescription} />
        ) : (
          <>
            {orders.map((row) => (
              <Fragment key={row.id}>
              <ListMobileCard>
                <div className="mb-2 flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className={posQueueHighlightClassName()}>
                      #{formatQueueNumber(row.queueNumber)}
                    </p>
                    <p className={cn("text-xs tabular-nums", text.muted)}>
                      {formatDateTime(row.createdAt)}
                      <span className="mx-1" aria-hidden>
                        ·
                      </span>
                      {row.paymentMethod?.replace("_", " ") ?? "—"}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1.5">
                    <StatusBadge tone={orderStatusTone(row.status)}>{formatStatusLabel(row.status)}</StatusBadge>
                    <span className={typeHeadingClassName("font-mono text-base tabular-nums")}>
                      {formatCurrency(row.netAmount)}
                    </span>
                  </div>
                </div>
                <OrderLineItems row={row} />
                <div className="mt-3 flex justify-end">
                  <OrderMobileActions
                    row={row}
                    canManage={canManage}
                    onVoid={onVoid}
                    onRefund={onRefund}
                  />
                </div>
              </ListMobileCard>
              </Fragment>
            ))}
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
          loading={loading}
          rowKey="id"
          dataSource={orders}
          columns={columns}
          emptyDescription={emptyDescription}
          expandable={{
            expandedRowRender: expandedRow,
            rowExpandable: (row) => (row.items?.length ?? 0) > 0,
          }}
        />
      }
    />
  );
}
