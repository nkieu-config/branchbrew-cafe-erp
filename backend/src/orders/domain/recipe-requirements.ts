export type RecipeRow = { ingredientId: number; quantity: number };

export type ModifierOptionForSwap = {
  swapToIngredientId: number | null;
  group: { swapIngredientId: number | null };
};

/** Apply milk-type (or other) ingredient swaps from selected modifier options. */
export function applyIngredientSwaps(
  requirements: Map<number, number>,
  recipeItems: RecipeRow[],
  quantity: number,
  modifierOptions: ModifierOptionForSwap[],
): void {
  for (const opt of modifierOptions) {
    const swapFrom = opt.group.swapIngredientId;
    const swapTo = opt.swapToIngredientId;
    if (!swapFrom || !swapTo || swapFrom === swapTo) continue;

    const recipeRow = recipeItems.find((r) => r.ingredientId === swapFrom);
    if (!recipeRow) continue;

    const amount = recipeRow.quantity * quantity;
    const fromTotal = (requirements.get(swapFrom) ?? 0) - amount;
    if (fromTotal <= 0) requirements.delete(swapFrom);
    else requirements.set(swapFrom, fromTotal);

    requirements.set(swapTo, (requirements.get(swapTo) ?? 0) + amount);
  }
}

export function buildItemIngredientRequirements(
  recipeItems: RecipeRow[],
  quantity: number,
  modifierOptions: ModifierOptionForSwap[] = [],
): Map<number, number> {
  const map = new Map<number, number>();
  for (const recipe of recipeItems) {
    const needed = recipe.quantity * quantity;
    map.set(recipe.ingredientId, (map.get(recipe.ingredientId) ?? 0) + needed);
  }
  applyIngredientSwaps(map, recipeItems, quantity, modifierOptions);
  return map;
}

export function mergeRequirementMaps(
  target: Map<number, number>,
  source: Map<number, number>,
): void {
  for (const [ingredientId, qty] of source.entries()) {
    target.set(ingredientId, (target.get(ingredientId) ?? 0) + qty);
  }
}

export function buildIngredientRequirementsFromOrderItems(
  items: {
    quantity: number;
    product: { recipeItems: RecipeRow[] };
    modifiers?: { option: ModifierOptionForSwap }[];
  }[],
): Map<number, number> {
  const map = new Map<number, number>();
  for (const item of items) {
    const itemReqs = buildItemIngredientRequirements(
      item.product.recipeItems,
      item.quantity,
      item.modifiers?.map((m) => m.option) ?? [],
    );
    mergeRequirementMaps(map, itemReqs);
  }
  return map;
}
