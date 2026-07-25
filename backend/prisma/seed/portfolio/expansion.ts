import {
  getQueueBusinessDateString,
  parseQueueBusinessDate,
} from '../../../src/orders/helpers/queue-number.helper';
import { inclusiveTaxAmount } from '../../../src/common/vat.util';
import {
  dateAtDayOffset,
  dateDaysAgo,
  dateMinutesAgo,
  SEED_VAT_RATE_PERCENT,
  settlementDifference,
  shiftWindow,
} from '../helpers';
import type { SeedContext } from '../types';

export async function seedExpansionDemo(ctx: SeedContext): Promise<void> {
  const {
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
    icedLatte,
    cappuccino,
    vanillaLatte,
    croissant,
    customer,
    goldCustomer,
    tempGroup,
  } = ctx;

  console.log('Seeding expanded demo data (all modules)...');

  const icedOption = tempGroup.options.find((o) => o.name === 'Iced');
  const hotOption = tempGroup.options.find((o) => o.name === 'Hot');
  const oatOption = await prisma.modifierOption.findFirst({
    where: { name: 'Oat', group: { name: 'Milk Type' } },
  });
  const welcomePromo = await prisma.promotion.findFirst({ where: { code: 'WELCOME10' } });
  const todayQueueDate = parseQueueBusinessDate(getQueueBusinessDateString());

  // ——— Promotions ———
  await prisma.promotion.createMany({
    data: [
      {
        code: 'SAVE20',
        description: '20 baht off orders over 150 baht',
        discountType: 'FIXED_AMOUNT',
        discountValue: 20,
        minPurchase: 150,
        isActive: true,
      },
      {
        code: 'SUMMER24',
        description: 'Expired summer campaign',
        discountType: 'PERCENTAGE',
        discountValue: 15,
        minPurchase: 200,
        isActive: false,
      },
    ],
  });

  // ——— Procurement ———
  await prisma.purchaseOrder.createMany({
    data: [
      {
        poNumber: 'PO-DEMO-002',
        branchId: mainBranch.id,
        supplierId: supplier2.id,
        status: 'PENDING',
      },
      {
        poNumber: 'PO-DEMO-004',
        branchId: mainBranch.id,
        supplierId: supplier2.id,
        status: 'DRAFT',
      },
    ],
  });

  const poPending = await prisma.purchaseOrder.findFirst({ where: { poNumber: 'PO-DEMO-002' } });

  if (poPending) {
    await prisma.purchaseOrderItem.create({
      data: {
        poId: poPending.id,
        ingredientId: milk.id,
        quantityRequested: 5000,
        unitPrice: 0.05,
      },
    });
  }

  const poDraft = await prisma.purchaseOrder.findFirst({ where: { poNumber: 'PO-DEMO-004' } });

  if (poDraft) {
    await prisma.purchaseOrderItem.createMany({
      data: [
        {
          poId: poDraft.id,
          ingredientId: oatMilk.id,
          quantityRequested: 4000,
          unitPrice: 0.09,
        },
        {
          poId: poDraft.id,
          ingredientId: cup.id,
          quantityRequested: 300,
          unitPrice: 1.2,
        },
      ],
    });
  }

  // ——— Kitchen / production ———
  await prisma.productionOrder.createMany({
    data: [
      {
        orderNumber: 'PRD-DEMO-003',
        branchId: centralKitchen.id,
        targetIngredientId: ctx.coldBrewBase.id,
        quantityToProduce: 800,
        status: 'COMPLETED',
        completedAt: dateDaysAgo(2),
      },
      {
        orderNumber: 'PRD-DEMO-004',
        branchId: centralKitchen.id,
        targetIngredientId: ctx.coldBrewBase.id,
        quantityToProduce: 300,
        status: 'CANCELLED',
      },
    ],
  });

  // ——— Inventory: low stock, batches, waste, transfers ———
  await prisma.branchInventory.update({
    where: {
      branchId_ingredientId: { branchId: secondBranch.id, ingredientId: cup.id },
    },
    data: { stock: 80 },
  });

  const soonExpiry = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
  await prisma.inventoryBatch.createMany({
    data: [
      {
        branchId: mainBranch.id,
        ingredientId: milk.id,
        quantity: 1200,
        status: 'ACTIVE',
        expiryDate: soonExpiry,
      },
      {
        branchId: secondBranch.id,
        ingredientId: syrup.id,
        quantity: 180,
        status: 'ACTIVE',
        expiryDate: soonExpiry,
      },
    ],
  });

  await prisma.wasteLog.createMany({
    data: [
      {
        branchId: mainBranch.id,
        ingredientId: oatMilk.id,
        quantity: 120,
        reason: 'Taste test batch discarded',
        recordedById: manager.id,
        createdAt: dateDaysAgo(5, 10, 20),
      },
      {
        branchId: secondBranch.id,
        ingredientId: milk.id,
        quantity: 400,
        reason: 'Fridge temperature spike overnight',
        recordedById: asokManager.id,
        createdAt: dateDaysAgo(1, 8, 5),
      },
      {
        branchId: mainBranch.id,
        ingredientId: syrup.id,
        quantity: 60,
        reason: 'Expired vanilla syrup partial bottle',
        recordedById: manager.id,
        createdAt: dateDaysAgo(7, 16, 40),
      },
    ],
  });

  await prisma.stockTransfer.createMany({
    data: [
      {
        fromBranchId: centralKitchen.id,
        toBranchId: secondBranch.id,
        ingredientId: coffeeBeans.id,
        quantity: 1500,
        status: 'SHIPPED',
        requestedById: asokManager.id,
        approvedById: admin.id,
        createdAt: dateDaysAgo(1, 9, 45),
      },
      {
        fromBranchId: mainBranch.id,
        toBranchId: secondBranch.id,
        ingredientId: syrup.id,
        quantity: 200,
        status: 'CANCELLED',
        requestedById: manager.id,
        createdAt: dateDaysAgo(6, 15, 10),
      },
    ],
  });

  // ——— POS / KDS orders ———
  const kdsOrderSpecs = [
    {
      queueNumber: 2,
      status: 'PENDING' as const,
      createdAt: dateMinutesAgo(3),
      productId: cappuccino.id,
      price: 52,
      userId: staff.id,
    },
    {
      queueNumber: 3,
      status: 'PENDING' as const,
      createdAt: dateMinutesAgo(6),
      productId: vanillaLatte.id,
      price: 65,
      userId: staff.id,
    },
    {
      queueNumber: 4,
      status: 'PREPARING' as const,
      createdAt: dateMinutesAgo(8),
      productId: icedLatte.id,
      price: 85,
      userId: manager.id,
    },
    {
      queueNumber: 5,
      status: 'PREPARING' as const,
      createdAt: dateMinutesAgo(13),
      productId: icedLatte.id,
      price: 85,
      userId: staff.id,
    },
    {
      queueNumber: 1,
      status: 'PENDING' as const,
      createdAt: dateMinutesAgo(2),
      productId: cappuccino.id,
      price: 52,
      userId: asokStaff.id,
      branchId: secondBranch.id,
    },
  ];

  const kdsCogsByProduct = new Map<number, number>([
    [icedLatte.id, 20],
    [cappuccino.id, 18.5],
    [vanillaLatte.id, 26],
  ]);

  for (const spec of kdsOrderSpecs) {
    const branchId = spec.branchId ?? mainBranch.id;
    const net = spec.price;
    await prisma.order.create({
      data: {
        userId: spec.userId,
        branchId,
        status: spec.status,
        paymentMethod: 'CASH',
        totalAmount: net,
        netAmount: net,
        discountAmount: 0,
        taxAmount: inclusiveTaxAmount(net, SEED_VAT_RATE_PERCENT),
        totalCogs: kdsCogsByProduct.get(spec.productId) ?? 20,
        queueNumber: spec.queueNumber,
        queueDate: todayQueueDate,
        createdAt: spec.createdAt,
        items: {
          create: [
            {
              productId: spec.productId,
              quantity: 1,
              price: spec.price,
              notes: spec.status === 'PREPARING' ? 'On pass' : undefined,
              modifiers: {
                create: [
                  ...(icedOption
                    ? [{ optionId: icedOption.id, optionName: 'Temperature: Iced', priceDelta: 0 }]
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
  }

  // Historical orders — Riverside branch, mixed statuses
  await prisma.order.create({
    data: {
      userId: manager.id,
      branchId: mainBranch.id,
      customerId: customer.id,
      promotionId: welcomePromo?.id,
      status: 'COMPLETED',
      paymentMethod: 'CREDIT_CARD',
      totalAmount: 130,
      netAmount: 117,
      discountAmount: 13,
      taxAmount: inclusiveTaxAmount(117, SEED_VAT_RATE_PERCENT),
      totalCogs: 52,
      pointsEarned: 1,
      queueNumber: 88,
      queueDate: dateDaysAgo(2),
      createdAt: dateDaysAgo(2),
      items: {
        create: [{ productId: vanillaLatte.id, quantity: 2, price: 65 }],
      },
    },
  });

  await prisma.order.create({
    data: {
      userId: staff.id,
      branchId: mainBranch.id,
      status: 'REFUNDED',
      paymentMethod: 'CASH',
      totalAmount: 85,
      netAmount: 85,
      discountAmount: 0,
      taxAmount: inclusiveTaxAmount(85, SEED_VAT_RATE_PERCENT),
      totalCogs: 12,
      refundReason: 'Wrong drink prepared — customer refund',
      refundedAt: dateDaysAgo(1),
      queueNumber: 77,
      queueDate: dateDaysAgo(3),
      createdAt: dateDaysAgo(3),
      items: {
        create: [{ productId: icedLatte.id, quantity: 1, price: 85 }],
      },
    },
  });

  await prisma.order.create({
    data: {
      userId: staff.id,
      branchId: mainBranch.id,
      status: 'CANCELLED',
      paymentMethod: 'CASH',
      totalAmount: 60,
      netAmount: 60,
      discountAmount: 0,
      taxAmount: inclusiveTaxAmount(60, SEED_VAT_RATE_PERCENT),
      totalCogs: 0,
      queueNumber: 66,
      queueDate: dateDaysAgo(0),
      createdAt: dateMinutesAgo(45),
      items: {
        create: [{ productId: cappuccino.id, quantity: 1, price: 60 }],
      },
    },
  });

  // ——— Finance: settlements & expenses ———
  await prisma.shiftSettlement.createMany({
    data: [
      {
        branchId: secondBranch.id,
        date: dateDaysAgo(1),
        expectedCash: 6200,
        actualCash: 6200,
        expectedCreditCard: 2100,
        actualCreditCard: 2100,
        expectedQR: 980,
        actualQR: 980,
        difference: 0,
        status: 'APPROVED',
        submittedById: asokManager.id,
      },
      {
        branchId: secondBranch.id,
        date: dateDaysAgo(0),
        expectedCash: 4800,
        actualCash: 4650,
        expectedCreditCard: 1500,
        actualCreditCard: 1500,
        expectedQR: 620,
        actualQR: 620,
        difference: -150,
        status: 'PENDING',
        submittedById: asokManager.id,
      },
      {
        branchId: mainBranch.id,
        date: dateDaysAgo(5),
        expectedCash: 9200,
        actualCash: 9100,
        expectedCreditCard: 3800,
        actualCreditCard: 3800,
        expectedQR: 1600,
        actualQR: 1550,
        difference: settlementDifference(
          { cash: 9200, card: 3800, qr: 1600 },
          { cash: 9100, card: 3800, qr: 1550 },
        ),
        status: 'APPROVED',
        submittedById: manager.id,
      },
    ],
  });

  const extraExpenses = [
    { daysAgo: 0, hour: 10, minute: 35, branchId: mainBranch.id, amount: 180, category: 'Supplies', description: 'Ice bags for the afternoon rush' },
    { daysAgo: 2, hour: 14, minute: 5, branchId: mainBranch.id, amount: 2800, category: 'Equipment', description: 'Steam wand repair parts' },
    { daysAgo: 1, hour: 11, minute: 25, branchId: secondBranch.id, amount: 650, category: 'Supplies', description: 'Labels and receipt rolls' },
    { daysAgo: 3, hour: 9, minute: 10, branchId: mainBranch.id, amount: 3400, category: 'Rent', description: 'Mall kiosk surcharge' },
    { daysAgo: 8, hour: 13, minute: 50, branchId: mainBranch.id, amount: 520, category: 'Training', description: 'Barista certification course' },
    { daysAgo: 10, hour: 15, minute: 30, branchId: secondBranch.id, amount: 1100, category: 'Utilities', description: 'Water filtration service' },
    { daysAgo: 12, hour: 17, minute: 15, branchId: mainBranch.id, amount: 900, category: 'Marketing', description: 'LINE OA ads boost' },
  ];
  for (const row of extraExpenses) {
    await prisma.expense.create({
      data: {
        branchId: row.branchId,
        amount: row.amount,
        category: row.category,
        description: row.description,
        recordedById: row.branchId === mainBranch.id ? manager.id : asokManager.id,
        createdAt: dateDaysAgo(row.daysAgo, row.hour, row.minute),
      },
    });
  }

  const accountIds = Object.fromEntries(
    (await prisma.account.findMany()).map((account) => [account.code, account.id]),
  );

  await prisma.journalEntry.createMany({
    data: [
      {
        branchId: mainBranch.id,
        date: dateDaysAgo(2),
        reference: 'PAY-SEED-001',
        description: 'Payroll for previous month — Downtown branch',
        status: 'POSTED',
      },
    ],
  });

  const journalEntries = await prisma.journalEntry.findMany({
    where: { reference: { in: ['PAY-SEED-001'] } },
  });
  const journalByRef = Object.fromEntries(journalEntries.map((entry) => [entry.reference, entry.id]));

  if (journalByRef['PAY-SEED-001']) {
    await prisma.journalEntryLine.createMany({
      data: [
        { journalEntryId: journalByRef['PAY-SEED-001'], accountId: accountIds['5020'], debit: 46400, credit: 0, description: 'Payroll expense (gross)' },
        { journalEntryId: journalByRef['PAY-SEED-001'], accountId: accountIds['2030'], debit: 0, credit: 4320, description: 'Withholdings payable (SSO + tax)' },
        { journalEntryId: journalByRef['PAY-SEED-001'], accountId: accountIds['1010'], debit: 0, credit: 42080, description: 'Net pay disbursed' },
      ],
    });
  }

  const payrollMonth = new Date();
  await prisma.payrollRun.create({
    data: {
      month: payrollMonth.getMonth() + 1,
      year: payrollMonth.getFullYear(),
      status: 'DRAFT',
      branchId: secondBranch.id,
      payslips: {
        create: [
          {
            userId: asokStaff.id,
            standardHours: 160,
            otHours: 0,
            basePay: 14000,
            grossPay: 14000,
            netPay: 12850,
          },
        ],
      },
    },
  });

  // ——— HR & assets ———
  const asokMorning = shiftWindow(0, 7, 15);
  const asokEvening = shiftWindow(0, 14, 22);
  const staffMidweek = shiftWindow(-2, 10, 18);

  await prisma.shift.createMany({
    data: [
      {
        userId: asokStaff.id,
        branchId: secondBranch.id,
        startTime: asokMorning.startTime,
        endTime: asokMorning.endTime,
        status: 'COMPLETED',
      },
      {
        userId: asokStaff.id,
        branchId: secondBranch.id,
        startTime: asokEvening.startTime,
        endTime: asokEvening.endTime,
        status: 'SCHEDULED',
      },
      {
        userId: asokManager.id,
        branchId: secondBranch.id,
        startTime: shiftWindow(1, 9, 17).startTime,
        endTime: shiftWindow(1, 9, 17).endTime,
        status: 'SCHEDULED',
      },
      {
        userId: staff.id,
        branchId: mainBranch.id,
        startTime: staffMidweek.startTime,
        endTime: staffMidweek.endTime,
        status: 'COMPLETED',
      },
      {
        userId: manager.id,
        branchId: mainBranch.id,
        startTime: shiftWindow(-3, 10, 18).startTime,
        endTime: shiftWindow(-3, 10, 18).endTime,
        status: 'COMPLETED',
      },
      {
        userId: asokStaff.id,
        branchId: secondBranch.id,
        startTime: shiftWindow(-1, 8, 16).startTime,
        endTime: shiftWindow(-1, 8, 16).endTime,
        status: 'CANCELLED',
      },
    ],
  });

  await prisma.attendanceRecord.createMany({
    data: [
      {
        userId: asokStaff.id,
        branchId: secondBranch.id,
        clockIn: dateAtDayOffset(-1, 7, 55),
        clockOut: dateAtDayOffset(-1, 15, 10),
        totalHours: 7.2,
      },
      {
        userId: asokStaff.id,
        branchId: secondBranch.id,
        clockIn: dateAtDayOffset(-3, 8, 0),
        clockOut: dateAtDayOffset(-3, 16, 0),
        totalHours: 8,
      },
      {
        userId: asokManager.id,
        branchId: secondBranch.id,
        clockIn: dateAtDayOffset(-2, 9, 5),
        clockOut: dateAtDayOffset(-2, 17, 30),
        totalHours: 8.4,
      },
      {
        userId: staff.id,
        branchId: mainBranch.id,
        clockIn: dateAtDayOffset(-4, 8, 10),
        clockOut: dateAtDayOffset(-4, 16, 5),
        totalHours: 7.9,
      },
    ],
  });

  await prisma.leaveRequest.createMany({
    data: [
      {
        userId: asokStaff.id,
        type: 'UNPAID',
        startDate: dateDaysAgo(-2),
        endDate: dateDaysAgo(-1),
        reason: 'Personal errand',
        status: 'REJECTED',
      },
      {
        userId: asokManager.id,
        type: 'ANNUAL',
        startDate: dateDaysAgo(-10),
        endDate: dateDaysAgo(-8),
        reason: 'Long weekend trip',
        status: 'PENDING',
      },
      {
        userId: staff.id,
        type: 'SICK',
        startDate: dateDaysAgo(10),
        endDate: dateDaysAgo(9),
        reason: 'Dental appointment',
        status: 'APPROVED',
      },
    ],
  });

  const asokEspresso = await prisma.equipment.create({
    data: {
      branchId: secondBranch.id,
      name: 'Victoria Arduino Eagle One',
      type: 'ESPRESSO_MACHINE',
      serialNumber: 'VA-ASOK-001',
      status: 'ACTIVE',
      purchaseDate: dateDaysAgo(300),
      warrantyExpiry: dateDaysAgo(-90),
    },
  });

  await prisma.equipment.createMany({
    data: [
      {
        branchId: secondBranch.id,
        name: 'Bunn Iced Tea Brewer',
        type: 'OTHER',
        serialNumber: 'BN-ASOK-02',
        status: 'ACTIVE',
        purchaseDate: dateDaysAgo(150),
      },
      {
        branchId: centralKitchen.id,
        name: 'Industrial Cold Brew Tank',
        type: 'REFRIGERATOR',
        serialNumber: 'CK-TANK-01',
        status: 'ACTIVE',
        purchaseDate: dateDaysAgo(200),
      },
    ],
  });

  await prisma.maintenanceLog.createMany({
    data: [
      {
        equipmentId: asokEspresso.id,
        description: 'Steam boiler descale',
        cost: 2200,
        performedBy: 'Riverside service vendor',
        date: dateDaysAgo(20),
      },
      {
        equipmentId: asokEspresso.id,
        description: 'Portafilter gasket kit',
        cost: 650,
        performedBy: 'Riverside Manager',
        date: dateDaysAgo(3),
      },
    ],
  });

  // ——— Audit trail ———
  const extraAudit = [
    { userId: asokManager.id, action: 'CREATE_PO', targetType: 'PurchaseOrder', targetId: poPending?.id, details: { poNumber: 'PO-DEMO-002' }, daysAgo: 2 },
    { userId: manager.id, action: 'ORDER_CREATED', targetType: 'Order', details: { branch: 'Downtown', paymentMethod: 'QR' }, daysAgo: 0 },
    { userId: asokStaff.id, action: 'ORDER_CREATED', targetType: 'Order', details: { branch: 'Riverside', items: 2 }, daysAgo: 1 },
    { userId: admin.id, action: 'SETTLEMENT_APPROVED', targetType: 'ShiftSettlement', details: { branch: 'Riverside' }, daysAgo: 1 },
    { userId: manager.id, action: 'WASTE_RECORDED', targetType: 'WasteLog', details: { ingredient: 'Oat Milk', quantity: 120 }, daysAgo: 5 },
    { userId: asokManager.id, action: 'LEAVE_REJECTED', targetType: 'LeaveRequest', details: { type: 'UNPAID' }, daysAgo: 1 },
    { userId: admin.id, action: 'PAYROLL_APPROVED', targetType: 'PayrollRun', details: { branch: 'Downtown', status: 'DRAFT skipped' }, daysAgo: 0 },
    { userId: manager.id, action: 'ADD_BATCH', targetType: 'InventoryBatch', details: { ingredient: 'Whole Milk', expiry: '3 days' }, daysAgo: 0 },
    { userId: admin.id, action: 'ACCEPT_TRANSFER', targetType: 'StockTransfer', details: { status: 'SHIPPED', to: 'Riverside' }, daysAgo: 1 },
  ];

  for (const row of extraAudit) {
    await prisma.auditLog.create({
      data: {
        userId: row.userId,
        action: row.action,
        targetType: row.targetType,
        targetId: row.targetId,
        details: JSON.stringify(row.details),
        createdAt: dateDaysAgo(row.daysAgo),
      },
    });
  }
}
