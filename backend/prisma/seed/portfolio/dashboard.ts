import {
  getQueueBusinessDateString,
  parseQueueBusinessDate,
} from '../../../src/orders/helpers/queue-number.helper';
import { inclusiveTaxAmount } from '../../../src/common/vat.util';
import { dateAtDayOffset, dateMinutesAgo, SEED_VAT_RATE_PERCENT } from '../helpers';
import type { SeedContext } from '../types';
import type { PaymentMethod } from '@prisma/client';

type DashboardOrderLine = {
  productName: string;
  quantity: number;
  unitPrice: number;
};

type DashboardOrderSpec = {
  branchKey: 'main' | 'second';
  userKey: 'staff' | 'manager' | 'asokStaff' | 'asokManager';
  createdAt: Date;
  paymentMethod: PaymentMethod;
  customerKey?: 'customer' | 'goldCustomer';
  lines: DashboardOrderLine[];
};

function orderNetAmount(lines: DashboardOrderLine[]): number {
  return lines.reduce((sum, line) => sum + line.unitPrice * line.quantity, 0);
}

function estimateCogs(lines: DashboardOrderLine[], unitCost = 12): number {
  return lines.reduce((sum, line) => sum + unitCost * line.quantity, 0);
}

/**
 * Dashboard widgets read live aggregates from orders, inventory, and batches —
 * no separate dashboard tables. This seed shapes today/yesterday sales, 7-day
 * trends, top products, and alert widgets.
 */
