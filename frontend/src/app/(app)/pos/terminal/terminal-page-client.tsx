"use client";

import { useState, useEffect, useMemo, useRef, useDeferredValue } from "react";
import dynamic from "next/dynamic";
import { useReactToPrint } from "react-to-print";
import { toast } from "sonner";
import {
  useProducts,
  useCreateOrder,
  useCustomerByPhone,
  useValidatePromotion,
} from "@/hooks/domains/usePosQueries";
import { useModifiers } from "@/hooks/domains/useModifierQueries";
import { useSettings } from "@/hooks/domains/useSettingsQueries";
import { useBranches } from "@/hooks/domains/useGeneralQueries";
import { useAuth } from "@/context/AuthContext";
import { BranchEmptyState } from "@/components/shared/branch-empty-state";
import { PosCartSidebar } from "@/components/pos/PosCartSidebar";
import { PosMobileCart } from "@/components/pos/PosMobileCart";
import { PosProductCatalog } from "@/components/pos/PosProductCatalog";

const PosCheckoutDialog = dynamic(
  () => import("@/components/pos/PosCheckoutDialog").then((m) => m.PosCheckoutDialog),
);
const PosCustomerLookupDialog = dynamic(
  () => import("@/components/pos/PosCustomerLookupDialog").then((m) => m.PosCustomerLookupDialog),
);
const PosModifierDialog = dynamic(
  () => import("@/components/pos/PosModifierDialog").then((m) => m.PosModifierDialog),
);
const PosOrderSuccessDialog = dynamic(
  () => import("@/components/pos/PosOrderSuccessDialog").then((m) => m.PosOrderSuccessDialog),
);
import { filterActive } from "@/lib/form";
import { pointsToDiscountAmount } from "@/lib/loyalty";
import { toNumber } from "@/lib/money";
import { toReceiptOrder } from "@/lib/pos-receipt";
import type { PosCartItem } from "@/lib/pos-cart";
import {
  clearPosCart,
  countPosCartUnits,
  loadPosCart,
  savePosCart,
} from "@/lib/pos-cart-storage";
import {
  getModifierExtra,
  getModifierSummary,
  productNeedsModifiers,
  resolveModifierCategory,
} from "@/lib/pos-modifiers";
import type {
  Branch,
  Customer,
  ModifierGroup,
  Product,
  ReceiptOrder,
  ValidatedPromotion,
} from "@/types/api";

