import { IsIn } from 'class-validator';

export const LEAVE_DECISIONS = ['APPROVED', 'REJECTED'] as const;

export type LeaveDecision = (typeof LEAVE_DECISIONS)[number];

export class ProcessLeaveDto {
  @IsIn(LEAVE_DECISIONS)
  status: LeaveDecision;
}
