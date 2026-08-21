import {
  applyIngredientSwaps,
  buildItemIngredientRequirements,
  buildIngredientRequirementsFromOrderItems,
} from './recipe-requirements';

describe('recipe-requirements', () => {
  const milkId = 10;
  const oatId = 11;
  const beansId = 1;
  const recipe = [
    { ingredientId: beansId, quantity: 18 },
    { ingredientId: milkId, quantity: 150 },
  ];

  describe('applyIngredientSwaps', () => {
    it('replaces swap-target ingredient with option ingredient', () => {
      const map = new Map<number, number>([
        [beansId, 18],
        [milkId, 150],
      ]);

      applyIngredientSwaps(map, recipe, 1, [
        {
          swapToIngredientId: oatId,
          group: { swapIngredientId: milkId },
        },
      ]);

      expect(map.get(milkId)).toBeUndefined();
      expect(map.get(oatId)).toBe(150);
      expect(map.get(beansId)).toBe(18);
    });

    it('skips swap when swapTo is null', () => {
      const map = new Map<number, number>([[milkId, 150]]);

      applyIngredientSwaps(map, recipe, 1, [
        { swapToIngredientId: null, group: { swapIngredientId: milkId } },
      ]);

      expect(map.get(milkId)).toBe(150);
    });
  });

  describe('buildItemIngredientRequirements', () => {
    it('scales recipe by quantity and applies swaps', () => {
      const reqs = buildItemIngredientRequirements(recipe, 2, [
        {
          swapToIngredientId: oatId,
          group: { swapIngredientId: milkId },
        },
      ]);

      expect(reqs.get(beansId)).toBe(36);
      expect(reqs.get(milkId)).toBeUndefined();
      expect(reqs.get(oatId)).toBe(300);
    });
  });

  describe('buildIngredientRequirementsFromOrderItems', () => {
    it('aggregates multiple line items with modifiers', () => {
      const map = buildIngredientRequirementsFromOrderItems([
        {
          quantity: 1,
          product: { recipeItems: recipe },
          modifiers: [
            {
              option: {
                swapToIngredientId: oatId,
                group: { swapIngredientId: milkId },
              },
            },
          ],
        },
        {
          quantity: 1,
          product: { recipeItems: recipe },
          modifiers: [],
        },
      ]);

      expect(map.get(beansId)).toBe(36);
      expect(map.get(milkId)).toBe(150);
      expect(map.get(oatId)).toBe(150);
    });
  });
});
