import { toNumber } from "./money";
import type { CreatedOrderItem, ReceiptOrder } from "@/types/api";

export interface CreatedOrderResponse {
  id: number;
  queueNumber?: number | null;
  customer?: { name?: string | null } | null;
  items?: CreatedOrderItem[];
  totalAmount?: number | string;
  discountAmount?: number | string;
  netAmount?: number | string;
}

export function toReceiptOrder(
  order: CreatedOrderResponse,
  cashierName?: string,
): ReceiptOrder {
  return {
    id: order.id,
    queueNumber: order.queueNumber ?? null,
    cashier: cashierName,
    customerName: order.customer?.name ?? undefined,
    items: (order.items ?? []).map((item) => ({
      product: { ...item.product, price: toNumber(item.product.price) },
      quantity: item.quantity,
      notes: item.notes ?? undefined,
    })),
    subtotal: toNumber(order.totalAmount),
    discount: toNumber(order.discountAmount),
    netTotal: toNumber(order.netAmount),
  };
}
