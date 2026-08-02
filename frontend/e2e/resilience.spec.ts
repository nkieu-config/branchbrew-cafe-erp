import { test, expect, type Page } from "@playwright/test";
import { expectPosTerminalReady, locators, testIds } from "./helpers";

/**
 * Covers the failure modes that only show up mid-task: work discarded by a
 * reload or an expired token, filters lost on the way back from a detail page,
 * and rows that cannot be reached because paging stops at the loaded window.
 * None of these are visible to type-check or lint, so they are pinned here.
 */

const POS_CART_KEY = "branchbrew_pos_cart_v1";

async function addFirstProductToCart(page: Page) {
  const product = page.locator("button").filter({ hasText: /฿/ }).first();
  await product.waitFor({ state: "visible", timeout: 20_000 });
  await product.click();

  // Products with modifier groups open a dialog before the line is added.
  const addToOrder = page.getByRole("button", { name: /add to order/i });
  if (await addToOrder.isVisible().catch(() => false)) {
    await addToOrder.click();
  }
  await expect
    .poll(() => page.evaluate((k) => localStorage.getItem(k) != null, POS_CART_KEY), {
      timeout: 15_000,
    })
    .toBe(true);
}

const cartUnits = (page: Page) =>
  page.evaluate((k) => {
    const raw = localStorage.getItem(k);
    if (!raw) return 0;
    const parsed = JSON.parse(raw) as { cart: { quantity: number }[] };
    return parsed.cart.reduce((sum, line) => sum + line.quantity, 0);
  }, POS_CART_KEY);

test.describe("work in progress survives", () => {
  test("the POS cart is still there after a reload", async ({ page }) => {
    await page.goto("/pos/terminal");
    await expectPosTerminalReady(page);
    test.skip(
      await locators.branchEmptyState(page).isVisible().catch(() => false),
      "no branch selected for this account",
    );

    await addFirstProductToCart(page);
    const before = await cartUnits(page);
    expect(before).toBeGreaterThan(0);

    await page.reload();
    await expectPosTerminalReady(page);

    await expect.poll(() => cartUnits(page), { timeout: 15_000 }).toBe(before);
    await expect(page.getByText(/restored .* unfinished order/i)).toBeVisible({
      timeout: 15_000,
    });
  });

  test("an expired session keeps the page and offers a way back", async ({
    page,
    context,
  }) => {
    await page.goto("/pos/orders");
    await expect(page.getByPlaceholder(/search by order/i)).toBeVisible({
      timeout: 20_000,
    });

    // Expire the session, then change a filter so the list refetches under a
    // dead cookie. Typing is best-effort: a background refetch may have raised
    // the dialog already, and its overlay would then swallow the input.
    await context.clearCookies();
    await page
      .getByPlaceholder(/search by order/i)
      .fill("9")
      .catch(() => {});

    const dialog = page.getByTestId(testIds.sessionExpiredDialog);
    await expect(dialog).toBeVisible({ timeout: 20_000 });
    await expect(dialog).toContainText(/session has expired/i);
    await expect(page).toHaveURL(/\/pos\/orders/);

    await page.getByRole("button", { name: /sign in again/i }).click();
    await expect(page).toHaveURL(/\/login\?next=/);
    expect(decodeURIComponent(page.url())).toContain("/pos/orders");
  });
});

test.describe("list state and reach", () => {
  test("filters survive a reload instead of resetting", async ({ page }) => {
    await page.goto("/pos/orders?status=COMPLETED&q=1");
    await expect(page.getByPlaceholder(/search by order/i)).toHaveValue("1", {
      timeout: 20_000,
    });

    await page.reload();

    await expect(page.getByPlaceholder(/search by order/i)).toHaveValue("1", {
      timeout: 20_000,
    });
    await expect(page.getByLabel("Filter by status")).toContainText(/COMPLETED/i);
  });

  test("orders paging reaches a second page from the server", async ({ page }) => {
    const windows: string[] = [];
    page.on("request", (request) => {
      const url = request.url();
      if (url.includes("/orders?")) windows.push(url);
    });

    await page.goto("/pos/orders?size=1");
    const firstRow = page.locator("tbody tr.ant-table-row").first();
    await expect(firstRow).toBeVisible({ timeout: 20_000 });

    const pageOneKey = await firstRow.getAttribute("data-row-key");
    const next = page.locator("li.ant-pagination-next").first();
    await expect(next).not.toHaveAttribute("aria-disabled", "true");

    await next.click();

    await expect
      .poll(() => firstRow.getAttribute("data-row-key"), { timeout: 20_000 })
      .not.toBe(pageOneKey);
    expect(windows.some((url) => /offset=[1-9]/.test(url))).toBe(true);
  });
});

test.describe("connection", () => {
  test("going offline is announced rather than failing silently", async ({
    page,
    context,
  }) => {
    await page.goto("/pos/orders");
    await expect(page.getByPlaceholder(/search by order/i)).toBeVisible({
      timeout: 20_000,
    });

    await context.setOffline(true);
    const banner = page.getByTestId(testIds.connectionStatus);
    await expect(banner).toBeVisible({ timeout: 15_000 });
    await expect(banner).toContainText(/offline/i);

    await context.setOffline(false);
    await expect(banner).toContainText(/back online/i, { timeout: 15_000 });
  });
});
