"use client";

import { useMemo, useState, useCallback } from "react";
import type { ColumnsType } from "antd/es/table";
import { Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useTogglePromotion } from "@/hooks/domains/useCrmQueries";
import { getErrorMessage } from "@/lib/errors";
import { formatCurrency } from "@/lib/money";
import {
  formatPromoValidityRange,
  getPromoValidity,
  promoValidityLabel,
  promoValidityTone,
} from "@/lib/promotion-status";
import type { Promotion } from "@/types/api";
import { DataTable } from "@/components/shared/data-table";
import {
  ListMobileCard,
  PaginatedMobileList,
  ResponsiveDataTableLayout,
} from "@/components/shared/responsive-data-table";
import { StatusBadge } from "@/components/shared/status-badge";
import { TableActionButton } from "@/components/shared/table-action-button";
import { Switch } from "@/components/ui/switch";
import { useHubListPagination } from "@/hooks/useHubListPagination";
import { COL_WIDTH } from "@/lib/theme/data-table";
import { text } from "@/lib/theme/surface";
import { cn } from "@/lib/utils";

type PromotionListTableProps = {
  promotions: Promotion[];
  loading: boolean;
  isError: boolean;
  hasActiveFilters: boolean;
  onEdit: (promotion: Promotion) => void;
  onDelete: (promotion: Promotion) => void;
};

type PromotionStatusControlProps = {
  promotion: Promotion;
  togglingId: number | null;
  onToggle: (id: number, currentStatus: boolean) => void;
};

function PromotionStatusControl({
  promotion,
  togglingId,
  onToggle,
}: PromotionStatusControlProps) {
  const validity = getPromoValidity(promotion);
  const isExpired = validity === "expired";
  const isToggling = togglingId === promotion.id;

  return (
    <div className="flex items-center gap-2">
      <StatusBadge tone={promoValidityTone(validity)} className="shrink-0">
        {promoValidityLabel(validity)}
      </StatusBadge>
      <Switch
        checked={promotion.isActive}
        disabled={isExpired || isToggling}
        onCheckedChange={() => onToggle(promotion.id, promotion.isActive)}
        aria-label={`Toggle ${promotion.code}`}
      />
    </div>
  );
}

type PromotionActionsProps = {
  promotion: Promotion;
  onEdit: (promotion: Promotion) => void;
  onDelete: (promotion: Promotion) => void;
};

function PromotionActions({ promotion, onEdit, onDelete }: PromotionActionsProps) {
  return (
    <div className="flex items-center justify-end gap-1">
      <TableActionButton
        label={`Edit ${promotion.code}`}
        icon={Pencil}
        iconOnly
        tone="purple"
        onClick={() => onEdit(promotion)}
      />
      <TableActionButton
        label={`Delete ${promotion.code}`}
        icon={Trash2}
        iconOnly
        destructive
        onClick={() => onDelete(promotion)}
      />
    </div>
  );
}

type PromotionMobileCardProps = PromotionActionsProps & PromotionStatusControlProps;

function PromotionMobileCard({
  promotion,
  togglingId,
  onToggle,
  onEdit,
  onDelete,
}: PromotionMobileCardProps) {
  return (
    <ListMobileCard>
      <div className="mb-2 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className={cn("font-mono font-medium", text.primary)}>{promotion.code}</p>
          {promotion.description ? (
            <p className={cn("line-clamp-2 text-sm", text.secondary)}>
              {promotion.description}
            </p>
          ) : null}
        </div>
        <span className={cn("shrink-0 tabular-nums font-medium", text.primary)}>
          {promotion.discountType === "PERCENTAGE"
            ? `${promotion.discountValue}%`
            : formatCurrency(promotion.discountValue)}
        </span>
      </div>
      <p className={cn("mb-1 text-sm tabular-nums", text.muted)}>
        {formatPromoValidityRange(promotion)}
      </p>
      {promotion.minPurchase != null ? (
        <p className={cn("mb-2 text-xs tabular-nums", text.muted)}>
          Min {formatCurrency(promotion.minPurchase)}
        </p>
      ) : null}
      <div className="mb-3">
        <PromotionStatusControl
          promotion={promotion}
          togglingId={togglingId}
          onToggle={onToggle}
        />
      </div>
      <PromotionActions promotion={promotion} onEdit={onEdit} onDelete={onDelete} />
    </ListMobileCard>
  );
}

