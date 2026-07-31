import { Module } from '@nestjs/common';
import { OutboxProcessor } from './outbox.processor';
import { OutboxService } from './outbox.service';
import { OutboxController } from './outbox.controller';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [OutboxController],
  providers: [OutboxService, OutboxProcessor],
  exports: [OutboxService],
})
export class OutboxModule {}
