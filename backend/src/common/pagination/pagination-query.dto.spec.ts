import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import {
  DEFAULT_PAGE_SIZE,
  MAX_PAGE_SIZE,
  PaginationQueryDto,
  resolvePageWindow,
} from './pagination-query.dto';

function validate(query: Record<string, unknown>) {
  const dto = plainToInstance(PaginationQueryDto, query, {
    enableImplicitConversion: false,
  });
  return { dto, errors: validateSync(dto) };
}

describe('PaginationQueryDto', () => {
  it('accepts an absent window', () => {
    const { errors } = validate({});
    expect(errors).toHaveLength(0);
  });

  it('coerces numeric strings from the query string', () => {
    const { dto, errors } = validate({ limit: '25', offset: '50' });
    expect(errors).toHaveLength(0);
    expect(dto.limit).toBe(25);
    expect(dto.offset).toBe(50);
  });

  it.each([
    { limit: '0' },
    { limit: '-1' },
    { limit: 'ten' },
    { limit: '1.5' },
  ])('rejects %p', (query) => {
    expect(validate(query).errors.length).toBeGreaterThan(0);
  });

  it('rejects a limit above the cap instead of silently clamping it', () => {
    const { errors } = validate({ limit: String(MAX_PAGE_SIZE + 1) });
    expect(errors).toHaveLength(1);
    expect(errors[0].constraints).toHaveProperty('max');
  });

  it('rejects a negative offset', () => {
    expect(validate({ offset: '-1' }).errors.length).toBeGreaterThan(0);
  });
});

describe('resolvePageWindow', () => {
  it('falls back to the default page size', () => {
    expect(resolvePageWindow({})).toEqual({
      take: DEFAULT_PAGE_SIZE,
      skip: 0,
    });
  });

  it('honours a per-endpoint default', () => {
    expect(resolvePageWindow({}, 200)).toEqual({ take: 200, skip: 0 });
  });

  it('caps a per-endpoint default that exceeds the maximum', () => {
    expect(resolvePageWindow({}, MAX_PAGE_SIZE * 2).take).toBe(MAX_PAGE_SIZE);
  });

  it('uses the requested window when it is within the cap', () => {
    expect(resolvePageWindow({ limit: 10, offset: 30 })).toEqual({
      take: 10,
      skip: 30,
    });
  });
});
