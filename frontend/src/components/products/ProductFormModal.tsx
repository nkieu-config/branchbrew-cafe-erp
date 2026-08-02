"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import {
  FormField,
  FormFieldControl,
  FormFieldError,
  FormFieldLabel,
} from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  useCreateProduct,
  useUpdateProduct,
  useIngredients,
} from "@/hooks/domains/useProductQueries";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";
import type { Product, Ingredient } from "@/types/api";
import { getErrorMessage } from "@/lib/errors";
import { FormDialog, FormModalFooter } from "@/components/shared/form-modal";
import { StatusBadge } from "@/components/shared/status-badge";
import { useLineItemRows } from "@/hooks/useLineItemRows";
import { formFieldInvalidClassName, tableRowDividerClassName } from "@/lib/theme/color-helpers";
import { formSectionClassName, hubCtaClassName } from "@/lib/theme/hub-primitives";
import { productsDialogContentClassName } from "@/lib/theme/hub-products";
import { formFieldInsetClassName, formRemoveButtonClassName, formSelectContentClassName } from "@/lib/theme/stock";
import { text } from "@/lib/theme/surface";
import { cn } from "@/lib/utils";

type RecipeRow = {
  rowId: string;
  ingredientId: number;
  quantity: number;
};

function newRecipeRow(): RecipeRow {
  return { rowId: crypto.randomUUID(), ingredientId: 0, quantity: 1 };
}

function mapProductRecipe(product: Product): RecipeRow[] {
  return (
    product.recipeItems?.map((ri) => ({
      rowId: crypto.randomUUID(),
      ingredientId: ri.ingredientId,
      quantity: ri.quantity,
    })) ?? []
  );
}

