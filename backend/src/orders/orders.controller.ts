import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  ParseIntPipe,
  UseGuards,
  Request,
  Query,
  Patch,
} from '@nestjs/common';
import { OrdersService } from './orders.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CreateOrderDto } from './dto/create-order.dto';
import { RefundOrderDto } from './dto/refund-order.dto';
import { UpdateOrderStatusDto } from './dto/update-order-status.dto';
import type { RequestWithUser } from '../auth/interfaces/request-with-user.interface';
import { assertBranchAccess, resolveBranchId } from '../auth/branch-scope.util';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ApiCommonErrorResponses } from '../common/http/swagger-error.decorators';
import { OrderResponseDto } from './dto/order-response.dto';
import {
  ORDER_LIST_DEFAULT_LIMIT,
  ORDER_LIST_DEFAULT_LOOKBACK_DAYS,
  OrderListQueryDto,
} from './dto/order-list-query.dto';
import { resolvePageWindow } from '../common/pagination/pagination-query.dto';
import {
  ApiPaginatedResponse,
  paginated,
} from '../common/pagination/paginated-response.dto';

function resolveOrderListSince(since?: string): Date {
  if (since) return new Date(`${since}T00:00:00.000Z`);

  const fallback = new Date();
  fallback.setDate(fallback.getDate() - ORDER_LIST_DEFAULT_LOOKBACK_DAYS);
  fallback.setHours(0, 0, 0, 0);
  return fallback;
}

@UseGuards(JwtAuthGuard)
@ApiTags('orders')
@Controller('orders')
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Post()
  @ApiOperation({ summary: 'Create order' })
  @ApiOkResponse({ type: OrderResponseDto, description: 'Order created' })
  @ApiCommonErrorResponses()
  create(
    @Body() createOrderDto: CreateOrderDto,
    @Request() req: RequestWithUser,
  ) {
    const branchId = resolveBranchId(req.user, createOrderDto.branchId);
    return this.ordersService.createOrder({
      ...createOrderDto,
      userId: req.user.userId,
      branchId,
    });
  }

  @Get()
  @ApiOperation({ summary: 'List orders in a bounded, paginated window' })
  @ApiPaginatedResponse(OrderResponseDto, 'Orders retrieved')
  @ApiCommonErrorResponses()
  async findAll(
    @Request() req: RequestWithUser,
    @Query() query: OrderListQueryDto,
  ) {
    const isChainWide =
      req.user.role === 'SUPER_ADMIN' && query.branchId == null;
    const branchId = isChainWide
      ? undefined
      : resolveBranchId(req.user, query.branchId);

    const window = resolvePageWindow(query, ORDER_LIST_DEFAULT_LIMIT);
    const { items, total } = await this.ordersService.findPage({
      branchId,
      since: resolveOrderListSince(query.since),
      ...window,
    });

    return paginated(items, total, window);
  }

  @Get('kds')
  @ApiOperation({ summary: 'List kitchen display orders' })
  @ApiOkResponse({
    type: OrderResponseDto,
    isArray: true,
    description: 'KDS orders retrieved',
  })
  @ApiCommonErrorResponses()
  getKdsOrders(
    @Query('branchId', ParseIntPipe) branchId: number,
    @Request() req: RequestWithUser,
  ) {
    assertBranchAccess(req.user, branchId);
    return this.ordersService.getKdsOrders(branchId);
  }

  @Patch(':id/status')
  @ApiOperation({ summary: 'Update order status' })
  @ApiOkResponse({
    type: OrderResponseDto,
    description: 'Order status updated',
  })
  @ApiCommonErrorResponses()
  updateOrderStatus(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateOrderStatusDto,
    @Request() req: RequestWithUser,
  ) {
    return this.ordersService.updateOrderStatus(id, dto.status, req.user);
  }

  @Post(':id/void')
  @UseGuards(RolesGuard)
  @Roles('SUPER_ADMIN', 'MANAGER')
  @ApiOperation({ summary: 'Void order' })
  @ApiOkResponse({ type: OrderResponseDto, description: 'Order voided' })
  @ApiCommonErrorResponses()
  voidOrder(
    @Param('id', ParseIntPipe) id: number,
    @Request() req: RequestWithUser,
  ) {
    return this.ordersService.voidOrder(id, req.user);
  }

  @Post(':id/refund')
  @UseGuards(RolesGuard)
  @Roles('SUPER_ADMIN', 'MANAGER')
  @ApiOperation({ summary: 'Refund order' })
  @ApiOkResponse({ type: OrderResponseDto, description: 'Order refunded' })
  @ApiCommonErrorResponses()
  refundOrder(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: RefundOrderDto,
    @Request() req: RequestWithUser,
  ) {
    return this.ordersService.refundOrder(id, dto.reason, req.user);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get order by id' })
  @ApiOkResponse({ type: OrderResponseDto, description: 'Order retrieved' })
  @ApiCommonErrorResponses()
  findOne(
    @Param('id', ParseIntPipe) id: number,
    @Request() req: RequestWithUser,
  ) {
    return this.ordersService.findOne(id, req.user);
  }
}
