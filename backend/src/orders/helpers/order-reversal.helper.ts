import { OrderStatus } from '@prisma/client';
import { Prisma } from '@prisma/client';
import { InventoryHelper } from '../../common/helpers/inventory.helper';
import { buildIngredientRequirementsFromOrderItems } from '../domain/recipe-requirements';

export const ORDER_REVERSAL_INCLUDE = {
  items: {
    include: {
      product: { include: { recipeItems: true } },
      modifiers: {
        include: {
          option: { include: { group: true } },
        },
      },
    },
  },
} satisfies Prisma.OrderInclude;

export type OrderForReversal = Prisma.OrderGetPayload<{
  include: typeof ORDER_REVERSAL_INCLUDE;
}>;

export function isTerminalOrderStatus(status: OrderStatus): boolean {
  return status === 'CANCELLED' || status === 'REFUNDED';
}

/** Restore inventory and reverse loyalty points for a void/refund. */
export async function applyOrderReversalEffects(
  tx: Prisma.TransactionClient,
  order: OrderForReversal,
): Promise<void> {
  const ingredientRequirements = buildIngredientRequirementsFromOrderItems(
    order.items,
  );

  if (ingredientRequirements.size > 0) {
    await InventoryHelper.restoreInventory(
      tx,
      order.branchId,
      ingredientRequirements,
    );
  }

  if (order.customerId) {
    const pointsDelta = order.pointsRedeemed - order.pointsEarned;
    if (pointsDelta > 0) {
      await tx.customer.update({
        where: { id: order.customerId },
        data: { points: { increment: pointsDelta } },
      });
    } else if (pointsDelta < 0) {
      const clawback = -pointsDelta;
      const guarded = await tx.customer.updateMany({
        where: { id: order.customerId, points: { gte: clawback } },
        data: { points: { decrement: clawback } },
      });
      if (guarded.count === 0) {
        await tx.customer.update({
          where: { id: order.customerId },
          data: { points: 0 },
        });
      }
    }
  }
}
