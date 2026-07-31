import { Module } from '@nestjs/common';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { AppController } from './app.controller';
import { PrismaModule } from './prisma/prisma.module';
import { ProductsModule } from './products/products.module';
import { IngredientsModule } from './ingredients/ingredients.module';
import { OrdersModule } from './orders/orders.module';
import { EventEmitterModule } from '@nestjs/event-emitter';

import { AuthModule } from './auth/auth.module';
import { BranchesModule } from './branches/branches.module';
import { ProcurementModule } from './procurement/procurement.module';
import { CustomersModule } from './customers/customers.module';
import { PromotionsModule } from './promotions/promotions.module';
import { HrModule } from './hr/hr.module';
import { FinanceModule } from './finance/finance.module';
import { InventoryModule } from './inventory/inventory.module';
import { RealtimeModule } from './realtime/realtime.module';
import { EquipmentModule } from './equipment/equipment.module';
import { ScheduleModule } from '@nestjs/schedule';
import { ReportsModule } from './reports/reports.module';
import { AuditModule } from './audit/audit.module';
import { AccountingModule } from './accounting/accounting.module';
import { ProductionModule } from './production/production.module';
import { SettingsModule } from './settings/settings.module';
import { OutboxModule } from './outbox/outbox.module';
import { ModifiersModule } from './modifiers/modifiers.module';
import { NavigationModule } from './navigation/navigation.module';
import { NotificationsModule } from './notifications/notifications.module';
import { JwtAuthGuard } from './auth/jwt-auth.guard';
import { ObservabilityModule } from './observability/observability.module';

@Module({
  imports: [
    ThrottlerModule.forRoot([
      {
        ttl: Number(process.env.THROTTLE_TTL_MS ?? 60000),
        limit: Number(process.env.THROTTLE_LIMIT ?? 60),
      },
    ]),
    EventEmitterModule.forRoot(),
    PrismaModule,
    ProductsModule,
    IngredientsModule,
    OrdersModule,
    AuthModule,
    BranchesModule,
    ProcurementModule,
    CustomersModule,
    PromotionsModule,
    HrModule,
    FinanceModule,
    InventoryModule,
    RealtimeModule,
    EquipmentModule,
    ScheduleModule.forRoot(),
    ReportsModule,
    AuditModule,
    AccountingModule,
    ProductionModule,
    SettingsModule,
    OutboxModule,
    ModifiersModule,
    NavigationModule,
    NotificationsModule,
    ObservabilityModule,
  ],
  controllers: [AppController],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
  ],
})
export class AppModule {}
