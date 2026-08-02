"use client";

import { useEffect, useState } from "react";
import { Loader2, MinusCircle, Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  FormField,
  FormFieldError,
  FormFieldLabel,
  FormFieldSelectTrigger,
} from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { FormEmptyIngredientsBanner } from "@/components/shared/form-panel";
import { FormDialog, FormModalFooter } from "@/components/shared/form-modal";
import { StatusBadge } from "@/components/shared/status-badge";
import { useCreateProductionBOM } from "@/hooks/domains/useAccountingQueries";
import { useLineItemRows } from "@/hooks/useLineItemRows";
import { getErrorMessage } from "@/lib/errors";
import type { Ingredient } from "@/types/api";
import { formSectionClassName, hubCtaClassName } from "@/lib/theme/hub-primitives";
import { kitchenDialogContentClassName } from "@/lib/theme/hub-kitchen";
import { formFieldInsetClassName, formLineQtyFieldClassName, formLineRowClassName, formRemoveButtonClassName, formSelectContentClassName } from "@/lib/theme/stock";
import { text } from "@/lib/theme/surface";
import { cn } from "@/lib/utils";

type RawLineDraft = {
  rowId: string;
  rawIngredientId: number;
  quantityNeeded: string;
};

type BOMFormModalProps = {
  isOpen: boolean;
  onClose: () => void;
  ingredients: Ingredient[];
  loadingIngredients?: boolean;
};

function emptyLine(): RawLineDraft {
  return {
    rowId: crypto.randomUUID(),
    rawIngredientId: 0,
    quantityNeeded: "",
  };
}

function isLineDirty(line: RawLineDraft) {
  return line.rawIngredientId > 0 || line.quantityNeeded.trim().length > 0;
}

