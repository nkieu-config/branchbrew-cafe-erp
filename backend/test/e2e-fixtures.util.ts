import * as bcrypt from 'bcrypt';
import { DEFAULT_CHART_OF_ACCOUNTS } from '../src/accounting/domain/chart-of-accounts';
import { PrismaService } from '../src/prisma/prisma.service';

export const E2E_PASSWORD = 'password123';

export async function seedPosFixture(prisma: PrismaService) {
  const branch = await prisma.branch.create({
    data: { name: 'E2E POS Branch', location: 'Metro City' },
  });

  const email = 'pos-staff@e2e.test';
  const user = await prisma.user.create({
    data: {
      email,
      name: 'POS Staff',
      password: await bcrypt.hash(E2E_PASSWORD, 10),
      role: 'STAFF',
      branchId: branch.id,
    },
  });

  const managerEmail = 'pos-manager@e2e.test';
  const manager = await prisma.user.create({
    data: {
      email: managerEmail,
      name: 'POS Manager',
      password: await bcrypt.hash(E2E_PASSWORD, 10),
      role: 'MANAGER',
      branchId: branch.id,
    },
  });

  await prisma.systemSetting.upsert({
    where: { key: 'vat_rate' },
    update: { value: '7' },
    create: { key: 'vat_rate', value: '7' },
  });

  for (const acct of DEFAULT_CHART_OF_ACCOUNTS) {
    await prisma.account.upsert({
      where: { code: acct.code },
      update: {},
      create: acct,
    });
  }

  const ingredient = await prisma.ingredient.create({
    data: { name: 'E2E Beans', unit: 'g', costPerUnit: 1 },
  });

  await prisma.branchInventory.create({
    data: {
      branchId: branch.id,
      ingredientId: ingredient.id,
      stock: 1000,
      minStock: 100,
    },
  });

  await prisma.inventoryBatch.create({
    data: {
      branchId: branch.id,
      ingredientId: ingredient.id,
      quantity: 1000,
      status: 'ACTIVE',
    },
  });

  const product = await prisma.product.create({
    data: {
      name: 'E2E Latte',
      price: 100,
      category: 'Coffee',
      recipeItems: {
        create: [{ ingredientId: ingredient.id, quantity: 20 }],
      },
    },
  });

  return { branch, user, manager, product, ingredient, email, managerEmail };
}

export async function cleanupPosFixture(prisma: PrismaService, email: string) {
  const user = await prisma.user.findUnique({ where: { email } });
  const manager = await prisma.user.findUnique({
    where: { email: 'pos-manager@e2e.test' },
  });
  const userIds = [user?.id, manager?.id].filter(Boolean) as number[];
  if (userIds.length === 0) return;

  await prisma.journalEntryLine.deleteMany({
    where: { journalEntry: { branch: { name: 'E2E POS Branch' } } },
  });
  await prisma.journalEntry.deleteMany({
    where: { branch: { name: 'E2E POS Branch' } },
  });
  await prisma.orderItemModifier.deleteMany({
    where: { orderItem: { order: { userId: { in: userIds } } } },
  });
  await prisma.orderItem.deleteMany({
    where: { order: { userId: { in: userIds } } },
  });
  await prisma.order.deleteMany({ where: { userId: { in: userIds } } });
  await prisma.recipeItem.deleteMany({
    where: { product: { name: 'E2E Latte' } },
  });
  await prisma.product.deleteMany({ where: { name: 'E2E Latte' } });
  await prisma.inventoryBatch.deleteMany({
    where: { ingredient: { name: 'E2E Beans' } },
  });
  await prisma.branchInventory.deleteMany({
    where: { branch: { name: 'E2E POS Branch' } },
  });
  await prisma.ingredient.deleteMany({ where: { name: 'E2E Beans' } });
  await prisma.auditLog.deleteMany({ where: { userId: { in: userIds } } });
  await prisma.user.deleteMany({
    where: { email: { in: [email, 'pos-manager@e2e.test'] } },
  });
  await prisma.branch.deleteMany({ where: { name: 'E2E POS Branch' } });
}
