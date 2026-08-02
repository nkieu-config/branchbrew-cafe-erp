import type { PosCartItem } from "@/lib/pos-cart";
import type { Customer, ValidatedPromotion } from "@/types/api";

const STORAGE_KEY = "branchbrew_pos_cart_v1";

export const POS_CART_MAX_AGE_MS = 12 * 60 * 60 * 1000;

export type PersistedPosCart = {
  branchId: number;
  cart: PosCartItem[];
  customer: Customer | null;
  customerPhone: string;
  pointsToRedeem: number;
  promoCode: string;
  appliedPromo: ValidatedPromotion | null;
  clientRequestId: string;
  savedAt: number;
};

function isPosCartItem(value: unknown): value is PosCartItem {
  if (!value || typeof value !== "object") return false;
  const item = value as Partial<PosCartItem>;
  return (
    typeof item.id === "string" &&
    typeof item.quantity === "number" &&
    typeof item.unitPrice === "number" &&
    !!item.product &&
    typeof item.product === "object" &&
    typeof (item.product as { id?: unknown }).id === "number"
  );
}

function isPersistedPosCart(value: unknown): value is PersistedPosCart {
  if (!value || typeof value !== "object") return false;
  const state = value as Partial<PersistedPosCart>;
  return (
    typeof state.branchId === "number" &&
    typeof state.savedAt === "number" &&
    typeof state.clientRequestId === "string" &&
    Array.isArray(state.cart) &&
    state.cart.every(isPosCartItem)
  );
}

function hasRestorableWork(state: PersistedPosCart): boolean {
  return state.cart.length > 0;
}

export function savePosCart(state: PersistedPosCart): void {
  if (typeof window === "undefined") return;
  if (!hasRestorableWork(state)) {
    clearPosCart();
    return;
  }
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    clearPosCart();
  }
}

export function loadPosCart(
  branchId: number,
  now: number = Date.now(),
): PersistedPosCart | null {
  if (typeof window === "undefined") return null;

  let raw: string | null;
  try {
    raw = localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
  if (!raw) return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    clearPosCart();
    return null;
  }

  if (!isPersistedPosCart(parsed)) {
    clearPosCart();
    return null;
  }
  if (parsed.branchId !== branchId) return null;
  if (now - parsed.savedAt > POS_CART_MAX_AGE_MS) {
    clearPosCart();
    return null;
  }
  if (!hasRestorableWork(parsed)) {
    clearPosCart();
    return null;
  }

  return parsed;
}

export function clearPosCart(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* storage unavailable */
  }
}

export function countPosCartUnits(cart: PosCartItem[]): number {
  return cart.reduce((sum, item) => sum + item.quantity, 0);
}
