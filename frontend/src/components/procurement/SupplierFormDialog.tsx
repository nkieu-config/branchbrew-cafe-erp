"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  FormField,
  FormFieldControl,
  FormFieldError,
  FormFieldLabel,
} from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FormDialog } from "@/components/shared/form-modal";
import { formFieldInvalidClassName } from "@/lib/theme/color-helpers";
import { procurementDialogContentClassName } from "@/lib/theme/hub-procurement";
import { formFieldInsetClassName } from "@/lib/theme/stock";
import { hubCtaClassName } from "@/lib/theme/hub-primitives";
import { text } from "@/lib/theme/surface";
import { cn } from "@/lib/utils";
import type { Supplier } from "@/types/api";

export type SupplierFormValues = {
  name: string;
  contactEmail: string;
  phone: string;
};

type SupplierFormDialogProps = {
  open: boolean;
  initialValues?: Supplier | null;
  saving: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (values: SupplierFormValues) => void;
};

export function SupplierFormDialog({
  open,
  initialValues,
  saving,
  onOpenChange,
  onSave,
}: SupplierFormDialogProps) {
  const [values, setValues] = useState<SupplierFormValues>({
    name: "",
    contactEmail: "",
    phone: "",
  });
  const [fieldErrors, setFieldErrors] = useState<{ name?: string }>({});
  const editing = initialValues != null;

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
    setValues({
      name: initialValues?.name ?? "",
      contactEmail: initialValues?.contactEmail ?? "",
      phone: initialValues?.phone ?? "",
    });
    setFieldErrors({});
  }, [initialValues, open]);

  const updateValue = (field: keyof SupplierFormValues, value: string) => {
    setValues((current) => ({ ...current, [field]: value }));
  };

  const handleSave = () => {
    if (!values.name.trim()) {
      setFieldErrors({ name: "Name is required" });
      return;
    }
    onSave(values);
  };

  return (
    <FormDialog busy={saving} open={open} onOpenChange={onOpenChange} className={procurementDialogContentClassName()}>
      <FormDialog.Title>{editing ? "Edit supplier" : "Add supplier"}</FormDialog.Title>
      <FormDialog.Body className="space-y-4 pt-1">
        <FormField id="supplier-name" error={fieldErrors.name} className="space-y-2">
          <FormFieldLabel className={text.secondary}>Name</FormFieldLabel>
          <FormFieldControl>
            <Input
              value={values.name}
              onChange={(e) => {
                updateValue("name", e.target.value);
                clearFieldError("name");
              }}
              placeholder="Supplier name"
              className={formFieldInsetClassName(formFieldInvalidClassName(!!fieldErrors.name))}
            />
          </FormFieldControl>
          <FormFieldError />
        </FormField>
        <div className="space-y-2">
          <Label htmlFor="supplier-email" className={text.secondary}>
            Email
          </Label>
          <Input
            id="supplier-email"
            type="email"
            value={values.contactEmail}
            onChange={(e) => updateValue("contactEmail", e.target.value)}
            placeholder="sales@vendor.com"
            className={formFieldInsetClassName()}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="supplier-phone" className={text.secondary}>
            Phone
          </Label>
          <Input
            id="supplier-phone"
            value={values.phone}
            onChange={(e) => updateValue("phone", e.target.value)}
            placeholder="08x-xxx-xxxx"
            className={formFieldInsetClassName()}
          />
        </div>
      </FormDialog.Body>
      <FormDialog.Footer className="gap-2 sm:gap-0">
        <Button
          type="button"
          variant="outline"
          disabled={saving}
          onClick={() => onOpenChange(false)}
          className="min-h-[44px]"
        >
          Cancel
        </Button>
        <Button
          type="button"
          disabled={saving}
          className={cn("min-h-[44px]", hubCtaClassName("procurement"))}
          onClick={handleSave}
        >
          {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" aria-hidden />}
          {editing ? "Save" : "Create"}
        </Button>
      </FormDialog.Footer>
    </FormDialog>
  );
}
