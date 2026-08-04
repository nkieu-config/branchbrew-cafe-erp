import { expect, type Page } from "@playwright/test";

export const HOME_PATH = "/";

export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000";
export const MANAGER_EMAIL = process.env.E2E_EMAIL ?? "manager@branchbrew.dev";
export const ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL ?? "admin@branchbrew.dev";
export const E2E_PASSWORD = process.env.E2E_PASSWORD ?? "password123";

/** Stable selectors for Playwright — prefer test ids over visible copy. */
export const testIds = {
  loginPanel: "login-panel",
  loginHeading: "login-heading",
  loginSubmit: "login-submit",
  loginDemoPanel: "login-demo-panel",
  demoLogin: (id: string) => `demo-login-${id}`,
  posTerminal: "pos-terminal",
  branchPickerTopbar: "branch-picker-topbar",
  branchPickerSidebar: "branch-picker-sidebar",
  branchEmptyState: "branch-empty-state",
  nav: (id: string) => `nav-${id}`,
  dashboardSales: "dashboard-sales",
  financeOverview: "finance-overview",
  financeSettlements: "finance-settlements",
  financeExportSales: "finance-export-sales",
  financeExpenseSearch: "finance-expense-search",
  trialBalanceStatus: "trial-balance-status",
  balanceSheetStatus: "balance-sheet-status",
  balanceSheetStatement: "balance-sheet-statement",
  inventorySearch: "inventory-search",
  employeesSearch: "employees-search",
  modifiersSearch: "modifiers-search",
  modifiersNewGroup: "modifiers-new-group",
  hrScheduleShift: "hr-schedule-shift",
  hrScheduleShiftDialog: "hr-schedule-shift-dialog",
  sessionExpiredDialog: "session-expired-dialog",
  connectionStatus: "connection-status-banner",
  bulkActionBar: "bulk-action-bar",
  exportCsv: "export-csv",
  dataFreshness: "data-freshness",
} as const;

export const locators = {
  loginHeading: (page: Page) => page.getByTestId(testIds.loginHeading),
  loginSubmit: (page: Page) => page.getByTestId(testIds.loginSubmit),
  loginDemoPanel: (page: Page) => page.getByTestId(testIds.loginDemoPanel),
  demoLogin: (page: Page, id: string) => page.getByTestId(testIds.demoLogin(id)),
  demoManager: (page: Page) => page.getByTestId(testIds.demoLogin("manager")),
  posTerminal: (page: Page) => page.getByTestId(testIds.posTerminal),
  /** Visible topbar branch picker (desktop or mobile row — never both at once). */
  branchPicker: (page: Page) =>
    page.getByTestId(testIds.branchPickerTopbar).locator("visible=true"),
  branchPickerSidebar: (page: Page) =>
    page.getByTestId(testIds.branchPickerSidebar).locator("visible=true"),
  branchEmptyState: (page: Page) => page.getByTestId(testIds.branchEmptyState),
  navFinance: (page: Page) => page.getByTestId(testIds.nav("finance")),
  dashboardSales: (page: Page) => page.getByTestId(testIds.dashboardSales),
  financeOverview: (page: Page) => page.getByTestId(testIds.financeOverview),
  financeSettlements: (page: Page) => page.getByTestId(testIds.financeSettlements),
  financeExportSales: (page: Page) => page.getByTestId(testIds.financeExportSales),
  financeExpenseSearch: (page: Page) => page.getByTestId(testIds.financeExpenseSearch),
  trialBalanceStatus: (page: Page) => page.getByTestId(testIds.trialBalanceStatus),
  balanceSheetStatus: (page: Page) => page.getByTestId(testIds.balanceSheetStatus),
  balanceSheetStatement: (page: Page) =>
    page.getByTestId(testIds.balanceSheetStatement),
  inventorySearch: (page: Page) => page.getByTestId(testIds.inventorySearch),
  employeesSearch: (page: Page) => page.getByTestId(testIds.employeesSearch),
  modifiersSearch: (page: Page) => page.getByTestId(testIds.modifiersSearch),
  modifiersNewGroup: (page: Page) => page.getByTestId(testIds.modifiersNewGroup),
  hrScheduleShift: (page: Page) => page.getByTestId(testIds.hrScheduleShift),
  hrScheduleShiftDialog: (page: Page) => page.getByTestId(testIds.hrScheduleShiftDialog),
};

/** @deprecated Use locators.loginSubmit */
export function signInSubmitButton(page: Page) {
  return locators.loginSubmit(page);
}

/** @deprecated Use locators.demoManager */
export function demoManagerButton(page: Page) {
  return locators.demoManager(page);
}

/** Fast auth for setup projects — sets httpOnly cookie via API, not the login UI. */
export async function authenticateViaApi(page: Page, email: string, password: string) {
  const loginRes = await page.request.post(`${API_URL}/auth/login`, {
    data: { email, password },
  });
  expect(loginRes.ok()).toBeTruthy();

  const meRes = await page.request.get(`${API_URL}/auth/me`);
  expect(meRes.ok()).toBeTruthy();
  const profile = (await meRes.json()) as { email: string };
  expect(profile.email).toBe(email);
}

/** UI login — use when the test covers the login page itself. */
export async function signInWithCredentials(
  page: Page,
  email: string,
  password: string,
) {
  await page.goto("/login");
  await page.getByLabel(/email/i).fill(email);
  await page.getByLabel(/password/i).fill(password);
  await locators.loginSubmit(page).click();
  await page.waitForURL(HOME_PATH);
}

export async function expectAuthenticatedDashboard(page: Page) {
  await page.goto(HOME_PATH);
  await expect(locators.dashboardSales(page)).toBeVisible({ timeout: 30_000 });
}

export async function expectPosTerminalReady(page: Page) {
  await expect(
    locators.posTerminal(page).or(locators.branchEmptyState(page)),
  ).toBeVisible({ timeout: 15_000 });
}

export async function openBranchPicker(page: Page) {
  await locators.branchPicker(page).getByRole("combobox", { name: "Select branch" }).click();
}

/** Open branch picker on empty-state pages (sidebar variant below the message). */
export async function openBranchPickerFromEmptyState(page: Page) {
  await locators.branchPickerSidebar(page).getByRole("combobox", { name: "Select branch" }).click();
}

export async function selectBranchOption(page: Page, optionName: RegExp | string) {
  await openBranchPicker(page);
  await page.getByRole("option", { name: optionName }).click();
}

export async function selectBranchOptionFromEmptyState(
  page: Page,
  optionName: RegExp | string,
) {
  await openBranchPickerFromEmptyState(page);
  await page.getByRole("option", { name: optionName }).click();
}
