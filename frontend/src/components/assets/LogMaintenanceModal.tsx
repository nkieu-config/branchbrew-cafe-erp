"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { equipmentStatusLabel } from "@/lib/filters/equipment-filters";
import type { Equipment, EquipmentStatus } from "@/types/api";
import { assetsDialogContentClassName } from "@/lib/theme/assets";
import { formFieldInvalidClassName } from "@/lib/theme/color-helpers";
import { hubCtaClassName } from "@/lib/theme/hub-primitives";
import { formFieldInsetClassName, formLineDateFieldClassName, formSelectContentClassName } from "@/lib/theme/stock";
import { text } from "@/lib/theme/surface";
import { cn } from "@/lib/utils";

const STATUS_OPTIONS: EquipmentStatus[] = ["ACTIVE", "MAINTENANCE", "BROKEN", "RETIRED"];

type LogMaintenanceModalProps = {
  open: boolean;
  onClose: () => void;
  equipment: Equipment | null;
  performedBy?: string;
  onSubmit: (payload: {
    id: number;
    data: {
      description: string;
      cost: number;
      performedBy?: string;
      date: string;
      nextMaintenanceDate?: string;
      newStatus?: EquipmentStatus;
    };
  }) => Promise<void>;
  isSubmitting?: boolean;
};

export function LogMaintenanceModal({
  open,
  onClose,
  equipment,
  performedBy,
  onSubmit,
  isSubmitting = false,
}: LogMaintenanceModalProps) {
  const [description, setDescription] = useState("");
  const [cost, setCost] = useState("");
  const [nextMaintenanceDate, setNextMaintenanceDate] = useState("");
  const [newStatus, setNewStatus] = useState<EquipmentStatus | "">("");
  const [fieldErrors, setFieldErrors] = useState<{ description?: string; cost?: string }>({});

  const clearFieldError = (field: "description" | "cost") => {
    setFieldErrors((prev) => {
      if (!prev[field]) return prev;
      const next = { ...prev };
      delete next[field];
      return next;
    });
  };

  useEffect(() => {
    if (!open || !equipment) return;
    setDescription("");
    setCost("");
    setNextMaintenanceDate(
      equipment.nextMaintenanceDate
        ? equipment.nextMaintenanceDate.slice(0, 10)
        : "",
    );
    setNewStatus("");
    setFieldErrors({});
  }, [open, equipment]);

  const handleSubmit = async () => {
    if (!equipment) return;

    const trimmedDescription = description.trim();
    const parsedCost = Number(cost);

    const errors: { description?: string; cost?: string } = {};
    if (!trimmedDescription) errors.description = "Description is required";
    if (!Number.isFinite(parsedCost) || parsedCost < 0) errors.cost = "Enter a valid cost";
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }

    await onSubmit({
      id: equipment.id,
      data: {
        description: trimmedDescription,
        cost: parsedCost,
        performedBy: performedBy?.trim() || undefined,
        date: new Date().toISOString(),
        nextMaintenanceDate: nextMaintenanceDate
          ? new Date(`${nextMaintenanceDate}T12:00:00`).toISOString()
          : undefined,
        newStatus: newStatus || undefined,
      },
    });
  };

  return (
    <FormDialog
      busy={isSubmitting}
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
      className={assetsDialogContentClassName()}
    >
        <FormDialog.Title>
          Log maintenance{equipment ? ` · ${equipment.name}` : ""}
        </FormDialog.Title>
        <FormDialog.Body className="space-y-4 pt-1">
          <FormField
            id="maintenance-description"
            error={fieldErrors.description}
            className="space-y-2"
          >
            <FormFieldLabel className={text.secondary}>Description</FormFieldLabel>
            <FormFieldControl>
              <Input
                value={description}
                onChange={(event) => {
                  setDescription(event.target.value);
                  clearFieldError("description");
                }}
                placeholder="What was done?"
                className={formFieldInsetClassName(
                  formFieldInvalidClassName(!!fieldErrors.description),
                )}
                required
              />
            </FormFieldControl>
            <FormFieldError />
          </FormField>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormField id="maintenance-cost" error={fieldErrors.cost} className="space-y-2">
              <FormFieldLabel className={text.secondary}>Cost</FormFieldLabel>
              <FormFieldControl>
                <Input
                  type="number"
                  min={0}
                  step="0.01"
                  value={cost}
                  onChange={(event) => {
                    setCost(event.target.value);
                    clearFieldError("cost");
                  }}
                  className={formFieldInsetClassName(
                    formFieldInvalidClassName(!!fieldErrors.cost),
                  )}
                  required
                />
              </FormFieldControl>
              <FormFieldError />
            </FormField>
            <div className="space-y-2">
              <Label htmlFor="maintenance-next-date" className={text.secondary}>
                Next due
              </Label>
              <Input
                id="maintenance-next-date"
                type="date"
                value={nextMaintenanceDate}
                onChange={(event) => setNextMaintenanceDate(event.target.value)}
                className={formLineDateFieldClassName()}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="maintenance-status" className={text.secondary}>
              Status <span className={text.muted}>(optional)</span>
            </Label>
            <Select
              value={newStatus}
              onValueChange={(value) =>
                setNewStatus(value ? (value as EquipmentStatus) : "")
              }
            >
              <SelectTrigger id="maintenance-status" className={formFieldInsetClassName("w-full")}>
                <SelectValue placeholder="Keep current" />
              </SelectTrigger>
              <SelectContent className={formSelectContentClassName()}>
                {STATUS_OPTIONS.map((status) => (
                  <SelectItem key={status} value={status}>
                    {equipmentStatusLabel(status)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </FormDialog.Body>

        <FormDialog.Footer className="gap-2 sm:gap-0">
          <Button type="button" variant="outline" disabled={isSubmitting} onClick={onClose} className="min-h-[44px]">
            Cancel
          </Button>
          <Button
            type="button"
            disabled={isSubmitting || !equipment}
            className={cn("min-h-[44px]", hubCtaClassName("assets"))}
            onClick={() => void handleSubmit()}
          >
            {isSubmitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" aria-hidden />}
            Save
          </Button>
        </FormDialog.Footer>
    </FormDialog>
  );
}
