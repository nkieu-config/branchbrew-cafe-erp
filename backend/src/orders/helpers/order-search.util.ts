import { OrderStatus, PaymentMethod, Prisma } from '@prisma/client';

function asPositiveInt(term: string): number | null {
  if (!/^\d+$/.test(term)) return null;
  const value = Number(term);
  return Number.isSafeInteger(value) && value > 0 ? value : null;
}

function asOrderStatus(term: string): OrderStatus | null {
  const upper = term.toUpperCase();
  return upper in OrderStatus ? (upper as OrderStatus) : null;
}

function asPaymentMethod(term: string): PaymentMethod | null {
  const upper = term.toUpperCase().replace(/[\s-]+/g, '_');
  return upper in PaymentMethod ? (upper as PaymentMethod) : null;
}

export function buildOrderSearchFilter(
  search?: string,
): Pick<Prisma.OrderWhereInput, 'OR'> | Record<string, never> {
  const term = search?.trim();
  if (!term) return {};

  const clauses: Prisma.OrderWhereInput[] = [];

  const numeric = asPositiveInt(term);
  if (numeric !== null) {
    clauses.push({ id: numeric }, { queueNumber: numeric });
  }

  const status = asOrderStatus(term);
  if (status) clauses.push({ status });

  const paymentMethod = asPaymentMethod(term);
  if (paymentMethod) clauses.push({ paymentMethod });

  if (clauses.length === 0) return { OR: [{ id: -1 }] };

  return { OR: clauses };
}
