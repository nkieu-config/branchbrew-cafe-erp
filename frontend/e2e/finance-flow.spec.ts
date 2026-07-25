import { test, expect } from "@playwright/test";
import { locators } from "./helpers";

test.describe("finance business flow", () => {
  test("manager demo login opens finance overview via sidebar", async ({ page }) => {
    await page.goto("/login");
    await expect(locators.loginDemoPanel(page)).toBeVisible();
    await expect(async () => {
      await locators.demoManager(page).click();
      await page.waitForURL((url) => !url.pathname.includes("/login"), {
        timeout: 5_000,
      });
    }).toPass({ timeout: 30_000 });

    await locators.navFinance(page).click();
    await expect(page).toHaveURL(/\/finance\/overview/);

    await expect(locators.financeSettlements(page)).toBeVisible();
    await expect(locators.financeExportSales(page)).toBeVisible();
    await expect(locators.financeExpenseSearch(page)).toBeVisible();

    await page.getByRole("link", { name: "Trial Balance" }).click();
    await expect(page).toHaveURL(/\/finance\/trial-balance/);

    // The seeded ledger must balance in the real UI, not only in unit tests.
    await expect(locators.trialBalanceStatus(page)).toContainText(
      "Debits equal credits",
    );
  });
});
