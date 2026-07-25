import { BadRequestException } from '@nestjs/common';
import { parseOptionalDateString } from './query-params.util';

describe('parseOptionalDateString', () => {
  it('returns undefined for an absent or empty value', () => {
    expect(parseOptionalDateString(undefined, 'asOf')).toBeUndefined();
    expect(parseOptionalDateString('', 'asOf')).toBeUndefined();
  });

  it('passes a well-formed date through untouched', () => {
    expect(parseOptionalDateString('2026-07-25', 'asOf')).toBe('2026-07-25');
    expect(parseOptionalDateString('2024-02-29', 'asOf')).toBe('2024-02-29');
  });

  it.each([
    'not-a-date',
    '25-07-2026',
    '2026-7-5',
    '2026-07-25T00:00:00Z',
    "2026-07-25'; DROP TABLE",
  ])('rejects the malformed value %p', (value) => {
    expect(() => parseOptionalDateString(value, 'asOf')).toThrow(
      BadRequestException,
    );
  });

  it.each(['2026-02-31', '2026-13-01', '2025-02-29'])(
    'rejects %p, which is well-formed but not a real day',
    (value) => {
      expect(() => parseOptionalDateString(value, 'asOf')).toThrow(
        'asOf is not a valid calendar date.',
      );
    },
  );
});
