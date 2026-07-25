import { test } from "@playwright/test";
import { expectNoSeriousViolations } from "./a11y-helpers";
import {
  expectAuthenticatedDashboard,
  expectPosTerminalReady,
  locators,
  testIds,
} from "./helpers";

test.describe("accessibility smoke", () => {
  test("login page has no serious axe violations", async ({ page }) => {
    await page.goto("/login");
    await locators.loginHeading(page).waitFor();
    await expectNoSeriousViolations(page, "login page", {
      include: `[data-testid="${testIds.loginPanel}"]`,
      exclude: '[data-testid="login-hero"]',
      // Design-token contrast on login is tracked separately; smoke covers critical/serious non-contrast issues.
      disableRules: ["color-contrast"],
    });
  });
});

test.describe("authenticated accessibility", () => {
  test.use({ storageState: "e2e/.auth/manager.json" });

  test.beforeEach(async ({ page }) => {
    await expectAuthenticatedDashboard(page);
  });

  test("POS terminal has no serious axe violations", async ({ page }) => {
    await page.goto("/pos/terminal");
    await expectPosTerminalReady(page);
    await expectNoSeriousViolations(page, "POS terminal", {
      // POS catalog scroll regions are mouse-first; keyboard scroll is a separate UX task.
      disableRules: ["scrollable-region-focusable"],
    });
  });

  test("trial balance has no serious axe violations", async ({ page }) => {
    await page.goto("/finance/trial-balance");
    await locators.trialBalanceStatus(page).waitFor();
    await expectNoSeriousViolations(page, "trial balance");
  });

  test("schedule shift dialog has no serious axe violations", async ({ page }) => {
    await page.goto("/hr/shifts");
    await locators.hrScheduleShift(page).first().click();
    await locators.hrScheduleShiftDialog(page).waitFor();
    await expectNoSeriousViolations(page, "schedule shift dialog");
  });
});
