import { ApiProperty } from '@nestjs/swagger';
import { Tier } from '@prisma/client';

export class CustomerResponseDto {
  @ApiProperty({ example: 1 })
  id: number;

  @ApiProperty({ example: '0812345678' })
  phone: string;

  @ApiProperty({ example: 'Jane Customer' })
  name: string;

  @ApiProperty({ example: 120 })
  points: number;

  @ApiProperty({ enum: Tier, example: Tier.REGULAR })
  tier: Tier;

  @ApiProperty({ type: String, format: 'date-time' })
  createdAt: Date;

  @ApiProperty({ type: String, format: 'date-time' })
  updatedAt: Date;
}

export class OrderCustomerSummaryDto {
  @ApiProperty({ example: 1 })
  id: number;

  @ApiProperty({ example: 'Jane Customer' })
  name: string;

  @ApiProperty({ enum: Tier, example: Tier.REGULAR })
  tier: Tier;
}

export class Customer360FavoriteDrinkDto {
  @ApiProperty({ example: 'Latte' })
  name: string;

  @ApiProperty({ example: 8 })
  count: number;
}

export class Customer360OrderItemDto {
  @ApiProperty({ example: 1 })
  id: number;

  @ApiProperty({ example: 10 })
  productId: number;

  @ApiProperty({ example: 2 })
  quantity: number;
}

export class Customer360OrderDto {
  @ApiProperty({ example: 100 })
  id: number;

  @ApiProperty({ example: 150 })
  netAmount: number;

  @ApiProperty({ type: String, format: 'date-time' })
  createdAt: Date;

  @ApiProperty({
    type: Customer360OrderItemDto,
    isArray: true,
    required: false,
  })
  items?: Customer360OrderItemDto[];
}

export class Customer360ResponseDto {
  @ApiProperty({ type: CustomerResponseDto })
  customer: CustomerResponseDto;

  @ApiProperty({ example: 12500 })
  lifetimeSpend: number;

  @ApiProperty({ type: String, example: 'GOLD', nullable: true })
  nextTier: string | null;

  @ApiProperty({ example: 7500 })
  amountToNextTier: number;

  @ApiProperty({ example: 62.5 })
  progressPercentage: number;

  @ApiProperty({ type: Customer360FavoriteDrinkDto, isArray: true })
  favoriteDrinks: Customer360FavoriteDrinkDto[];

  @ApiProperty({ enum: ['LOW', 'MEDIUM', 'HIGH'], example: 'LOW' })
  churnRisk: string;

  @ApiProperty({ example: 3 })
  daysSinceLastOrder: number;

  @ApiProperty({ type: Customer360OrderDto, isArray: true })
  recentOrders: Customer360OrderDto[];
}
