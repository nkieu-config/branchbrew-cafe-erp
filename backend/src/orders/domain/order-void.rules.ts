import { OrderLifecycleStatus } from './order-status.rules';

export { buildIngredientRequirementsFromOrderItems } from './recipe-requirements';

export function isSameCalendarDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export function isTerminalOrderStatus(status: OrderLifecycleStatus): boolean {
  return status === 'CANCELLED' || status === 'REFUNDED';
}
