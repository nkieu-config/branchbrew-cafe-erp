"use client";

import { useCallback, useEffect, useMemo, useState, useDeferredValue } from "react";
import type { ColumnsType } from "antd/es/table";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  usePurchaseOrders,
  useSuppliers,
  useCreatePurchaseOrder,
  useSubmitPurchaseOrder,
  useApprovePurchaseOrder,
  useRejectPurchaseOrder,
  useReceivePurchaseOrder,
  usePayPurchaseOrder,
} from "@/hooks/domains/useProcurementQueries";
import { useIngredients } from "@/hooks/domains/useProductQueries";
import { useAuth } from "@/context/AuthContext";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { TableActionButton } from "@/components/shared/table-action-button";
import {
  StatusBadge,
  formatStatusLabel,
  poPaymentStatusTone,
  poStatusTone,
} from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import {
  Plus,
  CheckCircle2,
  XCircle,
  CheckSquare,
  Send,
  Banknote,
} from "lucide-react";
import { toast } from "sonner";
import { BranchEmptyState } from "@/components/shared/branch-empty-state";
import { DataTable } from "@/components/shared/data-table";
import {
  ListMobileCard,
  PaginatedMobileList,
  ResponsiveDataTableLayout,
} from "@/components/shared/responsive-data-table";
import { HubListPage } from "@/components/shared/hub-list-page";
import { ListFilterSelect } from "@/components/shared/list-filters";
import { CreatePOModal } from "@/components/procurement/CreatePOModal";
import { PayPurchaseOrderDialog } from "@/components/procurement/PayPurchaseOrderDialog";
import {
  PurchaseOrderExpandedPanel,
  ReceivePurchaseOrderDialog,
} from "@/components/procurement/ReceivePurchaseOrderDialog";
import { getErrorMessage } from "@/lib/errors";
import { formatCurrency } from "@/lib/money";
import {
  buildProcurementOrdersUrl,
  parseProcurementOrdersSearchParams,
} from "@/lib/procurement-hub-url";
import {
  computePurchaseOrderTotal,
  matchesPOHighlightFilter,
  matchesPOSupplierFilter,
  matchesPOStatusFilter,
  summarizePurchaseOrders,
  type POHighlightFilter,
  type POStatusFilter,
} from "@/lib/filters/purchase-order-filters";
import type { PurchaseOrder, Supplier } from "@/types/api";
import { useHubListPagination } from "@/hooks/useHubListPagination";
import { infoBannerClassName, infoBannerTextClassName } from "@/lib/theme/hub-banners";
import { COL_WIDTH } from "@/lib/theme/data-table";
import { hubCtaClassName, inlineLinkClassName, tableActionAccentClassName } from "@/lib/theme/hub-primitives";
import {
  procurementMutedMetaClassName,
  procurementSectionPanelClassName,
} from "@/lib/theme/hub-procurement";
import { text } from "@/lib/theme/surface";
import { cn } from "@/lib/utils";

