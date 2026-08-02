"use client";

import { memo, useMemo } from "react";
import type { ColumnsType } from "antd/es/table";
import { DataTable } from "@/components/shared/data-table";
import {
  ListMobileCard,
  PaginatedMobileList,
  ResponsiveDataTableLayout,
} from "@/components/shared/responsive-data-table";
import { StatusBadge } from "@/components/shared/status-badge";
import { TierIcon } from "@/components/crm/TierIcon";
import { formatDate } from "@/lib/intl-date";
import type { Customer } from "@/types/api";
import {
  crmPointsClassName,
  crmPointsSuffixClassName,
  customerTierTone,
} from "@/lib/theme/hub-crm";
import { useHubListPagination } from "@/hooks/useHubListPagination";
import { text } from "@/lib/theme/surface";
import { cn } from "@/lib/utils";

type CustomerListTableProps = {
  customers: Customer[];
  loading: boolean;
  isError: boolean;
  hasActiveFilters: boolean;
  onSelectCustomer: (id: number) => void;
};

type CustomerMobileCardProps = {
  customer: Customer;
  onSelectCustomer: (id: number) => void;
};

const CustomerMobileCard = memo(function CustomerMobileCard({
  customer,
  onSelectCustomer,
}: CustomerMobileCardProps) {
  return (
    <ListMobileCard
      onClick={() => onSelectCustomer(customer.id)}
      aria-label={`View profile for ${customer.name}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className={cn("font-medium", text.primary)}>{customer.name}</p>
          {customer.phone ? (
            <p className={cn("text-sm tabular-nums", text.muted)}>{customer.phone}</p>
          ) : null}
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <StatusBadge tone={customerTierTone(customer.tier)} className="w-fit">
              <span className="inline-flex items-center gap-1">
                <TierIcon tier={customer.tier} />
                {customer.tier}
              </span>
            </StatusBadge>
            <span className={crmPointsClassName()}>
              {customer.points.toLocaleString()}
              <span className={crmPointsSuffixClassName()}> pts</span>
            </span>
          </div>
          {customer.createdAt ? (
            <time
              className={cn("mt-1 block text-xs tabular-nums", text.muted)}
              dateTime={customer.createdAt}
            >
              Joined {formatDate(customer.createdAt)}
            </time>
          ) : null}
        </div>
      </div>
    </ListMobileCard>
  );
});

export function CustomerListTable({
  customers,
  loading,
  isError,
  hasActiveFilters,
  onSelectCustomer,
}: CustomerListTableProps) {
  const columns = useMemo(
    () =>
      [
        {
          title: "Name",
          dataIndex: "name",
          key: "name",
          render: (name: string) => (
            <span className={cn("font-medium", text.primary)}>{name}</span>
          ),
        },
        {
          title: "Phone",
          dataIndex: "phone",
          key: "phone",
          responsive: ["md"],
          render: (phone: string) => (
            <span className={cn("tabular-nums", text.muted)}>{phone}</span>
          ),
        },
        {
          title: "Tier",
          key: "tier",
          render: (_: unknown, record: Customer) => (
            <StatusBadge tone={customerTierTone(record.tier)} className="w-fit">
              <span className="inline-flex items-center gap-1">
                <TierIcon tier={record.tier} />
                {record.tier}
              </span>
            </StatusBadge>
          ),
        },
        {
          title: "Points",
          dataIndex: "points",
          key: "points",
          align: "right" as const,
          render: (points: number) => (
            <span className={crmPointsClassName()}>
              {points.toLocaleString()}
              <span className={crmPointsSuffixClassName()}> pts</span>
            </span>
          ),
        },
        {
          title: "Joined",
          dataIndex: "createdAt",
          key: "createdAt",
          responsive: ["lg"],
          render: (createdAt: string) => (
            <span className={cn("text-sm tabular-nums", text.muted)}>
              {formatDate(createdAt)}
            </span>
          ),
        },
      ] as ColumnsType<Customer>,
    [],
  );

  const emptyDescription = hasActiveFilters ? "No members match your filters." : "No members yet.";

  const listPagination = useHubListPagination(
    { pageSize: 15 },
    `${customers.length}-${hasActiveFilters}`,
  );

  return (
    <ResponsiveDataTableLayout
      mobile={
        loading && !isError ? (
          <ResponsiveDataTableLayout.Skeleton />
        ) : !loading && !isError && customers.length === 0 ? (
          <ResponsiveDataTableLayout.Empty message={emptyDescription} />
        ) : (
          <PaginatedMobileList
            items={customers}
            pageSize={listPagination.pageSize}
            page={listPagination.currentPage}
            onPageChange={listPagination.setCurrentPage}
          >
            {(customer) => (
              <CustomerMobileCard customer={customer} onSelectCustomer={onSelectCustomer} />
            )}
          </PaginatedMobileList>
        )
      }
      desktop={
        <DataTable
          hideBorders
          pagination={listPagination.tablePagination}
          loading={loading}
          columns={columns}
          dataSource={customers}
          rowKey="id"
          emptyDescription={emptyDescription}
          onRow={(record) => ({
            onClick: () => onSelectCustomer(record.id),
            onKeyDown: (e: React.KeyboardEvent) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onSelectCustomer(record.id);
              }
            },
            tabIndex: 0,
            role: "button",
            "aria-label": `View profile for ${record.name}`,
            className:
              "cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          })}
        />
      }
    />
  );
}
