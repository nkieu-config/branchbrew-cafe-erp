import {
  assertRefundable,
  OrderRefundValidationError,
} from './order-refund.rules';

describe('order-refund.rules', () => {
  it('allows refund for completed orders from a previous day', () => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    expect(() => assertRefundable(yesterday, 'COMPLETED')).not.toThrow();
  });

  it('rejects same-day refund', () => {
    expect(() => assertRefundable(new Date(), 'COMPLETED')).toThrow();
  });

  it('rejects refund for pending orders', () => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    expect(() => assertRefundable(yesterday, 'PENDING')).toThrow();
  });

  it('rejects already refunded orders', () => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    expect(() => assertRefundable(yesterday, 'REFUNDED')).toThrow();
  });

  it('throws REFUND_SAME_DAY for today completed orders', () => {
    expect(() => assertRefundable(new Date(), 'COMPLETED')).toThrow(
      OrderRefundValidationError,
    );

    try {
      assertRefundable(new Date(), 'COMPLETED');
    } catch (e) {
      const error = e as OrderRefundValidationError;
      expect(error.detail.kind).toBe('REFUND_SAME_DAY');
    }
  });
});