export default function ProcurementOrdersPageClient() {
  const { user, activeBranchId } = useAuth();
  const searchParams = useSearchParams();
  const procurementUrlKey = searchParams.toString();

  const {
    data: posData = [],
    isLoading: loadingPos,
    isError: posError,
    error: posErr,
    refetch: refetchPos,
    isFetching: posFetching,
  } = usePurchaseOrders();
  const { data: suppliersData = [], isLoading: loadingSup } = useSuppliers();
  const { data: ingredientsData = [], isLoading: loadingIng } = useIngredients();

  const suppliers = suppliersData;
  const ingredients = ingredientsData;

  const branchOrders = useMemo(() => {
    if (!activeBranchId) return [];
    return posData.filter((po: PurchaseOrder) => po.branchId === activeBranchId);
  }, [posData, activeBranchId]);

  const loading = loadingPos || loadingSup || loadingIng;

  const approveMutation = useApprovePurchaseOrder();
  const rejectMutation = useRejectPurchaseOrder();
  const receiveMutation = useReceivePurchaseOrder();
  const createMutation = useCreatePurchaseOrder();
  const submitMutation = useSubmitPurchaseOrder();
  const payMutation = usePayPurchaseOrder();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [receivePo, setReceivePo] = useState<PurchaseOrder | null>(null);
  const [payPo, setPayPo] = useState<PurchaseOrder | null>(null);
  const [expiryByIngredient, setExpiryByIngredient] = useState<Record<number, string>>({});
  const [confirmAction, setConfirmAction] = useState<
    { type: "approve" | "reject" | "submit"; po: PurchaseOrder } | null
  >(null);
  const [search, setSearch] = useState("");
  const deferredSearch = useDeferredValue(search.trim().toLowerCase());
  const [statusFilter, setStatusFilter] = useState<POStatusFilter>("ALL");
  const [highlightFilter, setHighlightFilter] = useState<POHighlightFilter>("ALL");
  const [supplierFilter, setSupplierFilter] = useState<number | null>(null);
  const [submittingPoId, setSubmittingPoId] = useState<number | null>(null);

  useEffect(() => {
    const parsed = parseProcurementOrdersSearchParams(
      new URLSearchParams(procurementUrlKey),
    );
    if (parsed.status !== "ALL") setStatusFilter(parsed.status);
    if (parsed.highlightFilter !== "ALL") setHighlightFilter(parsed.highlightFilter);
    if (parsed.supplierId != null) setSupplierFilter(parsed.supplierId);
  }, [procurementUrlKey]);

  const sortedPos = useMemo(() => {
    return [...branchOrders].sort((a, b) => {
      const aDraftAuto = a.status === "DRAFT" && a.isAutoGenerated ? 1 : 0;
      const bDraftAuto = b.status === "DRAFT" && b.isAutoGenerated ? 1 : 0;
      if (aDraftAuto !== bDraftAuto) return bDraftAuto - aDraftAuto;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  }, [branchOrders]);

  const summary = useMemo(() => summarizePurchaseOrders(branchOrders), [branchOrders]);

  const filteredPos = useMemo(() => {
    return sortedPos.filter((po) => {
      const matchesStatus = matchesPOStatusFilter(po, statusFilter);
      const matchesHighlight = matchesPOHighlightFilter(po, highlightFilter);
      const matchesSupplier = matchesPOSupplierFilter(po, supplierFilter);
      if (!deferredSearch) {
        return matchesStatus && matchesHighlight && matchesSupplier;
      }
      const haystack = [String(po.id), po.poNumber, po.status, po.supplier?.name ?? ""]
        .join(" ")
        .toLowerCase();
      return (
        matchesStatus &&
        matchesHighlight &&
        matchesSupplier &&
        haystack.includes(deferredSearch)
      );
    });
  }, [sortedPos, deferredSearch, statusFilter, highlightFilter, supplierFilter]);

  const hasActiveFilters =
    search.trim().length > 0 ||
    statusFilter !== "ALL" ||
    highlightFilter !== "ALL" ||
    supplierFilter != null;

  const canApprove = user?.role === "SUPER_ADMIN" || user?.role === "MANAGER";

  const handleApprove = async (poId: number) => {
    try {
      await approveMutation.mutateAsync(poId);
      toast.success("Purchase Order approved successfully!");
      setConfirmAction(null);
    } catch (error: unknown) {
      toast.error(getErrorMessage(error, "Failed to approve PO"));
    }
  };

  const handleReject = async (poId: number) => {
    try {
      await rejectMutation.mutateAsync(poId);
      toast.success("Purchase Order returned to draft.");
      setConfirmAction(null);
    } catch (error: unknown) {
      toast.error(getErrorMessage(error, "Failed to reject PO"));
    }
  };

  const openReceive = useCallback((po: PurchaseOrder) => {
    setReceivePo(po);
    const defaults: Record<number, string> = {};
    const defaultDate = new Date();
    defaultDate.setDate(defaultDate.getDate() + 30);
    const iso = defaultDate.toISOString().slice(0, 10);
    for (const item of po.items ?? []) {
      defaults[item.ingredientId] = iso;
    }
    setExpiryByIngredient(defaults);
  }, []);

  const handleReceive = async () => {
    if (!receivePo) return;
    try {
      const items = (receivePo.items ?? []).map((item) => ({
        ingredientId: item.ingredientId,
        expiryDate: expiryByIngredient[item.ingredientId] || undefined,
      }));
      await receiveMutation.mutateAsync({ id: receivePo.id, items });
      toast.success("Purchase Order received! Inventory updated.");
      setReceivePo(null);
    } catch (error: unknown) {
      toast.error(getErrorMessage(error, "Failed to receive PO"));
    }
  };

  const handleCreateSubmit = async (payload: {
    supplierId: number;
    items: { ingredientId: number; quantity: number; unitPrice: number }[];
  }) => {
    if (!activeBranchId) {
      toast.error("Please select a branch first");
      return;
    }
    try {
      const created = (await createMutation.mutateAsync({
        branchId: activeBranchId,
        supplierId: payload.supplierId,
        items: payload.items,
      })) as PurchaseOrder | undefined;
      setIsModalOpen(false);
      if (created?.poNumber) {
        setStatusFilter("ALL");
        setHighlightFilter("ALL");
        setSupplierFilter(null);
        setSearch(created.poNumber);
        toast.success(`Purchase Order ${created.poNumber} created`, {
          action: {
            label: "Show all",
            onClick: () => setSearch(""),
          },
        });
      } else {
        toast.success("Purchase Order created successfully");
      }
    } catch (err: unknown) {
      toast.error(getErrorMessage(err, "Failed to create PO"));
    }
  };

  const handlePay = async (method: "CASH" | "BANK_TRANSFER", notes?: string) => {
    if (!payPo) return;
    try {
      await payMutation.mutateAsync({ id: payPo.id, method, notes });
      toast.success(`Payment recorded for ${payPo.poNumber}`);
      setPayPo(null);
    } catch (error: unknown) {
      toast.error(getErrorMessage(error, "Failed to record payment"));
    }
  };

  const handleSubmit = async (poId: number) => {
    setSubmittingPoId(poId);
    try {
      await submitMutation.mutateAsync(poId);
      toast.success("Purchase order submitted for approval");
      setConfirmAction(null);
    } catch (error: unknown) {
      toast.error(getErrorMessage(error, "Failed to submit PO"));
    } finally {
      setSubmittingPoId(null);
    }
  };

  const renderPoActions = useCallback(
    (po: PurchaseOrder) => (
      <div className="flex flex-wrap justify-end gap-1">
        {po.status === "DRAFT" && (po.items?.length ?? 0) > 0 && (
          <TableActionButton
            icon={Send}
            label={`Submit ${po.poNumber}`}
            iconOnly
            loading={submittingPoId === po.id}
            onClick={() => setConfirmAction({ type: "submit", po })}
            className={tableActionAccentClassName("indigo")}
          />
        )}
        {po.status === "PENDING" && canApprove && (
          <>
            <TableActionButton
              icon={CheckSquare}
              label={`Approve ${po.poNumber}`}
              iconOnly
              onClick={() => setConfirmAction({ type: "approve", po })}
              className={tableActionAccentClassName("blue")}
            />
            <TableActionButton
              icon={XCircle}
              label={`Reject ${po.poNumber}`}
              iconOnly
              destructive
              onClick={() => setConfirmAction({ type: "reject", po })}
            />
          </>
        )}
        {po.status === "APPROVED" && (
          <TableActionButton
            icon={CheckCircle2}
            label={`Receive ${po.poNumber}`}
            iconOnly
            onClick={() => openReceive(po)}
            className={tableActionAccentClassName("emerald")}
          />
        )}
        {po.status === "RECEIVED" && po.paymentStatus === "UNPAID" && canApprove && (
          <TableActionButton
            icon={Banknote}
            label={`Pay ${po.poNumber}`}
            iconOnly
            onClick={() => setPayPo(po)}
            className={tableActionAccentClassName("emerald")}
          />
        )}
      </div>
    ),
    [canApprove, handleSubmit, openReceive, submittingPoId],
  );

  const columns = useMemo(
    () =>
      [
        {
          title: "PO #",
          key: "poNumber",
          render: (_: unknown, record: PurchaseOrder) => (
            <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
              <span className={cn("font-medium", text.primary)}>{record.poNumber}</span>
              {record.isAutoGenerated ? (
                <span className={procurementMutedMetaClassName()}>auto</span>
              ) : null}
            </div>
          ),
        },
        {
          title: "Supplier",
          key: "supplier",
          render: (_: unknown, record: PurchaseOrder) =>
            record.supplier?.name ? (
              <Link
                href={buildProcurementOrdersUrl({ supplier: record.supplierId })}
                className={inlineLinkClassName()}
              >
                {record.supplier.name}
              </Link>
            ) : (
              <span className={text.muted}>—</span>
            ),
        },
        {
          title: "Total",
          key: "total",
          align: "right" as const,
          width: COL_WIDTH.money,
          responsive: ["md"],
          render: (_: unknown, record: PurchaseOrder) => (
            <span className={cn("tabular-nums", text.primary)}>
              {formatCurrency(computePurchaseOrderTotal(record))}
            </span>
          ),
        },
        {
          title: "Status",
          key: "status",
          render: (_: unknown, record: PurchaseOrder) => (
            <div className="flex flex-wrap items-center gap-1">
              <StatusBadge tone={poStatusTone(record.status)}>
                {formatStatusLabel(record.status)}
              </StatusBadge>
              {record.status === "RECEIVED" ? (
                <StatusBadge tone={poPaymentStatusTone(record.paymentStatus)}>
                  {formatStatusLabel(record.paymentStatus)}
                </StatusBadge>
              ) : null}
            </div>
          ),
        },
        {
          title: "",
          key: "action",
          align: "right" as const,
          width: COL_WIDTH.actions,
          render: (_: unknown, po: PurchaseOrder) => renderPoActions(po),
        },
      ] as ColumnsType<PurchaseOrder>,
    [renderPoActions],
  );

  const poEmptyDescription = hasActiveFilters
    ? "No purchase orders match your filters."
    : suppliers.length === 0
      ? "No suppliers yet — add vendors before creating purchase orders."
      : "No purchase orders yet.";

  const poEmptyAction =
    !hasActiveFilters && suppliers.length > 0 ? (
      <Button className={hubCtaClassName("procurement")} onClick={() => setIsModalOpen(true)}>
        <Plus className="w-4 h-4 mr-2" aria-hidden />
        Create your first PO
      </Button>
    ) : null;

  const listPagination = useHubListPagination(
    { pageSize: 15 },
    `${filteredPos.length}-${hasActiveFilters}`,
  );

  const expandedRowRender = (record: PurchaseOrder) => (
    <PurchaseOrderExpandedPanel record={record} />
  );

  if (!activeBranchId) {
    return (
      <BranchEmptyState description="Select a branch in the top bar to view and manage purchase orders." />
    );
  }

  return (
    <>
      <div className="mb-4 flex justify-end">
        <Button className={hubCtaClassName("procurement")} onClick={() => setIsModalOpen(true)}>
          <Plus className="w-4 h-4 mr-2" aria-hidden />
          Create PO
        </Button>
      </div>

      <HubListPage className={procurementSectionPanelClassName()}>
        {summary.autoDraft > 0 && (
          <HubListPage.Banner>
            <div className={infoBannerClassName("py-3")}>
              <p className={infoBannerTextClassName()}>
                {summary.autoDraft} auto-reorder draft{summary.autoDraft > 1 ? "s" : ""} — review
                and submit for approval.
              </p>
            </div>
          </HubListPage.Banner>
        )}

        <HubListPage.Error
          message={posError ? getErrorMessage(posErr, "Failed to load purchase orders") : undefined}
          onRetry={() => void refetchPos()}
          loading={posFetching}
        />

        <HubListPage.Toolbar
          search={search}
          onSearchChange={setSearch}
          searchPlaceholder="Search PO #, supplier…"
          showReset={hasActiveFilters}
          onReset={() => {
            setSearch("");
            setStatusFilter("ALL");
            setHighlightFilter("ALL");
            setSupplierFilter(null);
          }}
          filters={
            <>
              <ListFilterSelect
                value={statusFilter}
                onValueChange={(value) => setStatusFilter(value as POStatusFilter)}
                ariaLabel="Filter by PO status"
                widthClassName="w-full sm:w-[180px]"
                options={[
                  { value: "ALL", label: "All statuses" },
                  { value: "DRAFT", label: "Draft" },
                  { value: "PENDING", label: "Pending" },
                  { value: "APPROVED", label: "Approved" },
                  { value: "RECEIVED", label: "Received" },
                ]}
              />
              <ListFilterSelect
                value={highlightFilter}
                onValueChange={(value) => setHighlightFilter(value as POHighlightFilter)}
                ariaLabel="Filter by order type"
                widthClassName="w-full sm:w-[180px]"
                options={[
                  { value: "ALL", label: "All types" },
                  { value: "auto-draft", label: "Auto drafts" },
                ]}
              />
              {suppliers.length > 0 && (
                <ListFilterSelect
                  value={supplierFilter != null ? String(supplierFilter) : "ALL"}
                  onValueChange={(value) => {
                    setSupplierFilter(value === "ALL" ? null : Number(value));
                  }}
                  ariaLabel="Filter by supplier"
                  widthClassName="w-full sm:w-[200px]"
                  options={[
                    { value: "ALL", label: "All suppliers" },
                    ...suppliers.map((supplier: Supplier) => ({
                      value: String(supplier.id),
                      label: supplier.name,
                    })),
                  ]}
                />
              )}
            </>
          }
        />

        <HubListPage.Count
          isLoading={loading}
          isError={posError}
          isFetching={posFetching}
          hasActiveFilters={hasActiveFilters}
          filteredCount={filteredPos.length}
          totalCount={summary.total}
          itemLabel="purchase order"
        />

        <ResponsiveDataTableLayout
          mobile={
            loading ? (
              <ResponsiveDataTableLayout.Skeleton />
            ) : filteredPos.length === 0 ? (
              <ResponsiveDataTableLayout.Empty message={poEmptyDescription} />
            ) : (
              <PaginatedMobileList
                items={filteredPos}
                pageSize={listPagination.pageSize}
                page={listPagination.currentPage}
                onPageChange={listPagination.setCurrentPage}
              >
                {(po) => (
                  <ListMobileCard>
                    <div className="mb-2 flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                          <p className={cn("font-medium", text.primary)}>{po.poNumber}</p>
                          {po.isAutoGenerated ? (
                            <span className={procurementMutedMetaClassName()}>auto</span>
                          ) : null}
                        </div>
                        <p className={cn("text-sm", text.secondary)}>
                          {po.supplier?.name ?? "—"}
                        </p>
                      </div>
                      <StatusBadge tone={poStatusTone(po.status)}>
                        {formatStatusLabel(po.status)}
                      </StatusBadge>
                    </div>
                    <p className={cn("mb-2 tabular-nums text-sm font-medium", text.primary)}>
                      {formatCurrency(computePurchaseOrderTotal(po))}
                    </p>
                    {(po.items?.length ?? 0) > 0 ? (
                      <p className={cn("mb-2 text-xs", text.muted)}>
                        {po.items!.length} line item{po.items!.length === 1 ? "" : "s"}
                      </p>
                    ) : null}
                    {renderPoActions(po)}
                  </ListMobileCard>
                )}
              </PaginatedMobileList>
            )
          }
          desktop={
            <DataTable
              hideBorders
              pagination={listPagination.tablePagination}
              columns={columns}
              dataSource={filteredPos}
              rowKey="id"
              loading={loading}
              emptyDescription={poEmptyDescription}
              emptyAction={poEmptyAction}
              expandable={{ expandedRowRender }}
            />
          }
        />
      </HubListPage>

      <CreatePOModal
        open={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        suppliers={suppliers}
        ingredients={ingredients}
        loadingSuppliers={loadingSup}
        loadingIngredients={loadingIng}
        onSubmit={handleCreateSubmit}
        isSubmitting={createMutation.isPending}
      />

      <PayPurchaseOrderDialog
        purchaseOrder={payPo}
        onClose={() => setPayPo(null)}
        onConfirm={handlePay}
        isSubmitting={payMutation.isPending}
      />

      <ReceivePurchaseOrderDialog
        purchaseOrder={receivePo}
        expiryByIngredient={expiryByIngredient}
        onExpiryChange={(ingredientId, value) =>
          setExpiryByIngredient((prev) => ({ ...prev, [ingredientId]: value }))
        }
        onClose={() => setReceivePo(null)}
        onConfirm={() => void handleReceive()}
        isSubmitting={receiveMutation.isPending}
      />

      <ConfirmDialog
        open={confirmAction !== null}
        onOpenChange={(open) => !open && setConfirmAction(null)}
        title={
          confirmAction?.type === "approve"
            ? "Approve PO?"
            : confirmAction?.type === "submit"
              ? `Submit ${confirmAction.po.poNumber} for approval?`
              : "Reject PO?"
        }
        description={
          confirmAction?.type === "reject"
            ? "Returns to draft for editing."
            : confirmAction?.type === "submit"
              ? "The order will be locked for editing until a manager approves or rejects it."
              : "Allows receiving into inventory."
        }
        confirmLabel={
          confirmAction?.type === "approve"
            ? "Approve"
            : confirmAction?.type === "submit"
              ? "Submit"
              : "Reject"
        }
        destructive={confirmAction?.type === "reject"}
        loading={
          approveMutation.isPending || rejectMutation.isPending || submitMutation.isPending
        }
        onConfirm={async () => {
          if (!confirmAction) return;
          if (confirmAction.type === "approve") {
            await handleApprove(confirmAction.po.id);
          } else if (confirmAction.type === "submit") {
            await handleSubmit(confirmAction.po.id);
          } else {
            await handleReject(confirmAction.po.id);
          }
        }}
      />
    </>
  );
}
