/** Shared Prisma include for kitchen display payloads (REST + WebSocket). */
export const kdsOrderInclude = {
  items: {
    include: {
      product: true,
      modifiers: true,
    },
  },
  customer: { select: { id: true, name: true, tier: true } },
} as const;
