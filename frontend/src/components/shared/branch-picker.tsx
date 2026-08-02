"use client";

import { useMemo } from "react";
import { MapPin } from "lucide-react";
import {
  sidebarBranchPillClassName,
  topbarBranchPickerClassName,
  topbarBranchSelectContentClassName,
  topbarBranchSelectItemClassName,
  topbarBranchSelectTriggerClassName,
} from "@/lib/theme/shell";
import { formSelectContentClassName } from "@/lib/theme/stock";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import type { Branch } from "@/types/api";

type BranchPickerProps = {
  branches: Branch[];
  activeBranchId: number | null;
  onChange: (branchId: number | null) => void;
  variant?: "topbar" | "sidebar";
  className?: string;
  loading?: boolean;
};

export function BranchPicker({
  branches,
  activeBranchId,
  onChange,
  variant = "topbar",
  className,
  loading = false,
}: BranchPickerProps) {
  const value = activeBranchId == null ? "all" : String(activeBranchId);
  const isSidebar = variant === "sidebar";
  const isScoped = !isSidebar && activeBranchId != null;

  const branchItems = useMemo(() => {
    const items: Record<string, string> = { all: "All branches" };
    for (const branch of branches) {
      items[String(branch.id)] = branch.name;
    }
    return items;
  }, [branches]);

  return (
    <div
      className={cn(
        isSidebar ? sidebarBranchPillClassName() : topbarBranchPickerClassName({ scoped: isScoped }),
        !isSidebar && "min-w-0 flex-1 w-full max-w-none lg:w-[12.5rem] lg:flex-none lg:max-w-none",
        className,
      )}
      data-testid={isSidebar ? "branch-picker-sidebar" : "branch-picker-topbar"}
    >
      {isSidebar && (
        <MapPin className="w-3.5 h-3.5 shrink-0 text-[var(--topbar-picker-icon)]" aria-hidden="true" />
      )}
      <Select
        value={value}
        items={branchItems}
        onValueChange={(next) => {
          if (next == null) return;
          onChange(next === "all" ? null : Number(next));
        }}
      >
        <SelectTrigger
          aria-label="Select branch"
          loading={loading}
          className={
            isSidebar
              ? "h-11 min-h-[44px] w-full border-0 bg-transparent shadow-none text-xs font-medium focus-visible:ring-0 dark:bg-transparent dark:hover:bg-transparent"
              : topbarBranchSelectTriggerClassName(
                  cn(
                    "h-full",
                    isScoped &&
                      "font-semibold text-[var(--topbar-picker-fg-active)] [&_svg]:!text-[var(--topbar-picker-fg-active)] [&_svg]:opacity-90",
                  ),
                )
          }
        >
          <SelectValue
            placeholder={loading ? "Loading branches…" : "Branch"}
            className="truncate"
          />
        </SelectTrigger>
        <SelectContent
          align={isSidebar ? "start" : "end"}
          alignItemWithTrigger={false}
          className={
            isSidebar
              ? formSelectContentClassName("min-w-[12rem]")
              : topbarBranchSelectContentClassName("min-w-[12rem]")
          }
        >
          <SelectItem value="all" className={!isSidebar ? topbarBranchSelectItemClassName() : undefined}>
            All branches
          </SelectItem>
          {branches.map((branch) => (
            <SelectItem
              key={branch.id}
              value={String(branch.id)}
              className={!isSidebar ? topbarBranchSelectItemClassName() : undefined}
            >
              {branch.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
