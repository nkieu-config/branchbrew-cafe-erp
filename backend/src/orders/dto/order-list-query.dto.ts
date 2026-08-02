import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, MaxLength, Min } from 'class-validator';
import { OrderStatus } from '@prisma/client';
import { PaginationQueryDto } from '../../common/pagination/pagination-query.dto';
import { IsCalendarDate } from '../../common/validation/is-calendar-date.decorator';

export const ORDER_LIST_DEFAULT_LIMIT = 50;
export const ORDER_LIST_DEFAULT_LOOKBACK_DAYS = 14;
export const ORDER_LIST_MAX_SEARCH_LENGTH = 64;

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

  @ApiPropertyOptional({
    enum: OrderStatus,
    description: 'Restrict to a single order status',
  })
  @IsOptional()
  @IsEnum(OrderStatus)
  status?: OrderStatus;

  @ApiPropertyOptional({
    description: 'Matches order id, queue number or payment method',
    maxLength: ORDER_LIST_MAX_SEARCH_LENGTH,
  })
  @IsOptional()
  @MaxLength(ORDER_LIST_MAX_SEARCH_LENGTH)
  search?: string;
}
