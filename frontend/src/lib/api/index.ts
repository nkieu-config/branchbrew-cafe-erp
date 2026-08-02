import type {
  LoginDTO,
  CreateCustomerDTO,
  CreatePromotionDTO,
  CreateShiftDTO,
  CreateTransferDTO,
  EquipmentDTO,
  LogMaintenanceDTO,
} from '../../types/schemas';
import type {
  CreateIngredientPayload,
  CreateProductPayload,
  CreateOrderPayload,
  CreatePurchaseOrderPayload,
  CreateProductionOrderPayload,
  CreateProductionBOMPayload
} from '../../types/api';
import { API_ENDPOINTS } from '../endpoints';
import { API_URL, fetchAPI, fetchAPIBlob } from './client';

export { fetchAPI, API_URL };

// Auth
export const loginApi = (data: LoginDTO) =>
  fetchAPI(API_ENDPOINTS.auth.login, { method: 'POST', body: JSON.stringify(data) });
export const logoutApi = () => fetchAPI(API_ENDPOINTS.auth.logout, { method: 'POST' });
export const getMe = () => fetchAPI(API_ENDPOINTS.auth.me);

// Ingredients
export const getIngredients = () => fetchAPI(API_ENDPOINTS.ingredients.list);
export const createIngredient = (data: CreateIngredientPayload) =>
  fetchAPI(API_ENDPOINTS.ingredients.create, { method: 'POST', body: JSON.stringify(data) });

// Products
export const getProducts = () => fetchAPI(API_ENDPOINTS.products.list);
export const createProduct = (data: CreateProductPayload) =>
  fetchAPI(API_ENDPOINTS.products.create, { method: 'POST', body: JSON.stringify(data) });

// Orders
export const createOrder = (data: CreateOrderPayload) =>
  fetchAPI(API_ENDPOINTS.orders.create, { method: 'POST', body: JSON.stringify(data) });
export const getOrders = () => fetchAPI(API_ENDPOINTS.orders.list());
export const getKdsOrders = (branchId: number) => fetchAPI(API_ENDPOINTS.orders.kds(branchId));
export const updateOrderStatus = (orderId: number, status: string) =>
  fetchAPI(API_ENDPOINTS.orders.updateStatus(orderId), { method: 'PATCH', body: JSON.stringify({ status }) });
export const voidOrder = (orderId: number) =>
  fetchAPI(API_ENDPOINTS.orders.void(orderId), { method: 'POST' });

export const refundOrder = (orderId: number, reason?: string) =>
  fetchAPI(API_ENDPOINTS.orders.refund(orderId), {
    method: 'POST',
    body: JSON.stringify(reason ? { reason } : {}),
  });

// Procurement & Branches
export const getPurchaseOrders = () => fetchAPI(API_ENDPOINTS.procurement.purchaseOrders);
export const createPurchaseOrder = (data: CreatePurchaseOrderPayload) =>
  fetchAPI(API_ENDPOINTS.procurement.createPurchaseOrder, { method: 'POST', body: JSON.stringify(data) });
export const approvePurchaseOrder = (id: number) =>
  fetchAPI(API_ENDPOINTS.procurement.approvePurchaseOrder(id), { method: 'PATCH' });
export const rejectPurchaseOrder = (id: number) =>
  fetchAPI(API_ENDPOINTS.procurement.rejectPurchaseOrder(id), { method: 'PATCH' });
export const receivePurchaseOrder = (id: number) =>
  fetchAPI(API_ENDPOINTS.procurement.receivePurchaseOrder(id), { method: 'POST' });
export const getSuppliers = () => fetchAPI(API_ENDPOINTS.procurement.suppliers);
export const getBranches = () => fetchAPI(API_ENDPOINTS.branches.list);
export const getBranch = (id: number) => fetchAPI(API_ENDPOINTS.branches.detail(id));

// Audit
export const getAuditLogs = (limit = 100, offset = 0) => fetchAPI(API_ENDPOINTS.audit.logs(limit, offset));

// Transfers
export const createTransfer = (data: CreateTransferDTO) =>
  fetchAPI(API_ENDPOINTS.branches.createTransfer, { method: 'POST', body: JSON.stringify(data) });
