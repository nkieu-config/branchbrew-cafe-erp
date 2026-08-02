"use client";

import { useMemo, useState, useDeferredValue } from "react";
import { MapPin, Pencil, Plus } from "lucide-react";
import { toast } from "sonner";
import { useBranches, useCreateBranch, useUpdateBranch } from "@/hooks/domains/useGeneralQueries";
import { HubListPage } from "@/components/shared/hub-list-page";
import { ListFilterSelect } from "@/components/shared/list-filters";
import { TableActionButton } from "@/components/shared/table-action-button";
import {
  BranchFormModal,
  type BranchFormValues,
} from "@/components/organization/BranchFormModal";
import { Button } from "@/components/ui/button";
import {
  type BranchTypeFilter,
  branchTypeLabel,
  filterBranches,
  summarizeBranches,
} from "@/lib/filters/branch-filters";
import { getErrorMessage } from "@/lib/errors";
import type { Branch } from "@/types/api";
import { infoBannerClassName, infoBannerTextClassName } from "@/lib/theme/hub-banners";
import { branchCardClassName, emptyStatePanelClassName, hubCtaClassName } from "@/lib/theme/hub-primitives";
import {
  organizationMutedMetaClassName,
  organizationSectionPanelClassName,
} from "@/lib/theme/organization";
import { text } from "@/lib/theme/surface";
import { typeHeadingClassName } from "@/lib/theme/typography";
import { cn } from "@/lib/utils";
import { QueryLoadingPanel } from "@/components/shared/query-states";

export default function BranchesPageClient({ embedded = false }: { embedded?: boolean }) {
  const {
    data: branches,
    isLoading,
    isError,
    error,
    refetch,
    isFetching,
  } = useBranches();
  const createMutation = useCreateBranch();
  const updateMutation = useUpdateBranch();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingBranch, setEditingBranch] = useState<Branch | null>(null);
  const [search, setSearch] = useState("");
  const deferredSearch = useDeferredValue(search.trim().toLowerCase());
  const [typeFilter, setTypeFilter] = useState<BranchTypeFilter>("ALL");

  const branchList = (branches as Branch[] | undefined) ?? [];
  const summary = useMemo(() => summarizeBranches(branchList), [branchList]);

  const filteredBranches = useMemo(
    () =>
      filterBranches(branchList, {
        typeFilter,
        search: deferredSearch,
      }),
    [branchList, typeFilter, deferredSearch],
  );

  const hasActiveFilters = search.trim().length > 0 || typeFilter !== "ALL";

  const resetFilters = () => {
    setSearch("");
    setTypeFilter("ALL");
  };

  const handleEdit = (branch: Branch) => {
    setEditingBranch(branch);
    setIsModalOpen(true);
  };

  const handleAddNew = () => {
    setEditingBranch(null);
    setIsModalOpen(true);
  };

  const handleSave = async (payload: BranchFormValues) => {
    try {
      if (editingBranch) {
        await updateMutation.mutateAsync({ id: editingBranch.id, ...payload });
        toast.success("Branch updated");
      } else {
        await createMutation.mutateAsync(payload);
        toast.success("Branch created");
      }
      setIsModalOpen(false);
      setEditingBranch(null);
    } catch (err: unknown) {
      toast.error(getErrorMessage(err, "Failed to save branch"));
      throw err;
    }
  };

  const content = (
    <div className="space-y-4 w-full max-w-5xl mx-auto">
      <div className="flex justify-end">
        <Button
          className={hubCtaClassName("organization", "min-h-[44px]")}
          onClick={handleAddNew}
        >
          <Plus className="w-4 h-4 mr-2" aria-hidden />
          Add branch
        </Button>
      </div>

      <HubListPage className={organizationSectionPanelClassName()}>
        {!isLoading && !isError && summary.total === 0 && (
          <HubListPage.Banner>
            <div className={infoBannerClassName("py-3")}>
              <p className={infoBannerTextClassName()}>
                No branches yet — create your first location to assign staff and inventory.
              </p>
            </div>
          </HubListPage.Banner>
        )}

        <HubListPage.Error
          message={isError ? getErrorMessage(error, "Failed to load branches.") : undefined}
          onRetry={() => void refetch()}
          loading={isFetching}
        />

        <HubListPage.Toolbar
          search={search}
          onSearchChange={setSearch}
          searchPlaceholder="Search name or location…"
          showReset={hasActiveFilters}
          onReset={resetFilters}
          filters={
            <ListFilterSelect
              value={typeFilter}
              onValueChange={(value) => setTypeFilter(value as BranchTypeFilter)}
              ariaLabel="Filter by branch type"
              widthClassName="w-full sm:w-[180px]"
              options={[
                { value: "ALL", label: "All types" },
                { value: "central", label: "Central kitchen" },
                { value: "franchise", label: "Franchise" },
              ]}
            />
          }
        />

        <HubListPage.Count
          isLoading={isLoading}
          isError={isError}
          isFetching={isFetching}
          hasActiveFilters={hasActiveFilters}
          filteredCount={filteredBranches.length}
          totalCount={branchList.length}
          itemLabel="branch"
        />

        <HubListPage.Body>
        {isLoading ? (
          <QueryLoadingPanel message="Loading branches" minHeightClassName="h-48" />
        ) : filteredBranches.length === 0 ? (
          <div className={emptyStatePanelClassName()}>
            <p className={typeHeadingClassName("text-base")}>
              {hasActiveFilters ? "No branches match your filters" : "No branches yet"}
            </p>
            <p className={cn("text-sm mt-1", text.muted)}>
              {hasActiveFilters
                ? "Try clearing search or type filters."
                : "Add a franchise location or central kitchen to get started."}
            </p>
            {!hasActiveFilters && (
              <Button
                className={hubCtaClassName("organization", "mt-4 min-h-[44px]")}
                onClick={handleAddNew}
              >
                <Plus className="w-4 h-4 mr-2" aria-hidden />
                Add branch
              </Button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
            {filteredBranches.map((branch) => (
              <article
                key={branch.id}
                className={branchCardClassName("organization", "p-4")}
              >
                <div className="flex justify-between items-start gap-2">
                  <div className="min-w-0 flex-1">
                    <h3 className={typeHeadingClassName("text-base truncate")}>
                      {branch.name}
                    </h3>
                    <p className={organizationMutedMetaClassName("mt-0.5")}>
                      {branchTypeLabel(branch.isCentralKitchen)}
                    </p>
                    <p className={cn("text-sm flex items-center gap-1 mt-2", text.muted)}>
                      <MapPin className="w-3.5 h-3.5 shrink-0" aria-hidden />
                      <span className="truncate">
                        {branch.location?.trim() || "No location"}
                      </span>
                    </p>
                  </div>
                  <TableActionButton
                    label="Edit"
                    icon={Pencil}
                    tone="blue"
                    onClick={() => handleEdit(branch)}
                  />
                </div>
              </article>
            ))}
          </div>
        )}
        </HubListPage.Body>
      </HubListPage>

      <BranchFormModal
        open={isModalOpen}
        onOpenChange={(next) => {
          setIsModalOpen(next);
          if (next) return;
          setEditingBranch(null);
        }}
        initialValues={editingBranch}
        onSave={handleSave}
        isSubmitting={createMutation.isPending || updateMutation.isPending}
      />
    </div>
  );

  if (embedded) return content;

  return <div className="mx-auto w-full max-w-5xl space-y-4">{content}</div>;
}
