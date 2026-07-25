import {
  getQueueBusinessDateString,
  parseQueueBusinessDate,
} from '../../../src/orders/helpers/queue-number.helper';
import { dateDaysAgo } from '../helpers';
import type { SeedContext } from '../types';
import type { Order, PurchaseOrder } from '@prisma/client';

const HERO_PO_NUMBER = 'PO-DEMO-003';
const HERO_PO_QTY = 1000;
const HERO_PO_UNIT_PRICE = 0.45;
const HERO_BEAN_STANDARD_COST = 0.5;
const HERO_ORDER_QTY = 2;
const HERO_ORDER_UNIT_PRICE = 85;

function heroOrderCogsPerUnit(): number {
  // Matches Iced Latte recipe in core seed: beans + milk + cup
  return 18 * 0.5 + 150 * 0.05 + 3.5;
}

export type HeroNarrativeSeed = {
  heroPurchaseOrder: PurchaseOrder;
  heroOrder: Order;
};

/**
 * Connected demo story for interviews: espresso beans received on a PO,
 * sold through a POS order, with ledger entries that share the same references
 * as production (`PO-DEMO-003` and `ORD-{orderId}`).
 */
export async function seedHeroNarrative(ctx: SeedContext): Promise<HeroNarrativeSeed> {
  const {
    prisma,
    mainBranch,
    manager,
    staff,
    supplier1,
    coffeeBeans,
    icedLatte,
  } = ctx;

  console.log('Seeding hero narrative (PO receive → POS sale → ledger)...');

  const accountIds = Object.fromEntries(
    (await prisma.account.findMany()).map((account) => [account.code, account.id]),
  );

  const poTotal = HERO_PO_QTY * HERO_PO_UNIT_PRICE;
  const poStandardTotal = HERO_PO_QTY * HERO_BEAN_STANDARD_COST;
  const heroPurchaseOrder = await prisma.purchaseOrder.create({
    data: {
      poNumber: HERO_PO_NUMBER,
      branchId: mainBranch.id,
      supplierId: supplier1.id,
      status: 'RECEIVED',
      items: {
        create: [
          {
            ingredientId: coffeeBeans.id,
            quantityRequested: HERO_PO_QTY,
            unitPrice: HERO_PO_UNIT_PRICE,
          },
        ],
      },
    },
  });

  const orderNet = HERO_ORDER_UNIT_PRICE * HERO_ORDER_QTY;
  const orderTax = Math.round(((orderNet * 0.07) / 1.07) * 100) / 100;
  const orderCogs = heroOrderCogsPerUnit() * HERO_ORDER_QTY;
  const orderCreatedAt = dateDaysAgo(3);
  orderCreatedAt.setHours(10, 15, 0, 0);

  const heroOrder = await prisma.order.create({
    data: {
      userId: staff.id,
      branchId: mainBranch.id,
      status: 'COMPLETED',
      paymentMethod: 'CASH',
      totalAmount: orderNet,
      netAmount: orderNet,
      discountAmount: 0,
      taxAmount: orderTax,
      totalCogs: orderCogs,
      pointsEarned: Math.floor(orderNet / 100),
      queueNumber: 201,
      queueDate: parseQueueBusinessDate(getQueueBusinessDateString(orderCreatedAt)),
      createdAt: orderCreatedAt,
      items: {
        create: [
          {
            productId: icedLatte.id,
            quantity: HERO_ORDER_QTY,
            price: HERO_ORDER_UNIT_PRICE,
            notes: 'Hero demo — beans from PO-DEMO-003 receive',
          },
        ],
      },
    },
  });

  await prisma.journalEntry.create({
    data: {
      branchId: mainBranch.id,
      date: dateDaysAgo(4),
      reference: HERO_PO_NUMBER,
      description: `Accounts Payable for PO ${HERO_PO_NUMBER} — Espresso Beans`,
      status: 'POSTED',
      lines: {
        create: [
          {
            accountId: accountIds['1030'],
            debit: poStandardTotal,
            credit: 0,
            description: 'Inventory received (standard cost)',
          },
          {
            accountId: accountIds['5035'],
            debit: 0,
            credit: poStandardTotal - poTotal,
            description: 'Purchase price variance (favorable)',
          },
          {
            accountId: accountIds['2010'],
            debit: 0,
            credit: poTotal,
            description: 'Accounts Payable recognized',
          },
        ],
      },
    },
  });


  await prisma.auditLog.createMany({
    data: [
      {
        userId: manager.id,
        action: 'RECEIVE_PO',
        targetType: 'PurchaseOrder',
        targetId: heroPurchaseOrder.id,
        details: JSON.stringify({
          poNumber: HERO_PO_NUMBER,
          ingredient: 'Espresso Beans',
          qty: HERO_PO_QTY,
        }),
        createdAt: dateDaysAgo(4),
      },
      {
        userId: staff.id,
        action: 'ORDER_CREATED',
        targetType: 'Order',
        targetId: heroOrder.id,
        details: JSON.stringify({
          poNumber: HERO_PO_NUMBER,
          paymentMethod: 'CASH',
          items: HERO_ORDER_QTY,
          product: 'Iced Latte',
        }),
        createdAt: orderCreatedAt,
      },
    ],
  });

  return { heroPurchaseOrder, heroOrder };
}