export const getTransfers = (branchId: number) => fetchAPI(API_ENDPOINTS.branches.transfers(branchId));
export const acceptTransfer = (transferId: number) =>
  fetchAPI(API_ENDPOINTS.branches.acceptTransfer(transferId), { method: 'POST' });

// Customers
export const getCustomerByPhone = (phone: string) => fetchAPI(API_ENDPOINTS.customers.byPhone(phone));
export const createCustomer = (data: CreateCustomerDTO) =>
  fetchAPI(API_ENDPOINTS.customers.create, { method: 'POST', body: JSON.stringify(data) });

// Promotions
export const getPromotions = () => fetchAPI(API_ENDPOINTS.promotions.list);
export const createPromotion = (data: CreatePromotionDTO) =>
  fetchAPI(API_ENDPOINTS.promotions.create, { method: 'POST', body: JSON.stringify(data) });
export const togglePromotion = (id: number, isActive: boolean) =>
  fetchAPI(API_ENDPOINTS.promotions.toggle(id), { method: 'PATCH', body: JSON.stringify({ isActive }) });
export const validatePromotion = (code: string, subtotal: number) =>
  fetchAPI(API_ENDPOINTS.promotions.validate, { method: 'POST', body: JSON.stringify({ code, subtotal }) });

// Waste
export const getWasteLogs = (branchId?: number) => fetchAPI(API_ENDPOINTS.ingredients.wasteLogs(branchId));

// HR
export const clockIn = (branchId: number) =>
  fetchAPI(API_ENDPOINTS.hr.clockIn, { method: 'POST', body: JSON.stringify({ branchId }) });
export const clockOut = () => fetchAPI(API_ENDPOINTS.hr.clockOut, { method: 'POST' });
export const getActiveClockIn = () => fetchAPI(API_ENDPOINTS.hr.attendanceStatus);
export const createShift = (data: CreateShiftDTO) =>
  fetchAPI(API_ENDPOINTS.hr.createShift, { method: 'POST', body: JSON.stringify(data) });
export const getShiftsByBranch = (branchId: number) => fetchAPI(API_ENDPOINTS.hr.shiftsByBranch(branchId));
export const getMyShifts = () => fetchAPI(API_ENDPOINTS.hr.shiftsMe);
export const generatePayrollRun = (branchId: number, month: number, year: number) =>
  fetchAPI(API_ENDPOINTS.hr.generatePayroll, { method: 'POST', body: JSON.stringify({ branchId, month, year }) });
export const getPayrollRuns = (branchId: number) => fetchAPI(API_ENDPOINTS.hr.payrollRuns(branchId));
export const approvePayrollRun = (id: number) =>
  fetchAPI(API_ENDPOINTS.hr.approvePayrollRun(id), { method: 'PATCH' });
export const updateHourlyRate = (userId: number, hourlyRate: number) =>
  fetchAPI(API_ENDPOINTS.hr.updateHourlyRate(userId), { method: 'PATCH', body: JSON.stringify({ hourlyRate }) });
export const getHrUsers = (branchId?: number) => fetchAPI(API_ENDPOINTS.hr.users(branchId));

// Inventory
export const getBranchInventory = (branchId?: number) => fetchAPI(API_ENDPOINTS.ingredients.branchInventory(branchId));

// Finance
export const createExpense = (branchId: number, data: { amount: number; category: string; description?: string }) =>
  fetchAPI(API_ENDPOINTS.finance.createExpense, { method: 'POST', body: JSON.stringify({ branchId, ...data }) });
export const getExpenses = (branchId?: number, date?: string) => {
  const params = new URLSearchParams();
  if (branchId) params.append('branchId', branchId.toString());
  if (date) params.append('date', date);
  const qs = params.toString();
  return fetchAPI(`/finance/expenses${qs ? `?${qs}` : ''}`);
};
export const getExpectedCash = (branchId?: number) =>
  fetchAPI(branchId ? API_ENDPOINTS.finance.expectedCash(branchId) : '/finance/settlements/expected');
