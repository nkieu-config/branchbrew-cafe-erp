export type CsvColumn<T> = {
  header: string;
  value: (row: T) => string | number | null | undefined;
};

const NEEDS_QUOTING = /[",\r\n]/;
const FORMULA_PREFIX = /^[=+\-@\t\r]/;

export function escapeCsvCell(value: string | number | null | undefined): string {
  if (value == null) return "";
  const raw = String(value);
  const safe = FORMULA_PREFIX.test(raw) ? `'${raw}` : raw;
  if (!NEEDS_QUOTING.test(safe)) return safe;
  return `"${safe.replace(/"/g, '""')}"`;
}

export function toCsv<T>(rows: readonly T[], columns: readonly CsvColumn<T>[]): string {
  const header = columns.map((column) => escapeCsvCell(column.header)).join(",");
  const body = rows.map((row) =>
    columns.map((column) => escapeCsvCell(column.value(row))).join(","),
  );
  return [header, ...body].join("\r\n");
}

export function buildCsvFilename(base: string, on: Date = new Date()): string {
  const stamp = [
    on.getFullYear(),
    String(on.getMonth() + 1).padStart(2, "0"),
    String(on.getDate()).padStart(2, "0"),
  ].join("");
  const slug = base
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return `${slug || "export"}-${stamp}.csv`;
}

export function downloadCsv(filename: string, csv: string): void {
  if (typeof document === "undefined") return;
  const blob = new Blob([`﻿${csv}`], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export function exportRowsToCsv<T>(
  base: string,
  rows: readonly T[],
  columns: readonly CsvColumn<T>[],
): void {
  downloadCsv(buildCsvFilename(base), toCsv(rows, columns));
}
