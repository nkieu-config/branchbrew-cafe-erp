import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ArrayMaxSize, ArrayNotEmpty, IsIn, IsInt, Min } from 'class-validator';
import { LEAVE_DECISIONS } from './process-leave.dto';
import type { LeaveDecision } from './process-leave.dto';

export const BULK_LEAVE_MAX_IDS = 100;

export class BulkProcessLeaveDto {
  @ApiProperty({
    type: [Number],
    maxItems: BULK_LEAVE_MAX_IDS,
    description: 'Leave request ids to decide in one action',
  })
  @ArrayNotEmpty()
  @ArrayMaxSize(BULK_LEAVE_MAX_IDS)
  @Type(() => Number)
  @IsInt({ each: true })
  @Min(1, { each: true })
  ids: number[];

  @ApiProperty({ enum: LEAVE_DECISIONS })
  @IsIn(LEAVE_DECISIONS)
  status: LeaveDecision;
}
