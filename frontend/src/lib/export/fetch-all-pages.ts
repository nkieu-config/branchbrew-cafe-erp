import { fetchAPI } from '@/lib/api';

export const EXPORT_PAGE_SIZE = 500;
export const EXPORT_MAX_ROWS = 20_000;

type Page<T> = { items: T[]; total: number };

/**
 * Walks a paginated endpoint so an export covers every row matching the current
 * filters, not just the page on screen. Capped so a mis-filtered export cannot
 * pull an unbounded amount of data.
 */
export async function fetchAllPages<T>(
  buildUrl: (window: { limit: number; offset: number }) => string,
  maxRows: number = EXPORT_MAX_ROWS,
): Promise<T[]> {
  const rows: T[] = [];
  let offset = 0;

  for (;;) {
    const page: Page<T> = await fetchAPI(
      buildUrl({ limit: EXPORT_PAGE_SIZE, offset }),
    );
    const items = page?.items ?? [];
    rows.push(...items);

    offset += items.length;
    const done =
      items.length === 0 ||
      items.length < EXPORT_PAGE_SIZE ||
      offset >= (page?.total ?? 0) ||
      rows.length >= maxRows;
    if (done) break;
  }

  return rows.slice(0, maxRows);
}
