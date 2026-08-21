import {
  buildIngredientRequirementsFromOrderItems,
  isSameCalendarDay,
} from './order-void.rules';

describe('order-void.rules', () => {
  describe('isSameCalendarDay', () => {
    it('returns true for same local calendar day', () => {
      const a = new Date('2026-06-27T08:00:00');
      const b = new Date('2026-06-27T22:00:00');
      expect(isSameCalendarDay(a, b)).toBe(true);
    });

    it('returns false across midnight', () => {
      const a = new Date('2026-06-27T23:59:00');
      const b = new Date('2026-06-28T00:01:00');
      expect(isSameCalendarDay(a, b)).toBe(false);
    });
  });

  describe('buildIngredientRequirementsFromOrderItems', () => {
    it('aggregates recipe quantities by ingredient', () => {
      const map = buildIngredientRequirementsFromOrderItems([
        {
          quantity: 2,
          product: {
            recipeItems: [
              { ingredientId: 1, quantity: 18 },
              { ingredientId: 2, quantity: 150 },
            ],
          },
        },
      ]);

      expect(map.get(1)).toBe(36);
      expect(map.get(2)).toBe(300);
    });
  });
});
