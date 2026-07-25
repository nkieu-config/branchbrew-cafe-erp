"use client";

import { useCallback, useEffect, useMemo, useState, useDeferredValue } from "react";
import { useSearchParams } from "next/navigation";
import { useFoodCostActual } from "@/hooks/domains/useReportsQueries";
import { useProductsSummaryQueries } from "@/hooks/domains/useProductsSummaryQueries";
import { FoodCostMarginPanel } from "@/components/products/FoodCostMarginPanel";
import { FoodCostTable } from "@/components/products/FoodCostTable";
import { ProductFormModal } from "@/components/products/ProductFormModal";
import { HubListPage } from "@/components/shared/hub-list-page";
import { ListFilterSelect } from "@/components/shared/list-filters";
import { getErrorMessage } from "@/lib/errors";
import { formatHubListCountWithFetching } from "@/lib/format-hub-list-count";
import {
  extractProductCategories,
} from "@/lib/filters/menu-product-filters";
import {
  filterFoodCostProducts,
  hasFoodCostFilters,
  type FoodCostActiveFilter,
  type FoodCostStatusFilter,
} from "@/lib/filters/food-cost-filters";
import { parseProductsCostingSearchParams } from "@/lib/products-hub-url";
import { productsSectionPanelClassName } from "@/lib/theme/hub-products";
import type { Product } from "@/types/api";

export default function CostingPageClient() {
  const searchParams = useSearchParams();
  const {
    products,
    summary,
    isLoading,
    isError,
    error,
    refetch,
    isFetching,
  } = useProductsSummaryQueries();
  const { data: foodCostActual, isLoading: foodCostLoading } = useFoodCostActual();

  const [search, setSearch] = useState("");
  const deferredSearch = useDeferredValue(search.trim().toLowerCase());
  const [categoryFilter, setCategoryFilter] = useState<string>("ALL");
  const [statusFilter, setStatusFilter] = useState<FoodCostStatusFilter>("ALL");
  const [activeFilter, setActiveFilter] = useState<FoodCostActiveFilter>("ALL");

  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const costingStatusParam = searchParams.get("status");
  const costingCategoryParam = searchParams.get("category");

  useEffect(() => {
    const params = new URLSearchParams();
    if (costingStatusParam) params.set("status", costingStatusParam);
    if (costingCategoryParam) params.set("category", costingCategoryParam);
    const parsed = parseProductsCostingSearchParams(params);
    if (parsed.status !== "ALL") setStatusFilter(parsed.status);
    if (parsed.category !== "ALL") setCategoryFilter(parsed.category);
  }, [costingStatusParam, costingCategoryParam]);

  const categories = useMemo(() => extractProductCategories(products), [products]);

  const filteredProducts = useMemo(
    () =>
      filterFoodCostProducts(products, {
        search: deferredSearch,
        categoryFilter,
        statusFilter,
        activeFilter,
      }),
    [products, deferredSearch, categoryFilter, statusFilter, activeFilter],
  );

  const hasActiveFilters = hasFoodCostFilters({
    search,
    categoryFilter,
    statusFilter,
    activeFilter,
  });

  const handleEdit = useCallback((product: Product) => {
    setSelectedProduct(product);
    setIsModalOpen(true);
  }, []);

  return (
    <>
      <HubListPage className={productsSectionPanelClassName()}>
        <HubListPage.Error
          message={
            isError ? getErrorMessage(error, "Failed to load menu items for food cost") : undefined
          }
          onRetry={() => void refetch()}
          loading={isFetching}
        />

        {!isLoading && !isError && (
          <HubListPage.Banner>
            <FoodCostMarginPanel
              actual={foodCostActual}
              theoreticalAvgPercent={summary.foodCost.avgPercent}
              isLoading={foodCostLoading}
            />
          </HubListPage.Banner>
        )}

        <HubListPage.Toolbar
          search={search}
          onSearchChange={setSearch}
          searchPlaceholder="Search menu items…"
          showReset={hasActiveFilters}
          onReset={() => {
            setSearch("");
            setCategoryFilter("ALL");
            setStatusFilter("ALL");
            setActiveFilter("ALL");
          }}
          filters={
            <>
              <ListFilterSelect
                value={categoryFilter}
                onValueChange={setCategoryFilter}
                ariaLabel="Filter by category"
                widthClassName="w-full sm:w-[180px]"
                options={[
                  { value: "ALL", label: "All categories" },
                  ...categories.map((cat) => ({ value: cat, label: cat })),
                ]}
              />
              <ListFilterSelect
                value={statusFilter}
                onValueChange={(value) => setStatusFilter(value as FoodCostStatusFilter)}
                ariaLabel="Filter by food cost status"
                widthClassName="w-full sm:w-[200px]"
                options={[
                  { value: "ALL", label: "All food cost levels" },
                  { value: "good", label: "On target (≤30%)" },
                  { value: "warn", label: "Watch (31–40%)" },
                  { value: "bad", label: "High cost (>40%)" },
                  { value: "no-recipe", label: "No recipe" },
                  { value: "missing-cost", label: "Missing ingredient cost" },
                ]}
              />
              <ListFilterSelect
                value={activeFilter}
                onValueChange={(value) => setActiveFilter(value as FoodCostActiveFilter)}
                ariaLabel="Filter by menu status"
                widthClassName="w-full sm:w-[160px]"
                options={[
                  { value: "ALL", label: "All statuses" },
                  { value: "active", label: "Active only" },
                  { value: "inactive", label: "Inactive only" },
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
          itemLabel="menu item"
          emptyLabel="No menu items yet"
        >
          {!hasActiveFilters && summary.total > 0 && summary.foodCost.avgPercent > 0
            ? formatHubListCountWithFetching(
                `${summary.total} menu item${summary.total === 1 ? "" : "s"} · avg ${summary.foodCost.avgPercent.toFixed(1)}% food cost`,
                isFetching,
                isLoading,
              )
            : undefined}
        </HubListPage.Count>

        <FoodCostTable
          products={filteredProducts}
          isLoading={isLoading}
          hasActiveFilters={hasActiveFilters}
          onEdit={handleEdit}
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
    </>
  );
}
