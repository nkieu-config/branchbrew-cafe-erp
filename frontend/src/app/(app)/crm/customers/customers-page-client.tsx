"use client";

import { useEffect, useMemo, useState, useDeferredValue } from "react";
import { useCustomers } from "@/hooks/domains/useCrmQueries";
import { Customer360Sheet } from "@/components/crm/Customer360Sheet";
import { CustomerListTable } from "@/components/crm/CustomerListTable";
import { RegisterCustomerDialog } from "@/components/crm/RegisterCustomerDialog";
import { HubListPage } from "@/components/shared/hub-list-page";
import { ListFilterSelect } from "@/components/shared/list-filters";
import { getErrorMessage } from "@/lib/errors";
import type { Tier } from "@/types/api";
import { crmSectionPanelClassName } from "@/lib/theme/hub-crm";
import { useListUrlState } from "@/hooks/useListUrlState";
import { CUSTOMER_PAGE_SIZE_DEFAULT } from "@/lib/filters/customer-filters";

type TierFilter = "ALL" | Tier;

export default function CustomersPageClient() {
  const { values, setValue, reset, isDefault } = useListUrlState({
    q: "",
    tier: "ALL",
    page: "1",
    size: String(CUSTOMER_PAGE_SIZE_DEFAULT),
  });
  const search = values.q;
  const setSearch = (next: string) => setValue("q", next);
  const deferredSearch = useDeferredValue(search.trim());
  const tierFilter = values.tier as TierFilter;
  const page = Math.max(1, Number(values.page) || 1);
  const pageSize = Number(values.size) || CUSTOMER_PAGE_SIZE_DEFAULT;
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedCustomerId, setSelectedCustomerId] = useState<number | null>(null);

  const listWindow = useMemo(
    () => ({
      limit: pageSize,
      offset: (page - 1) * pageSize,
      ...(deferredSearch ? { search: deferredSearch } : {}),
      ...(tierFilter !== "ALL" ? { tier: tierFilter } : {}),
    }),
    [page, pageSize, deferredSearch, tierFilter],
  );

  const {
    data: customerPage,
    isLoading: loading,
    isError,
    error,
    refetch,
    isFetching,
    dataUpdatedAt,
  } = useCustomers(listWindow);
  const customers = useMemo(() => customerPage?.items ?? [], [customerPage]);
  const totalCustomers = customerPage?.total ?? 0;

  useEffect(() => {
    setValue("page", "1");
  }, [deferredSearch, tierFilter, pageSize, setValue]);

  const handlePageChange = (nextPage: number, nextPageSize: number) => {
    if (nextPageSize !== pageSize) {
      setValue("size", String(nextPageSize));
      setValue("page", "1");
      return;
    }
    setValue("page", String(nextPage));
  };

  const hasActiveFilters = !isDefault;

  const openCustomerProfile = (id: number) => {
    setSelectedCustomerId(id);
    setDrawerOpen(true);
  };

  return (
    <>
      <div className="mb-4 flex justify-end">
        <RegisterCustomerDialog />
      </div>

      <HubListPage className={crmSectionPanelClassName()}>
        <HubListPage.Error
          message={isError ? getErrorMessage(error, "Failed to load customers") : undefined}
          onRetry={() => void refetch()}
          loading={isFetching}
        />

        <HubListPage.Toolbar
          search={search}
          onSearchChange={setSearch}
          searchPlaceholder="Search name or phone…"
          showReset={hasActiveFilters}
          onReset={reset}
          freshness={{ dataUpdatedAt, isFetching, onRefresh: () => void refetch() }}
          filters={
            <ListFilterSelect
              value={tierFilter}
              onValueChange={(value) => setValue("tier", value)}
              ariaLabel="Filter by tier"
              widthClassName="w-full sm:w-[180px]"
              options={[
                { value: "ALL", label: "All tiers" },
                { value: "PLATINUM", label: "Platinum" },
                { value: "GOLD", label: "Gold" },
                { value: "SILVER", label: "Silver" },
                { value: "REGULAR", label: "Regular" },
              ]}
            />
          }
        />

        <HubListPage.Count
          isLoading={loading}
          isError={isError}
          isFetching={isFetching}
          hasActiveFilters={hasActiveFilters}
          filteredCount={totalCustomers}
          totalCount={totalCustomers}
          itemLabel="member"
          emptyLabel="No members yet"
        />

        <CustomerListTable
          customers={customers}
          loading={loading}
          isError={isError}
          hasActiveFilters={hasActiveFilters}
          serverPagination={{
            page,
            pageSize,
            total: totalCustomers,
            onChange: handlePageChange,
          }}
          onSelectCustomer={openCustomerProfile}
        />
      </HubListPage>

      <Customer360Sheet
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        customerId={selectedCustomerId}
      />
    </>
  );
}
