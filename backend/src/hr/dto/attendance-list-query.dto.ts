import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional } from 'class-validator';
import { PaginationQueryDto } from '../../common/pagination/pagination-query.dto';
import { IsCalendarDate } from '../../common/validation/is-calendar-date.decorator';

export const ATTENDANCE_LIST_DEFAULT_LIMIT = 30;

export class AttendanceListQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({
    example: '2026-07-01',
    description: 'Earliest clock-in date',
  })
  @IsOptional()
  @IsCalendarDate()
  from?: string;

  @ApiPropertyOptional({
    example: '2026-07-31',
    description: 'Latest clock-in date',
  })
  @IsOptional()
  @IsCalendarDate()
  to?: string;
}
