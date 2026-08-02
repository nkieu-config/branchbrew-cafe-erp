"use client";

import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { HubId } from "@/lib/navigation";
import { formModalDefaultIconClassName, hubModalIconClassName } from "@/lib/theme/color-helpers";
import { formDialogContentClassName, typeHeadingClassName } from "@/lib/theme/typography";
import { cn } from "@/lib/utils";

type FormDialogRootProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: ReactNode;
  className?: string;
  width?: number | string;
  testId?: string;
  /** Blocks Esc/backdrop dismissal while a submission is in flight. */
  busy?: boolean;
};

function FormDialogRoot({
  open,
  onOpenChange,
  children,
  className,
  width = 800,
  testId,
  busy = false,
}: FormDialogRootProps) {
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (busy && !next) return;
        onOpenChange(next);
      }}
    >
      <DialogContent
        className={className ?? formDialogContentClassName(width)}
        data-testid={testId}
        showCloseButton={!busy}
      >
        {children}
      </DialogContent>
    </Dialog>
  );
}

type FormDialogTitleProps = {
  children: ReactNode;
  icon?: LucideIcon;
  accentHub?: HubId;
  iconClassName?: string;
  className?: string;
};

function FormDialogTitle({
  children,
  icon: Icon,
  accentHub,
  iconClassName,
  className,
}: FormDialogTitleProps) {
  const resolvedIconClassName =
    iconClassName ??
    (accentHub != null ? hubModalIconClassName(accentHub) : formModalDefaultIconClassName());

  return (
    <DialogHeader>
      <DialogTitle className={cn(typeHeadingClassName(), "flex items-center gap-2 text-lg", className)}>
        {Icon && <Icon className={cn("shrink-0", resolvedIconClassName)} aria-hidden />}
        {children}
      </DialogTitle>
    </DialogHeader>
  );
}

function FormDialogBody({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("mt-4", className)}>{children}</div>;
}

function FormDialogFooter({ children, className }: { children: ReactNode; className?: string }) {
  return <DialogFooter className={className}>{children}</DialogFooter>;
}

export const FormDialog = Object.assign(FormDialogRoot, {
  Title: FormDialogTitle,
  Body: FormDialogBody,
  Footer: FormDialogFooter,
});

interface FormModalProps {
  title: string;
  icon?: LucideIcon;
  /** Hub accent for the title icon (overrides default when set). */
  accentHub?: HubId;
  /** Optional icon class override (defaults to accent hub or indigo metric). */
  iconClassName?: string;
  isOpen: boolean;
  onClose: () => void;
  children: ReactNode;
  width?: number | string;
  /** Blocks Esc/backdrop/close-button dismissal while a submission is in flight. */
  busy?: boolean;
}

export function FormModal({
  title,
  icon: Icon,
  accentHub,
  iconClassName,
  isOpen,
  onClose,
  children,
  width = 800,
  busy = false,
}: FormModalProps) {
  const resolvedIconClassName =
    iconClassName ??
    (accentHub != null ? hubModalIconClassName(accentHub) : formModalDefaultIconClassName());

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        if (open || busy) return;
        onClose();
      }}
    >
      <DialogContent className={formDialogContentClassName(width)} showCloseButton={!busy}>
        <DialogHeader>
          <DialogTitle className={cn(typeHeadingClassName(), "flex items-center gap-2 text-lg")}>
            {Icon && <Icon className={cn("shrink-0", resolvedIconClassName)} aria-hidden />}
            {title}
          </DialogTitle>
        </DialogHeader>
        <div className="mt-4">{children}</div>
      </DialogContent>
    </Dialog>
  );
}

type FormModalFooterProps = {
  children: ReactNode;
  className?: string;
};

/** Standard modal footer — primary/cancel actions aligned right. */
export function FormModalFooter({ children, className }: FormModalFooterProps) {
  return (
    <div
      className={cn(
        "mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end sm:gap-3",
        className,
      )}
    >
      {children}
    </div>
  );
}
