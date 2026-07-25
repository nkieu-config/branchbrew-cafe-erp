import type { Order, OrderStatus } from "@/types/api";
import { formatQueueNumber } from "@/lib/queue";

export function isOrderToday(iso: string): boolean {
  const d = new Date(iso);
  const now = new Date();
  return (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  );
}

export function isTerminalOrderStatus(status: OrderStatus): boolean {
  return status === "CANCELLED" || status === "REFUNDED";
}

export function matchesPosOrderSearch(order: Order, search: string): boolean {
  if (!search) return true;
  const haystack = [
    String(order.id),
    order.status,
    order.paymentMethod ?? "",
    formatQueueNumber(order.queueNumber),
  ]
    .join(" ")
    .toLowerCase();
  return haystack.includes(search);
}

export function filterPosOrders(
  orders: Order[],
  options: {
    search: string;
    statusFilter: OrderStatus | "ALL";
  },
): Order[] {
  return orders.filter((order) => {
    const matchesStatus = options.statusFilter === "ALL" || order.status === options.statusFilter;
    return matchesStatus && matchesPosOrderSearch(order, options.search);
  });
}

export function hasPosOrderFilters(options: {
  search: string;
  statusFilter: OrderStatus | "ALL";
}): boolean {
  return options.search.trim().length > 0 || options.statusFilter !== "ALL";
}
