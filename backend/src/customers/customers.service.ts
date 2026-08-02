import {
  Injectable,
  BadRequestException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma, Tier } from '@prisma/client';
import { OnEvent } from '@nestjs/event-emitter';
import { OrderCreatedEvent } from '../orders/events/order-created.event';
import { toNum } from '../common/decimal.util';
import {
  AuditService,
  AUDIT_ACTIONS,
  AUDIT_TARGETS,
} from '../audit/audit.service';

const ANONYMIZED_PHONE_PREFIX = 'deleted-';
const ANONYMIZED_NAME = 'Deleted customer';

@Injectable()
export class CustomersService {
  private readonly logger = new Logger(CustomersService.name);

  constructor(
    private prisma: PrismaService,
    private auditService: AuditService,
  ) {}

  @OnEvent('order.created', { async: true })
  async handleOrderCreated(event: OrderCreatedEvent) {
    if (!event.customerId) return;

    this.logger.log(
      `Handling order.created event for CRM Customer ${event.customerId}`,
    );

    await this.checkAndUpdateTier(event.customerId);
  }

  async create(data: { name: string; phone: string }) {
    const existing = await this.prisma.customer.findUnique({
      where: { phone: data.phone },
    });
    if (existing) {
      throw new BadRequestException('Customer with this phone already exists');
    }
    return this.prisma.customer.create({
      data: {
        name: data.name,
        phone: data.phone,
        points: 0,
        tier: 'REGULAR',
      },
    });
  }

