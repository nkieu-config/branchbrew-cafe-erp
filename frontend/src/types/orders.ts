import type { components } from './generated/api';
import type { Paginated } from './pagination';

export type Order = components['schemas']['OrderResponseDto'];

export type OrderPage = Paginated<Order>;

export type OrderItem = components['schemas']['OrderItemResponseDto'];

export type OrderItemModifier =
  components['schemas']['OrderItemModifierResponseDto'];

export type OrderProductSummary =
  components['schemas']['OrderProductSummaryDto'];

export type OrderPromotionSummary =
  components['schemas']['OrderPromotionSummaryDto'];
