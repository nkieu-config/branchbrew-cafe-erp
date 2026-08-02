import { Prisma } from '@prisma/client';

export function buildJournalEntrySearchFilter(
  search?: string,
): Pick<Prisma.JournalEntryWhereInput, 'OR'> | Record<string, never> {
  const term = search?.trim();
  if (!term) return {};

  const clauses: Prisma.JournalEntryWhereInput[] = [
    { reference: { contains: term, mode: 'insensitive' } },
    { description: { contains: term, mode: 'insensitive' } },
  ];

  if (/^\d+$/.test(term)) {
    const id = Number(term);
    if (Number.isSafeInteger(id) && id > 0) clauses.push({ id });
  }

  return { OR: clauses };
}