  async findPage(options: {
    search?: string;
    tier?: Tier;
    take: number;
    skip: number;
  }) {
    const term = options.search?.trim();
    const where: Prisma.CustomerWhereInput = {
      ...(options.tier ? { tier: options.tier } : {}),
      ...(term
        ? {
            OR: [
              { name: { contains: term, mode: 'insensitive' as const } },
              { phone: { contains: term } },
            ],
          }
        : {}),
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.customer.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: options.take,
        skip: options.skip,
      }),
      this.prisma.customer.count({ where }),
    ]);

    return { items, total };
  }

  async findOne(id: number) {
    return this.prisma.customer.findUnique({
      where: { id },
    });
  }

  async update(id: number, data: Partial<{ name: string; phone: string }>) {
    return this.prisma.customer.update({ where: { id }, data });
  }

  async anonymize(id: number, actorUserId: number) {
    return this.prisma.$transaction(async (tx) => {
      const customer = await tx.customer.findUnique({
        where: { id },
        include: { _count: { select: { orders: true } } },
      });
      if (!customer) throw new NotFoundException('Customer not found');
      if (customer.anonymizedAt) {
        throw new BadRequestException('Customer is already anonymized');
      }

      const anonymized = await tx.customer.update({
        where: { id },
        data: {
          phone: `${ANONYMIZED_PHONE_PREFIX}${id}`,
          name: ANONYMIZED_NAME,
          points: 0,
          anonymizedAt: new Date(),
        },
      });

      await this.auditService.logAction(
        actorUserId,
        AUDIT_ACTIONS.ANONYMIZE_CUSTOMER,
        AUDIT_TARGETS.CUSTOMER,
        id,
        { tier: customer.tier, orderCount: customer._count.orders },
        tx,
      );

      return anonymized;
    });
  }

  async findByPhone(phone: string) {
    const customer = await this.prisma.customer.findUnique({
      where: { phone },
    });
    if (!customer) throw new BadRequestException('Customer not found');
    return customer;
  }

  // Calculate and update tier based on lifetime spend
  async checkAndUpdateTier(customerId: number) {
    const agg = await this.prisma.order.aggregate({
      where: {
        customerId,
        status: { in: ['COMPLETED', 'PENDING', 'PREPARING'] },
      },
      _sum: { netAmount: true },
    });

    const lifetimeSpend = toNum(agg._sum.netAmount);

    const customer = await this.prisma.customer.findUnique({
      where: { id: customerId },
    });
    if (!customer) return;

    let newTier: Tier = 'REGULAR';
    if (lifetimeSpend >= 50000) newTier = 'PLATINUM';
    else if (lifetimeSpend >= 20000) newTier = 'GOLD';
    else if (lifetimeSpend >= 5000) newTier = 'SILVER';

    if (newTier !== customer.tier) {
      await this.prisma.customer.update({
        where: { id: customerId },
        data: { tier: newTier },
      });
    }
  }

  async getCustomer360(id: number) {
    const customer = await this.prisma.customer.findUnique({
      where: { id },
      include: {
        orders: {
          orderBy: { createdAt: 'desc' },
          take: 5,
          select: {
            id: true,
            netAmount: true,
            createdAt: true,
            items: { select: { id: true, productId: true, quantity: true } },
          },
        },
      },
    });

    if (!customer) throw new BadRequestException('Customer not found');

    const { orders: recentOrders, ...customerProfile } = customer;

    // Calculate Lifetime Spend via Aggregation
    const agg = await this.prisma.order.aggregate({
      where: {
        customerId: id,
        status: { in: ['COMPLETED', 'PENDING', 'PREPARING'] },
      },
      _sum: { netAmount: true },
    });

    const lifetimeSpend = toNum(agg._sum.netAmount);

    // Calculate Next Tier
    let nextTier: string | null = null;
    let amountToNextTier = 0;
    let progressPercentage = 0;

    if (lifetimeSpend < 5000) {
      nextTier = 'SILVER';
      amountToNextTier = 5000 - lifetimeSpend;
      progressPercentage = (lifetimeSpend / 5000) * 100;
    } else if (lifetimeSpend < 20000) {
      nextTier = 'GOLD';
      amountToNextTier = 20000 - lifetimeSpend;
      progressPercentage = ((lifetimeSpend - 5000) / (20000 - 5000)) * 100;
    } else if (lifetimeSpend < 50000) {
      nextTier = 'PLATINUM';
      amountToNextTier = 50000 - lifetimeSpend;
      progressPercentage = ((lifetimeSpend - 20000) / (50000 - 20000)) * 100;
    } else {
      nextTier = 'MAX';
      progressPercentage = 100;
    }

    // Favorite Drinks
    const favoriteItemsAgg = await this.prisma.orderItem.groupBy({
      by: ['productId'],
      _sum: { quantity: true },
      where: {
        order: {
          customerId: id,
          status: { in: ['COMPLETED', 'PENDING', 'PREPARING'] },
        },
      },
      orderBy: { _sum: { quantity: 'desc' } },
      take: 3,
    });

    const favoriteDrinks: { name: string; count: number }[] = [];
    for (const fav of favoriteItemsAgg) {
      const product = await this.prisma.product.findUnique({
        where: { id: fav.productId },
      });
      if (product) {
        favoriteDrinks.push({
          name: product.name,
          count: fav._sum.quantity || 0,
        });
      }
    }

    // Churn Risk
    let churnRisk = 'LOW';
    let daysSinceLastOrder = 0;
    if (recentOrders.length > 0) {
      const lastOrderDate = recentOrders[0].createdAt;
      const msDiff = new Date().getTime() - lastOrderDate.getTime();
      daysSinceLastOrder = Math.floor(msDiff / (1000 * 3600 * 24));

      if (daysSinceLastOrder > 60) churnRisk = 'HIGH';
      else if (daysSinceLastOrder > 30) churnRisk = 'MEDIUM';
    } else {
      churnRisk = 'HIGH'; // No orders yet
    }

    return {
      customer: customerProfile,
      lifetimeSpend,
      nextTier,
      amountToNextTier,
      progressPercentage,
      favoriteDrinks,
      churnRisk,
      daysSinceLastOrder,
      recentOrders,
    };
  }
}
