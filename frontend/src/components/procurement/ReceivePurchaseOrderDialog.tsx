"use client";

import { Loader2 } from "lucide-react";
import type { ColumnsType } from "antd/es/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FormDialog } from "@/components/shared/form-modal";
import { DataTable } from "@/components/shared/data-table";
import {
  ListMobileCard,
  PaginatedMobileList,
  ResponsiveDataTableLayout,
} from "@/components/shared/responsive-data-table";
import { formatCurrency } from "@/lib/money";
import { expandedRowPanelClassName, hubCtaClassName } from "@/lib/theme/hub-primitives";
import { procurementDialogContentClassName } from "@/lib/theme/hub-procurement";
import { formLineDateFieldClassName } from "@/lib/theme/stock";
import { text } from "@/lib/theme/surface";
import { cn } from "@/lib/utils";
import type { PurchaseOrder, PurchaseOrderItem } from "@/types/api";

const poItemColumns: ColumnsType<PurchaseOrderItem> = [
  {
    title: "Ingredient",
    key: "name",
    render: (_: unknown, item: PurchaseOrderItem) => (
      <span className={text.primary}>{item.ingredient?.name ?? "—"}</span>
    ),
  },
  {
    title: "Qty",
    dataIndex: "quantityRequested",
    key: "qty",
    width: 96,
    align: "right" as const,
    render: (val: number, item: PurchaseOrderItem) => (
      <span className={cn("tabular-nums", text.secondary)}>
        {val} {item.ingredient?.unit ?? ""}
      </span>
    ),
  },
  {
    title: "Unit",
    dataIndex: "unitPrice",
    key: "price",
    align: "right" as const,
    responsive: ["md"],
    render: (val: number) => (
      <span className={cn("tabular-nums", text.secondary)}>{formatCurrency(val)}</span>
    ),
  },
  {
    title: "Total",
    key: "total",
    align: "right" as const,
    render: (_: unknown, item: PurchaseOrderItem) => (
      <span className={cn("tabular-nums font-medium", text.primary)}>
        {formatCurrency(item.quantityRequested * item.unitPrice)}
      </span>
    ),
  },
];

function PoLineItemsTable({ items }: { items: PurchaseOrderItem[] }) {
  return (
    <ResponsiveDataTableLayout
      mobile={
        items.length === 0 ? (
          <ResponsiveDataTableLayout.Empty message="No line items." />
        ) : (
          <PaginatedMobileList items={items} pageSize={0}>
            {(item) => (
              <ListMobileCard>
                <p className={cn("font-medium", text.primary)}>{item.ingredient?.name ?? "—"}</p>
                <dl className="mt-2 grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <dt className={text.muted}>Qty</dt>
                    <dd className={cn("tabular-nums", text.secondary)}>
                      {item.quantityRequested} {item.ingredient?.unit ?? ""}
                    </dd>
                  </div>
                  <div>
                    <dt className={text.muted}>Unit</dt>
                    <dd className={cn("tabular-nums", text.secondary)}>
                      {formatCurrency(item.unitPrice)}
                    </dd>
                  </div>
                  <div className="col-span-2">
                    <dt className={text.muted}>Total</dt>
                    <dd className={cn("tabular-nums font-medium", text.primary)}>
                      {formatCurrency(item.quantityRequested * item.unitPrice)}
                    </dd>
                  </div>
                </dl>
              </ListMobileCard>
            )}
          </PaginatedMobileList>
        )
      }
      desktop={
        <DataTable
          columns={poItemColumns}
          dataSource={items}
          rowKey="id"
          pagination={false}
          size="small"
          hideBorders
          emptyDescription="No line items."
        />
      }
    />
  );
}

export function PurchaseOrderExpandedPanel({ record }: { record: PurchaseOrder }) {
  const items = record.items ?? [];

  return (
    <div className={expandedRowPanelClassName()}>
      <PoLineItemsTable items={items} />
    </div>
  );
}

export function ReceivePurchaseOrderDialog({
  purchaseOrder,
  expiryByIngredient,
  onExpiryChange,
  onClose,
  onConfirm,
  isSubmitting,
}: {
  purchaseOrder: PurchaseOrder | null;
  expiryByIngredient: Record<number, string>;
  onExpiryChange: (ingredientId: number, value: string) => void;
  onClose: () => void;
  onConfirm: () => void;
  isSubmitting: boolean;
}) {
  const items = purchaseOrder?.items ?? [];

  return (
    <FormDialog
      busy={isSubmitting}
      open={purchaseOrder != null}
      onOpenChange={(open) => !open && onClose()}
      className={procurementDialogContentClassName("sm:max-w-lg")}
    >
        <FormDialog.Title>Receive {purchaseOrder?.poNumber ?? "PO"}</FormDialog.Title>
        <FormDialog.Body className="space-y-3 pt-1">
          {items.length === 0 ? (
            <p className={cn("py-4 text-center text-sm", text.muted)}>No line items.</p>
          ) : (
            <PaginatedMobileList
              items={items}
              pageSize={0}
              getItemKey={(item) => item.id}
            >
              {(item) => (
                <ListMobileCard>
                  <div className="mb-3">
                    <p className={cn("font-medium", text.primary)}>{item.ingredient?.name}</p>
                    <p className={cn("text-xs tabular-nums", text.muted)}>
                      {item.quantityRequested} {item.ingredient?.unit}
                    </p>
                  </div>
                  <div>
                    <Label className={cn("text-xs", text.secondary)} htmlFor={`expiry-${item.ingredientId}`}>
                      Expiry
                    </Label>
                    <Input
                      id={`expiry-${item.ingredientId}`}
                      type="date"
                      value={expiryByIngredient[item.ingredientId] ?? ""}
                      onChange={(e) => onExpiryChange(item.ingredientId, e.target.value)}
                      className={cn("mt-1", formLineDateFieldClassName())}
                    />
                  </div>
                </ListMobileCard>
              )}
            </PaginatedMobileList>
          )}
        </FormDialog.Body>
        <FormDialog.Footer className="gap-2 sm:gap-0">
          <Button type="button" variant="outline" disabled={isSubmitting} onClick={onClose} className="min-h-[44px]">
            Cancel
          </Button>
          <Button
            type="button"
            disabled={isSubmitting}
            className={cn("min-h-[44px]", hubCtaClassName("procurement"))}
            onClick={onConfirm}
          >
            {isSubmitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" aria-hidden />}
            Receive
          </Button>
        </FormDialog.Footer>
    </FormDialog>
  );
}
