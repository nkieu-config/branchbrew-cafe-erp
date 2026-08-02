import type { OrderStatus } from "@/types/api";

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

export const ORDER_PAGE_SIZE_DEFAULT = 25;
export const ORDER_LOOKBACK_DEFAULT_DAYS = 14;

export const ORDER_LOOKBACK_OPTIONS = [
  { value: "14", label: "Last 14 days" },
  { value: "30", label: "Last 30 days" },
  { value: "90", label: "Last 90 days" },
  { value: "365", label: "Last 12 months" },
] as const;

export function lookbackStartDate(days: number, from: Date = new Date()): string {
  const start = new Date(from);
  start.setDate(start.getDate() - days);
  const month = String(start.getMonth() + 1).padStart(2, "0");
  const day = String(start.getDate()).padStart(2, "0");
  return `${start.getFullYear()}-${month}-${day}`;
}
