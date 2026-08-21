/** Loyalty program: 10 points redeem for one currency unit discount. */
export const POINTS_PER_CURRENCY_UNIT = 10;

export const SPEND_PER_POINT_EARNED = 100;

export function pointsToDiscountAmount(points: number): number {
  return points / POINTS_PER_CURRENCY_UNIT;
}

export function pointsEarnedForSpend(netAmount: number): number {
  return Math.floor(netAmount / SPEND_PER_POINT_EARNED);
}
