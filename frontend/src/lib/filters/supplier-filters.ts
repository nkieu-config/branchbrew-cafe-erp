import type { PurchaseOrder, Supplier } from "@/types/api";

export type SupplierContactFilter = "ALL" | "missing-email" | "missing-phone";

export function supplierMissingEmail(supplier: Supplier): boolean {
  return !supplier.contactEmail?.trim();
}

export function supplierMissingPhone(supplier: Supplier): boolean {
  return !supplier.phone?.trim();
}

export function matchesSupplierContactFilter(
  supplier: Supplier,
  filter: SupplierContactFilter,
): boolean {
  if (filter === "ALL") return true;
  if (filter === "missing-email") return supplierMissingEmail(supplier);
  return supplierMissingPhone(supplier);
}

export function summarizeSuppliers(suppliers: Supplier[]) {
  let missingEmail = 0;
  let missingPhone = 0;
  for (const supplier of suppliers) {
    if (supplierMissingEmail(supplier)) missingEmail += 1;
    if (supplierMissingPhone(supplier)) missingPhone += 1;
  }
  return {
    total: suppliers.length,
    missingEmail,
    missingPhone,
  };
}

export function countPurchaseOrdersBySupplier(
  orders: PurchaseOrder[],
): Map<number, number> {
  const counts = new Map<number, number>();
  for (const order of orders) {
    counts.set(order.supplierId, (counts.get(order.supplierId) ?? 0) + 1);
  }
  return counts;
}

export function matchesSupplierSearch(supplier: Supplier, search: string): boolean {
  if (!search) return true;
  const haystack = [supplier.name, supplier.contactEmail ?? "", supplier.phone ?? ""]
    .join(" ")
    .toLowerCase();
  return haystack.includes(search);
}

export function filterSuppliers(
  suppliers: Supplier[],
  options: {
    search: string;
    contactFilter: SupplierContactFilter;
  },
): Supplier[] {
  return suppliers.filter(
    (supplier) =>
      matchesSupplierSearch(supplier, options.search) &&
      matchesSupplierContactFilter(supplier, options.contactFilter),
  );
}

