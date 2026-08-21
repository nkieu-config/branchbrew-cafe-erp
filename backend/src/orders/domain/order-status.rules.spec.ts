import {
  canTransitionOrderStatus,
  productRequiresKitchen,
  resolveInitialOrderStatus,
} from './order-status.rules';

describe('order-status.rules', () => {
  it('detects kitchen-prep categories', () => {
    expect(productRequiresKitchen('Coffee')).toBe(true);
    expect(productRequiresKitchen('Hot Beverage')).toBe(true);
    expect(productRequiresKitchen('Bakery')).toBe(false);
  });

  it('queues beverage orders for KDS', () => {
    expect(
      resolveInitialOrderStatus([
        { category: 'Coffee' },
        { category: 'Bakery' },
      ]),
    ).toBe('PENDING');
  });

  it('completes retail-only orders at payment', () => {
    expect(resolveInitialOrderStatus([{ category: 'Bakery' }])).toBe(
      'COMPLETED',
    );
  });

  describe('canTransitionOrderStatus', () => {
    it('allows only forward KDS transitions', () => {
      expect(canTransitionOrderStatus('PENDING', 'PREPARING')).toBe(true);
      expect(canTransitionOrderStatus('PENDING', 'COMPLETED')).toBe(true);
      expect(canTransitionOrderStatus('PREPARING', 'COMPLETED')).toBe(true);
    });

    it('rejects backward transitions', () => {
      expect(canTransitionOrderStatus('COMPLETED', 'PREPARING')).toBe(false);
      expect(canTransitionOrderStatus('COMPLETED', 'PENDING')).toBe(false);
      expect(canTransitionOrderStatus('PREPARING', 'PENDING')).toBe(false);
    });

    it('never leaves terminal statuses', () => {
      expect(canTransitionOrderStatus('CANCELLED', 'PENDING')).toBe(false);
      expect(canTransitionOrderStatus('REFUNDED', 'COMPLETED')).toBe(false);
    });
  });
});
