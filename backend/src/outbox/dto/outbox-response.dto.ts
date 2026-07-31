import { ApiProperty } from '@nestjs/swagger';
import { OutboxStatus } from '@prisma/client';

export class OutboxEventResponseDto {
  @ApiProperty({ example: 7 })
  id: number;

  @ApiProperty({ example: 'order.created' })
  eventType: string;

  @ApiProperty({ enum: OutboxStatus, example: OutboxStatus.FAILED })
  status: OutboxStatus;

  @ApiProperty({ example: 5 })
  attempts: number;

  @ApiProperty({ type: String, nullable: true })
  lastError: string | null;

  @ApiProperty({ type: String, format: 'date-time' })
  createdAt: Date;

  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  claimedAt: Date | null;

  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  processedAt: Date | null;
}
