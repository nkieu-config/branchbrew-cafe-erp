import { RequestMethod } from '@nestjs/common';
import { PATH_METADATA, METHOD_METADATA } from '@nestjs/common/constants';
import { ROLES_KEY } from './roles.decorator';
import { IS_PUBLIC_KEY } from './public.decorator';
import { AccountingController } from '../accounting/accounting.controller';
import { AppController } from '../app.controller';
import { AuditController } from '../audit/audit.controller';
import { MetricsController } from '../observability/metrics.controller';
import { AuthController } from './auth.controller';
import { BranchesController } from '../branches/branches.controller';
import { CustomersController } from '../customers/customers.controller';
import { EquipmentController } from '../equipment/equipment.controller';
import { FinanceController } from '../finance/finance.controller';
import { HrController } from '../hr/hr.controller';
import { IngredientsController } from '../ingredients/ingredients.controller';
import { InventoryController } from '../inventory/inventory.controller';
import { ModifiersController } from '../modifiers/modifiers.controller';
import { NavigationController } from '../navigation/navigation.controller';
import { NotificationsController } from '../notifications/notifications.controller';
import { OrdersController } from '../orders/orders.controller';
import { OutboxController } from '../outbox/outbox.controller';
import { PurchaseOrdersController } from '../procurement/purchase-orders.controller';
import { SuppliersController } from '../procurement/suppliers.controller';
import { ProductionController } from '../production/production.controller';
import { ProductsController } from '../products/products.controller';
import { PromotionsController } from '../promotions/promotions.controller';
import { ReportsController } from '../reports/reports.controller';
import { SettingsController } from '../settings/settings.controller';

const CONTROLLERS = [
  AccountingController,
  AppController,
  AuditController,
  AuthController,
  MetricsController,
  BranchesController,
  CustomersController,
  EquipmentController,
  FinanceController,
  HrController,
  IngredientsController,
  InventoryController,
  ModifiersController,
  NavigationController,
  NotificationsController,
  OrdersController,
  OutboxController,
  PurchaseOrdersController,
  SuppliersController,
  ProductionController,
  ProductsController,
  PromotionsController,
  ReportsController,
  SettingsController,
];

const VERB = new Map<number, string>([
  [RequestMethod.GET, 'GET'],
  [RequestMethod.POST, 'POST'],
  [RequestMethod.PUT, 'PUT'],
  [RequestMethod.DELETE, 'DELETE'],
  [RequestMethod.PATCH, 'PATCH'],
]);

const ANY_AUTHENTICATED_ROUTES = new Set<string>([
  'GET /auth/me',
  'POST /auth/logout',
  'GET /nav-counts',
  'GET /settings',

  'GET /notifications',
  'PATCH /notifications/:id/read',
  'POST /notifications/read-all',

  'POST /orders',
  'GET /orders',
  'GET /orders/:id',
  'GET /orders/kds',
  'PATCH /orders/:id/status',
  'GET /products',
  'GET /products/:id',
  'GET /modifiers',
  'GET /promotions',
  'POST /promotions/validate',
  'GET /customers/phone/:phone',

  'POST /hr/clock-in',
  'POST /hr/clock-out',
  'GET /hr/attendance/me',
  'GET /hr/attendance/status',
  'GET /hr/shifts/me',
  'GET /hr/shifts/branch/:branchId',
  'POST /hr/leave',
  'GET /hr/leave/me',

  'GET /branches',
  'GET /branches/:id',
  'GET /branches/:id/transfers',
  'GET /branches/transfers/all',
  'GET /ingredients',
  'GET /ingredients/:id',
  'GET /ingredients/inventory/branch',
  'GET /ingredients/waste/logs',
  'GET /equipment',
  'GET /equipment/:id',
  'GET /production/boms',
  'GET /production/orders',

  'GET /finance/settlements/expected',
  'GET /purchase-orders',
  'GET /suppliers',
]);

type Route = { id: string; guarded: boolean; isPublic: boolean };

function routesOf(controller: new (...args: never[]) => object): Route[] {
  const proto = controller.prototype as Record<string, unknown>;
  const base = (Reflect.getMetadata(PATH_METADATA, controller) as string) ?? '';
  const classRoles: unknown = Reflect.getMetadata(ROLES_KEY, controller);

  return Object.getOwnPropertyNames(proto)
    .filter((name) => name !== 'constructor')
    .map((name) => proto[name])
    .filter(
      (handler): handler is (...args: never[]) => unknown =>
        typeof handler === 'function' &&
        Reflect.hasMetadata(PATH_METADATA, handler),
    )
    .map((handler) => {
      const path = Reflect.getMetadata(PATH_METADATA, handler) as string;
      const verb = Reflect.getMetadata(METHOD_METADATA, handler) as number;
      const suffix = path && path !== '/' ? `/${path}` : '';

      return {
        id: `${VERB.get(verb) ?? verb} /${base}${suffix}`,
        guarded:
          classRoles !== undefined ||
          Reflect.getMetadata(ROLES_KEY, handler) !== undefined,
        isPublic:
          Reflect.getMetadata(IS_PUBLIC_KEY, handler) === true ||
          Reflect.getMetadata(IS_PUBLIC_KEY, controller) === true,
      };
    });
}

describe('route authorization coverage', () => {
  const routes = CONTROLLERS.flatMap((controller) =>
    routesOf(controller as never),
  );

  it('discovers every controller route', () => {
    expect(routes.length).toBeGreaterThan(100);
  });

  it('leaves no route implicitly open to any authenticated role', () => {
    const unaccounted = routes
      .filter(
        (route) =>
          !route.guarded &&
          !route.isPublic &&
          !ANY_AUTHENTICATED_ROUTES.has(route.id),
      )
      .map((route) => route.id)
      .sort();

    expect(unaccounted).toEqual([]);
  });

  it('keeps the any-authenticated allowlist honest', () => {
    const stale = [...ANY_AUTHENTICATED_ROUTES]
      .filter((id) => {
        const route = routes.find((candidate) => candidate.id === id);
        return !route || route.guarded || route.isPublic;
      })
      .sort();

    expect(stale).toEqual([]);
  });
});
