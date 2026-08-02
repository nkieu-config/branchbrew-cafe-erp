"use client";

import { useMemo, useState, useDeferredValue } from "react";
import Link from "next/link";
import { useProductionBOMs } from "@/hooks/domains/useAccountingQueries";
import { useIngredients } from "@/hooks/domains/useProductQueries";
import { Plus } from "lucide-react";
import { HubListPage } from "@/components/shared/hub-list-page";
import { BOMFormModal } from "@/components/kitchen/BOMFormModal";
import { BomListEmptyState } from "@/components/kitchen/BomListEmptyState";
import { CentralKitchenBanner } from "@/components/kitchen/CentralKitchenBanner";
import { ProductionBomTable } from "@/components/kitchen/ProductionBomTable";
import { Button } from "@/components/ui/button";
import { getErrorMessage } from "@/lib/errors";
import { groupProductionBoms } from "@/lib/bom";
import { buildProductsIngredientsUrl } from "@/lib/products-hub-url";
import { matchesBomSearch, summarizeProductionBoms } from "@/lib/filters/bom-filters";
import type { BomGroupRow, ProductionBOM } from "@/types/api";
import { hubCtaClassName, inlineLinkClassName } from "@/lib/theme/hub-primitives";
import { kitchenSectionPanelClassName } from "@/lib/theme/hub-kitchen";
import { text } from "@/lib/theme/surface";
import { cn } from "@/lib/utils";

export default function BomsPageClient() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [search, setSearch] = useState("");
  const deferredSearch = useDeferredValue(search.trim().toLowerCase());

  const {
    data: bomsData = [],
    isLoading: loadingBoms,
    isError: bomsError,
    error: bomsErr,
    refetch: refetchBoms,
    isFetching: bomsFetching,
  } = useProductionBOMs();
  const { data: ingredients = [], isLoading: loadingIng } = useIngredients();

  const loading = loadingBoms || loadingIng;

  const bomsGrouped = useMemo(
    () => groupProductionBoms(bomsData as ProductionBOM[]),
    [bomsData],
  );

  const filteredGroups = useMemo(
    () => bomsGrouped.filter((group) => matchesBomSearch(group, deferredSearch)),
    [bomsGrouped, deferredSearch],
  );

  const summary = useMemo(() => summarizeProductionBoms(bomsGrouped), [bomsGrouped]);

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button className={hubCtaClassName("kitchen")} onClick={() => setIsModalOpen(true)}>
          <Plus className="w-4 h-4 mr-2" aria-hidden />
          Create BOM
        </Button>
      </div>

      <CentralKitchenBanner message="BOMs are managed at the central kitchen branch." />

      <HubListPage className={kitchenSectionPanelClassName()}>
        <HubListPage.Error
          message={bomsError ? getErrorMessage(bomsErr, "Failed to load production BOMs") : undefined}
          onRetry={() => void refetchBoms()}
          loading={bomsFetching}
        />

        <HubListPage.Toolbar
          search={search}
          onSearchChange={setSearch}
          searchPlaceholder="Search target or ingredient…"
          showReset={search.trim().length > 0}
          onReset={() => setSearch("")}
        />

        {summary.missingCostLines > 0 && (
          <HubListPage.Banner>
            <p className={cn("text-sm", text.muted)}>
              <Link
                href={buildProductsIngredientsUrl({ cost: "missing-cost" })}
                className={inlineLinkClassName()}
              >
                {summary.missingCostLines} ingredient{summary.missingCostLines === 1 ? "" : "s"}{" "}
                missing cost
              </Link>
            </p>
          </HubListPage.Banner>
        )}

        <HubListPage.Count
          isLoading={loading}
          isError={bomsError}
          isFetching={bomsFetching}
          hasActiveFilters={search.trim().length > 0}
          filteredCount={filteredGroups.length}
          totalCount={summary.targets}
          itemLabel="BOM"
        />

        {!loading && !bomsError && filteredGroups.length === 0 ? (
          <BomListEmptyState
            hasSearch={search.trim().length > 0}
            onCreate={() => setIsModalOpen(true)}
          />
        ) : (
          <ProductionBomTable groups={filteredGroups as BomGroupRow[]} loading={loading} />
        )}
      </HubListPage>

      <BOMFormModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        ingredients={ingredients}
        loadingIngredients={loadingIng}
      />
    </div>
  );
}
