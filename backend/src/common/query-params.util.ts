import { BadRequestException } from '@nestjs/common';

export function parseOptionalPositiveInt(
  value: string | undefined,
  name: string,
): number | undefined {
  if (value == null || value === '') return undefined;

  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new BadRequestException(`${name} must be a positive integer.`);
  }

  return parsed;
}

export function parseOptionalNonNegativeInt(
  value: string | undefined,
  name: string,
): number | undefined {
  if (value == null || value === '') return undefined;

  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 0) {
    throw new BadRequestException(`${name} must be a non-negative integer.`);
  }

  return parsed;
}

const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export function isCalendarDate(value: unknown): value is string {
  if (typeof value !== 'string' || !ISO_DATE_PATTERN.test(value)) return false;

  const [year, month, day] = value.split('-').map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));

  return (
    parsed.getUTCFullYear() === year &&
    parsed.getUTCMonth() === month - 1 &&
    parsed.getUTCDate() === day
  );
}

export function parseOptionalDateString(
  value: string | undefined,
  name: string,
): string | undefined {
  if (value == null || value === '') return undefined;

  if (!ISO_DATE_PATTERN.test(value)) {
    throw new BadRequestException(`${name} must be a date in YYYY-MM-DD form.`);
  }

  if (!isCalendarDate(value)) {
    throw new BadRequestException(`${name} is not a valid calendar date.`);
  }

  return value;
}
