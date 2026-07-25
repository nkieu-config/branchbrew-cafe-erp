import { Type, applyDecorators } from '@nestjs/common';
import {
  ApiExtraModels,
  ApiHideProperty,
  ApiOkResponse,
  ApiProperty,
  getSchemaPath,
} from '@nestjs/swagger';

export class PaginatedResponseDto<T> {
  @ApiHideProperty()
  items: T[];

  @ApiProperty({ example: 412, description: 'Rows matching the query' })
  total: number;

  @ApiProperty({ example: 50, description: 'Rows returned in this page' })
  limit: number;

  @ApiProperty({ example: 0 })
  offset: number;
}

export function paginated<T>(
  items: T[],
  total: number,
  window: { take: number; skip: number },
): PaginatedResponseDto<T> {
  return { items, total, limit: window.take, offset: window.skip };
}

export function ApiPaginatedResponse<TModel extends Type<unknown>>(
  model: TModel,
  description: string,
) {
  return applyDecorators(
    ApiExtraModels(PaginatedResponseDto, model),
    ApiOkResponse({
      description,
      schema: {
        allOf: [
          { $ref: getSchemaPath(PaginatedResponseDto) },
          {
            required: ['items'],
            properties: {
              items: { type: 'array', items: { $ref: getSchemaPath(model) } },
            },
          },
        ],
      },
    }),
  );
}
