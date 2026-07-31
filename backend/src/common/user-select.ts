import { Prisma } from '@prisma/client';

export const SAFE_USER_SELECT = {
  id: true,
  name: true,
  email: true,
  role: true,
  branchId: true,
} satisfies Prisma.UserSelect;
