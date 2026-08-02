"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { FormDialog } from "@/components/shared/form-modal";
import { Button } from "@/components/ui/button";
import {
  FormField,
  FormFieldControl,
  FormFieldError,
  FormFieldLabel,
  FormFieldSelectTrigger,
} from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectValue,
} from "@/components/ui/select";
import type { User } from "@/types/api";
import {
  validateShiftFields,
  type ShiftFieldErrors,
} from "@/lib/hr/create-shift-validation";
import { formFieldInvalidClassName } from "@/lib/theme/color-helpers";
import { hubCtaClassName, inlineLinkClassName } from "@/lib/theme/hub-primitives";
import { hrDialogContentClassName } from "@/lib/theme/hub-hr";
import { formFieldInsetClassName, formLineDateFieldClassName, formSelectContentClassName } from "@/lib/theme/stock";
import { text } from "@/lib/theme/surface";
import { cn } from "@/lib/utils";

type CreateShiftModalProps = {
  open: boolean;
  onClose: () => void;
  employees: User[];
  loadingEmployees?: boolean;
  branchId: number;
  defaultDate?: string;
  onSubmit: (payload: {
    userId: number;
    branchId: number;
    startTime: string;
    endTime: string;
  }) => Promise<void>;
  isSubmitting?: boolean;
};

export function CreateShiftModal({
  open,
  onClose,
  employees,
  loadingEmployees = false,
  branchId,
  defaultDate,
  onSubmit,
  isSubmitting = false,
}: CreateShiftModalProps) {
  const [userId, setUserId] = useState<string>("");
  const [shiftDate, setShiftDate] = useState("");
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("17:00");
  const [fieldErrors, setFieldErrors] = useState<ShiftFieldErrors>({});

  const staffOptions = useMemo(
    () => employees.filter((employee) => employee.role === "STAFF" || employee.role === "MANAGER"),
    [employees],
  );

  useEffect(() => {
    if (!open) return;
    setUserId("");
    setShiftDate(defaultDate ?? new Date().toISOString().slice(0, 10));
    setStartTime("09:00");
    setEndTime("17:00");
    setFieldErrors({});
  }, [open, defaultDate]);

  const clearFieldError = (field: keyof ShiftFieldErrors) => {
    setFieldErrors((prev) => {
      if (!prev[field]) return prev;
      const next = { ...prev };
      delete next[field];
      return next;
    });
  };

  const handleSubmit = async () => {
    const errors = validateShiftFields({
      userId,
      shiftDate,
      startTime,
      endTime,
      hasStaffOptions: staffOptions.length > 0,
    });

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }

    const start = new Date(`${shiftDate}T${startTime}:00`);
    const end = new Date(`${shiftDate}T${endTime}:00`);

    setFieldErrors({});
    await onSubmit({
      userId: Number(userId),
      branchId,
      startTime: start.toISOString(),
      endTime: end.toISOString(),
    });
  };

  return (
    <FormDialog
      busy={isSubmitting}
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
      className={hrDialogContentClassName()}
      testId="hr-schedule-shift-dialog"
    >
      <FormDialog.Title>Schedule shift</FormDialog.Title>

      <FormDialog.Body className="flex flex-col gap-stack pt-1">
        <FormField id="shift-employee" error={fieldErrors.employee}>
          <FormFieldLabel className={text.secondary}>Employee</FormFieldLabel>
          {staffOptions.length === 0 ? (
            <p className={cn("text-sm", text.muted)}>
              No employees yet —{" "}
              <Link href="/hr/employees" className={inlineLinkClassName()}>
                add staff
              </Link>
            </p>
          ) : (
            <Select
              value={userId}
              onValueChange={(value) => {
                if (value == null) return;
                setUserId(value);
                clearFieldError("employee");
              }}
            >
              <FormFieldSelectTrigger
                className={formFieldInsetClassName("w-full")}
                loading={loadingEmployees}
              >
                <SelectValue
                  placeholder={loadingEmployees ? "Loading employees…" : "Select employee"}
                />
              </FormFieldSelectTrigger>
              <SelectContent className={formSelectContentClassName()}>
                {staffOptions.map((employee) => (
                  <SelectItem key={employee.id} value={String(employee.id)}>
                    {employee.name ?? employee.email}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <FormFieldError />
        </FormField>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-stack">
          <FormField id="shift-date" error={fieldErrors.date}>
            <FormFieldLabel className={text.secondary}>Date</FormFieldLabel>
            <FormFieldControl>
              <Input
                type="date"
                value={shiftDate}
                onChange={(event) => {
                  setShiftDate(event.target.value);
                  clearFieldError("date");
                  clearFieldError("endTime");
                }}
                className={cn(
                  formLineDateFieldClassName(),
                  formFieldInvalidClassName(!!fieldErrors.date),
                )}
              />
            </FormFieldControl>
            <FormFieldError />
          </FormField>

          <FormField id="shift-start" error={fieldErrors.startTime}>
            <FormFieldLabel className={text.secondary}>Start</FormFieldLabel>
            <FormFieldControl>
              <Input
                type="time"
                value={startTime}
                onChange={(event) => {
                  setStartTime(event.target.value);
                  clearFieldError("startTime");
                  clearFieldError("endTime");
                }}
                className={formFieldInsetClassName(formFieldInvalidClassName(!!fieldErrors.startTime))}
              />
            </FormFieldControl>
            <FormFieldError />
          </FormField>

          <FormField id="shift-end" error={fieldErrors.endTime}>
            <FormFieldLabel className={text.secondary}>End</FormFieldLabel>
            <FormFieldControl>
              <Input
                type="time"
                value={endTime}
                onChange={(event) => {
                  setEndTime(event.target.value);
                  clearFieldError("endTime");
                }}
                className={formFieldInsetClassName(formFieldInvalidClassName(!!fieldErrors.endTime))}
              />
            </FormFieldControl>
            <FormFieldError />
          </FormField>
        </div>
      </FormDialog.Body>

      <FormDialog.Footer className="gap-2 sm:gap-0">
        <Button type="button" variant="outline" disabled={isSubmitting} onClick={onClose} className="min-h-[44px]">
          Cancel
        </Button>
        <Button
          type="button"
          disabled={isSubmitting || staffOptions.length === 0}
          className={cn("min-h-[44px]", hubCtaClassName("hr"))}
          onClick={() => void handleSubmit()}
        >
          {isSubmitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" aria-hidden />}
          Save
        </Button>
      </FormDialog.Footer>
    </FormDialog>
  );
}
