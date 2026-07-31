import {
  IsInt,
  IsPositive,
  IsArray,
  ValidateNested,
  IsOptional,
  IsString,
  IsBoolean,
  IsNotEmpty,
  Matches,
  MaxLength,
  IsUUID,
  Min,
  IsEnum,
  ValidateIf,
} from 'class-validator';
import { Type } from 'class-transformer';
import { PaymentMethod } from '@prisma/client';

export class OrderItemDto {
  @IsInt()
  @IsPositive()
  productId: number;

  @IsInt()
  @IsPositive()
  quantity: number;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;

  @IsOptional()
  @IsArray()
  @IsInt({ each: true })
  modifierOptionIds?: number[];
}

export class CreateOrderDto {
  @IsOptional()
  @IsInt()
  @IsPositive()
  branchId?: number;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => OrderItemDto)
  items: OrderItemDto[];

  @IsOptional()
  @Matches(/^\d{8,15}$/, {
    message: 'customerPhone must be 8-15 digits',
  })
  customerPhone?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  promotionCode?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  pointsToRedeem?: number;

  @IsOptional()
  @IsEnum(PaymentMethod)
  paymentMethod?: PaymentMethod;

  @IsOptional()
  @IsBoolean()
  isTaxInvoiceRequested?: boolean;

  @ValidateIf((o: CreateOrderDto) => o.isTaxInvoiceRequested === true)
  @IsString()
  @IsNotEmpty({ message: 'taxInvoiceName is required for a tax invoice' })
  @MaxLength(200)
  taxInvoiceName?: string;

  @ValidateIf((o: CreateOrderDto) => o.isTaxInvoiceRequested === true)
  @Matches(/^\d{13}$/, {
    message: 'taxInvoiceTaxId must be a 13-digit Thai tax ID',
  })
  taxInvoiceTaxId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  taxInvoiceAddress?: string;

  @IsOptional()
  @IsUUID()
  clientRequestId?: string;
}
