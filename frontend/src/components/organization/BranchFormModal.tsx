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
import { Checkbox } from "@/components/ui/checkbox";
import type { Branch } from "@/types/api";
import { formFieldInvalidClassName } from "@/lib/theme/color-helpers";
import { hubCtaClassName } from "@/lib/theme/hub-primitives";
import { organizationDialogContentClassName } from "@/lib/theme/organization";
import { formFieldInsetClassName } from "@/lib/theme/stock";
import { text } from "@/lib/theme/surface";
import { cn } from "@/lib/utils";

export type BranchFormValues = {
  name: string;
  location?: string;
  isCentralKitchen?: boolean;
};

type BranchFormModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialValues?: Branch | null;
  onSave: (payload: BranchFormValues) => Promise<void>;
  isSubmitting?: boolean;
};

export function BranchFormModal({
  open,
  onOpenChange,
  initialValues,
  onSave,
  isSubmitting = false,
}: BranchFormModalProps) {
  const [name, setName] = useState("");
  const [location, setLocation] = useState("");
  const [isCentralKitchen, setIsCentralKitchen] = useState(false);
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
    setName(initialValues?.name ?? "");
    setLocation(initialValues?.location ?? "");
    setIsCentralKitchen(initialValues?.isCentralKitchen ?? false);
    setFieldErrors({});
  }, [open, initialValues]);

  const handleSubmit = async () => {
    const trimmedName = name.trim();
    if (!trimmedName) {
      setFieldErrors({ name: "Branch name is required" });
      return;
    }

    await onSave({
      name: trimmedName,
      location: location.trim() || undefined,
      isCentralKitchen,
    });
  };

  return (
    <FormDialog busy={isSubmitting} open={open} onOpenChange={onOpenChange} className={organizationDialogContentClassName()}>
      <FormDialog.Title>{editing ? "Edit branch" : "Add branch"}</FormDialog.Title>
      <FormDialog.Body className="space-y-4 pt-1">
        <FormField id="branch-name" error={fieldErrors.name} className="space-y-2">
          <FormFieldLabel className={text.secondary}>Name</FormFieldLabel>
          <FormFieldControl>
            <Input
              value={name}
              onChange={(event) => {
                setName(event.target.value);
                clearFieldError("name");
              }}
              placeholder="e.g. BranchBrew Downtown"
              className={formFieldInsetClassName(formFieldInvalidClassName(!!fieldErrors.name))}
              required
            />
          </FormFieldControl>
          <FormFieldError />
        </FormField>

        <div className="space-y-2">
          <Label htmlFor="branch-location" className={text.secondary}>
            Location <span className={text.muted}>(optional)</span>
          </Label>
          <Input
            id="branch-location"
            value={location}
            onChange={(event) => setLocation(event.target.value)}
            placeholder="e.g. 1st Floor, Center Point"
            className={formFieldInsetClassName()}
          />
        </div>

        <div className="flex items-start gap-3 border-t border-[var(--table-row-border)] pt-4">
          <Checkbox
            id="branch-central-kitchen"
            checked={isCentralKitchen}
            onCheckedChange={(checked) => setIsCentralKitchen(Boolean(checked))}
            className="mt-0.5"
          />
          <div className="space-y-0.5">
            <Label htmlFor="branch-central-kitchen" className={cn("font-medium", text.primary)}>
              Central kitchen (HQ)
            </Label>
            <p className={cn("text-sm", text.muted)}>
              Supplies other branches via stock transfers.
            </p>
          </div>
        </div>
      </FormDialog.Body>

      <FormDialog.Footer className="gap-2 sm:gap-0">
        <Button
          type="button"
          variant="outline"
          disabled={isSubmitting}
          onClick={() => onOpenChange(false)}
          className="min-h-[44px]"
        >
          Cancel
        </Button>
        <Button
          type="button"
          disabled={isSubmitting}
          className={cn("min-h-[44px]", hubCtaClassName("organization"))}
          onClick={() => void handleSubmit()}
        >
          {isSubmitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" aria-hidden />}
          {editing ? "Save" : "Create"}
        </Button>
      </FormDialog.Footer>
    </FormDialog>
  );
}