export async function seedDashboardDemo(ctx: SeedContext): Promise<void> {
  const {
    prisma,
    mainBranch,
    secondBranch,
    staff,
    manager,
    asokStaff,
    asokManager,
    customer,
    goldCustomer,
  } = ctx;

  console.log('Seeding dashboard analytics demo...');

  const products = await prisma.product.findMany({ where: { isActive: true } });
  const productByName = new Map(products.map((product) => [product.name, product]));

  const branches = {
    main: mainBranch,
    second: secondBranch,
  } as const;
  const users = {
    staff,
    manager,
    asokStaff,
    asokManager,
  } as const;
  const customers = {
    customer,
    goldCustomer,
  } as const;

  let queueCounter = 300;

  const createCompletedOrder = async (spec: DashboardOrderSpec) => {
    const productLines = spec.lines.map((line) => {
      const product = productByName.get(line.productName);
      if (!product) {
        throw new Error(`Dashboard seed: product not found: ${line.productName}`);
      }
      return { product, ...line };
    });

    const net = orderNetAmount(spec.lines);
    const createdAt = spec.createdAt;

    await prisma.order.create({
      data: {
        userId: users[spec.userKey].id,
        branchId: branches[spec.branchKey].id,
        customerId: spec.customerKey ? customers[spec.customerKey].id : undefined,
        status: 'COMPLETED',
        paymentMethod: spec.paymentMethod,
        totalAmount: net,
        netAmount: net,
        discountAmount: 0,
        taxAmount: inclusiveTaxAmount(net, SEED_VAT_RATE_PERCENT),
        totalCogs: estimateCogs(spec.lines),
        pointsEarned: Math.floor(net / 100),
        queueNumber: queueCounter++,
        queueDate: parseQueueBusinessDate(getQueueBusinessDateString(createdAt)),
        createdAt,
        items: {
          create: productLines.map((line) => ({
            productId: line.product.id,
            quantity: line.quantity,
            price: line.unitPrice,
          })),
        },
      },
    });
  };

  const todayOrders: DashboardOrderSpec[] = [
    {
      branchKey: 'main',
      userKey: 'staff',
      createdAt: dateMinutesAgo(465),
      paymentMethod: 'CASH',
      lines: [
        { productName: 'Iced Latte', quantity: 3, unitPrice: 85 },
        { productName: 'Croissant', quantity: 2, unitPrice: 45 },
      ],
    },
    {
      branchKey: 'main',
      userKey: 'staff',
      createdAt: dateMinutesAgo(320),
      paymentMethod: 'CREDIT_CARD',
      customerKey: 'customer',
      lines: [
        { productName: 'Cappuccino', quantity: 2, unitPrice: 52 },
        { productName: 'Vanilla Latte', quantity: 2, unitPrice: 65 },
      ],
    },
    {
      branchKey: 'main',
      userKey: 'manager',
      createdAt: dateMinutesAgo(235),
      paymentMethod: 'QR_PROMPTPAY',
      customerKey: 'goldCustomer',
      lines: [
        { productName: 'Americano', quantity: 4, unitPrice: 55 },
        { productName: 'Mocha', quantity: 2, unitPrice: 75 },
      ],
    },
    {
      branchKey: 'main',
      userKey: 'staff',
      createdAt: dateMinutesAgo(100),
      paymentMethod: 'CASH',
      lines: [
        { productName: 'Cold Brew', quantity: 3, unitPrice: 80 },
        { productName: 'Chocolate Muffin', quantity: 3, unitPrice: 55 },
      ],
    },
    {
      branchKey: 'main',
      userKey: 'staff',
      createdAt: dateMinutesAgo(35),
      paymentMethod: 'CREDIT_CARD',
      lines: [
        { productName: 'Honey Oat Latte', quantity: 2, unitPrice: 92 },
        { productName: 'Flat White', quantity: 2, unitPrice: 70 },
        { productName: 'Blueberry Scone', quantity: 2, unitPrice: 50 },
      ],
    },
    {
      branchKey: 'second',
      userKey: 'asokStaff',
      createdAt: dateMinutesAgo(390),
      paymentMethod: 'CASH',
      lines: [
        { productName: 'Iced Latte', quantity: 2, unitPrice: 85 },
        { productName: 'Ham & Cheese Toast', quantity: 1, unitPrice: 89 },
      ],
    },
    {
      branchKey: 'second',
      userKey: 'asokStaff',
      createdAt: dateMinutesAgo(170),
      paymentMethod: 'QR_PROMPTPAY',
      lines: [
        { productName: 'Classic Milk Tea', quantity: 3, unitPrice: 65 },
        { productName: 'Croissant', quantity: 2, unitPrice: 45 },
      ],
    },
    {
      branchKey: 'second',
      userKey: 'asokManager',
      createdAt: dateMinutesAgo(80),
      paymentMethod: 'CREDIT_CARD',
      customerKey: 'goldCustomer',
      lines: [
        { productName: 'Matcha Latte', quantity: 2, unitPrice: 90 },
        { productName: 'Caramel Macchiato', quantity: 2, unitPrice: 78 },
      ],
    },
  ];

  const yesterdayOrders: DashboardOrderSpec[] = [
    {
      branchKey: 'main',
      userKey: 'staff',
      createdAt: dateAtDayOffset(-1, 9, 0),
      paymentMethod: 'CASH',
      lines: [
        { productName: 'Iced Latte', quantity: 2, unitPrice: 85 },
        { productName: 'Espresso', quantity: 3, unitPrice: 60 },
      ],
    },
    {
      branchKey: 'main',
      userKey: 'staff',
      createdAt: dateAtDayOffset(-1, 12, 30),
      paymentMethod: 'CREDIT_CARD',
      lines: [{ productName: 'Cappuccino', quantity: 3, unitPrice: 52 }],
    },
    {
      branchKey: 'main',
      userKey: 'manager',
      createdAt: dateAtDayOffset(-1, 17, 0),
      paymentMethod: 'QR_PROMPTPAY',
      lines: [
        { productName: 'Vanilla Latte', quantity: 2, unitPrice: 65 },
        { productName: 'Croissant', quantity: 2, unitPrice: 45 },
      ],
    },
    {
      branchKey: 'second',
      userKey: 'asokStaff',
      createdAt: dateAtDayOffset(-1, 11, 15),
      paymentMethod: 'CASH',
      lines: [{ productName: 'Iced Latte', quantity: 2, unitPrice: 85 }],
    },
    {
      branchKey: 'second',
      userKey: 'asokStaff',
      createdAt: dateAtDayOffset(-1, 16, 20),
      paymentMethod: 'CASH',
      lines: [
        { productName: 'Americano', quantity: 2, unitPrice: 55 },
        { productName: 'Banana Bread Slice', quantity: 1, unitPrice: 48 },
      ],
    },
  ];

  const trendOrders: DashboardOrderSpec[] = [];
  const trendPattern: DashboardOrderLine[][] = [
    [{ productName: 'Iced Latte', quantity: 8, unitPrice: 85 }],
    [{ productName: 'Cappuccino', quantity: 6, unitPrice: 52 }],
    [{ productName: 'Mocha', quantity: 5, unitPrice: 75 }],
    [{ productName: 'Cold Brew', quantity: 4, unitPrice: 80 }],
    [{ productName: 'Vanilla Latte', quantity: 7, unitPrice: 65 }],
    [{ productName: 'Flat White', quantity: 5, unitPrice: 70 }],
    [{ productName: 'Honey Oat Latte', quantity: 4, unitPrice: 92 }],
  ];

  for (let daysAgo = 35; daysAgo >= 2; daysAgo--) {
    trendOrders.push({
      branchKey: daysAgo % 2 === 0 ? 'main' : 'second',
      userKey: daysAgo % 2 === 0 ? 'staff' : 'asokStaff',
      createdAt: dateAtDayOffset(-daysAgo, 17, 30),
      paymentMethod: daysAgo % 3 === 0 ? 'CREDIT_CARD' : 'CASH',
      lines: trendPattern[daysAgo % trendPattern.length],
    });
    if (daysAgo % 7 === 0 || daysAgo % 7 === 1) {
      trendOrders.push({
        branchKey: 'main',
        userKey: 'staff',
        createdAt: dateAtDayOffset(-daysAgo, 11, 15),
        paymentMethod: 'QR_PROMPTPAY',
        lines: trendPattern[(daysAgo + 3) % trendPattern.length],
      });
    }
  }

  for (const spec of [...todayOrders, ...yesterdayOrders, ...trendOrders]) {
    await createCompletedOrder(spec);
  }
}
