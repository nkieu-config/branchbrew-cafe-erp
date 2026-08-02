"use client";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { dataTableRowHoverClassName } from "@/lib/theme/data-table";
import { metricValueClassName } from "@/lib/theme/metric";
import type { MetricTone } from "@/lib/theme/metric";
import { touchTargetClassName } from "@/lib/theme/typography";
import { Loader2, type LucideIcon } from "lucide-react";

type TableActionButtonProps = {
  /** Visible and accessible name; required for icon-only buttons. */
  label: string;
  icon?: LucideIcon;
  /** Show icon only; label is exposed via aria-label. */
  iconOnly?: boolean;
  onClick?: () => void;
  className?: string;
  variant?: "ghost" | "outline" | "link";
  destructive?: boolean;
  /** Accent color for non-destructive actions (default: blue). */
  tone?: MetricTone;
  /** Swaps the icon for a spinner and blocks re-entry while the row action runs. */
  loading?: boolean;
  disabled?: boolean;
};

export function TableActionButton({
  label,
  icon: Icon,
  iconOnly = false,
  onClick,
  className,
  variant = "ghost",
  destructive = false,
  tone = "blue",
  loading = false,
  disabled,
}: TableActionButtonProps) {
  return (
    <Button
      type="button"
      variant={variant}
      size="sm"
      onClick={onClick}
      disabled={loading || disabled}
      aria-busy={loading || undefined}
      aria-label={iconOnly ? label : undefined}
      className={cn(
        touchTargetClassName(),
        "px-2 font-medium",
        destructive && "text-destructive hover:text-destructive hover:bg-destructive/10",
        !destructive && variant === "ghost" && cn(
          metricValueClassName(tone),
          dataTableRowHoverClassName(),
        ),
        className,
      )}
    >
      {loading ? (
        <Loader2 className="w-4 h-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />
      ) : (
        Icon && <Icon className="w-4 h-4" aria-hidden="true" />
      )}
      {!iconOnly && <span className={Icon || loading ? "ml-1.5" : undefined}>{label}</span>}
    </Button>
  );
}
