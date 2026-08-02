import type { CsvColumn } from "@/lib/export/csv";
import type { Order } from "@/types/api";

export const ORDER_CSV_COLUMNS: readonly CsvColumn<Order>[] = [
  { header: "Order", value: (row) => row.id },
  { header: "Queue", value: (row) => row.queueNumber ?? "" },
  { header: "Placed at", value: (row) => row.createdAt },
  { header: "Status", value: (row) => row.status },
  { header: "Payment", value: (row) => row.paymentMethod ?? "" },
  { header: "Items", value: (row) => row.items?.length ?? 0 },
  { header: "Gross", value: (row) => row.totalAmount },
  { header: "Discount", value: (row) => row.discountAmount },
  { header: "Tax", value: (row) => row.taxAmount },
  { header: "Net", value: (row) => row.netAmount },
  { header: "Refund reason", value: (row) => row.refundReason ?? "" },
];
