import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, MaxLength } from 'class-validator';
import { Tier } from '@prisma/client';
import { PaginationQueryDto } from '../../common/pagination/pagination-query.dto';

export const CUSTOMER_LIST_DEFAULT_LIMIT = 50;
export const CUSTOMER_MAX_SEARCH_LENGTH = 64;

export class CustomerListQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({
    description: 'Matches member name or phone',
    maxLength: CUSTOMER_MAX_SEARCH_LENGTH,
  })
  @IsOptional()
  @MaxLength(CUSTOMER_MAX_SEARCH_LENGTH)
  search?: string;

  @ApiPropertyOptional({
    enum: Tier,
    description: 'Restrict to one loyalty tier',
  })
  @IsOptional()
  @IsEnum(Tier)
  tier?: Tier;
}
