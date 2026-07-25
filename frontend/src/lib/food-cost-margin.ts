import type { FoodCostActual } from "@/types/api";

export function foodCostVariance(
  actual: FoodCostActual,
  theoreticalAvgPercent: number,
) {
  return {
    ...actual,
    theoreticalAvgPercent,
    variancePercent: actual.actualFoodCostPercent - theoreticalAvgPercent,
  };
}
