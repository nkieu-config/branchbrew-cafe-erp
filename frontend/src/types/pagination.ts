import type { components } from './generated/api';

export type Paginated<T> = components['schemas']['PaginatedResponseDto'] & {
  items: T[];
};
