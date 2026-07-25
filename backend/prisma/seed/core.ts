import * as bcrypt from 'bcrypt';
import { DEFAULT_CHART_OF_ACCOUNTS } from '../../src/accounting/chart-of-accounts';
import { inclusiveTaxAmount } from '../../src/common/vat.util';
import { SEED_VAT_RATE_PERCENT } from './helpers';
import {
  getQueueBusinessDateString,
  parseQueueBusinessDate,
} from '../../src/orders/helpers/queue-number.helper';
import type { SeedContext } from './types';
import type { PrismaClient } from '@prisma/client';

export async function seedCore(prisma: PrismaClient): Promise<SeedContext> {
  console.log('Seeding database with demo cafe data...');

  const hashedPassword = await bcrypt.hash('password123', 10);

  const mainBranch = await prisma.branch.create({
    data: { name: 'Downtown Branch', location: 'Bangkok' },
  });
  const secondBranch = await prisma.branch.create({
    data: { name: 'Riverside Branch', location: 'Bangkok' },
  });
  const centralKitchen = await prisma.branch.create({
    data: {
      name: 'BranchBrew Central Kitchen',
      location: 'Bangkok',
      isCentralKitchen: true,
    },
  });

  const admin = await prisma.user.create({
    data: {
      email: 'admin@branchbrew.dev',
      name: 'Super Admin',
      password: hashedPassword,
      role: 'SUPER_ADMIN',
    },
  });

  const manager = await prisma.user.create({
    data: {
      email: 'manager@branchbrew.dev',
      name: 'Downtown Manager',
      password: hashedPassword,
      role: 'MANAGER',
      branchId: mainBranch.id,
      employmentType: 'FULL_TIME',
      baseSalary: 28000,
      hourlyRate: 160,
    },
  });

  const staff = await prisma.user.create({
    data: {
      email: 'staff.downtown@branchbrew.dev',
      name: 'Downtown Cashier',
      password: hashedPassword,
      role: 'STAFF',
      branchId: mainBranch.id,
      employmentType: 'PART_TIME',
      hourlyRate: 65,
    },
  });

  const asokManager = await prisma.user.create({
    data: {
      email: 'manager.riverside@branchbrew.dev',
      name: 'Riverside Manager',
      password: hashedPassword,
      role: 'MANAGER',
      branchId: secondBranch.id,
      employmentType: 'FULL_TIME',
      baseSalary: 26000,
      hourlyRate: 150,
    },
  });

  const asokStaff = await prisma.user.create({
    data: {
      email: 'staff.riverside@branchbrew.dev',
      name: 'Riverside Barista',
      password: hashedPassword,
      role: 'STAFF',
      branchId: secondBranch.id,
      employmentType: 'PART_TIME',
      hourlyRate: 62,
    },
  });

  const supplier1 = await prisma.supplier.create({
    data: { name: 'Global Coffee Beans Roaster', contactEmail: 'sales@gcr.com', phone: '0812345678' },
  });
  const supplier2 = await prisma.supplier.create({
    data: { name: 'Fresh Dairy Co.', contactEmail: 'orders@freshdairy.example', phone: '0898765432' },
  });

  const coffeeBeans = await prisma.ingredient.create({
    data: { name: 'Espresso Beans', unit: 'g', costPerUnit: 0.5, primarySupplierId: supplier1.id },
  });
  const milk = await prisma.ingredient.create({
    data: { name: 'Whole Milk', unit: 'ml', costPerUnit: 0.05, primarySupplierId: supplier2.id },
  });
  const cup = await prisma.ingredient.create({
    data: { name: 'Paper Cup', unit: 'pcs', costPerUnit: 3.5, primarySupplierId: supplier1.id },
  });
  const syrup = await prisma.ingredient.create({
    data: { name: 'Vanilla Syrup', unit: 'ml', costPerUnit: 0.2, primarySupplierId: supplier1.id },
  });
  const oatMilk = await prisma.ingredient.create({
    data: { name: 'Oat Milk', unit: 'ml', costPerUnit: 0.08, primarySupplierId: supplier2.id },
  });
  const almondMilk = await prisma.ingredient.create({
    data: { name: 'Almond Milk', unit: 'ml', costPerUnit: 0.09, primarySupplierId: supplier2.id },
  });
  const coldBrewBase = await prisma.ingredient.create({
    data: {
      name: 'House Cold Brew Base',
      unit: 'ml',
      costPerUnit: 0.12,
      primarySupplierId: supplier1.id,
    },
  });

  const inventoryRows = [
    { branchId: mainBranch.id, ingredientId: coffeeBeans.id, stock: 5000, minStock: 1000 },
    { branchId: mainBranch.id, ingredientId: milk.id, stock: 10000, minStock: 2000 },
    { branchId: mainBranch.id, ingredientId: cup.id, stock: 500, minStock: 100 },
    { branchId: mainBranch.id, ingredientId: syrup.id, stock: 1000, minStock: 200 },
    { branchId: mainBranch.id, ingredientId: oatMilk.id, stock: 3000, minStock: 500 },
    { branchId: mainBranch.id, ingredientId: almondMilk.id, stock: 2000, minStock: 500 },
    { branchId: secondBranch.id, ingredientId: coffeeBeans.id, stock: 2000, minStock: 1000 },
    { branchId: secondBranch.id, ingredientId: milk.id, stock: 3000, minStock: 2000 },
    { branchId: secondBranch.id, ingredientId: cup.id, stock: 150, minStock: 100 },
    { branchId: secondBranch.id, ingredientId: syrup.id, stock: 500, minStock: 200 },
    { branchId: secondBranch.id, ingredientId: oatMilk.id, stock: 800, minStock: 500 },
    { branchId: secondBranch.id, ingredientId: almondMilk.id, stock: 600, minStock: 500 },
    { branchId: centralKitchen.id, ingredientId: coffeeBeans.id, stock: 20000, minStock: 5000 },
    { branchId: centralKitchen.id, ingredientId: coldBrewBase.id, stock: 2000, minStock: 500 },
    { branchId: mainBranch.id, ingredientId: coldBrewBase.id, stock: 400, minStock: 200 },
  ];
  await prisma.branchInventory.createMany({ data: inventoryRows });
  const futureExpiry = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  await prisma.inventoryBatch.createMany({
    data: inventoryRows.map((row) => ({
      branchId: row.branchId,
      ingredientId: row.ingredientId,
      quantity: row.stock,
      status: 'ACTIVE' as const,
      expiryDate: futureExpiry,
    })),
  });

  // Demo batch past expiry — auto-waste cron will dispose on next hourly run
  await prisma.inventoryBatch.create({
    data: {
      branchId: mainBranch.id,
      ingredientId: oatMilk.id,
      quantity: 250,
      status: 'ACTIVE',
      expiryDate: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
    },
  });

  await prisma.productionBOM.create({
    data: {
      targetIngredientId: coldBrewBase.id,
      rawIngredientId: coffeeBeans.id,
      quantityNeeded: 0.5,
    },
  });

  const plannedDate = new Date();
  plannedDate.setDate(plannedDate.getDate() + 1);
  await prisma.productionOrder.createMany({
    data: [
      {
        orderNumber: 'PRD-DEMO-001',
        branchId: centralKitchen.id,
        targetIngredientId: coldBrewBase.id,
        quantityToProduce: 1000,
        status: 'PLANNED',
        plannedStartDate: plannedDate,
      },
      {
        orderNumber: 'PRD-DEMO-002',
        branchId: centralKitchen.id,
        targetIngredientId: coldBrewBase.id,
        quantityToProduce: 500,
        status: 'IN_PROGRESS',
      },
    ],
  });

  const tempGroup = await prisma.modifierGroup.create({
    data: {
      name: 'Temperature',
      category: 'Coffee',
      sortOrder: 1,
      options: {
        create: [
          { name: 'Hot', priceDelta: 0, isDefault: false, sortOrder: 1 },
          { name: 'Iced', priceDelta: 0, isDefault: true, sortOrder: 2 },
          { name: 'Frappe', priceDelta: 10, isDefault: false, sortOrder: 3 },
        ],
      },
    },
    include: { options: true },
  });

  await prisma.modifierGroup.create({
    data: {
      name: 'Sweetness',
      category: 'Coffee',
      sortOrder: 2,
      options: {
        create: [
          { name: '0%', priceDelta: 0, sortOrder: 1 },
          { name: '50%', priceDelta: 0, sortOrder: 2 },
          { name: '100%', priceDelta: 0, isDefault: true, sortOrder: 3 },
          { name: '150%', priceDelta: 5, sortOrder: 4 },
        ],
      },
    },
  });

  await prisma.modifierGroup.create({
    data: {
      name: 'Milk Type',
      category: 'Coffee',
      sortOrder: 3,
      swapIngredientId: milk.id,
      options: {
        create: [
          { name: 'Normal', priceDelta: 0, isDefault: true, sortOrder: 1 },
          { name: 'Oat', priceDelta: 15, sortOrder: 2, swapToIngredientId: oatMilk.id },
          { name: 'Almond', priceDelta: 15, sortOrder: 3, swapToIngredientId: almondMilk.id },
        ],
      },
    },
  });

  await prisma.product.create({
    data: {
      name: 'Espresso',
      price: 60,
      category: 'Coffee',
      recipeItems: {
        create: [
          { ingredientId: coffeeBeans.id, quantity: 18 },
          { ingredientId: cup.id, quantity: 1 },
        ],
      },
    },
  });

  const icedLatte = await prisma.product.create({
    data: {
      name: 'Iced Latte',
      price: 85,
      category: 'Coffee',
      recipeItems: {
        create: [
          { ingredientId: coffeeBeans.id, quantity: 18 },
          { ingredientId: milk.id, quantity: 150 },
          { ingredientId: cup.id, quantity: 1 },
        ],
      },
    },
  });

  const croissant = await prisma.product.create({
    data: {
      name: 'Croissant',
      price: 45,
      category: 'Bakery',
      recipeItems: { create: [] },
    },
  });

  const cappuccino = await prisma.product.create({
    data: {
      name: 'Cappuccino',
      price: 52,
      category: 'Coffee',
      recipeItems: {
        create: [
          { ingredientId: coffeeBeans.id, quantity: 18 },
          { ingredientId: milk.id, quantity: 120 },
          { ingredientId: cup.id, quantity: 1 },
        ],
      },
    },
  });

  const vanillaLatte = await prisma.product.create({
    data: {
      name: 'Vanilla Latte',
      price: 65,
      category: 'Coffee',
      recipeItems: {
        create: [
          { ingredientId: coffeeBeans.id, quantity: 18 },
          { ingredientId: milk.id, quantity: 150 },
          { ingredientId: cup.id, quantity: 1 },
          { ingredientId: syrup.id, quantity: 50 },
        ],
      },
    },
  });

  await prisma.product.create({
    data: {
      name: 'Matcha Latte',
      price: 90,
      category: 'Coffee',
      recipeItems: {
        create: [
          { ingredientId: milk.id, quantity: 180 },
          { ingredientId: cup.id, quantity: 1 },
          { ingredientId: syrup.id, quantity: 30 },
        ],
      },
    },
  });

  const customer = await prisma.customer.create({
    data: { phone: '0811111111', name: 'Demo Member', points: 120, tier: 'SILVER' },
  });

  const goldCustomer = await prisma.customer.create({
    data: { phone: '0822222222', name: 'Gold Member', points: 450, tier: 'GOLD' },
  });

  await prisma.customer.createMany({
    data: [
      { phone: '0833333333', name: 'Walk-in Regular', points: 0, tier: 'REGULAR' },
      { phone: '0844444444', name: 'Corporate Client', points: 890, tier: 'GOLD' },
      { phone: '0855555555', name: 'Student Regular', points: 35, tier: 'REGULAR' },
      { phone: '0866666666', name: 'Silver Fan', points: 210, tier: 'SILVER' },
      { phone: '0877777777', name: 'Tourist Guest', points: 15, tier: 'REGULAR' },
    ],
  });

  await prisma.promotion.create({
    data: {
      code: 'WELCOME10',
      description: '10% off for demo',
      discountType: 'PERCENTAGE',
      discountValue: 10,
      minPurchase: 100,
      isActive: true,
    },
  });

  await prisma.systemSetting.createMany({
    data: [
      { key: 'company_name', value: 'BranchBrew Demo' },
      { key: 'tax_id', value: '0105560000000' },
      { key: 'vat_rate', value: '7' },
      { key: 'currency', value: 'THB' },
      { key: 'receipt_footer', value: 'Thank you for visiting BranchBrew' },
    ],
  });

  for (const acct of DEFAULT_CHART_OF_ACCOUNTS) {
    await prisma.account.create({ data: acct });
  }

  const hotOption = tempGroup.options.find((o) => o.name === 'Hot');
  const oatOption = await prisma.modifierOption.findFirst({
    where: { name: 'Oat', group: { name: 'Milk Type' } },
  });

  await prisma.order.create({
    data: {
      userId: staff.id,
      branchId: mainBranch.id,
      status: 'PENDING',
      paymentMethod: 'CASH',
      totalAmount: 100,
      netAmount: 100,
      discountAmount: 0,
      taxAmount: inclusiveTaxAmount(100, SEED_VAT_RATE_PERCENT),
      totalCogs: 18 * 0.5 + 150 * 0.05 + 3.5,
      queueNumber: 1,
      queueDate: parseQueueBusinessDate(getQueueBusinessDateString()),
      items: {
        create: [
          {
            productId: icedLatte.id,
            quantity: 1,
            price: 100,
            notes: 'Extra hot — rush',
            modifiers: {
              create: [
                ...(hotOption
                  ? [{ optionId: hotOption.id, optionName: 'Temperature: Hot', priceDelta: 0 }]
                  : []),
                ...(oatOption
                  ? [{ optionId: oatOption.id, optionName: 'Milk Type: Oat', priceDelta: 15 }]
                  : []),
              ],
            },
          },
        ],
      },
    },
  });

  await prisma.purchaseOrder.create({
    data: {
      poNumber: 'PO-DEMO-001',
      branchId: mainBranch.id,
      supplierId: supplier1.id,
      status: 'APPROVED',
      items: {
        create: [{ ingredientId: coffeeBeans.id, quantityRequested: 1000, unitPrice: 0.45 }],
      },
    },
  });

  return {
    prisma,
    mainBranch,
    secondBranch,
    centralKitchen,
    admin,
    manager,
    staff,
    asokManager,
    asokStaff,
    supplier1,
    supplier2,
    coffeeBeans,
    milk,
    cup,
    syrup,
    oatMilk,
    almondMilk,
    coldBrewBase,
    icedLatte,
    cappuccino,
    vanillaLatte,
    croissant,
    customer,
    goldCustomer,
    tempGroup,
  };
}
