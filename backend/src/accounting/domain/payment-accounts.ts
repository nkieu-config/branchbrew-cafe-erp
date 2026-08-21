export const PAYMENT_ACCOUNT_CODES = {
  CASH: '1010',
  CREDIT_CARD: '1040',
  QR_PROMPTPAY: '1050',
} as const;

export type PaymentAccountMethod = keyof typeof PAYMENT_ACCOUNT_CODES;

export function resolvePaymentAccountCode(
  method: PaymentAccountMethod,
): string {
  return PAYMENT_ACCOUNT_CODES[method] ?? PAYMENT_ACCOUNT_CODES.CASH;
}

export function paymentAccountLabel(method: PaymentAccountMethod): string {
  switch (method) {
    case 'CREDIT_CARD':
      return 'Card payment received';
    case 'QR_PROMPTPAY':
      return 'QR payment received';
    default:
      return 'Cash received';
  }
}
