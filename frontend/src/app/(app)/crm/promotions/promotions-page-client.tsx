"use client";

import { useMemo, useState, useDeferredValue } from "react";
import { Plus } from "lucide-react";
import { usePromotions } from "@/hooks/domains/useCrmQueries";
import { DeletePromotionDialog } from "@/components/crm/DeletePromotionDialog";
import { PromotionFormDialog } from "@/components/crm/PromotionFormDialog";
import { PromotionListTable } from "@/components/crm/PromotionListTable";
import { HubListPage } from "@/components/shared/hub-list-page";
import { ListFilterSelect } from "@/components/shared/list-filters";
import { getErrorMessage } from "@/lib/errors";
import {
  getPromoValidity,
  type PromoDiscountFilter,
  type PromoStatusFilter,
} from "@/lib/promotion-status";
import type { Promotion } from "@/types/api";
import { Button } from "@/components/ui/button";
import { crmSectionPanelClassName } from "@/lib/theme/hub-crm";
import { hubCtaClassName } from "@/lib/theme/hub-primitives";
import { useListUrlState } from "@/hooks/useListUrlState";

export default function PromotionsPageClient() {
  const {
    data: promotionsData,
    isLoading: loading,
    isError,
    error,
    refetch,
    isFetching,
  } = usePromotions();
  const promotions = promotionsData || [];

  const { values, setValue, reset, isDefault } = useListUrlState({
    q: "",
    status: "ALL",
    discount: "ALL",
  });
  const search = values.q;
  const setSearch = (next: string) => setValue("q", next);
  const deferredSearch = useDeferredValue(search.trim().toLowerCase());
  const statusFilter = values.status as PromoStatusFilter;
  const discountFilter = values.discount as PromoDiscountFilter;

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Promotion | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Promotion | null>(null);

  const summary = useMemo(() => {
    const counts = { active: 0, inactive: 0, expired: 0, scheduled: 0 };
    for (const p of promotions) {
      counts[getPromoValidity(p)] += 1;
    }
    return { total: promotions.length, ...counts };
  }, [promotions]);

  const filteredPromotions = useMemo(() => {
    return promotions.filter((p: Promotion) => {
      const haystack = [p.code, p.description].join(" ").toLowerCase();
      const matchesSearch = !deferredSearch || haystack.includes(deferredSearch);
      const validity = getPromoValidity(p);
      const matchesStatus = statusFilter === "ALL" || validity === statusFilter;
      const matchesDiscount = discountFilter === "ALL" || p.discountType === discountFilter;
      return matchesSearch && matchesStatus && matchesDiscount;
    });
  }, [promotions, deferredSearch, statusFilter, discountFilter]);

  const hasActiveFilters = !isDefault;

  const openCreate = () => {
    setEditing(null);
    setDialogOpen(true);
  };

  const openEdit = (promotion: Promotion) => {
    setEditing(promotion);
    setDialogOpen(true);
  };

  return (
    <>
      <div className="mb-4 flex justify-end">
        <Button className={hubCtaClassName("crm")} onClick={openCreate}>
          <Plus className="w-4 h-4 mr-2" aria-hidden />
          New promo
        </Button>
      </div>

      <HubListPage className={crmSectionPanelClassName()}>
        <HubListPage.Error
          message={isError ? getErrorMessage(error, "Failed to load promotions") : undefined}
          onRetry={() => void refetch()}
          loading={isFetching}
        />

        <HubListPage.Toolbar
          search={search}
          onSearchChange={setSearch}
          searchPlaceholder="Search code or description…"
          showReset={hasActiveFilters}
          onReset={reset}
          filters={
            <>
              <ListFilterSelect
                value={statusFilter}
                onValueChange={(value) => setValue("status", value)}
                ariaLabel="Filter by status"
                widthClassName="w-full sm:w-[180px]"
                options={[
                  { value: "ALL", label: "All statuses" },
                  { value: "active", label: "Active" },
                  { value: "inactive", label: "Inactive" },
                  { value: "expired", label: "Expired" },
                  { value: "scheduled", label: "Scheduled" },
                ]}
              />
              <ListFilterSelect
                value={discountFilter}
                onValueChange={(value) => setValue("discount", value)}
                ariaLabel="Filter by discount type"
                widthClassName="w-full sm:w-[180px]"
                options={[
                  { value: "ALL", label: "All types" },
                  { value: "PERCENTAGE", label: "Percentage" },
                  { value: "FIXED_AMOUNT", label: "Fixed amount" },
                ]}
              />
            </>
          }
        />

        <HubListPage.Count
          isLoading={loading}
          isError={isError}
          isFetching={isFetching}
          hasActiveFilters={hasActiveFilters}
          filteredCount={filteredPromotions.length}
          totalCount={summary.total}
          itemLabel="promo"
          itemLabelPlural="promos"
          emptyLabel="No promos yet"
        />

        <PromotionListTable
          promotions={filteredPromotions}
          loading={loading}
          isError={isError}
          hasActiveFilters={hasActiveFilters}
          onEdit={openEdit}
          onDelete={setDeleteTarget}
        />
      </HubListPage>

      <PromotionFormDialog
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) setEditing(null);
        }}
        promotion={editing}
      />

      <DeletePromotionDialog
        promotion={deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
      />
    </>
  );
}