export default function PosTerminalPageClient() {
  const { user, activeBranchId } = useAuth();
  const { data: branches = [] } = useBranches();
  const branchNameForReceipt =
    activeBranchId != null
      ? (branches as Branch[]).find((b) => b.id === activeBranchId)?.name
      : (user?.branch ?? "Branch");
  const { data: settings } = useSettings();
  const {
    data: productsData,
    isLoading: loading,
    isError: productsError,
    error: productsErr,
    refetch: refetchProducts,
    isFetching: productsFetching,
  } = useProducts();
  const products = filterActive<Product>((productsData || []) as Product[]);
  const [productSearch, setProductSearch] = useState("");
  const deferredProductSearch = useDeferredValue(productSearch.trim().toLowerCase());
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);

  const categories = useMemo(() => {
    const set = new Set<string>();
    for (const p of products) {
      if (p.category) set.add(p.category);
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [products]);

  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      const matchesCategory = !categoryFilter || p.category === categoryFilter;
      const q = deferredProductSearch;
      const matchesSearch =
        !q ||
        p.name.toLowerCase().includes(q) ||
        p.category.toLowerCase().includes(q);
      return matchesCategory && matchesSearch;
    });
  }, [products, categoryFilter, deferredProductSearch]);

  const [cart, setCart] = useState<PosCartItem[]>([]);
  const [showModifiers, setShowModifiers] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [selectedModifiers, setSelectedModifiers] = useState<Record<number, number>>({});
  const modifierCategory = resolveModifierCategory(selectedProduct?.category);
  const { data: modifierGroups = [] } = useModifiers(modifierCategory) as {
    data: ModifierGroup[];
  };

  const [showNumpad, setShowNumpad] = useState(false);
  const [customerPhone, setCustomerPhone] = useState("");
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [pointsToRedeem, setPointsToRedeem] = useState<number>(0);
  const [promoCode, setPromoCode] = useState("");
  const [appliedPromo, setAppliedPromo] = useState<ValidatedPromotion | null>(null);
  const [showCheckout, setShowCheckout] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<"CASH" | "CREDIT_CARD" | "QR_PROMPTPAY">(
    "CASH",
  );
  const [isTaxInvoiceRequested, setIsTaxInvoiceRequested] = useState(false);
  const [taxInvoiceName, setTaxInvoiceName] = useState("");
  const [taxInvoiceTaxId, setTaxInvoiceTaxId] = useState("");
  const [taxInvoiceAddress, setTaxInvoiceAddress] = useState("");
  const [showSuccess, setShowSuccess] = useState(false);
  const [completedOrder, setCompletedOrder] = useState<ReceiptOrder | null>(null);
  const [clientRequestId, setClientRequestId] = useState(() => crypto.randomUUID());
  const [hydratedBranchId, setHydratedBranchId] = useState<number | null>(null);
  const receiptRef = useRef<HTMLDivElement>(null);

  const updateCart = (updater: (prev: PosCartItem[]) => PosCartItem[]) => {
    setCart(updater);
    setClientRequestId(crypto.randomUUID());
  };

  const handlePrint = useReactToPrint({
    contentRef: receiptRef,
    documentTitle: `Receipt-${completedOrder?.id || "new"}`,
  });

  const createOrderMutation = useCreateOrder();
  const getCustomerMutation = useCustomerByPhone();
  const validatePromoMutation = useValidatePromotion();

  useEffect(() => {
    if (!activeBranchId) return;

    const saved = loadPosCart(activeBranchId);
    if (saved) {
      setCart(saved.cart);
      setCustomer(saved.customer);
      setCustomerPhone(saved.customerPhone);
      setPointsToRedeem(saved.pointsToRedeem);
      setPromoCode(saved.promoCode);
      setAppliedPromo(saved.appliedPromo);
      setClientRequestId(saved.clientRequestId);
      toast.info(
        `Restored ${countPosCartUnits(saved.cart)} item(s) from your unfinished order`,
      );
    } else {
      setCart([]);
      setCustomer(null);
      setCustomerPhone("");
      setPointsToRedeem(0);
      setPromoCode("");
      setAppliedPromo(null);
    }
    setHydratedBranchId(activeBranchId);
  }, [activeBranchId]);

  useEffect(() => {
    if (!activeBranchId || hydratedBranchId !== activeBranchId) return;
    savePosCart({
      branchId: activeBranchId,
      cart,
      customer,
      customerPhone,
      pointsToRedeem,
      promoCode,
      appliedPromo,
      clientRequestId,
      savedAt: Date.now(),
    });
  }, [
    activeBranchId,
    hydratedBranchId,
    cart,
    customer,
    customerPhone,
    pointsToRedeem,
    promoCode,
    appliedPromo,
    clientRequestId,
  ]);

  useEffect(() => {
    const anyDialogOpen =
      showCheckout || showModifiers || showNumpad || showSuccess;

    const handleHotkeys = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const isTyping =
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target?.isContentEditable;

      if (anyDialogOpen) return;

      if (event.key === "/" && !isTyping) {
        event.preventDefault();
        document.getElementById("pos-product-search")?.focus();
        return;
      }

      if (event.key === "Enter" && !isTyping && cart.length > 0) {
        event.preventDefault();
        setShowCheckout(true);
      }
    };

    window.addEventListener("keydown", handleHotkeys);
    return () => window.removeEventListener("keydown", handleHotkeys);
  }, [showCheckout, showModifiers, showNumpad, showSuccess, cart.length]);

  const addToCart = (
    product: Product,
    notes?: string,
    modifierOptionIds?: number[],
    unitPrice?: number,
  ) => {
    const price = unitPrice ?? toNumber(product.price);
    updateCart((prev) => {
      const existing = prev.find(
        (item) =>
          item.product.id === product.id &&
          item.notes === notes &&
          JSON.stringify(item.modifierOptionIds ?? []) ===
            JSON.stringify(modifierOptionIds ?? []),
      );
      if (existing) {
        return prev.map((item) =>
          item.id === existing.id ? { ...item, quantity: item.quantity + 1 } : item,
        );
      }
      return [
        ...prev,
        {
          id: Date.now().toString() + Math.random(),
          product,
          quantity: 1,
          notes,
          modifierOptionIds,
          unitPrice: price,
        },
      ];
    });
    setShowModifiers(false);
  };

  const handleProductClick = (product: Product) => {
    if (productNeedsModifiers(product)) {
      setSelectedProduct(product);
      setShowModifiers(true);
    } else {
      addToCart(product);
    }
  };

  useEffect(() => {
    if (!showModifiers || modifierGroups.length === 0) return;
    const defaults: Record<number, number> = {};
    for (const group of modifierGroups) {
      const def = group.options.find((o) => o.isDefault) ?? group.options[0];
      if (def) defaults[group.id] = def.id;
    }
    setSelectedModifiers(defaults);
  }, [showModifiers, selectedProduct?.id, modifierGroups]);

  const removeFromCart = (cartId: string) => {
    updateCart((prev) => prev.filter((item) => item.id !== cartId));
  };

  const adjustCartQuantity = (cartId: string, delta: number) => {
    updateCart((prev) =>
      prev
        .map((item) =>
          item.id === cartId ? { ...item, quantity: item.quantity + delta } : item,
        )
        .filter((item) => item.quantity > 0),
    );
  };

  const subtotal = cart.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);

  const promoDiscount = appliedPromo
    ? appliedPromo.type === "PERCENTAGE"
      ? subtotal * (appliedPromo.value / 100)
      : appliedPromo.value
    : 0;
  const pointsDiscount = pointsToDiscountAmount(pointsToRedeem);
  const totalDiscount = Math.min(promoDiscount + pointsDiscount, subtotal);
  const netTotal = subtotal - totalDiscount;
  const pointsEarned = customer ? Math.floor(netTotal / 100) : 0;

  const handleFindCustomer = async () => {
    if (!customerPhone) return;
    try {
      const data = await getCustomerMutation.mutateAsync(customerPhone);
      setCustomer(data);
      toast.success(`Found member: ${data.name}`);
    } catch {
      toast.error("Customer not found");
      setCustomer(null);
      setPointsToRedeem(0);
    }
  };

  const handleApplyPromo = async () => {
    if (!promoCode) return;
    try {
      const data = await validatePromoMutation.mutateAsync({ code: promoCode, subtotal });
      setAppliedPromo(data);
      toast.success("Promotion applied!");
    } catch (err: unknown) {
      if (err instanceof Error) toast.error(err.message);
      setAppliedPromo(null);
    }
  };

  const handleClearCRM = () => {
    setCustomer(null);
    setCustomerPhone("");
    setPointsToRedeem(0);
  };

  const handleCheckout = async () => {
    if (cart.length === 0) return;
    if (!activeBranchId) {
      toast.error("Please select a branch first.");
      return;
    }

    try {
      const items = cart.map((item) => ({
        productId: item.product.id,
        quantity: item.quantity,
        ...(item.notes ? { notes: item.notes } : {}),
        ...(item.modifierOptionIds?.length
          ? { modifierOptionIds: item.modifierOptionIds }
          : {}),
      }));
      const orderData = await createOrderMutation.mutateAsync({
        branchId: activeBranchId,
        items,
        customerPhone: customer?.phone,
        promotionCode: appliedPromo?.code,
        pointsToRedeem: pointsToRedeem > 0 ? pointsToRedeem : undefined,
        paymentMethod,
        isTaxInvoiceRequested,
        taxInvoiceName: isTaxInvoiceRequested ? taxInvoiceName : undefined,
        taxInvoiceTaxId: isTaxInvoiceRequested ? taxInvoiceTaxId : undefined,
        taxInvoiceAddress: isTaxInvoiceRequested ? taxInvoiceAddress : undefined,
        clientRequestId,
      });

      toast.success("Order completed successfully!");
      clearPosCart();
      setCompletedOrder(toReceiptOrder(orderData, user?.name ?? undefined));
      setShowSuccess(true);
      setClientRequestId(crypto.randomUUID());
      setCart([]);
      handleClearCRM();
      setAppliedPromo(null);
      setPromoCode("");
      setShowCheckout(false);
      setPaymentMethod("CASH");
      setIsTaxInvoiceRequested(false);
      setTaxInvoiceName("");
      setTaxInvoiceTaxId("");
      setTaxInvoiceAddress("");
    } catch (err: unknown) {
      if (err instanceof Error) toast.error("Checkout failed: " + err.message);
    }
  };

  const handleAddWithModifiers = () => {
    if (!selectedProduct) return;
    const summary = getModifierSummary(modifierGroups, selectedModifiers);
    const optionIds = Object.values(selectedModifiers);
    const extra = getModifierExtra(modifierGroups, selectedModifiers);
    addToCart(
      selectedProduct,
      summary || undefined,
      optionIds.length ? optionIds : undefined,
      toNumber(selectedProduct.price) + extra,
    );
  };

  if (!activeBranchId) {
    return (
      <BranchEmptyState description="Select a branch in the top bar to process sales at the POS terminal." />
    );
  }

  const cartProps = {
    cart,
    customer,
    pointsToRedeem,
    onPointsToRedeemChange: setPointsToRedeem,
    onFindMember: () => setShowNumpad(true),
    onClearCustomer: handleClearCRM,
    promoCode,
    onPromoCodeChange: setPromoCode,
    appliedPromo,
    onApplyPromo: () => void handleApplyPromo(),
    onClearPromo: () => setAppliedPromo(null),
    subtotal,
    totalDiscount,
    netTotal,
    pointsEarned,
    onAdjustQuantity: adjustCartQuantity,
    onRemoveItem: removeFromCart,
    onCheckout: () => setShowCheckout(true),
  };

  return (
    <div className="flex h-full flex-col lg:flex-row gap-4 lg:gap-5 w-full min-h-0">
      <PosProductCatalog
        productsError={productsError}
        productsErr={productsErr}
        productsFetching={productsFetching}
        onRetry={() => void refetchProducts()}
        productSearch={productSearch}
        onProductSearchChange={setProductSearch}
        categories={categories}
        categoryFilter={categoryFilter}
        onCategoryFilterChange={setCategoryFilter}
        loading={loading}
        filteredProducts={filteredProducts}
        totalProducts={products.length}
        onProductClick={handleProductClick}
      />

      <div className="hidden lg:flex lg:h-full lg:min-h-0 lg:max-h-full lg:shrink-0 lg:self-stretch">
        <PosCartSidebar {...cartProps} className="h-full" />
      </div>

      <PosMobileCart {...cartProps} />

      <PosCheckoutDialog
        open={showCheckout}
        onOpenChange={setShowCheckout}
        netTotal={netTotal}
        paymentMethod={paymentMethod}
        onPaymentMethodChange={setPaymentMethod}
        isTaxInvoiceRequested={isTaxInvoiceRequested}
        onTaxInvoiceRequestedChange={setIsTaxInvoiceRequested}
        taxInvoiceName={taxInvoiceName}
        onTaxInvoiceNameChange={setTaxInvoiceName}
        taxInvoiceTaxId={taxInvoiceTaxId}
        onTaxInvoiceTaxIdChange={setTaxInvoiceTaxId}
        taxInvoiceAddress={taxInvoiceAddress}
        onTaxInvoiceAddressChange={setTaxInvoiceAddress}
        isProcessing={createOrderMutation.isPending}
        onConfirm={() => void handleCheckout()}
      />

      <PosOrderSuccessDialog
        open={showSuccess}
        onOpenChange={setShowSuccess}
        completedOrder={completedOrder}
        receiptRef={receiptRef}
        branchName={branchNameForReceipt ?? "Branch"}
        settings={settings}
        onPrint={() => handlePrint()}
      />

      <PosModifierDialog
        open={showModifiers}
        onOpenChange={setShowModifiers}
        product={selectedProduct}
        modifierGroups={modifierGroups}
        selectedModifiers={selectedModifiers}
        onSelectModifier={(groupId, optionId) =>
          setSelectedModifiers((prev) => ({ ...prev, [groupId]: optionId }))
        }
        onAddToCart={handleAddWithModifiers}
      />

      <PosCustomerLookupDialog
        open={showNumpad}
        onOpenChange={setShowNumpad}
        phone={customerPhone}
        onPhoneChange={setCustomerPhone}
        onSubmit={() => void handleFindCustomer()}
      />
    </div>
  );
}
