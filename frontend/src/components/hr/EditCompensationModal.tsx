"use client";

import { Loader2 } from "lucide-react";
import { FormDialog } from "@/components/shared/form-modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar } from "@/components/ui/avatar";
import type { User } from "@/types/api";
import { formatCurrency } from "@/lib/money";
import { hrAvatarClassName } from "@/lib/theme/hub-hr";
import { hubCtaClassName } from "@/lib/theme/hub-primitives";
import { hrDialogContentClassName } from "@/lib/theme/hub-hr";
import { formFieldInsetClassName } from "@/lib/theme/stock";
import { text } from "@/lib/theme/surface";
import { cn } from "@/lib/utils";

type EditCompensationModalProps = {
  open: boolean;
  user: User | null;
  hourlyRate: string;
  onHourlyRateChange: (value: string) => void;
  onClose: () => void;
  onSubmit: () => void;
  isSubmitting?: boolean;
};

export function EditCompensationModal({
  open,
  user,
  hourlyRate,
  onHourlyRateChange,
  onClose,
  onSubmit,
  isSubmitting = false,
}: EditCompensationModalProps) {
  return (
    <FormDialog
      busy={isSubmitting}
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
      className={hrDialogContentClassName()}
    >
        <FormDialog.Title>Edit rate</FormDialog.Title>

        {user && (
          <FormDialog.Body className="space-y-4 pt-1">
            <div className="flex items-center gap-3">
              <Avatar size="lg" className={hrAvatarClassName()}>
                {user.name?.charAt(0) ?? "U"}
              </Avatar>
              <div>
                <div className={cn("font-medium", text.primary)}>{user.name ?? "Unknown user"}</div>
                <div className={cn("text-sm", text.muted)}>{user.role}</div>
              </div>
            </div>

            {user.employmentType === "FULL_TIME" && user.baseSalary != null && user.baseSalary > 0 && (
              <p className={cn("text-sm", text.muted)}>
                Base salary {formatCurrency(user.baseSalary)}
              </p>
            )}

            <div className="space-y-2">
              <Label htmlFor="hourly-rate" className={text.secondary}>
                Hourly rate
              </Label>
              <Input
                id="hourly-rate"
                type="number"
                min={0}
                step={1}
                value={hourlyRate}
                onChange={(event) => onHourlyRateChange(event.target.value)}
                className={formFieldInsetClassName()}
              />
            </div>
          </FormDialog.Body>
        )}

        <FormDialog.Footer className="gap-2 sm:gap-0">
          <Button type="button" variant="outline" disabled={isSubmitting} onClick={onClose} className="min-h-[44px]">
            Cancel
          </Button>
          <Button
            type="button"
            disabled={isSubmitting}
            className={cn("min-h-[44px]", hubCtaClassName("hr"))}
            onClick={onSubmit}
          >
            {isSubmitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" aria-hidden />}
            Save
          </Button>
        </FormDialog.Footer>
    </FormDialog>
  );
}
