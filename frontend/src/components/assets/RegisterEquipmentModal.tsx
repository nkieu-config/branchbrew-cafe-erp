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
import { EQUIPMENT_TYPE_OPTIONS } from "@/lib/filters/equipment-filters";
import type { EquipmentType } from "@/types/api";
import { assetsDialogContentClassName } from "@/lib/theme/assets";
import { formFieldInvalidClassName } from "@/lib/theme/color-helpers";
import { hubCtaClassName } from "@/lib/theme/hub-primitives";
import { formFieldInsetClassName, formLineDateFieldClassName, formSelectContentClassName } from "@/lib/theme/stock";
import { text } from "@/lib/theme/surface";
import { cn } from "@/lib/utils";

type RegisterEquipmentModalProps = {
  open: boolean;
  onClose: () => void;
  branchId: number;
  onSubmit: (payload: {
    branchId: number;
    name: string;
    type: EquipmentType;
    serialNumber?: string;
    nextMaintenanceDate?: string;
  }) => Promise<void>;
  isSubmitting?: boolean;
};

export function RegisterEquipmentModal({
  open,
  onClose,
  branchId,
  onSubmit,
  isSubmitting = false,
}: RegisterEquipmentModalProps) {
  const [name, setName] = useState("");
  const [type, setType] = useState<EquipmentType>("ESPRESSO_MACHINE");
  const [serialNumber, setSerialNumber] = useState("");
  const [nextMaintenanceDate, setNextMaintenanceDate] = useState("");
  const [fieldErrors, setFieldErrors] = useState<{ name?: string }>({});

  const clearFieldError = (field: "name") => {
    setFieldErrors((prev) => {
      if (!prev[field]) return prev;
      const next = { ...prev };
      delete next[field];
      return next;
    });
  };

  useEffect(() => {
    if (!open) return;
    setName("");
    setType("ESPRESSO_MACHINE");
    setSerialNumber("");
    setNextMaintenanceDate("");
    setFieldErrors({});
  }, [open]);

  const handleSubmit = async () => {
    const trimmedName = name.trim();
    if (!trimmedName) {
      setFieldErrors({ name: "Equipment name is required" });
      return;
    }

    await onSubmit({
      branchId,
      name: trimmedName,
      type,
      serialNumber: serialNumber.trim() || undefined,
      nextMaintenanceDate: nextMaintenanceDate
        ? new Date(`${nextMaintenanceDate}T12:00:00`).toISOString()
        : undefined,
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
        <FormDialog.Title>Register equipment</FormDialog.Title>
        <FormDialog.Body className="space-y-4 pt-1">
          <FormField id="equipment-name" error={fieldErrors.name} className="space-y-2">
            <FormFieldLabel className={text.secondary}>Name</FormFieldLabel>
            <FormFieldControl>
              <Input
                value={name}
                onChange={(event) => {
                  setName(event.target.value);
                  clearFieldError("name");
                }}
                placeholder="e.g. La Marzocco Linea PB"
                className={formFieldInsetClassName(formFieldInvalidClassName(!!fieldErrors.name))}
                required
              />
            </FormFieldControl>
            <FormFieldError />
          </FormField>

          <div className="space-y-2">
            <Label htmlFor="equipment-type" className={text.secondary}>
              Type
            </Label>
            <Select
              value={type}
              onValueChange={(value) => value && setType(value as EquipmentType)}
            >
              <SelectTrigger id="equipment-type" className={formFieldInsetClassName("w-full")}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent className={formSelectContentClassName()}>
                {EQUIPMENT_TYPE_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="equipment-serial" className={text.secondary}>
              Serial <span className={text.muted}>(optional)</span>
            </Label>
            <Input
              id="equipment-serial"
              value={serialNumber}
              onChange={(event) => setSerialNumber(event.target.value)}
              placeholder="SN-12345"
              className={formFieldInsetClassName()}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="equipment-next-maintenance" className={text.secondary}>
              Next maintenance <span className={text.muted}>(optional)</span>
            </Label>
            <Input
              id="equipment-next-maintenance"
              type="date"
              value={nextMaintenanceDate}
              onChange={(event) => setNextMaintenanceDate(event.target.value)}
              className={formLineDateFieldClassName()}
            />
          </div>
        </FormDialog.Body>

        <FormDialog.Footer className="gap-2 sm:gap-0">
          <Button type="button" variant="outline" disabled={isSubmitting} onClick={onClose} className="min-h-[44px]">
            Cancel
          </Button>
          <Button
            type="button"
            disabled={isSubmitting}
            className={cn("min-h-[44px]", hubCtaClassName("assets"))}
            onClick={() => void handleSubmit()}
          >
            {isSubmitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" aria-hidden />}
            Register
          </Button>
        </FormDialog.Footer>
    </FormDialog>
  );
}
