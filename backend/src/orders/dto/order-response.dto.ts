import { ApiProperty } from '@nestjs/swagger';
import { OrderStatus, PaymentMethod } from '@prisma/client';
import { BranchResponseDto } from '../../branches/dto/branch-response.dto';
import { OrderCustomerSummaryDto } from '../../customers/dto/customer-response.dto';

export class OrderItemModifierResponseDto {
  @ApiProperty({ example: 1 })
  id: number;

  @ApiProperty({ example: 10 })
  orderItemId: number;

  @ApiProperty({ example: 3 })
  optionId: number;

  @ApiProperty({ example: 'Extra shot' })
  optionName: string;

  @ApiProperty({ example: 15 })
  priceDelta: number;
}

export class OrderProductSummaryDto {
  @ApiProperty({ example: 1 })
  id: number;

  @ApiProperty({ example: 'Latte' })
  name: string;

  @ApiProperty({ example: 120 })
  price: number;

  @ApiProperty({ example: 'Coffee' })
  category: string;
}

export class OrderItemResponseDto {
  @ApiProperty({ example: 1 })
  id: number;

  @ApiProperty({ example: 100 })
  orderId: number;

  @ApiProperty({ example: 1 })
  productId: number;

  @ApiProperty({ example: 2 })
  quantity: number;

  @ApiProperty({ example: 120 })
  price: number;

  @ApiProperty({ type: String, example: 'Less ice', nullable: true })
  notes: string | null;

  @ApiProperty({ type: OrderProductSummaryDto, required: false })
  product?: OrderProductSummaryDto;

  @ApiProperty({
    type: OrderItemModifierResponseDto,
    isArray: true,
    required: false,
  })
  modifiers?: OrderItemModifierResponseDto[];
}

export class OrderPromotionSummaryDto {
  @ApiProperty({ example: 1 })
  id: number;

  @ApiProperty({ example: 'SUMMER10' })
  code: string;

  @ApiProperty({ example: '10% off summer drinks' })
  description: string;
}

export class OrderResponseDto {
  @ApiProperty({ example: 100 })
  id: number;

  @ApiProperty({ example: 240 })
  totalAmount: number;

  @ApiProperty({ example: 24 })
  discountAmount: number;

  @ApiProperty({ example: 216 })
  netAmount: number;

  @ApiProperty({ example: 0 })
  taxAmount: number;

  @ApiProperty({ example: 80 })
  totalCogs: number;

  @ApiProperty({ example: 21 })
  pointsEarned: number;

  @ApiProperty({ example: 0 })
  pointsRedeemed: number;

  @ApiProperty({ enum: OrderStatus, example: OrderStatus.PENDING })
  status: OrderStatus;

  @ApiProperty({ enum: PaymentMethod, example: PaymentMethod.CASH })
  paymentMethod: PaymentMethod;

  @ApiProperty({ example: false, required: false })
  isTaxInvoiceRequested?: boolean;

  @ApiProperty({ type: String, nullable: true, required: false })
  taxInvoiceName?: string | null;

  @ApiProperty({ type: String, nullable: true, required: false })
  taxInvoiceTaxId?: string | null;

  @ApiProperty({ type: String, nullable: true, required: false })
  taxInvoiceAddress?: string | null;

  @ApiProperty({ example: 1 })
  userId: number;

  @ApiProperty({ example: 1 })
  branchId: number;

  @ApiProperty({ type: Number, example: 5, nullable: true, required: false })
  customerId?: number | null;

  @ApiProperty({ type: Number, example: 2, nullable: true, required: false })
  promotionId?: number | null;

  @ApiProperty({ type: Number, example: 42, nullable: true, required: false })
  queueNumber?: number | null;

  @ApiProperty({
    type: String,
    format: 'date',
    nullable: true,
    required: false,
  })
  queueDate?: Date | null;

  @ApiProperty({ type: String, nullable: true, required: false })
  refundReason?: string | null;

  @ApiProperty({
    type: String,
    format: 'date-time',
    nullable: true,
    required: false,
  })
  refundedAt?: Date | null;

  @ApiProperty({ type: String, format: 'date-time' })
  createdAt: Date;

  @ApiProperty({ type: OrderItemResponseDto, isArray: true, required: false })
  items?: OrderItemResponseDto[];

  @ApiProperty({
    type: OrderCustomerSummaryDto,
    required: false,
    nullable: true,
  })
  customer?: OrderCustomerSummaryDto | null;

  @ApiProperty({ type: BranchResponseDto, required: false })
  branch?: BranchResponseDto;

  @ApiProperty({
    type: OrderPromotionSummaryDto,
    required: false,
    nullable: true,
  })
  promotion?: OrderPromotionSummaryDto | null;
}
