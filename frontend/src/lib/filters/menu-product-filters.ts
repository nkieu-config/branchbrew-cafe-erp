import type { Product } from "@/types/api";

export type MenuStatusFilter = "ALL" | "active" | "inactive";

export function productIsActive(product: Product): boolean {
  return product.isActive !== false;
}

export function productHasRecipe(product: Product): boolean {
  return (product.recipeItems?.length ?? 0) > 0;
}

export function matchesMenuStatusFilter(
  product: Product,
  filter: MenuStatusFilter,
): boolean {
  if (filter === "ALL") return true;
  return filter === "active" ? productIsActive(product) : !productIsActive(product);
}

export function matchesMenuProductSearch(product: Product, search: string): boolean {
  if (!search) return true;
  const haystack = [product.name, product.category, String(product.id)].join(" ").toLowerCase();
  return haystack.includes(search);
}

export function extractProductCategories(products: Product[]): string[] {
  const set = new Set<string>();
  for (const product of products) {
    if (product.category) set.add(product.category);
  }
  return Array.from(set).sort((a, b) => a.localeCompare(b));
}

export function filterMenuProducts(
  products: Product[],
  options: {
    search: string;
    categoryFilter: string;
    statusFilter: MenuStatusFilter;
  },
): Product[] {
  return products.filter(
    (product) =>
      matchesMenuProductSearch(product, options.search) &&
      (options.categoryFilter === "ALL" || product.category === options.categoryFilter) &&
      matchesMenuStatusFilter(product, options.statusFilter),
  );
}

