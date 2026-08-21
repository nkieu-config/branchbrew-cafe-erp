import { Module } from '@nestjs/common';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';
import { OrderCreationService } from './order-creation.service';
import { OrderLifecycleService } from './order-lifecycle.service';
import { OutboxModule } from '../outbox/outbox.module';
import { SettingsModule } from '../settings/settings.module';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [OutboxModule, SettingsModule, AuditModule],
  controllers: [OrdersController],
  providers: [OrdersService, OrderCreationService, OrderLifecycleService],
})
export class OrdersModule {}
