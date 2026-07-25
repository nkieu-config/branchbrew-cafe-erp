const BANGKOK_UTC_OFFSET_HOURS = 7;

export const SEED_VAT_RATE_PERCENT = 7;

export function dateMinutesAgo(minutes: number): Date {
  return new Date(Date.now() - minutes * 60_000);
}

export function dateDaysAgo(days: number, hour = 12, minute = 0): Date {
  return dateAtDayOffset(-days, hour, minute);
}

export function dateAtDayOffset(dayOffset: number, hour: number, minute = 0): Date {
  const nowBangkok = new Date(Date.now() + BANGKOK_UTC_OFFSET_HOURS * 3_600_000);
  return new Date(
    Date.UTC(
      nowBangkok.getUTCFullYear(),
      nowBangkok.getUTCMonth(),
      nowBangkok.getUTCDate() + dayOffset,
      hour - BANGKOK_UTC_OFFSET_HOURS,
      minute,
    ),
  );
}

export function shiftWindow(dayOffset: number, startHour: number, endHour: number) {
  return {
    startTime: dateAtDayOffset(dayOffset, startHour),
    endTime: dateAtDayOffset(dayOffset, endHour),
  };
}

export function settlementDifference(
  expected: { cash: number; card: number; qr: number },
  actual: { cash: number; card: number; qr: number },
): number {
  const totalExpected = expected.cash + expected.card + expected.qr;
  const totalActual = actual.cash + actual.card + actual.qr;
  return Math.round((totalActual - totalExpected) * 100) / 100;
}
