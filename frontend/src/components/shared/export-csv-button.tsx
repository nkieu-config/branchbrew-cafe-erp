"use client";

import { useState } from "react";
import { Download } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { exportRowsToCsv, type CsvColumn } from "@/lib/export/csv";
import { getErrorMessage } from "@/lib/errors";
import { text } from "@/lib/theme/surface";
import { cn } from "@/lib/utils";

type ExportCsvButtonProps<T> = {
  filenameBase: string;
  columns: readonly CsvColumn<T>[];
  /** Rows already in memory. Ignored when {@link loadRows} is given. */
  rows?: readonly T[];
  /**
   * Fetches every row matching the current filters. Required for server-paginated
   * tables, where the rows in memory are only the visible page.
   */
  loadRows?: () => Promise<readonly T[]>;
  label?: string;
  disabled?: boolean;
  className?: string;
};

export function ExportCsvButton<T>({
  filenameBase,
  columns,
  rows,
  loadRows,
  label = "Export CSV",
  disabled = false,
  className,
}: ExportCsvButtonProps<T>) {
  const [isExporting, setIsExporting] = useState(false);
  const isEmpty = !loadRows && (rows?.length ?? 0) === 0;

  const handleExport = async () => {
    if (!loadRows) {
      exportRowsToCsv(filenameBase, rows ?? [], columns);
      return;
    }

    setIsExporting(true);
    try {
      const all = await loadRows();
      if (all.length === 0) {
        toast.info("Nothing to export for the current filters");
        return;
      }
      exportRowsToCsv(filenameBase, all, columns);
      toast.success(`Exported ${all.length} rows`);
    } catch (error) {
      toast.error(getErrorMessage(error, "Export failed"));
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      loading={isExporting}
      disabled={disabled || isEmpty}
      onClick={() => void handleExport()}
      className={cn("min-h-[44px]", text.secondary, className)}
      title={isEmpty ? "Nothing to export" : label}
      data-testid="export-csv"
    >
      {!isExporting && <Download className="mr-1.5 h-4 w-4" aria-hidden />}
      {isExporting ? "Exporting…" : label}
    </Button>
  );
}
