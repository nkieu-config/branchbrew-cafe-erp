import { describe, expect, it } from "vitest";
import { toReceiptOrder, type CreatedOrderResponse } from "./pos-receipt";

function response(
  overrides: Partial<CreatedOrderResponse> = {},
): CreatedOrderResponse {
  return {
    id: 42,
    queueNumber: 7,
    customer: { name: "Ploy" },
    items: [
      {
        product: {
          id: 1,
          name: "Iced Latte",
          price: 85,
          category: "Coffee",
          isActive: true,
        },
        quantity: 2,
        notes: "less sweet",
      },
    ],
    totalAmount: 170,
    discountAmount: 20,
    netAmount: 150,
    ...overrides,
  } as CreatedOrderResponse;
}

describe("toReceiptOrder", () => {
  it("builds the receipt from the order the server actually stored", () => {
    const receipt = toReceiptOrder(response(), "Nok");

    expect(receipt.id).toBe(42);
    expect(receipt.queueNumber).toBe(7);
    expect(receipt.cashier).toBe("Nok");
    expect(receipt.customerName).toBe("Ploy");
    expect(receipt.subtotal).toBe(170);
    expect(receipt.discount).toBe(20);
    expect(receipt.netTotal).toBe(150);
    expect(receipt.items).toEqual([
      {
        product: {
          id: 1,
          name: "Iced Latte",
          price: 85,
          category: "Coffee",
          isActive: true,
        },
        quantity: 2,
        notes: "less sweet",
      },
    ]);
  });

  it("coerces decimal money that arrives as strings", () => {
    const receipt = toReceiptOrder(
      response({
        totalAmount: "170.00",
        discountAmount: "20.00",
        netAmount: "150.00",
        items: [
          {
            product: {
              id: 1,
              name: "Iced Latte",
              price: "85.00",
              category: "Coffee",
              isActive: true,
            },
            quantity: 2,
          },
        ],
      } as Partial<CreatedOrderResponse>),
    );

    expect(receipt.subtotal).toBe(170);
    expect(receipt.netTotal).toBe(150);
    expect(receipt.items?.[0].product.price).toBe(85);
  });

  it("reports a walk-in sale when the server stored no member", () => {
    const receipt = toReceiptOrder(response({ customer: null }));

    expect(receipt.customerName).toBeUndefined();
  });

  it("tolerates an order that carries no items", () => {
    const receipt = toReceiptOrder(response({ items: undefined }));

    expect(receipt.items).toEqual([]);
  });
});
