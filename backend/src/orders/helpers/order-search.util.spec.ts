import { buildOrderSearchFilter } from './order-search.util';

describe('buildOrderSearchFilter', () => {
  it('returns no constraint for an absent or blank term', () => {
    expect(buildOrderSearchFilter(undefined)).toEqual({});
    expect(buildOrderSearchFilter('   ')).toEqual({});
  });

  it('matches a number against both order id and queue number', () => {
    expect(buildOrderSearchFilter('42')).toEqual({
      OR: [{ id: 42 }, { queueNumber: 42 }],
    });
  });

  it('matches a status regardless of case', () => {
    expect(buildOrderSearchFilter('refunded')).toEqual({
      OR: [{ status: 'REFUNDED' }],
    });
  });

  it('matches a payment method typed with a space or hyphen', () => {
    expect(buildOrderSearchFilter('credit card')).toEqual({
      OR: [{ paymentMethod: 'CREDIT_CARD' }],
    });
    expect(buildOrderSearchFilter('qr-promptpay')).toEqual({
      OR: [{ paymentMethod: 'QR_PROMPTPAY' }],
    });
  });

  it('matches nothing rather than everything for an unrecognised term', () => {
    expect(buildOrderSearchFilter('espresso')).toEqual({ OR: [{ id: -1 }] });
  });

  it('ignores a numeric term that cannot be a real id', () => {
    expect(buildOrderSearchFilter('0')).toEqual({ OR: [{ id: -1 }] });
  });
});