export function PromotionListTable({
  promotions,
  loading,
  isError,
  hasActiveFilters,
  onEdit,
  onDelete,
}: PromotionListTableProps) {
  const emptyDescription = hasActiveFilters ? "No promos match your filters." : "No promos yet.";

  const listPagination = useHubListPagination(
    { pageSize: 15 },
    `${promotions.length}-${hasActiveFilters}`,
  );

  const [togglingId, setTogglingId] = useState<number | null>(null);
  const toggleMutation = useTogglePromotion();

  const handleToggle = useCallback(
    async (id: number, currentStatus: boolean) => {
      setTogglingId(id);
      try {
        await toggleMutation.mutateAsync({ id, isActive: !currentStatus });
      } catch (err: unknown) {
        toast.error(getErrorMessage(err, "Failed to update promotion"));
      } finally {
        setTogglingId(null);
      }
    },
    [toggleMutation],
  );

  const columns = useMemo(
    () =>
      [
        {
          title: "Code",
          dataIndex: "code",
          key: "code",
          render: (code: string) => (
            <span className={cn("font-mono font-medium", text.primary)}>{code}</span>
          ),
        },
        {
          title: "Discount",
          key: "discount",
          width: 100,
          align: "right" as const,
          render: (_: unknown, record: Promotion) => (
            <span className={cn("tabular-nums font-medium", text.primary)}>
              {record.discountType === "PERCENTAGE"
                ? `${record.discountValue}%`
                : formatCurrency(record.discountValue)}
            </span>
          ),
        },
        {
          title: "Description",
          dataIndex: "description",
          key: "desc",
          responsive: ["md"],
          render: (desc: string) => <span className={text.secondary}>{desc}</span>,
        },
        {
          title: "Valid",
          key: "validity",
          responsive: ["lg"],
          render: (_: unknown, record: Promotion) => (
            <span className={cn("text-sm tabular-nums", text.muted)}>
              {formatPromoValidityRange(record)}
            </span>
          ),
        },
        {
          title: "Min",
          dataIndex: "minPurchase",
          key: "minPurchase",
          responsive: ["lg"],
          width: 96,
          align: "right" as const,
          render: (min: number | null) => (
            <span className={cn("tabular-nums text-sm", text.muted)}>
              {min != null ? formatCurrency(min) : "—"}
            </span>
          ),
        },
        {
          title: "Status",
          dataIndex: "isActive",
          key: "status",
          width: COL_WIDTH.status,
          render: (_: boolean, record: Promotion) => (
            <PromotionStatusControl
              promotion={record}
              togglingId={togglingId}
              onToggle={handleToggle}
            />
          ),
        },
        {
          title: "",
          key: "actions",
          width: 80,
          render: (_: unknown, record: Promotion) => (
            <PromotionActions promotion={record} onEdit={onEdit} onDelete={onDelete} />
          ),
        },
      ] as ColumnsType<Promotion>,
    [handleToggle, onDelete, onEdit, togglingId],
  );

  return (
    <ResponsiveDataTableLayout
      mobile={
        loading && !isError ? (
          <ResponsiveDataTableLayout.Skeleton />
        ) : !loading && !isError && promotions.length === 0 ? (
          <ResponsiveDataTableLayout.Empty message={emptyDescription} />
        ) : (
          <PaginatedMobileList
            items={promotions}
            pageSize={listPagination.pageSize}
            page={listPagination.currentPage}
            onPageChange={listPagination.setCurrentPage}
          >
            {(promotion) => (
              <PromotionMobileCard
                promotion={promotion}
                togglingId={togglingId}
                onToggle={handleToggle}
                onEdit={onEdit}
                onDelete={onDelete}
              />
            )}
          </PaginatedMobileList>
        )
      }
      desktop={
        <DataTable
          hideBorders
          pagination={listPagination.tablePagination}
          columns={columns}
          dataSource={promotions}
          rowKey="id"
          loading={loading}
          emptyDescription={emptyDescription}
        />
      }
    />
  );
}
