import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Customer, Prisma } from '@prisma/client';
import { InventoryHelper } from '../common/helpers/inventory.helper';
import { OutboxService } from '../outbox/outbox.service';
import { OUTBOX_EVENT_TYPES } from '../outbox/outbox-event.types';
import { SettingsService } from '../settings/settings.service';
import { dec, toNum, roundMoney } from '../common/decimal.util';
import { inclusiveTaxAmount } from '../common/vat.util';
import {
  pointsEarnedForSpend,
  pointsToDiscountAmount,
  POINTS_PER_CURRENCY_UNIT,
} from '../customers/loyalty.constants';
import {
  productRequiresKitchen,
  resolveInitialOrderStatus,
} from './helpers/order-status.util';
import {
  buildItemIngredientRequirements,
  mergeRequirementMaps,
} from './helpers/recipe-requirements.helper';
import { allocateQueueNumber } from './helpers/queue-number.helper';
import {
  CreateOrderInput,
  CreatedOrder,
  createOrderInclude,
} from './orders.types';
import { ApiErrorCode } from '../common/errors/api-error-code.enum';
import { appBadRequest, appNotFound } from '../common/errors/app.exception';
import { toOrderSnapshot } from './domain/order.snapshot';

const MAX_QUEUE_NUMBER_RETRIES = 5;

@Injectable()
export class OrderCreationService {
  constructor(
    private prisma: PrismaService,
    private outboxService: OutboxService,
    private settingsService: SettingsService,
  ) {}

  async createOrder(data: CreateOrderInput): Promise<CreatedOrder> {
    return this.createOrderWithQueueRetry(data);
  }

