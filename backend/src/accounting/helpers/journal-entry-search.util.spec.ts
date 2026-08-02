import { buildJournalEntrySearchFilter } from './journal-entry-search.util';

describe('buildJournalEntrySearchFilter', () => {
  it('returns no constraint for an absent or blank term', () => {
    expect(buildJournalEntrySearchFilter(undefined)).toEqual({});
    expect(buildJournalEntrySearchFilter('  ')).toEqual({});
  });

  it('matches reference and description case-insensitively', () => {
    expect(buildJournalEntrySearchFilter('ord-100')).toEqual({
      OR: [
        { reference: { contains: 'ord-100', mode: 'insensitive' } },
        { description: { contains: 'ord-100', mode: 'insensitive' } },
      ],
    });
  });

  it('also matches the entry id when the term is numeric', () => {
    const filter = buildJournalEntrySearchFilter('42');
    expect(filter.OR).toContainEqual({ id: 42 });
  });

  it('does not treat zero as a searchable id', () => {
    const filter = buildJournalEntrySearchFilter('0');
    expect(filter.OR).not.toContainEqual({ id: 0 });
  });
});
