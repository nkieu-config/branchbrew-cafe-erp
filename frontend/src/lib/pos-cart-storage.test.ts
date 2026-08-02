import { describe, it, expect, beforeEach } from "vitest";
import {
  clearPosCart,
  countPosCartUnits,
  loadPosCart,
  POS_CART_MAX_AGE_MS,
  savePosCart,
  type PersistedPosCart,
} from "./pos-cart-storage";
import type { PosCartItem } from "./pos-cart";
import type { Product } from "@/types/api";

const product = { id: 7, name: "Latte", category: "Coffee", price: 85 } as unknown as Product;

const item: PosCartItem = {
  id: "line-1",
  product,
  quantity: 2,
  unitPrice: 85,
};

const state = (overrides: Partial<PersistedPosCart> = {}): PersistedPosCart => ({
  branchId: 1,
  cart: [item],
  customer: null,
  customerPhone: "",
  pointsToRedeem: 0,
  promoCode: "",
  appliedPromo: null,
  clientRequestId: "req-1",
  savedAt: Date.now(),
  ...overrides,
});

describe("pos cart storage", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("round-trips a cart for the same branch", () => {
    savePosCart(state());
    const restored = loadPosCart(1);
    expect(restored?.cart).toHaveLength(1);
    expect(restored?.clientRequestId).toBe("req-1");
  });

  it("never hands a cart to a different branch", () => {
    savePosCart(state({ branchId: 1 }));
    expect(loadPosCart(2)).toBeNull();
  });

  it("keeps the other branch's cart intact on a mismatch", () => {
    savePosCart(state({ branchId: 1 }));
    loadPosCart(2);
    expect(loadPosCart(1)).not.toBeNull();
  });

  it("drops a cart older than the max age", () => {
    savePosCart(state({ savedAt: Date.now() - POS_CART_MAX_AGE_MS - 1 }));
    expect(loadPosCart(1)).toBeNull();
  });

  it("clears storage instead of persisting an empty cart", () => {
    savePosCart(state());
    savePosCart(state({ cart: [] }));
    expect(loadPosCart(1)).toBeNull();
  });

  it("discards corrupt payloads without throwing", () => {
    localStorage.setItem("branchbrew_pos_cart_v1", "{not json");
    expect(loadPosCart(1)).toBeNull();
  });

  it("rejects a payload whose items lost their product", () => {
    localStorage.setItem(
      "branchbrew_pos_cart_v1",
      JSON.stringify({ ...state(), cart: [{ id: "x", quantity: 1, unitPrice: 5 }] }),
    );
    expect(loadPosCart(1)).toBeNull();
  });

  it("clears on demand", () => {
    savePosCart(state());
    clearPosCart();
    expect(loadPosCart(1)).toBeNull();
  });

  it("counts units rather than lines", () => {
    expect(countPosCartUnits([item, { ...item, id: "line-2", quantity: 3 }])).toBe(5);
  });
});
