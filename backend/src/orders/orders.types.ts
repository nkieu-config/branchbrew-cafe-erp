import { PaymentMethod, Prisma } from '@prisma/client';
import { kdsOrderInclude } from './kds-order.include';

export const createOrderInclude = {
  ...kdsOrderInclude,
  promotion: true,
} satisfies Prisma.OrderInclude;

export const orderListInclude = {
  items: true,
  branch: true,
  customer: { select: { id: true, name: true, tier: true } },
  promotion: true,
} satisfies Prisma.OrderInclude;

export type CreateOrderInput = {
  userId: number;
  branchId: number;
  items: {
    productId: number;
    quantity: number;
    notes?: string;
    modifierOptionIds?: number[];
  }[];
  customerPhone?: string;
  promotionCode?: string;
  pointsToRedeem?: number;
  paymentMethod?: PaymentMethod;
  isTaxInvoiceRequested?: boolean;
  taxInvoiceName?: string;
  taxInvoiceTaxId?: string;
  taxInvoiceAddress?: string;
};

export type CreatedOrder = Prisma.OrderGetPayload<{
  include: typeof createOrderInclude;
}>;
