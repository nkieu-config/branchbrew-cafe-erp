import { describe, expect, it } from "vitest";
import { foodCostVariance } from "./food-cost-margin";
import type { FoodCostActual } from "@/types/api";

function actual(overrides: Partial<FoodCostActual> = {}): FoodCostActual {
  return {
    orderCount: 2,
    totalRevenue: 300,
    totalCogs: 110,
    grossProfit: 190,
    actualFoodCostPercent: 36.67,
    grossMarginPercent: 63.33,
    ...overrides,
  };
}

describe("food-cost-margin", () => {
  it("compares the actual food cost to the theoretical recipe average", () => {
    const result = foodCostVariance(actual(), 28);

    expect(result.actualFoodCostPercent).toBeCloseTo(36.67, 1);
    expect(result.variancePercent).toBeCloseTo(8.67, 1);
    expect(result.orderCount).toBe(2);
  });

  it("reports a negative variance when the kitchen beats the recipe", () => {
    const result = foodCostVariance(actual({ actualFoodCostPercent: 25 }), 28);

    expect(result.variancePercent).toBeCloseTo(-3, 5);
  });
});
