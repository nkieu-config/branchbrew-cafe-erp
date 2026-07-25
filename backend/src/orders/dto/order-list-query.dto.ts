import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, Min } from 'class-validator';
import { PaginationQueryDto } from '../../common/pagination/pagination-query.dto';
import { IsCalendarDate } from '../../common/validation/is-calendar-date.decorator';

export const ORDER_LIST_DEFAULT_LIMIT = 200;
export const ORDER_LIST_DEFAULT_LOOKBACK_DAYS = 14;

export class OrderListQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  branchId?: number;

  @ApiPropertyOptional({
    example: '2026-07-11',
    description: `Oldest order date to include; defaults to ${ORDER_LIST_DEFAULT_LOOKBACK_DAYS} days back`,
  })
  @IsOptional()
  @IsCalendarDate()
  since?: string;
}
