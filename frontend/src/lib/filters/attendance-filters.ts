import {
  differenceInMinutes,
  endOfDay,
  isSameDay,
  startOfDay,
} from "date-fns";
import type { Shift } from "@/types/api";

export const ATTENDANCE_LATE_THRESHOLD_MINUTES = 15;

export type AttendanceRecordRow = {
  id: number;
  clockIn: string;
  clockOut?: string | null;
  totalHours?: number | null;
  branch?: { id: number; name: string } | null;
  user?: { role?: string };
};

export type AttendanceStatusFilter = "ALL" | "active" | "late" | "on-time";

export function findShiftForClockIn(
  shifts: Shift[],
  clockIn: string | Date,
): Shift | undefined {
  const clockInDate = new Date(clockIn);
  return shifts.find((shift) => isSameDay(new Date(shift.startTime), clockInDate));
}

export function getLateMinutes(clockIn: string | Date, shift: Shift): number {
  return differenceInMinutes(new Date(clockIn), new Date(shift.startTime));
}

export function isAttendanceLate(
  clockIn: string | Date,
  shifts: Shift[],
  thresholdMinutes = ATTENDANCE_LATE_THRESHOLD_MINUTES,
): { isLate: boolean; lateMinutes: number; shift?: Shift } {
  const shift = findShiftForClockIn(shifts, clockIn);
  if (!shift) return { isLate: false, lateMinutes: 0 };
  const lateMinutes = getLateMinutes(clockIn, shift);
  return {
    isLate: lateMinutes > thresholdMinutes,
    lateMinutes,
    shift,
  };
}

export function isActiveRecord(record: AttendanceRecordRow): boolean {
  return record.clockOut == null;
}

export function summarizeAttendance(records: AttendanceRecordRow[], shifts: Shift[]) {
  let active = 0;
  let late = 0;
  let totalHours = 0;

  for (const record of records) {
    if (isActiveRecord(record)) {
      active += 1;
    } else if (record.totalHours != null && record.totalHours > 0) {
      totalHours += record.totalHours;
    }
    if (isAttendanceLate(record.clockIn, shifts).isLate) {
      late += 1;
    }
  }

  return {
    total: records.length,
    active,
    late,
    onTime: records.length - late,
    totalHours,
  };
}

export function matchesAttendanceDateRange(
  record: AttendanceRecordRow,
  startDate: Date | null,
  endDate: Date | null,
): boolean {
  const clockIn = new Date(record.clockIn);
  if (startDate && clockIn < startOfDay(startDate)) return false;
  if (endDate && clockIn > endOfDay(endDate)) return false;
  return true;
}

export function matchesAttendanceStatusFilter(
  record: AttendanceRecordRow,
  filter: AttendanceStatusFilter,
  shifts: Shift[],
): boolean {
  if (filter === "ALL") return true;
  if (filter === "active") return isActiveRecord(record);
  const { isLate } = isAttendanceLate(record.clockIn, shifts);
  if (filter === "late") return isLate;
  if (filter === "on-time") return !isLate;
  return true;
}

export function filterAttendance(
  records: AttendanceRecordRow[],
  options: {
    statusFilter: AttendanceStatusFilter;
    startDate: Date | null;
    endDate: Date | null;
    shifts: Shift[];
  },
): AttendanceRecordRow[] {
  return records.filter(
    (record) =>
      matchesAttendanceDateRange(record, options.startDate, options.endDate) &&
      matchesAttendanceStatusFilter(record, options.statusFilter, options.shifts),
  );
}
export const ATTENDANCE_PAGE_SIZE_DEFAULT = 30;