export const submitSettlement = (branchId: number, actualCash: number, actualCreditCard?: number, actualQR?: number) =>
  fetchAPI(API_ENDPOINTS.finance.submitSettlement, { method: 'POST', body: JSON.stringify({ branchId, actualCash, actualCreditCard, actualQR }) });
export const getSettlements = (branchId?: number) => fetchAPI(API_ENDPOINTS.finance.settlements(branchId));
export const approveSettlement = (id: number) =>
  fetchAPI(API_ENDPOINTS.finance.approveSettlement(id), { method: 'PATCH' });

export async function addInventoryBatch(branchId: number, data: { ingredientId: number; quantity: number; expiryDate?: string }) {
  return fetchAPI(API_ENDPOINTS.branches.addBatch(branchId), { method: 'POST', body: JSON.stringify(data) });
}

export async function reportWaste(branchId: number, data: { batchId?: number; ingredientId: number; quantity: number; reason: string }) {
  return fetchAPI(API_ENDPOINTS.branches.reportWaste(branchId), { method: 'POST', body: JSON.stringify(data) });
}

// Accounting
export const getAccounts = () => fetchAPI(API_ENDPOINTS.accounting.accounts);
export const getJournalEntries = (branchId?: number | string) => fetchAPI(API_ENDPOINTS.accounting.journalEntries(branchId));
export const getProfitLoss = (branchId?: number | string) => fetchAPI(API_ENDPOINTS.accounting.profitLoss(branchId));

// Production
export const getProductionOrders = () => fetchAPI(API_ENDPOINTS.production.orders);
export const createProductionOrder = (data: CreateProductionOrderPayload) =>
  fetchAPI(API_ENDPOINTS.production.createOrder, { method: 'POST', body: JSON.stringify(data) });
export const updateProductionOrderStatus = (orderId: number, status: string) =>
  fetchAPI(API_ENDPOINTS.production.updateStatus(orderId), { method: 'PATCH', body: JSON.stringify({ status }) });
export const completeProductionOrder = (orderId: number) =>
  fetchAPI(API_ENDPOINTS.production.complete(orderId), { method: 'PATCH' });
export const getProductionBOMs = () => fetchAPI(API_ENDPOINTS.production.boms);
export const createProductionBOM = (data: CreateProductionBOMPayload) =>
  fetchAPI(API_ENDPOINTS.production.createBom, { method: 'POST', body: JSON.stringify(data) });
export const seedAccounts = () => fetchAPI(API_ENDPOINTS.accounting.seed, { method: 'POST' });

export async function exportSales(branchId?: number, startDate?: Date, endDate?: Date) {
  const endpoint = API_ENDPOINTS.finance.exportSales(
    branchId,
    startDate?.toISOString(),
    endDate?.toISOString(),
  );
  const blob = await fetchAPIBlob(endpoint);
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `sales-export-${new Date().toISOString().split('T')[0]}.csv`;
  document.body.appendChild(a);
  a.click();
  window.URL.revokeObjectURL(url);
  document.body.removeChild(a);
}

// Equipment
export const getEquipment = (branchId?: number) => fetchAPI(API_ENDPOINTS.equipment.list(branchId));
export const createEquipment = (data: EquipmentDTO) =>
  fetchAPI(API_ENDPOINTS.equipment.create, { method: 'POST', body: JSON.stringify(data) });
export const updateEquipment = (id: number, data: Partial<EquipmentDTO>) =>
  fetchAPI(API_ENDPOINTS.equipment.update(id), { method: 'PATCH', body: JSON.stringify(data) });
export const logMaintenance = (equipmentId: number, data: LogMaintenanceDTO) =>
  fetchAPI(API_ENDPOINTS.equipment.maintenance(equipmentId), { method: 'POST', body: JSON.stringify(data) });

// Customers
export const getCustomer360 = (id: number) => fetchAPI(API_ENDPOINTS.customers.detail360(id));

// Reports
export const getSalesTrends = (branchId?: number) => fetchAPI(API_ENDPOINTS.reports.salesTrends(branchId));
export const getTopProducts = (branchId?: number) => fetchAPI(API_ENDPOINTS.reports.topProducts(branchId));
export const getExecutiveSummary = (branchId?: number) => fetchAPI(API_ENDPOINTS.reports.executiveSummary(branchId));
