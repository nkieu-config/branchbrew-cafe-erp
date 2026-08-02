"use client";

import { useCallback, useMemo, useState, useDeferredValue } from "react";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { useDeleteProduct } from "@/hooks/domains/useProductQueries";
import { useProductsSummaryQueries } from "@/hooks/domains/useProductsSummaryQueries";
import { Button } from "@/components/ui/button";
import { ProductFormModal } from "@/components/products/ProductFormModal";
import { MenuProductListTable } from "@/components/products/MenuProductListTable";
import { usePageChromeExtension } from "@/components/layout/PageChrome";
import { HubListPage } from "@/components/shared/hub-list-page";
import { ListFilterSelect } from "@/components/shared/list-filters";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { getErrorMessage } from "@/lib/errors";
import {
  extractProductCategories,
  filterMenuProducts,
  type MenuStatusFilter,
} from "@/lib/filters/menu-product-filters";
import { hubCtaClassName } from "@/lib/theme/hub-primitives";
import { productsSectionPanelClassName } from "@/lib/theme/hub-products";
import type { Product } from "@/types/api";
import { useListUrlState } from "@/hooks/useListUrlState";

export default function ProductsPageClient() {
  const {
    products,
    summary,
    isLoading,
    isError,
    error,
    refetch,
    isFetching,
  } = useProductsSummaryQueries();
  const deleteMutation = useDeleteProduct();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Product | null>(null);
  const { values, setValue, reset, isDefault } = useListUrlState({
    q: "",
    category: "ALL",
    status: "ALL",
  });
  const search = values.q;
  const setSearch = (next: string) => setValue("q", next);
  const deferredSearch = useDeferredValue(search.trim().toLowerCase());
  const categoryFilter = values.category;
  const statusFilter = values.status as MenuStatusFilter;

  const categories = useMemo(() => extractProductCategories(products), [products]);

  const filteredProducts = useMemo(
    () =>
      filterMenuProducts(products, {
        search: deferredSearch,
        categoryFilter,
        statusFilter,
      }),
    [products, deferredSearch, categoryFilter, statusFilter],
  );

  const hasActiveFilters = !isDefault;

  const handleEdit = useCallback((product: Product) => {
    setSelectedProduct(product);
    setIsModalOpen(true);
  }, []);

  const handleAddNew = useCallback(() => {
    setSelectedProduct(null);
    setIsModalOpen(true);
  }, []);

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteMutation.mutateAsync(deleteTarget.id);
      toast.success("Menu item deleted");
      setDeleteTarget(null);
    } catch (err: unknown) {
      toast.error(getErrorMessage(err, "Failed to delete menu item"));
    }
  };

  usePageChromeExtension(
    useMemo(
      () => ({
        actions: (
          <Button onClick={handleAddNew} className={hubCtaClassName("products")}>
            <Plus className="w-4 h-4 mr-2" aria-hidden />
            Add item
          </Button>
        ),
      }),
      [handleAddNew],
    ),
  );

  return (
    <>
      <HubListPage className={productsSectionPanelClassName()}>
        <HubListPage.Error
          message={isError ? getErrorMessage(error, "Failed to load menu items") : undefined}
          onRetry={() => void refetch()}
          loading={isFetching}
        />

        <HubListPage.Toolbar
          search={search}
          onSearchChange={setSearch}
          searchPlaceholder="Search menu items…"
          showReset={hasActiveFilters}
          onReset={reset}
          filters={
            <>
              <ListFilterSelect
                value={categoryFilter}
                onValueChange={(value) => setValue("category", value)}
                ariaLabel="Filter by category"
                widthClassName="w-full sm:w-[200px]"
                options={[
                  { value: "ALL", label: "All categories" },
                  ...categories.map((cat) => ({ value: cat, label: cat })),
                ]}
              />
              <ListFilterSelect
                value={statusFilter}
                onValueChange={(value) => setValue("status", value)}
                ariaLabel="Filter by status"
                widthClassName="w-full sm:w-[180px]"
                options={[
                  { value: "ALL", label: "All statuses" },
                  { value: "active", label: "Active" },
                  { value: "inactive", label: "Inactive" },
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
          filteredCount={filteredProducts.length}
          totalCount={summary.total}
          itemLabel="item"
          emptyLabel="No menu items yet"
        />

        <MenuProductListTable
          products={filteredProducts}
          isLoading={isLoading}
          hasActiveFilters={hasActiveFilters}
          onEdit={handleEdit}
          onDelete={setDeleteTarget}
        />
      </HubListPage>

      <ProductFormModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setSelectedProduct(null);
        }}
        product={selectedProduct ?? undefined}
      />

      <ConfirmDialog
        open={deleteTarget != null}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title="Delete menu item?"
        description={
          deleteTarget
            ? `Remove "${deleteTarget.name}"? This cannot be undone.`
            : undefined
        }
        confirmLabel="Delete"
        destructive
        loading={deleteMutation.isPending}
        onConfirm={handleDelete}
      />
    </>
  );
}
