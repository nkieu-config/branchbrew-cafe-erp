import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';

export const DEFAULT_PAGE_SIZE = 50;
export const MAX_PAGE_SIZE = 500;

export class PaginationQueryDto {
  @ApiPropertyOptional({
    minimum: 1,
    maximum: MAX_PAGE_SIZE,
    description: `Rows to return, capped at ${MAX_PAGE_SIZE}`,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_PAGE_SIZE)
  limit?: number;

  @ApiPropertyOptional({ minimum: 0, description: 'Rows to skip' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  offset?: number;
}

export function resolvePageWindow(
  query: PaginationQueryDto,
  defaultLimit: number = DEFAULT_PAGE_SIZE,
): { take: number; skip: number } {
  return {
    take: Math.min(query.limit ?? defaultLimit, MAX_PAGE_SIZE),
    skip: query.offset ?? 0,
  };
}
