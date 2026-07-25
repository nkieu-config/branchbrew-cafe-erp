import { Injectable } from '@nestjs/common';
import { BranchScopedUser } from '../auth/branch-scope.util';
import { OrderStatus } from '@prisma/client';
import { OrderCreationService } from './order-creation.service';
import { OrderLifecycleService } from './order-lifecycle.service';
import { CreateOrderInput, CreatedOrder } from './orders.types';

/**
 * Facade over order creation and lifecycle services.
 * Keeps controllers and external modules stable while splitting responsibilities.
 */
@Injectable()
export class OrdersService {
  constructor(
    private readonly creationService: OrderCreationService,
    private readonly lifecycleService: OrderLifecycleService,
  ) {}

  createOrder(data: CreateOrderInput): Promise<CreatedOrder> {
    return this.creationService.createOrder(data);
  }

  findPage(options: {
    branchId?: number;
    since: Date;
    take: number;
    skip: number;
  }) {
    return this.lifecycleService.findPage(options);
  }

  findOne(id: number, user?: BranchScopedUser) {
    return this.lifecycleService.findOne(id, user);
  }

  getKdsOrders(branchId: number) {
    return this.lifecycleService.getKdsOrders(branchId);
  }

  updateOrderStatus(
    orderId: number,
    status: OrderStatus,
    user?: BranchScopedUser,
  ) {
    return this.lifecycleService.updateOrderStatus(orderId, status, user);
  }

  voidOrder(orderId: number, user?: BranchScopedUser) {
    return this.lifecycleService.voidOrder(orderId, user);
  }

  refundOrder(orderId: number, reason?: string, user?: BranchScopedUser) {
    return this.lifecycleService.refundOrder(orderId, reason, user);
  }
}
