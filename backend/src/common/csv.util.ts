const FORMULA_TRIGGER = /^[=+\-@\t\r]/;

export function escapeCsvCell(value: unknown): unknown {
  if (typeof value !== 'string') return value;
  return FORMULA_TRIGGER.test(value) ? `'${value}` : value;
}

export function escapeCsvRow(
  row: Record<string, unknown>,
): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(row).map(([key, value]) => [key, escapeCsvCell(value)]),
  );
}
