"use client";

import { useState, useEffect, useCallback } from "react";
import { FormDialog } from "@/components/shared/form-modal";
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
  useCreateIngredient,
  useUpdateIngredient,
} from "@/hooks/domains/useProductQueries";
import { useSuppliers } from "@/hooks/domains/useProcurementQueries";
import { toast } from "sonner";
import type { Ingredient, Supplier } from "@/types/api";
import { getErrorMessage } from "@/lib/errors";
import { formFieldInvalidClassName, tableRowDividerClassName } from "@/lib/theme/color-helpers";
import { hubCtaClassName } from "@/lib/theme/hub-primitives";
import { productsDialogContentClassName } from "@/lib/theme/hub-products";
import { formFieldInsetClassName, formSelectContentClassName } from "@/lib/theme/stock";
import { text } from "@/lib/theme/surface";
import { cn } from "@/lib/utils";

export function IngredientFormModal({
  isOpen,
  onClose,
  ingredient,
}: {
  isOpen: boolean;
  onClose: () => void;
  ingredient?: Ingredient;
}) {
  const [name, setName] = useState("");
  const [unit, setUnit] = useState("");
  const [costPerUnit, setCostPerUnit] = useState<number | "">("");
  const [primarySupplierId, setPrimarySupplierId] = useState<string>("");
  const [isActive, setIsActive] = useState(true);
  const [fieldErrors, setFieldErrors] = useState<{ name?: string; unit?: string }>({});

  const clearFieldError = (field: "name" | "unit") => {
    setFieldErrors((prev) => {
      if (!prev[field]) return prev;
      const next = { ...prev };
      delete next[field];
      return next;
    });
  };

  const { data: suppliers = [], isPending: loadingSuppliers } = useSuppliers();
  const createMutation = useCreateIngredient();
  const updateMutation = useUpdateIngredient();
  const isSaving = createMutation.isPending || updateMutation.isPending;

  const resetForm = useCallback(() => {
    setName("");
    setUnit("");
    setCostPerUnit("");
    setPrimarySupplierId("");
    setIsActive(true);
    setFieldErrors({});
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    if (ingredient) {
      setName(ingredient.name);
      setUnit(ingredient.unit);
      setCostPerUnit(ingredient.costPerUnit ?? "");
      setPrimarySupplierId(
        ingredient.primarySupplierId ? String(ingredient.primarySupplierId) : "",
      );
      setIsActive(ingredient.isActive ?? true);
    } else {
      resetForm();
    }
  }, [ingredient, isOpen, resetForm]);

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const handleSubmit = async () => {
    const errors: { name?: string; unit?: string } = {};
    if (!name.trim()) errors.name = "Name is required";
    if (!unit.trim()) errors.unit = "Unit is required";
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }

    const payload = {
      name: name.trim(),
      unit: unit.trim(),
      costPerUnit: costPerUnit === "" ? 0 : Number(costPerUnit),
      isActive,
      ...(primarySupplierId
        ? { primarySupplierId: Number(primarySupplierId) }
        : {}),
    };

    try {
      if (ingredient) {
        await updateMutation.mutateAsync({ id: ingredient.id, ...payload });
        toast.success("Ingredient updated");
      } else {
        await createMutation.mutateAsync(payload);
        toast.success("Ingredient created");
      }
      handleClose();
    } catch (err: unknown) {
      toast.error(getErrorMessage(err, "Failed to save ingredient"));
    }
  };

  return (
    <FormDialog
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) handleClose();
      }}
      className={productsDialogContentClassName()}
    >
        <FormDialog.Title>{ingredient ? "Edit ingredient" : "New ingredient"}</FormDialog.Title>

        <FormDialog.Body className="space-y-4 py-2">
          <FormField id="ingredient-name" error={fieldErrors.name} className="space-y-2">
            <FormFieldLabel className={text.secondary}>Name</FormFieldLabel>
            <FormFieldControl>
              <Input
                placeholder="e.g. Arabica Beans"
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
            <FormField id="ingredient-unit" error={fieldErrors.unit} className="space-y-2">
              <FormFieldLabel className={text.secondary}>Unit of Measurement</FormFieldLabel>
              <FormFieldControl>
                <Input
                  placeholder="e.g. g, ml, pcs"
                  value={unit}
                  onChange={(e) => {
                    setUnit(e.target.value);
                    clearFieldError("unit");
                  }}
                  className={formFieldInsetClassName(formFieldInvalidClassName(!!fieldErrors.unit))}
                />
              </FormFieldControl>
              <FormFieldError />
            </FormField>
            <div className="space-y-2">
              <Label htmlFor="ingredient-cost" className={text.secondary}>
                Estimated Cost per Unit
              </Label>
              <Input
                id="ingredient-cost"
                type="number"
                min="0"
                step="0.01"
                placeholder="e.g. 0.50"
                value={costPerUnit}
                onChange={(e) =>
                  setCostPerUnit(e.target.value === "" ? "" : Number(e.target.value))
                }
                className={formFieldInsetClassName()}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="ingredient-supplier" className={text.secondary}>
              Primary Supplier (Optional)
            </Label>
            <Select
              value={primarySupplierId || "none"}
              items={[
                { value: "none", label: "None" },
                ...(suppliers as Supplier[]).map((supplier) => ({
                  value: String(supplier.id),
                  label: supplier.name,
                })),
              ]}
              onValueChange={(value) => {
                if (value == null) return;
                setPrimarySupplierId(value === "none" ? "" : value);
              }}
            >
              <SelectTrigger
                id="ingredient-supplier"
                className={formFieldInsetClassName("w-full")}
                loading={loadingSuppliers}
              >
                <SelectValue
                  placeholder={loadingSuppliers ? "Loading suppliers…" : "Select supplier…"}
                />
              </SelectTrigger>
              <SelectContent className={formSelectContentClassName()}>
                <SelectItem value="none">None</SelectItem>
                {(suppliers as Supplier[]).map((supplier) => (
                  <SelectItem key={supplier.id} value={String(supplier.id)}>
                    {supplier.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className={cn("flex items-center justify-between gap-3 pt-2 border-t", tableRowDividerClassName())}>
            <Label htmlFor="isActiveIngredient" className={cn("cursor-pointer", text.secondary)}>
              Active (available for recipes and POs)
            </Label>
            <Switch
              id="isActiveIngredient"
              checked={isActive}
              onCheckedChange={setIsActive}
              aria-label="Toggle ingredient active status"
            />
          </div>
        </FormDialog.Body>

        <FormDialog.Footer className="gap-2">
          <Button type="button" variant="outline" onClick={handleClose} disabled={isSaving}>
            Cancel
          </Button>
          <Button
            type="button"
            onClick={() => void handleSubmit()}
            className={hubCtaClassName("products")}
            disabled={isSaving}
          >
            {isSaving ? "Saving…" : "Save Ingredient"}
          </Button>
        </FormDialog.Footer>
    </FormDialog>
  );
}
