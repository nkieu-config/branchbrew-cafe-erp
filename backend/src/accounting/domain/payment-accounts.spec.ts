import {
  resolvePaymentAccountCode,
  PAYMENT_ACCOUNT_CODES,
} from './payment-accounts';

describe('payment-accounts', () => {
  it('maps each payment method to a clearing account', () => {
    expect(resolvePaymentAccountCode('CASH')).toBe('1010');
    expect(resolvePaymentAccountCode('CREDIT_CARD')).toBe('1040');
    expect(resolvePaymentAccountCode('QR_PROMPTPAY')).toBe('1050');
  });

  it('falls back to cash for unknown methods', () => {
    expect(resolvePaymentAccountCode('UNKNOWN' as any)).toBe(
      PAYMENT_ACCOUNT_CODES.CASH,
    );
  });
});
