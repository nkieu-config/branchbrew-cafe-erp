"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { FormDialog } from "@/components/shared/form-modal";
import { Button } from "@/components/ui/button";
import {
  FormField,
  FormFieldControl,
  FormFieldError,
  FormFieldLabel,
  FormFieldSelectTrigger,
} from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectValue,
} from "@/components/ui/select";
import type { Ingredient } from "@/types/api";
import { formFieldInvalidClassName } from "@/lib/theme/color-helpers";
import { infoBannerClassName, infoBannerTextClassName } from "@/lib/theme/hub-banners";
import { hubCtaClassName, inlineLinkClassName } from "@/lib/theme/hub-primitives";
import { kitchenDialogContentClassName } from "@/lib/theme/hub-kitchen";
import { formFieldInsetClassName, formLineDateFieldClassName, formSelectContentClassName } from "@/lib/theme/stock";
import { text } from "@/lib/theme/surface";
import { cn } from "@/lib/utils";

type CreateProductionOrderModalProps = {
  open: boolean;
  onClose: () => void;
  ingredients: Ingredient[];
  loadingIngredients?: boolean;
  bomTargetIds: Set<number>;
  onSubmit: (payload: {
    targetIngredientId: number;
    quantityToProduce: number;
    plannedStartDate: string;
  }) => Promise<void>;
  isSubmitting?: boolean;
};

export function CreateProductionOrderModal({
  open,
  onClose,
  ingredients,
  loadingIngredients = false,
  bomTargetIds,
  onSubmit,
  isSubmitting = false,
}: CreateProductionOrderModalProps) {
  const [targetId, setTargetId] = useState<string>("");
  const [quantity, setQuantity] = useState("1");
  const [plannedDate, setPlannedDate] = useState("");
  const [fieldErrors, setFieldErrors] = useState<{
    target?: string;
    quantity?: string;
    plannedDate?: string;
  }>({});

  const clearFieldError = (field: "target" | "quantity" | "plannedDate") => {
    setFieldErrors((prev) => {
      if (!prev[field]) return prev;
      const next = { ...prev };
      delete next[field];
      return next;
    });
  };

  useEffect(() => {
    if (!open) return;
    setFieldErrors({});
  }, [open]);

  const targetIngredientId = targetId ? Number(targetId) : 0;
  const missingBom = targetIngredientId > 0 && !bomTargetIds.has(targetIngredientId);

  const handleSubmit = async () => {
    const quantityToProduce = Number(quantity);

    const errors: { target?: string; quantity?: string; plannedDate?: string } = {};
    if (!targetIngredientId) errors.target = "Select a target product";
    if (!Number.isFinite(quantityToProduce) || quantityToProduce <= 0)
      errors.quantity = "Quantity must be greater than zero";
    if (!plannedDate) errors.plannedDate = "Planned date is required";
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }

    await onSubmit({
      targetIngredientId,
      quantityToProduce,
      plannedStartDate: new Date(plannedDate).toISOString(),
    });
  };

  return (
    <FormDialog
      busy={isSubmitting}
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
      className={kitchenDialogContentClassName()}
    >
        <FormDialog.Title>New order</FormDialog.Title>

        <FormDialog.Body className="space-y-4 pt-1">
          <FormField id="po-target" error={fieldErrors.target} className="space-y-2">
            <FormFieldLabel className={text.secondary}>Target product</FormFieldLabel>
            {ingredients.length === 0 ? (
              <p className={cn("text-sm", text.muted)}>
                No ingredients yet —{" "}
                <Link href="/products/ingredients" className={inlineLinkClassName()}>
                  add ingredients
                </Link>
              </p>
            ) : (
              <Select
                value={targetId}
                onValueChange={(value) => {
                  if (value == null) return;
                  setTargetId(value);
                  clearFieldError("target");
                }}
              >
                <FormFieldSelectTrigger
                  className={formFieldInsetClassName("w-full")}
                  loading={loadingIngredients}
                >
                  <SelectValue
                    placeholder={loadingIngredients ? "Loading products…" : "Select product"}
                  />
                </FormFieldSelectTrigger>
                <SelectContent className={formSelectContentClassName()}>
                  {ingredients.map((ingredient) => (
                    <SelectItem key={ingredient.id} value={String(ingredient.id)}>
                      {ingredient.name} ({ingredient.unit})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <FormFieldError />
          </FormField>

          {missingBom && (
            <div className={infoBannerClassName("py-3")}>
              <p className={infoBannerTextClassName()}>
                No BOM for this target —{" "}
                <Link href="/kitchen/boms" className={inlineLinkClassName()}>
                  define one
                </Link>{" "}
                before completing.
              </p>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormField id="po-quantity" error={fieldErrors.quantity} className="space-y-2">
              <FormFieldLabel className={text.secondary}>Quantity</FormFieldLabel>
              <FormFieldControl>
                <Input
                  type="number"
                  min={1}
                  step={1}
                  value={quantity}
                  onChange={(event) => {
                    setQuantity(event.target.value);
                    clearFieldError("quantity");
                  }}
                  className={formFieldInsetClassName(
                    formFieldInvalidClassName(!!fieldErrors.quantity),
                  )}
                />
              </FormFieldControl>
              <FormFieldError />
            </FormField>
            <FormField id="po-date" error={fieldErrors.plannedDate} className="space-y-2">
              <FormFieldLabel className={text.secondary}>Planned date</FormFieldLabel>
              <FormFieldControl>
                <Input
                  type="date"
                  value={plannedDate}
                  onChange={(event) => {
                    setPlannedDate(event.target.value);
                    clearFieldError("plannedDate");
                  }}
                  className={formLineDateFieldClassName(
                    formFieldInvalidClassName(!!fieldErrors.plannedDate),
                  )}
                />
              </FormFieldControl>
              <FormFieldError />
            </FormField>
          </div>
        </FormDialog.Body>

        <FormDialog.Footer className="gap-2 sm:gap-0">
          <Button type="button" variant="outline" disabled={isSubmitting} onClick={onClose} className="min-h-[44px]">
            Cancel
          </Button>
          <Button
            type="button"
            disabled={isSubmitting || ingredients.length === 0}
            className={cn("min-h-[44px]", hubCtaClassName("kitchen"))}
            onClick={() => void handleSubmit()}
          >
            {isSubmitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" aria-hidden />}
            Create
          </Button>
        </FormDialog.Footer>
    </FormDialog>
  );
}
