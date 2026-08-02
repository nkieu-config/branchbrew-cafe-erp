"use client";

import { useCallback, useMemo, useState, useDeferredValue } from "react";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { HubListPage } from "@/components/shared/hub-list-page";
import { ListFilterSelect } from "@/components/shared/list-filters";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import {
  SupplierFormDialog,
  type SupplierFormValues,
} from "@/components/procurement/SupplierFormDialog";
import { SuppliersTable } from "@/components/procurement/SuppliersTable";
import { Button } from "@/components/ui/button";
import {
  useSuppliers,
  useCreateSupplier,
  useUpdateSupplier,
  useDeleteSupplier,
  usePurchaseOrders,
} from "@/hooks/domains/useProcurementQueries";
import { getErrorMessage } from "@/lib/errors";
import {
  countPurchaseOrdersBySupplier,
  filterSuppliers,
  summarizeSuppliers,
  type SupplierContactFilter,
} from "@/lib/filters/supplier-filters";
import { hubCtaClassName } from "@/lib/theme/hub-primitives";
import { procurementSectionPanelClassName } from "@/lib/theme/hub-procurement";
import type { Supplier } from "@/types/api";
import { useListUrlState } from "@/hooks/useListUrlState";

export default function SuppliersPageClient() {
  const { data: suppliers = [], isLoading, isError, error, refetch, isFetching } = useSuppliers();
  const { data: purchaseOrders = [] } = usePurchaseOrders();
  const createMutation = useCreateSupplier();
  const updateMutation = useUpdateSupplier();
  const deleteMutation = useDeleteSupplier();

  const { values, setValue, reset, isDefault } = useListUrlState({
    q: "",
    contact: "ALL",
  });
  const search = values.q;
  const setSearch = (next: string) => setValue("q", next);
  const deferredSearch = useDeferredValue(search.trim().toLowerCase());
  const contactFilter = values.contact as SupplierContactFilter;

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Supplier | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Supplier | null>(null);

  const poCountBySupplier = useMemo(
    () => countPurchaseOrdersBySupplier(purchaseOrders),
    [purchaseOrders],
  );

  const summary = useMemo(() => summarizeSuppliers(suppliers), [suppliers]);

  const filteredSuppliers = useMemo(
    () => filterSuppliers(suppliers, { search: deferredSearch, contactFilter }),
    [suppliers, deferredSearch, contactFilter],
  );

  const hasActiveFilters = !isDefault;

  const openCreate = useCallback(() => {
    setEditing(null);
    setOpen(true);
  }, []);

  const openEdit = useCallback((supplier: Supplier) => {
    setEditing(supplier);
    setOpen(true);
  }, []);

  const closeDialog = useCallback(() => {
    setOpen(false);
    setEditing(null);
  }, []);

  const handleSave = async (values: SupplierFormValues) => {
    const payload = {
      name: values.name.trim(),
      contactEmail: values.contactEmail.trim() || undefined,
      phone: values.phone.trim() || undefined,
    };
    try {
      if (editing) {
        await updateMutation.mutateAsync({ id: editing.id, ...payload });
        toast.success("Supplier updated");
      } else {
        await createMutation.mutateAsync(payload);
        toast.success("Supplier created");
      }
      closeDialog();
    } catch (err: unknown) {
      toast.error(getErrorMessage(err, "Failed to save supplier"));
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteMutation.mutateAsync(deleteTarget.id);
      toast.success("Supplier deleted");
      setDeleteTarget(null);
    } catch (err: unknown) {
      toast.error(getErrorMessage(err, "Failed to delete supplier"));
    }
  };

  const saving = createMutation.isPending || updateMutation.isPending;

  return (
    <>
      <div className="mb-4 flex justify-end">
        <Button onClick={openCreate} className={hubCtaClassName("procurement")}>
          <Plus className="w-4 h-4 mr-2" aria-hidden />
          Add supplier
        </Button>
      </div>

      <HubListPage className={procurementSectionPanelClassName()}>
        <HubListPage.Error
          message={isError ? getErrorMessage(error, "Failed to load suppliers") : undefined}
          onRetry={() => void refetch()}
          loading={isFetching}
        />

        <HubListPage.Toolbar
          search={search}
          onSearchChange={setSearch}
          searchPlaceholder="Search suppliers…"
          showReset={hasActiveFilters}
          onReset={reset}
          filters={
            <ListFilterSelect
              value={contactFilter}
              onValueChange={(value) => setValue("contact", value)}
              ariaLabel="Filter by contact data"
              widthClassName="w-full sm:w-[180px]"
              options={[
                { value: "ALL", label: "All" },
                { value: "missing-email", label: "Missing email" },
                { value: "missing-phone", label: "Missing phone" },
              ]}
            />
          }
        />

        <HubListPage.Count
          isLoading={isLoading}
          isError={isError}
          isFetching={isFetching}
          hasActiveFilters={hasActiveFilters}
          filteredCount={filteredSuppliers.length}
          totalCount={summary.total}
          itemLabel="supplier"
        />

        <SuppliersTable
          suppliers={filteredSuppliers}
          loading={isLoading}
          hasActiveFilters={hasActiveFilters}
          poCountBySupplier={poCountBySupplier}
          onEdit={openEdit}
          onDelete={setDeleteTarget}
        />
      </HubListPage>

      <SupplierFormDialog
        open={open}
        initialValues={editing}
        saving={saving}
        onOpenChange={(isOpen) => {
          if (!isOpen) closeDialog();
          else setOpen(true);
        }}
        onSave={(values) => void handleSave(values)}
      />

      <ConfirmDialog
        open={deleteTarget !== null}
        onOpenChange={(isOpen) => !isOpen && setDeleteTarget(null)}
        title="Delete supplier?"
        description={
          deleteTarget ? `Remove "${deleteTarget.name}"?` : undefined
        }
        confirmLabel="Delete"
        destructive
        loading={deleteMutation.isPending}
        onConfirm={handleDelete}
      />
    </>
  );
}
