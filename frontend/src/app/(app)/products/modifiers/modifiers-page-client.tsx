"use client";

import { useCallback, useMemo, useState, useDeferredValue } from "react";
import type { ColumnsType } from "antd/es/table";
import {
  Plus,
  Pencil,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { DataTable } from "@/components/shared/data-table";
import {
  ListMobileCard,
  PaginatedMobileList,
} from "@/components/shared/responsive-data-table";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { HubListPage } from "@/components/shared/hub-list-page";
import { QueryLoadingPanel } from "@/components/shared/query-states";
import { ListFilterSelect } from "@/components/shared/list-filters";
import { TableActionButton } from "@/components/shared/table-action-button";
import { Button } from "@/components/ui/button";
import {
  MODIFIER_ALL_CATEGORIES,
  ModifierGroupFormDialog,
} from "@/components/products/ModifierGroupFormDialog";
import { ModifierOptionFormDialog } from "@/components/products/ModifierOptionFormDialog";
import {
  useModifiers,
  useCreateModifierGroup,
  useUpdateModifierGroup,
  useDeleteModifierGroup,
  useCreateModifierOption,
  useUpdateModifierOption,
  useDeleteModifierOption,
} from "@/hooks/domains/useModifierQueries";
import { useProducts } from "@/hooks/domains/useProductQueries";
import type { ModifierGroup, ModifierOption, Product } from "@/types/api";
import { getErrorMessage } from "@/lib/errors";
import { formatHubListCountWithFetching } from "@/lib/format-hub-list-count";
import { formatCurrency, toNumber } from "@/lib/money";
import {
  buildModifierCategoryOptions,
  countModifierOptions,
  matchesModifierCategoryFilter,
  matchesModifierHighlightFilter,
  matchesModifierSearch,
  modifierGroupHasSwap,
  modifierGroupIsEmpty,
  type ModifierCategoryFilter,
  type ModifierHighlightFilter,
} from "@/lib/filters/modifier-filters";
import { hubListDataTableProps } from "@/lib/theme/data-table";
import { hubCtaClassName } from "@/lib/theme/hub-primitives";
import { modifierGroupPanelClassName } from "@/lib/theme/hub-products";
import { productsSectionPanelClassName } from "@/lib/theme/hub-products";
import { text } from "@/lib/theme/surface";
import { cn } from "@/lib/utils";
import { useListUrlState } from "@/hooks/useListUrlState";

export default function ModifiersPageClient() {
  const {
    data: groups = [],
    isLoading,
    isError,
    error,
    refetch,
    isFetching,
  } = useModifiers();
  const { data: products = [] } = useProducts();
  const createGroup = useCreateModifierGroup();
  const updateGroup = useUpdateModifierGroup();
  const deleteGroup = useDeleteModifierGroup();
  const createOption = useCreateModifierOption();
  const updateOption = useUpdateModifierOption();
  const deleteOption = useDeleteModifierOption();

  const { values, setValue, reset, isDefault } = useListUrlState({
    q: "",
    category: "ALL",
    highlight: "ALL",
  });
  const search = values.q;
  const setSearch = (next: string) => setValue("q", next);
  const deferredSearch = useDeferredValue(search.trim().toLowerCase());
  const categoryFilter = values.category as ModifierCategoryFilter;
  const highlightFilter = values.highlight as ModifierHighlightFilter;

  const [groupDialogOpen, setGroupDialogOpen] = useState(false);
  const [optionDialogOpen, setOptionDialogOpen] = useState(false);
  const [editingGroup, setEditingGroup] = useState<ModifierGroup | null>(null);
  const [editingOption, setEditingOption] = useState<ModifierOption | null>(null);
  const [optionGroupId, setOptionGroupId] = useState<number | null>(null);

  const [groupName, setGroupName] = useState("");
  const [groupCategory, setGroupCategory] = useState("Coffee");
  const [groupSortOrder, setGroupSortOrder] = useState("0");
  const [groupSwapIngredientId, setGroupSwapIngredientId] = useState<number | "">("");

  const [optionName, setOptionName] = useState("");
  const [optionPriceDelta, setOptionPriceDelta] = useState("0");
  const [optionSortOrder, setOptionSortOrder] = useState("0");
  const [optionIsDefault, setOptionIsDefault] = useState(false);
  const [optionSwapToId, setOptionSwapToId] = useState<number | "">("");

  type PendingDelete =
    | { type: "group"; item: ModifierGroup }
    | { type: "option"; item: ModifierOption };
  const [pendingDelete, setPendingDelete] = useState<PendingDelete | null>(null);

  const productCategories = useMemo(
    () =>
      Array.from(
        new Set(
          products
            .map((p: Product) => p.category)
            .filter(Boolean) as string[],
        ),
      ).sort((a, b) => a.localeCompare(b)),
    [products],
  );

  const formCategoryOptions = useMemo(
    () => buildModifierCategoryOptions(groups, productCategories),
    [groups, productCategories],
  );

  const toolbarCategories = useMemo(
    () => buildModifierCategoryOptions(groups, productCategories),
    [groups, productCategories],
  );

  const summary = useMemo(() => {
    let emptyGroups = 0;
    let withSwap = 0;
    for (const group of groups) {
      if (modifierGroupIsEmpty(group)) emptyGroups += 1;
      if (modifierGroupHasSwap(group)) withSwap += 1;
    }
    return {
      totalGroups: groups.length,
      totalOptions: countModifierOptions(groups),
      emptyGroups,
      withSwap,
    };
  }, [groups]);

  const filteredGroups = useMemo(() => {
    return groups.filter((group: ModifierGroup) => {
      const matchesSearch = matchesModifierSearch(group, deferredSearch);
      const matchesCategory = matchesModifierCategoryFilter(group, categoryFilter);
      const matchesHighlight = matchesModifierHighlightFilter(group, highlightFilter);
      return matchesSearch && matchesCategory && matchesHighlight;
    });
  }, [groups, deferredSearch, categoryFilter, highlightFilter]);

  const hasActiveFilters = !isDefault;

  const isSavingGroup = createGroup.isPending || updateGroup.isPending;
  const isSavingOption = createOption.isPending || updateOption.isPending;
  const isDeleting = deleteGroup.isPending || deleteOption.isPending;

  const resetGroupForm = useCallback(() => {
    setEditingGroup(null);
    setGroupName("");
    setGroupCategory(formCategoryOptions[0] ?? "Coffee");
    setGroupSortOrder("0");
    setGroupSwapIngredientId("");
  }, [formCategoryOptions]);

  const resetOptionForm = useCallback(() => {
    setEditingOption(null);
    setOptionGroupId(null);
    setOptionName("");
    setOptionPriceDelta("0");
    setOptionSortOrder("0");
    setOptionIsDefault(false);
    setOptionSwapToId("");
  }, []);

  const openCreateGroup = useCallback(() => {
    resetGroupForm();
    setGroupDialogOpen(true);
  }, [resetGroupForm]);

  const openEditGroup = useCallback((group: ModifierGroup) => {
    setEditingGroup(group);
    setGroupName(group.name);
    setGroupCategory(group.category ?? MODIFIER_ALL_CATEGORIES);
    setGroupSortOrder(String(group.sortOrder));
    setGroupSwapIngredientId(group.swapIngredientId ?? "");
    setGroupDialogOpen(true);
  }, []);

  const openCreateOption = useCallback(
    (groupId: number) => {
      resetOptionForm();
      setOptionGroupId(groupId);
      setOptionDialogOpen(true);
    },
    [resetOptionForm],
  );

  const openEditOption = useCallback((option: ModifierOption) => {
    setEditingOption(option);
    setOptionGroupId(option.groupId);
    setOptionName(option.name);
    setOptionPriceDelta(String(toNumber(option.priceDelta)));
    setOptionSortOrder(String(option.sortOrder));
    setOptionIsDefault(option.isDefault);
    setOptionSwapToId(option.swapToIngredientId ?? "");
    setOptionDialogOpen(true);
  }, []);

  const handleSaveGroup = async () => {
    if (!groupName.trim()) {
      toast.error("Group name is required");
      return;
    }
    const categoryValue =
      groupCategory === MODIFIER_ALL_CATEGORIES
        ? editingGroup
          ? null
          : undefined
        : groupCategory || undefined;
    try {
      if (editingGroup) {
        await updateGroup.mutateAsync({
          id: editingGroup.id,
          name: groupName.trim(),
          category: categoryValue,
          sortOrder: Number(groupSortOrder) || 0,
          swapIngredientId:
            groupSwapIngredientId === "" ? null : Number(groupSwapIngredientId),
        });
        toast.success("Modifier group updated");
      } else {
        await createGroup.mutateAsync({
          name: groupName.trim(),
          category: categoryValue === null ? undefined : categoryValue,
          sortOrder: Number(groupSortOrder) || 0,
          swapIngredientId:
            groupSwapIngredientId === "" ? undefined : Number(groupSwapIngredientId),
        });
        toast.success("Modifier group created");
      }
      setGroupDialogOpen(false);
      resetGroupForm();
    } catch (err: unknown) {
      toast.error(getErrorMessage(err, "Failed to save group"));
    }
  };

  const handleDeleteGroup = async (group: ModifierGroup) => {
    try {
      await deleteGroup.mutateAsync(group.id);
      toast.success("Modifier group deleted");
      setPendingDelete(null);
    } catch (err: unknown) {
      toast.error(getErrorMessage(err, "Failed to delete group"));
    }
  };

  const handleSaveOption = async () => {
    if (!optionName.trim() || !optionGroupId) {
      toast.error("Option name is required");
      return;
    }
    try {
      const payload = {
        name: optionName.trim(),
        priceDelta: Number(optionPriceDelta) || 0,
        sortOrder: Number(optionSortOrder) || 0,
        isDefault: optionIsDefault,
        swapToIngredientId:
          optionSwapToId === "" ? undefined : Number(optionSwapToId),
      };
      if (editingOption) {
        await updateOption.mutateAsync({
          id: editingOption.id,
          ...payload,
          swapToIngredientId:
            optionSwapToId === "" ? null : Number(optionSwapToId),
        });
        toast.success("Option updated");
      } else {
        await createOption.mutateAsync({ groupId: optionGroupId, ...payload });
        toast.success("Option created");
      }
      setOptionDialogOpen(false);
      resetOptionForm();
    } catch (err: unknown) {
      toast.error(getErrorMessage(err, "Failed to save option"));
    }
  };

  const handleDeleteOption = async (option: ModifierOption) => {
    try {
      await deleteOption.mutateAsync(option.id);
      toast.success("Option deleted");
      setPendingDelete(null);
    } catch (err: unknown) {
      toast.error(getErrorMessage(err, "Failed to delete option"));
    }
  };

  const makeOptionColumns = useCallback(
    (group: ModifierGroup): ColumnsType<ModifierOption> => [
      {
        title: "Name",
        dataIndex: "name",
        key: "name",
        render: (name: string) => (
          <span className={cn("font-medium", text.primary)}>{name}</span>
        ),
      },
      {
        title: "Price +",
        key: "price",
        align: "right" as const,
        render: (_: unknown, record: ModifierOption) => (
          <span className={cn("tabular-nums font-medium", text.primary)}>
            {formatCurrency(toNumber(record.priceDelta))}
          </span>
        ),
      },
      {
        title: "Default",
        dataIndex: "isDefault",
        key: "default",
        responsive: ["md"],
        width: 72,
        render: (v: boolean) => (
          <span className={cn("text-sm", v ? text.primary : text.muted)}>{v ? "Yes" : "—"}</span>
        ),
      },
      {
        title: "Swap",
        key: "swap",
        responsive: ["lg"],
        render: (_: unknown, record: ModifierOption) => (
          <span className={cn("text-sm", text.secondary)}>
            {record.swapToIngredient?.name ?? "—"}
          </span>
        ),
      },
      {
        title: "Sort",
        dataIndex: "sortOrder",
        key: "sort",
        responsive: ["lg"],
        width: 56,
        render: (sortOrder: number) => (
          <span className={cn("tabular-nums text-sm", text.muted)}>{sortOrder}</span>
        ),
      },
      {
        title: "",
        key: "actions",
        width: 96,
        align: "right" as const,
        render: (_: unknown, record: ModifierOption) => (
          <div className="flex items-center justify-end gap-1">
            <TableActionButton
              icon={Pencil}
              label={`Edit ${record.name} in ${group.name}`}
              iconOnly
              tone="purple"
              onClick={() => openEditOption(record)}
            />
            <TableActionButton
              icon={Trash2}
              label={`Delete ${record.name}`}
              iconOnly
              destructive
              onClick={() => setPendingDelete({ type: "option", item: record })}
            />
          </div>
        ),
      },
    ],
    [openEditOption],
  );

  const renderOptionMobile = useCallback(
    (record: ModifierOption, group: ModifierGroup) => (
      <ListMobileCard>
        <div className="mb-2 flex items-start justify-between gap-3">
          <span className={cn("font-medium", text.primary)}>{record.name}</span>
          <span className={cn("shrink-0 tabular-nums font-medium", text.primary)}>
            {formatCurrency(toNumber(record.priceDelta))}
          </span>
        </div>
        <dl className="mb-3 grid grid-cols-2 gap-x-3 gap-y-1 text-sm">
          <div>
            <dt className={text.muted}>Default</dt>
            <dd className={cn(record.isDefault ? text.primary : text.muted)}>
              {record.isDefault ? "Yes" : "—"}
            </dd>
          </div>
          <div>
            <dt className={text.muted}>Sort</dt>
            <dd className={cn("tabular-nums", text.muted)}>{record.sortOrder}</dd>
          </div>
          {record.swapToIngredient?.name ? (
            <div className="col-span-2">
              <dt className={text.muted}>Swap</dt>
              <dd className={text.secondary}>{record.swapToIngredient.name}</dd>
            </div>
          ) : null}
        </dl>
        <div className="flex items-center justify-end gap-1">
          <TableActionButton
            icon={Pencil}
            label={`Edit ${record.name} in ${group.name}`}
            iconOnly
            tone="purple"
            onClick={() => openEditOption(record)}
          />
          <TableActionButton
            icon={Trash2}
            label={`Delete ${record.name}`}
            iconOnly
            destructive
            onClick={() => setPendingDelete({ type: "option", item: record })}
          />
        </div>
      </ListMobileCard>
    ),
    [openEditOption],
  );

  const groupActionButtonClass = "min-h-9";

  return (
    <>
      <div className="mb-4 flex justify-end">
        <Button onClick={openCreateGroup} className={hubCtaClassName("products")} data-testid="modifiers-new-group">
          <Plus className="w-4 h-4 mr-2" aria-hidden />
          New group
        </Button>
      </div>

      <HubListPage className={productsSectionPanelClassName()}>
        <HubListPage.Error
          message={isError ? getErrorMessage(error, "Failed to load modifier groups") : undefined}
          onRetry={() => void refetch()}
          loading={isFetching}
        />

        <HubListPage.Toolbar
          search={search}
          onSearchChange={setSearch}
          searchPlaceholder="Search groups and options…"
          searchTestId="modifiers-search"
          showReset={hasActiveFilters}
          onReset={reset}
          filters={
            <>
              <ListFilterSelect
                value={categoryFilter}
                onValueChange={(value) => setValue("category", value)}
                ariaLabel="Filter by menu category"
                widthClassName="w-full sm:w-[200px]"
                options={[
                  { value: "ALL", label: "All categories" },
                  ...toolbarCategories.map((cat) => ({ value: cat, label: cat })),
                ]}
              />
              <ListFilterSelect
                value={highlightFilter}
                onValueChange={(value) => setValue("highlight", value)}
                ariaLabel="Filter by group type"
                widthClassName="w-full sm:w-[180px]"
                options={[
                  { value: "ALL", label: "All groups" },
                  { value: "empty", label: "Empty groups" },
                  { value: "with-swap", label: "With swap" },
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
          filteredCount={filteredGroups.length}
          totalCount={summary.totalGroups}
          itemLabel="group"
          emptyLabel="No modifier groups yet"
        >
          {!hasActiveFilters && summary.totalGroups > 0
            ? formatHubListCountWithFetching(
                `${summary.totalGroups} group${summary.totalGroups === 1 ? "" : "s"} · ${summary.totalOptions} option${summary.totalOptions === 1 ? "" : "s"}`,
                isFetching,
                isLoading,
              )
            : undefined}
        </HubListPage.Count>

        <HubListPage.Body className="space-y-0">
          {isLoading ? (
            <QueryLoadingPanel message="Loading modifier groups…" minHeightClassName="py-16" />
          ) : !isError && filteredGroups.length === 0 ? (
            <HubListPage.Empty
              title={
                hasActiveFilters
                  ? "No modifier groups match your filters."
                  : "No modifier groups yet"
              }
              description={
                hasActiveFilters ? undefined : "Create one to customize POS orders."
              }
            />
          ) : (
            !isError &&
            filteredGroups.map((group: ModifierGroup) => (
              <div key={group.id} className={modifierGroupPanelClassName()}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className={cn("font-semibold", text.primary)}>{group.name}</h3>
                    <p className={cn("mt-0.5 text-sm", text.muted)}>
                      {[
                        group.category ?? "All categories",
                        `sort ${group.sortOrder}`,
                        group.swapIngredient?.name
                          ? `swap ${group.swapIngredient.name}`
                          : null,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    <Button
                      variant="outline"
                      size="sm"
                      className={groupActionButtonClass}
                      onClick={() => openEditGroup(group)}
                    >
                      <Pencil className="w-3.5 h-3.5 mr-1" aria-hidden />
                      Edit
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className={groupActionButtonClass}
                      onClick={() => openCreateOption(group.id)}
                    >
                      <Plus className="w-3.5 h-3.5 mr-1" aria-hidden />
                      Option
                    </Button>
                    <TableActionButton
                      icon={Trash2}
                      label={`Delete ${group.name}`}
                      iconOnly
                      variant="outline"
                      destructive
                      onClick={() => setPendingDelete({ type: "group", item: group })}
                    />
                  </div>
                </div>

                <div className="md:hidden">
                  {group.options.length === 0 ? (
                    <p className={cn("py-4 text-center text-sm", text.muted)}>No options yet.</p>
                  ) : (
                    <PaginatedMobileList
                      items={group.options}
                      pageSize={0}
                    >
                      {(record) => renderOptionMobile(record, group)}
                    </PaginatedMobileList>
                  )}
                </div>
                <div className="hidden md:block">
                  <DataTable
                    {...hubListDataTableProps()}
                    rowKey="id"
                    dataSource={group.options}
                    pagination={false}
                    emptyDescription="No options yet."
                    columns={makeOptionColumns(group)}
                  />
                </div>
              </div>
            ))
          )}
        </HubListPage.Body>
      </HubListPage>

      <ModifierGroupFormDialog
        open={groupDialogOpen}
        onOpenChange={(open) => {
          setGroupDialogOpen(open);
          if (!open) resetGroupForm();
        }}
        editingGroup={editingGroup}
        groupName={groupName}
        onGroupNameChange={setGroupName}
        groupCategory={groupCategory}
        onGroupCategoryChange={setGroupCategory}
        groupSortOrder={groupSortOrder}
        onGroupSortOrderChange={setGroupSortOrder}
        groupSwapIngredientId={groupSwapIngredientId}
        onGroupSwapIngredientIdChange={setGroupSwapIngredientId}
        formCategoryOptions={formCategoryOptions}
        isSaving={isSavingGroup}
        onSave={() => void handleSaveGroup()}
      />

      <ModifierOptionFormDialog
        open={optionDialogOpen}
        onOpenChange={(open) => {
          setOptionDialogOpen(open);
          if (!open) resetOptionForm();
        }}
        editingOption={editingOption}
        optionName={optionName}
        onOptionNameChange={setOptionName}
        optionPriceDelta={optionPriceDelta}
        onOptionPriceDeltaChange={setOptionPriceDelta}
        optionSortOrder={optionSortOrder}
        onOptionSortOrderChange={setOptionSortOrder}
        optionIsDefault={optionIsDefault}
        onOptionIsDefaultChange={setOptionIsDefault}
        optionSwapToId={optionSwapToId}
        onOptionSwapToIdChange={setOptionSwapToId}
        isSaving={isSavingOption}
        onSave={() => void handleSaveOption()}
      />

      <ConfirmDialog
        open={pendingDelete !== null}
        onOpenChange={(open) => !open && setPendingDelete(null)}
        title={
          pendingDelete?.type === "group"
            ? `Delete "${pendingDelete.item.name}"?`
            : `Delete option "${pendingDelete?.type === "option" ? pendingDelete.item.name : ""}"?`
        }
        description={
          pendingDelete?.type === "group"
            ? "This will remove the group and all of its options."
            : undefined
        }
        confirmLabel="Delete"
        destructive
        loading={isDeleting}
        onConfirm={async () => {
          if (!pendingDelete) return;
          if (pendingDelete.type === "group") {
            await handleDeleteGroup(pendingDelete.item);
          } else {
            await handleDeleteOption(pendingDelete.item);
          }
        }}
      />
    </>
  );
}