  private async createOrderWithQueueRetry(
    data: CreateOrderInput,
    attempt = 0,
  ): Promise<CreatedOrder> {
    try {
      return await this.prisma.$transaction(async (tx) => {
        let totalAmount = dec(0);
        let totalCogs = dec(0);

        const ingredientRequirements = new Map<number, number>();
        const productsForStatus: { category: string }[] = [];
        const processedItems: {
          productId: number;
          quantity: number;
          unitPrice: number;
          notesText?: string;
          modifiers: {
            optionId: number;
            optionName: string;
            priceDelta: number;
          }[];
        }[] = [];

        for (const item of data.items) {
          const product = await tx.product.findUnique({
            where: { id: item.productId },
            include: { recipeItems: { include: { ingredient: true } } },
          });

          if (!product) {
            throw appNotFound(
              ApiErrorCode.PRODUCT_NOT_FOUND,
              `Product with ID ${item.productId} not found`,
            );
          }

          productsForStatus.push(product);

          if (
            productRequiresKitchen(product.category) &&
            product.recipeItems.length === 0
          ) {
            throw appBadRequest(
              ApiErrorCode.PRODUCT_RECIPE_REQUIRED,
              `Product "${product.name}" requires a recipe before it can be sold.`,
            );
          }

          let unitPrice = dec(product.price);
          const modifiers: {
            optionId: number;
            optionName: string;
            priceDelta: number;
          }[] = [];
          const modifierLabels: string[] = [];
          let selectedOptions: {
            swapToIngredientId: number | null;
            group: { swapIngredientId: number | null };
          }[] = [];

          if (item.modifierOptionIds?.length) {
            const options = await tx.modifierOption.findMany({
              where: { id: { in: item.modifierOptionIds } },
              include: { group: true },
            });
            if (options.length !== item.modifierOptionIds.length) {
              throw appBadRequest(
                ApiErrorCode.INVALID_MODIFIER_SELECTION,
                'Invalid modifier selection',
              );
            }
            selectedOptions = options;
            for (const opt of options) {
              unitPrice = unitPrice.plus(dec(opt.priceDelta));
              const label = `${opt.group.name}: ${opt.name}`;
              modifierLabels.push(label);
              modifiers.push({
                optionId: opt.id,
                optionName: label,
                priceDelta: toNum(opt.priceDelta),
              });
            }
          }

          totalAmount = totalAmount.plus(unitPrice.times(item.quantity));

          const recipeRows = product.recipeItems.map((recipe) => ({
            ingredientId: recipe.ingredientId,
            quantity: recipe.quantity,
          }));
          const itemRequirements = buildItemIngredientRequirements(
            recipeRows,
            item.quantity,
            selectedOptions,
          );
          mergeRequirementMaps(ingredientRequirements, itemRequirements);

          const costByIngredient = new Map(
            product.recipeItems.map((recipe) => [
              recipe.ingredientId,
              dec(recipe.ingredient.costPerUnit),
            ]),
          );
          const missingCostIds = [...itemRequirements.keys()].filter(
            (id) => !costByIngredient.has(id),
          );
          if (missingCostIds.length > 0) {
            const extraIngredients = await tx.ingredient.findMany({
              where: { id: { in: missingCostIds } },
            });
            for (const ing of extraIngredients) {
              costByIngredient.set(ing.id, dec(ing.costPerUnit));
            }
          }
          for (const [ingredientId, qty] of itemRequirements.entries()) {
            totalCogs = totalCogs.plus(
              (costByIngredient.get(ingredientId) ?? dec(0)).times(qty),
            );
          }

          const notesText =
            [item.notes, modifierLabels.join(', ')]
              .filter(Boolean)
              .join(' | ') || undefined;

          processedItems.push({
            productId: item.productId,
            quantity: item.quantity,
            unitPrice: roundMoney(unitPrice),
            notesText,
            modifiers,
          });
        }

        await InventoryHelper.deductInventoryFIFO(
          tx,
          data.branchId,
          ingredientRequirements,
        );

        let discountAmount = dec(0);
        const pointsRequested = data.pointsToRedeem || 0;
        let customerId: number | null = null;
        let promotionId: number | null = null;

        let customer: Customer | null = null;
        if (data.customerPhone) {
          customer = await tx.customer.findUnique({
            where: { phone: data.customerPhone },
          });
          if (!customer) {
            throw appNotFound(
              ApiErrorCode.CUSTOMER_NOT_FOUND,
              'Customer not found',
            );
          }
          customerId = customer.id;

          if (pointsRequested > 0 && customer.points < pointsRequested) {
            throw appBadRequest(
              ApiErrorCode.INSUFFICIENT_LOYALTY_POINTS,
              'Not enough points to redeem',
            );
          }
        } else if (pointsRequested > 0) {
          throw appBadRequest(
            ApiErrorCode.CUSTOMER_PHONE_REQUIRED,
            'Must provide customer phone to redeem points',
          );
        }

        if (data.promotionCode) {
          const promo = await tx.promotion.findUnique({
            where: { code: data.promotionCode },
          });
          if (!promo || !promo.isActive) {
            throw appBadRequest(
              ApiErrorCode.PROMOTION_INVALID,
              'Invalid or inactive promotion',
            );
          }

          const now = new Date();
          if (promo.startDate && now < promo.startDate) {
            throw appBadRequest(
              ApiErrorCode.PROMOTION_NOT_STARTED,
              'Promotion not started yet',
            );
          }
          if (promo.endDate && now > promo.endDate) {
            throw appBadRequest(
              ApiErrorCode.PROMOTION_EXPIRED,
              'Promotion expired',
            );
          }
          if (
            promo.minPurchase &&
            totalAmount.lessThan(dec(promo.minPurchase))
          ) {
            throw appBadRequest(
              ApiErrorCode.PROMOTION_MIN_PURCHASE,
              `Minimum purchase of ${toNum(promo.minPurchase)} required`,
            );
          }

          promotionId = promo.id;
          const promoDiscount =
            promo.discountType === 'PERCENTAGE'
              ? totalAmount.times(dec(promo.discountValue)).dividedBy(100)
              : dec(promo.discountValue);

          discountAmount = discountAmount.plus(promoDiscount);
        }

        let pointsRedeemed = 0;
        if (customer && pointsRequested > 0) {
          const coverable = Prisma.Decimal.max(
            totalAmount.minus(discountAmount),
            dec(0),
          );
          const pointsUsable = coverable
            .times(POINTS_PER_CURRENCY_UNIT)
            .floor()
            .toNumber();
          pointsRedeemed = Math.min(pointsRequested, pointsUsable);
          if (pointsRedeemed > 0) {
            discountAmount = discountAmount.plus(
              pointsToDiscountAmount(pointsRedeemed),
            );
            await tx.customer.update({
              where: { id: customer.id },
              data: { points: { decrement: pointsRedeemed } },
            });
          }
        }

        const discountFinal = Prisma.Decimal.min(
          discountAmount.toDecimalPlaces(2),
          totalAmount.toDecimalPlaces(2),
        ).toNumber();
        const netAmount = roundMoney(totalAmount.minus(discountFinal));
        const vatRate = await this.settingsService.getVatRatePercent();
        const taxAmount = inclusiveTaxAmount(netAmount, vatRate);
        const pointsEarned = customer ? pointsEarnedForSpend(netAmount) : 0;

        if (customer && pointsEarned > 0) {
          await tx.customer.update({
            where: { id: customer.id },
            data: { points: { increment: pointsEarned } },
          });
        }

        const orderStatus = resolveInitialOrderStatus(productsForStatus);
        const { queueNumber, queueDate } = await allocateQueueNumber(
          tx,
          data.branchId,
        );

        const order = await tx.order.create({
          data: {
            clientRequestId: data.clientRequestId,
            userId: data.userId,
            branchId: data.branchId,
            status: orderStatus,
            queueNumber,
            queueDate,
            totalAmount: roundMoney(totalAmount),
            discountAmount: discountFinal,
            netAmount,
            taxAmount,
            totalCogs: roundMoney(totalCogs),
            pointsEarned,
            pointsRedeemed,
            customerId,
            promotionId,
            paymentMethod: data.paymentMethod || 'CASH',
            isTaxInvoiceRequested: data.isTaxInvoiceRequested || false,
            taxInvoiceName: data.taxInvoiceName,
            taxInvoiceTaxId: data.taxInvoiceTaxId,
            taxInvoiceAddress: data.taxInvoiceAddress,
            items: {
              create: processedItems.map((item) => ({
                productId: item.productId,
                quantity: item.quantity,
                price: item.unitPrice,
                notes: item.notesText,
                modifiers: item.modifiers.length
                  ? {
                      create: item.modifiers.map((m) => ({
                        optionId: m.optionId,
                        optionName: m.optionName,
                        priceDelta: m.priceDelta,
                      })),
                    }
                  : undefined,
              })),
            },
          },
          include: createOrderInclude,
        });

        await this.outboxService.enqueue(tx, OUTBOX_EVENT_TYPES.ORDER_CREATED, {
          order: toOrderSnapshot(order),
          ingredientRequirements: Array.from(ingredientRequirements.entries()),
          branchId: data.branchId,
          customerId,
        });

        return order;
      });
    } catch (err) {
      if (data.clientRequestId && this.isClientRequestIdConflict(err)) {
        const existing = await this.prisma.order.findUnique({
          where: { clientRequestId: data.clientRequestId },
          include: createOrderInclude,
        });
        if (existing) return existing;
      }
      if (
        this.isQueueNumberConflict(err) &&
        attempt < MAX_QUEUE_NUMBER_RETRIES
      ) {
        return this.createOrderWithQueueRetry(data, attempt + 1);
      }
      throw err;
    }
  }

  private isClientRequestIdConflict(err: unknown): boolean {
    return this.isUniqueConflictOn(err, 'clientRequestId');
  }

  private isUniqueConflictOn(err: unknown, column: string): boolean {
    if (
      !(err instanceof Prisma.PrismaClientKnownRequestError) ||
      err.code !== 'P2002'
    ) {
      return false;
    }

    const target = err.meta?.target;
    return Array.isArray(target) && target.includes(column);
  }

  private isQueueNumberConflict(err: unknown): boolean {
    return this.isUniqueConflictOn(err, 'queueNumber');
  }
}
