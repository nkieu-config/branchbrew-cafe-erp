"use client";

import { Button } from "@/components/ui/button";
import { FormDialog } from "@/components/shared/form-modal";
import {
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formFieldInsetClassName, hubDangerActionClassName } from "@/lib/theme/stock";
import { text } from "@/lib/theme/surface";
import { typeUiLabelClassName } from "@/lib/theme/typography";

type BatchWasteDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  ingredientName: string | null;
  maxQty: number | null;
  quantity: string;
  onQuantityChange: (value: string) => void;
  reason: string;
  onReasonChange: (value: string) => void;
  onSubmit: () => void;
  isPending: boolean;
};

export function BatchWasteDialog({
  open,
  onOpenChange,
  ingredientName,
  maxQty,
  quantity,
  onQuantityChange,
  reason,
  onReasonChange,
  onSubmit,
  isPending,
}: BatchWasteDialogProps) {
  return (
    <FormDialog busy={isPending} open={open} onOpenChange={onOpenChange} className="rounded-xl sm:max-w-md">
        <FormDialog.Title>Report waste</FormDialog.Title>
          <DialogDescription>
            {ingredientName && maxQty != null
              ? `${ingredientName} · max ${maxQty}`
              : "Deduct quantity from this batch."}
          </DialogDescription>
        <FormDialog.Body className="space-y-4 pt-1">
          <div className="space-y-2">
            <Label className={typeUiLabelClassName(text.secondary)}>Quantity</Label>
            <Input
              className={formFieldInsetClassName("h-11")}
              type="number"
              min="0.01"
              step="0.01"
              max={maxQty ?? undefined}
              value={quantity}
              onChange={(e) => onQuantityChange(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label className={typeUiLabelClassName(text.secondary)}>Reason</Label>
            <Input
              className={formFieldInsetClassName("h-11")}
              value={reason}
              onChange={(e) => onReasonChange(e.target.value)}
              placeholder="Expired, spilled…"
            />
          </div>
        </FormDialog.Body>
        <FormDialog.Footer className="gap-2">
          <Button disabled={isPending} variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            className={hubDangerActionClassName()}
            onClick={onSubmit}
            disabled={isPending}
          >
            {isPending ? "Saving…" : "Confirm"}
          </Button>
        </FormDialog.Footer>
    </FormDialog>
  );
}
