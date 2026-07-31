// API response / domain types — decoupled from Prisma database models.

import type { components } from './generated/api';
import type {
  AccountType,
  BatchStatus,
  DiscountType,
  EmploymentType,
  EquipmentStatus,
  EquipmentType,
  JournalStatus,
  LeaveStatus,
  LeaveType,
  OrderStatus,
  PaymentMethod,
  PayrollStatus,
  POStatus,
  ProductionStatus,
  Role,
  SettlementStatus,
  ShiftStatus,
  Tier,
  TransferStatus,
} from '@branchbrew/types';

import type { Account } from './accounting';
import type { Product } from './products';
import type { User } from './hr';
import type { ValidatePromotionResult } from './promotions';

export type { Branch, StockTransfer, SyncBranchInventoryResult } from './branches';
export type { Customer, Customer360, Customer360Order } from './customers';
export type {
  Order,
  OrderItem,
  OrderItemModifier,
  OrderPage,
  OrderProductSummary,
  OrderPromotionSummary,
} from './orders';
export type { Product, RecipeItem } from './products';
export type {
  ApAging,
  ApAgingBucket,
  PurchaseOrder,
  PurchaseOrderItem,
  Supplier,
  SupplierPayment,
} from './procurement';
export type {
  BranchInventory,
  IngredientSummary,
  InventoryBatch,
  StockAdjustment,
  StockCount,
  StockCountLine,
  StockInResult,
  WasteLog,
} from './inventory';
export type {
  AttendanceRecord,
  HrUser,
  HrUserSummary,
  LeaveRequest,
  LeaveRequestUserSummary,
  PayrollRun,
  Payslip,
  Shift,
  User,
} from './hr';
export type {
  Account,
  AppNotification,
  JournalEntry,
  JournalLine,
  ProfitLossMonth,
  VatReportMonth,
} from './accounting';
export type { Expense, Settlement, SettlementExpected } from './finance';
export type { ModifierDeleteResult, ModifierGroup, ModifierOption } from './modifiers';
export type { Equipment, EquipmentDetail, MaintenanceLog } from './equipment';
export type {
  ExecutiveSummary,
  ExecutiveSummaryExpiryAlert,
  ExecutiveSummaryLowStockAlert,
  ExecutiveSummaryTopBranch,
  FoodCostActual,
  ReportsProfitLoss,
  SalesTrendPoint,
  TopProductReport,
} from './reports';
export type {
  BranchInventoryWithIngredient,
  Ingredient,
  SyncIngredientInventoryResult,
} from './ingredients';
export type { Promotion, ValidatePromotionResult } from './promotions';
export type { ProductionBOM, ProductionOrder } from './production';
export type { SystemSettings } from './settings';
export type { AuditLog, AuditLogUserSummary } from './audit';

export type {
  AccountType,
  BatchStatus,
  DiscountType,
  EmploymentType,
  EquipmentStatus,
  EquipmentType,
  JournalStatus,
  LeaveStatus,
  LeaveType,
  OrderStatus,
  PaymentMethod,
  PayrollStatus,
  POStatus,
  ProductionStatus,
  Role,
  SettlementStatus,
  ShiftStatus,
  Tier,
  TransferStatus,
};

// --- Form / UI helper types ---

export type UpdatePayload<T extends { id: number }> = { id: number } & Partial<Omit<T, 'id'>>;

export interface StockLineItem {
  ingredientId: number;
  quantity: number;
  expiryDate?: string;
}

export interface WasteLineItem {
  ingredientId: number;
  quantity: number;
  reason: string;
}

export interface CreateUserPayload {
  name: string;
  email: string;
  password?: string;
  role: Role;
  branchId: number | null;
  employmentType: EmploymentType;
  hourlyRate: number;
  baseSalary: number;
}

export type UpdateUserPayload = UpdatePayload<User> & Partial<CreateUserPayload>;

export interface CreateIngredientPayload {
  name: string;
  unit: string;
  stock: number;
  minStock: number;
}

export interface CreateProductPayload {
  name: string;
  price: number;
  category: string;
  recipeItems?: { ingredientId: number; quantity: number }[];
}

export type CreateOrderPayload = components['schemas']['CreateOrderDto'];

export interface CreatePurchaseOrderPayload {
  branchId: number;
  supplierId: number;
  items: { ingredientId: number; quantity: number; price: number }[];
}

export interface CreateProductionOrderPayload {
  branchId: number;
  targetIngredientId: number;
  quantityToProduce: number;
  plannedStartDate?: string;
}

export interface CreateProductionBOMPayload {
  targetIngredientId: number;
  rawIngredientId: number;
  quantityNeeded: number;
}

// --- Production BOM UI composites ---

export interface BomChildRow {
  id: number;
  rawIngredientId: number;
  rawName: string;
  rawUnit: string;
  quantityNeeded: number;
  costPerUnit: number;
  totalCost: number;
}

export interface BomGroupRow {
  id: string;
  targetName: string;
  targetUnit: string;
  isGroup: true;
  children: BomChildRow[];
}

export type BomTableRow = BomGroupRow | (BomChildRow & { isGroup?: never });

// --- Accounting UI composites ---

export interface AccountTreeGroup {
  id: string;
  code: string;
  name: string;
  type: AccountType;
  isGroup: true;
  children: Account[];
}

export type AccountTableRow = AccountTreeGroup | (Account & { isGroup?: never });

// --- POS receipt ---

export interface ReceiptCartItem {
  product: Product;
  quantity: number;
  notes?: string;
}

export interface CreatedOrderItem {
  product: Product;
  quantity: number;
  notes?: string | null;
}

export interface ReceiptOrder {
  id?: number;
  queueNumber?: number | null;
  cashier?: string | { name?: string | null };
  customerName?: string;
  items?: ReceiptCartItem[];
  subtotal?: number;
  discount?: number;
  netTotal?: number;
}

export type ValidatedPromotion = ValidatePromotionResult;
