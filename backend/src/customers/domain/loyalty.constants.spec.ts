import {
  POINTS_PER_CURRENCY_UNIT,
  pointsToDiscountAmount,
} from './loyalty.constants';

describe('loyalty.constants', () => {
  it('defines 10 points per currency unit', () => {
    expect(POINTS_PER_CURRENCY_UNIT).toBe(10);
  });

  it('converts points to discount amount', () => {
    expect(pointsToDiscountAmount(50)).toBe(5);
    expect(pointsToDiscountAmount(10)).toBe(1);
  });
});