export function BOMFormModal({
  isOpen,
  onClose,
  ingredients,
  loadingIngredients = false,
}: BOMFormModalProps) {
  const [targetId, setTargetId] = useState<string>("");
  const [fieldErrors, setFieldErrors] = useState<{ target?: string }>({});
  const createMutation = useCreateProductionBOM();

  const clearFieldError = (field: "target") => {
    setFieldErrors((prev) => {
      if (!prev[field]) return prev;
      const next = { ...prev };
      delete next[field];
      return next;
    });
  };

  const {
    items: lines,
    addRow,
    removeRow,
    updateRow,
    resetRows,
    duplicateKeys,
  } = useLineItemRows({
    createEmpty: emptyLine,
    isDirty: isLineDirty,
    duplicateKey: (line) => line.rawIngredientId,
  });

  useEffect(() => {
    if (!isOpen) return;
    setTargetId("");
    setFieldErrors({});
    resetRows();
  }, [isOpen, resetRows]);

  const handleCreate = async () => {
    const targetIngredientId = targetId ? Number(targetId) : 0;
    if (!targetIngredientId) {
      setFieldErrors({ target: "Select a target product" });
      return;
    }

    if (duplicateKeys.size > 0) {
      toast.error("Each raw ingredient can only appear once. Remove duplicate rows.");
      return;
    }

    const rawIngredients = lines
      .filter((line) => line.rawIngredientId > 0)
      .map((line) => ({
        rawIngredientId: line.rawIngredientId,
        quantityNeeded: Number(line.quantityNeeded),
      }))
      .filter((line) => line.quantityNeeded > 0);

    if (rawIngredients.length === 0) {
      toast.error("Add at least one raw ingredient line");
      return;
    }

    try {
      await Promise.all(
        rawIngredients.map((item) =>
          createMutation.mutateAsync({
            targetIngredientId,
            rawIngredientId: item.rawIngredientId,
            quantityNeeded: item.quantityNeeded,
          }),
        ),
      );
      toast.success("Production BOM saved");
      onClose();
    } catch (error: unknown) {
      toast.error(getErrorMessage(error, "Failed to save BOM"));
    }
  };

  const formDisabled = ingredients.length === 0;
  const submitDisabled = createMutation.isPending || formDisabled || duplicateKeys.size > 0;

  return (
    <FormDialog
      busy={createMutation.isPending}
      open={isOpen}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
      className={kitchenDialogContentClassName("sm:max-w-2xl")}
    >
        <FormDialog.Title>New BOM</FormDialog.Title>

        <FormDialog.Body className="space-y-4 pt-1">
          <FormField id="bom-target" error={fieldErrors.target} className="space-y-2">
            <FormFieldLabel className={text.secondary}>Target product</FormFieldLabel>
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
            <FormFieldError />
          </FormField>

          <div className={formSectionClassName()}>
            {ingredients.length === 0 && !loadingIngredients ? (
              <FormEmptyIngredientsBanner />
            ) : (
              <>
                <div className="space-y-3">
                  {lines.map((line, idx) => {
                    const isDuplicate =
                      line.rawIngredientId > 0 && duplicateKeys.has(line.rawIngredientId);
                    return (
                      <div key={line.rowId} className={formLineRowClassName()}>
                        <div className="grid grid-cols-1 sm:grid-cols-[1fr_8rem_auto] gap-3 items-end flex-1">
                          <div className="space-y-2">
                            <Label className={cn("text-xs", text.secondary)}>Raw ingredient</Label>
                            <Select
                              value={line.rawIngredientId > 0 ? String(line.rawIngredientId) : undefined}
                              onValueChange={(value) =>
                                value != null && updateRow(idx, "rawIngredientId", Number(value))
                              }
                            >
                              <SelectTrigger
                                className={formFieldInsetClassName("w-full")}
                                loading={loadingIngredients}
                              >
                                <SelectValue
                                  placeholder={
                                    loadingIngredients
                                      ? "Loading ingredients…"
                                      : "Select ingredient"
                                  }
                                />
                              </SelectTrigger>
                              <SelectContent className={formSelectContentClassName()}>
                                {ingredients.map((ingredient) => (
                                  <SelectItem key={ingredient.id} value={String(ingredient.id)}>
                                    {ingredient.name} ({ingredient.unit})
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            {isDuplicate ? (
                              <StatusBadge tone="warning" className="mt-1 w-fit">
                                Duplicate row
                              </StatusBadge>
                            ) : null}
                          </div>
                          <div className="space-y-2">
                            <Label className={cn("text-xs", text.secondary)}>Qty</Label>
                            <Input
                              type="number"
                              min={0.01}
                              step={0.01}
                              value={line.quantityNeeded}
                              onChange={(event) =>
                                updateRow(idx, "quantityNeeded", event.target.value)
                              }
                              className={formLineQtyFieldClassName()}
                              placeholder="0"
                            />
                          </div>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className={cn(formRemoveButtonClassName(), "min-h-[44px] min-w-[44px]")}
                            aria-label="Remove raw ingredient line"
                            onClick={() => removeRow(idx)}
                            disabled={lines.length === 1}
                          >
                            <MinusCircle className="w-4 h-4" aria-hidden />
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
                <Button
                  type="button"
                  variant="outline"
                  className="mt-4 w-full min-h-[44px] border-dashed font-medium"
                  onClick={addRow}
                >
                  <Plus className="w-4 h-4 mr-2" aria-hidden />
                  Add line
                </Button>
              </>
            )}
          </div>
        </FormDialog.Body>

        <FormModalFooter>
          <Button type="button" variant="outline" disabled={createMutation.isPending} onClick={onClose} className="min-h-[44px]">
            Cancel
          </Button>
          <Button
            type="button"
            disabled={submitDisabled}
            className={cn("min-h-[44px]", hubCtaClassName("kitchen"))}
            onClick={() => void handleCreate()}
          >
            {createMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" aria-hidden />}
            Save
          </Button>
        </FormModalFooter>
    </FormDialog>
  );
}