export function ProductFormModal({
  isOpen,
  onClose,
  product,
}: {
  isOpen: boolean;
  onClose: () => void;
  product?: Product;
}) {
  const [name, setName] = useState("");
  const [category, setCategory] = useState("");
  const [price, setPrice] = useState<number | "">("");
  const [isActive, setIsActive] = useState(true);
  const [fieldErrors, setFieldErrors] = useState<{
    name?: string;
    category?: string;
    price?: string;
  }>({});

  const clearFieldError = (field: "name" | "category" | "price") => {
    setFieldErrors((prev) => {
      if (!prev[field]) return prev;
      const next = { ...prev };
      delete next[field];
      return next;
    });
  };

  const {
    items: recipeItems,
    setItems: setRecipeItems,
    addRow: handleAddRecipeItem,
    removeRow: handleRemoveRecipeItem,
    updateRow: handleRecipeItemChange,
    resetRows: resetRecipeRows,
    duplicateKeys: duplicateIngredientIds,
  } = useLineItemRows({
    createEmpty: newRecipeRow,
    duplicateKey: (item) => item.ingredientId,
    minRows: 0,
  });

  const { data: ingredientsData, isPending: loadingIngredients } = useIngredients();
  const ingredients = ingredientsData || [];

  const createMutation = useCreateProduct();
  const updateMutation = useUpdateProduct();
  const isSaving = createMutation.isPending || updateMutation.isPending;

  const resetForm = useCallback(() => {
    setName("");
    setCategory("");
    setPrice("");
    setIsActive(true);
    setFieldErrors({});
    resetRecipeRows();
  }, [resetRecipeRows]);

  useEffect(() => {
    if (!isOpen) return;
    if (product) {
      setName(product.name);
      setCategory(product.category);
      setPrice(product.price);
      setIsActive(product.isActive ?? true);
      setRecipeItems(mapProductRecipe(product));
    } else {
      resetForm();
    }
  }, [product, isOpen, resetForm, setRecipeItems]);

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const handleSubmit = async () => {
    const errors: { name?: string; category?: string; price?: string } = {};
    if (!name.trim()) errors.name = "Name is required";
    if (!category.trim()) errors.category = "Category is required";
    if (price === "") errors.price = "Price is required";
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }

    if (duplicateIngredientIds.size > 0) {
      toast.error("Each ingredient can only appear once in the menu recipe");
      return;
    }

    const validRecipeItems = recipeItems
      .filter((r) => r.ingredientId > 0 && r.quantity > 0)
      .map(({ ingredientId, quantity }) => ({ ingredientId, quantity }));

    const payload = {
      name: name.trim(),
      category: category.trim(),
      price: Number(price),
      isActive,
      recipeItems: validRecipeItems.length > 0 ? validRecipeItems : undefined,
    };

    try {
      if (product) {
        await updateMutation.mutateAsync({
          id: product.id,
          ...payload,
        } as Parameters<typeof updateMutation.mutateAsync>[0]);
        toast.success("Menu item updated");
      } else {
        await createMutation.mutateAsync(payload);
        toast.success("Menu item created");
      }
      handleClose();
    } catch (err: unknown) {
      toast.error(getErrorMessage(err, "Failed to save menu item"));
    }
  };

  return (
    <FormDialog
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) handleClose();
      }}
      className={productsDialogContentClassName("max-w-[600px]")}
    >
        <FormDialog.Title>{product ? "Edit item" : "New item"}</FormDialog.Title>

        <FormDialog.Body className="space-y-6 py-2">
          <div className={formSectionClassName("mb-0 space-y-4")}>
            <FormField id="product-name" error={fieldErrors.name} className="space-y-2">
              <FormFieldLabel className={text.secondary}>Name</FormFieldLabel>
              <FormFieldControl>
                <Input
                  placeholder="e.g. Iced Latte"
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value);
                    clearFieldError("name");
                  }}
                  className={formFieldInsetClassName(formFieldInvalidClassName(!!fieldErrors.name))}
                />
              </FormFieldControl>
              <FormFieldError />
            </FormField>
            <div className="grid grid-cols-2 gap-4">
              <FormField
                id="product-category"
                error={fieldErrors.category}
                className="space-y-2"
              >
                <FormFieldLabel className={text.secondary}>Category</FormFieldLabel>
                <FormFieldControl>
                  <Input
                    placeholder="e.g. Coffee"
                    value={category}
                    onChange={(e) => {
                      setCategory(e.target.value);
                      clearFieldError("category");
                    }}
                    className={formFieldInsetClassName(
                      formFieldInvalidClassName(!!fieldErrors.category),
                    )}
                  />
                </FormFieldControl>
                <FormFieldError />
              </FormField>
              <FormField id="product-price" error={fieldErrors.price} className="space-y-2">
                <FormFieldLabel className={text.secondary}>Price</FormFieldLabel>
                <FormFieldControl>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="e.g. 85"
                    value={price}
                    onChange={(e) => {
                      setPrice(e.target.value === "" ? "" : Number(e.target.value));
                      clearFieldError("price");
                    }}
                    className={formFieldInsetClassName(
                      formFieldInvalidClassName(!!fieldErrors.price),
                    )}
                  />
                </FormFieldControl>
                <FormFieldError />
              </FormField>
            </div>
            <div className={cn("flex items-center justify-between gap-3 pt-2 border-t", tableRowDividerClassName())}>
              <Label htmlFor="isActiveProduct" className={cn("cursor-pointer", text.secondary)}>
                Active on POS
              </Label>
              <Switch
                id="isActiveProduct"
                checked={isActive}
                onCheckedChange={setIsActive}
                aria-label="Toggle menu item active status"
              />
            </div>
          </div>

          <div className={formSectionClassName("mb-0 space-y-4")}>
            <div className="flex justify-between items-center">
              <h3 className={cn("text-sm font-medium", text.muted)}>Recipe</h3>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleAddRecipeItem}
                className="h-9"
              >
                <Plus className="w-4 h-4 mr-1" aria-hidden />
                Add
              </Button>
            </div>

            {recipeItems.length === 0 ? (
              <p className={cn("text-sm", text.muted)}>
                No recipe — inventory won&apos;t deduct on sale.
              </p>
            ) : (
              <div className="space-y-3">
                {recipeItems.map((item, idx) => {
                  const isDuplicate =
                    item.ingredientId > 0 && duplicateIngredientIds.has(item.ingredientId);
                  return (
                    <div key={item.rowId} className="flex items-end gap-3">
                      <div className="flex-1 space-y-1">
                        <Label
                          htmlFor={`recipe-ingredient-${item.rowId}`}
                          className={cn("text-xs", text.secondary)}
                        >
                          Ingredient
                        </Label>
                        <Select
                          value={item.ingredientId === 0 ? "" : String(item.ingredientId)}
                          onValueChange={(value) => {
                            if (value != null) {
                              handleRecipeItemChange(idx, "ingredientId", Number(value));
                            }
                          }}
                        >
                          <SelectTrigger
                            id={`recipe-ingredient-${item.rowId}`}
                            className={formFieldInsetClassName(
                              formFieldInsetClassName(formFieldInvalidClassName(isDuplicate)),
                            )}
                            aria-invalid={isDuplicate}
                            loading={loadingIngredients}
                          >
                            <SelectValue
                              placeholder={
                                loadingIngredients ? "Loading ingredients…" : "Select ingredient…"
                              }
                            />
                          </SelectTrigger>
                          <SelectContent className={formSelectContentClassName()}>
                            {ingredients.map((ing: Ingredient) => (
                              <SelectItem key={ing.id} value={String(ing.id)}>
                                {ing.name} ({ing.unit})
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        {isDuplicate ? (
                          <StatusBadge tone="warning" className="mt-1 w-fit">
                            Duplicate ingredient — combine into one row
                          </StatusBadge>
                        ) : null}
                      </div>
                      <div className="w-28 space-y-1">
                        <Label
                          htmlFor={`recipe-qty-${item.rowId}`}
                          className={cn("text-xs", text.secondary)}
                        >
                          Quantity
                        </Label>
                        <Input
                          id={`recipe-qty-${item.rowId}`}
                          type="number"
                          min="0.01"
                          step="0.01"
                          value={item.quantity}
                          onChange={(e) =>
                            handleRecipeItemChange(idx, "quantity", Number(e.target.value))
                          }
                          className={formFieldInsetClassName()}
                        />
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className={cn(formRemoveButtonClassName(), "h-11 w-11 shrink-0")}
                        onClick={() => handleRemoveRecipeItem(idx)}
                        aria-label="Remove recipe line"
                      >
                        <Trash2 className="w-4 h-4" aria-hidden />
                      </Button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </FormDialog.Body>

        <FormModalFooter>
          <Button type="button" variant="outline" onClick={handleClose} disabled={isSaving}>
            Cancel
          </Button>
          <Button
            type="button"
            onClick={() => void handleSubmit()}
            className={hubCtaClassName("products")}
            disabled={isSaving || duplicateIngredientIds.size > 0}
          >
            {isSaving ? "Saving…" : "Save Menu Item"}
          </Button>
        </FormModalFooter>
    </FormDialog>
  );
}
