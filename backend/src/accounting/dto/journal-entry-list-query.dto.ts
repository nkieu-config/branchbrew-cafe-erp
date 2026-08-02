import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, MaxLength, Min } from 'class-validator';
import { JournalStatus } from '@prisma/client';
import { PaginationQueryDto } from '../../common/pagination/pagination-query.dto';

export const JOURNAL_ENTRY_LIST_DEFAULT_LIMIT = 50;
export const JOURNAL_ENTRY_MAX_SEARCH_LENGTH = 64;

export class JournalEntryListQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  branchId?: number;

  @ApiPropertyOptional({
    enum: JournalStatus,
    description: 'Restrict to a single journal status',
  })
  @IsOptional()
  @IsEnum(JournalStatus)
  status?: JournalStatus;

  @ApiPropertyOptional({
    description: 'Matches entry id, reference or description',
    maxLength: JOURNAL_ENTRY_MAX_SEARCH_LENGTH,
  })
  @IsOptional()
  @MaxLength(JOURNAL_ENTRY_MAX_SEARCH_LENGTH)
  search?: string;
}
