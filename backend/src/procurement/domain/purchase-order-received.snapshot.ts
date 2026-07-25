export type PurchaseOrderReceivedSnapshot = {
  poId: number;
  poNumber: string;
  branchId: number;
  totalAmount: number;
  standardAmount?: number;
};

export function toPurchaseOrderReceivedSnapshot(input: {
  poId: number;
  poNumber: string;
  branchId: number;
  totalAmount: number;
  standardAmount: number;
}): PurchaseOrderReceivedSnapshot {
  return {
    poId: input.poId,
    poNumber: input.poNumber,
    branchId: input.branchId,
    totalAmount: input.totalAmount,
    standardAmount: input.standardAmount,
  };
}
