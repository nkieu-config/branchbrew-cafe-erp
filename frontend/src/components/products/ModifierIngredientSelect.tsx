"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useIngredients } from "@/hooks/domains/useProductQueries";
import { formFieldInsetClassName, formSelectContentClassName } from "@/lib/theme/stock";
import type { Ingredient } from "@/types/api";

export const MODIFIER_EMPTY_INGREDIENT = "__none__";

export function ModifierIngredientSelect({
  value,
  onChange,
  placeholder,
  allowEmpty = true,
  id,
}: {
  value: number | "";
  onChange: (value: number | "") => void;
  placeholder: string;
  allowEmpty?: boolean;
  id?: string;
}) {
  const { data: ingredients = [], isPending: loadingIngredients } = useIngredients();
  const selectValue = value === "" ? MODIFIER_EMPTY_INGREDIENT : String(value);

  return (
    <Select
      value={selectValue}
      onValueChange={(v) =>
        onChange(v === MODIFIER_EMPTY_INGREDIENT || v == null ? "" : Number(v))
      }
    >
      <SelectTrigger
        id={id}
        className={formFieldInsetClassName("w-full")}
        loading={loadingIngredients}
      >
        <SelectValue placeholder={loadingIngredients ? "Loading ingredients…" : placeholder} />
      </SelectTrigger>
      <SelectContent className={formSelectContentClassName()}>
        {allowEmpty && (
          <SelectItem value={MODIFIER_EMPTY_INGREDIENT}>{placeholder}</SelectItem>
        )}
        {ingredients.map((ing: Ingredient) => (
          <SelectItem key={ing.id} value={String(ing.id)}>
            {ing.name} ({ing.unit})
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
