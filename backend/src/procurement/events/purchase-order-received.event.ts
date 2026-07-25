import { PurchaseOrderReceivedSnapshot } from '../domain/purchase-order-received.snapshot';

export class PurchaseOrderReceivedEvent {
  constructor(public readonly payload: PurchaseOrderReceivedSnapshot) {}

  get poId(): number {
    return this.payload.poId;
  }

  get poNumber(): string {
    return this.payload.poNumber;
  }

  get branchId(): number {
    return this.payload.branchId;
  }

  get totalAmount(): number {
    return this.payload.totalAmount;
  }

  get standardAmount(): number {
    return this.payload.standardAmount ?? this.payload.totalAmount;
  }
}
