import { test, expect } from "@playwright/test";
import { locators } from "./helpers";

/**
 * Guards the server-rendered half of the loading work: `/login` mounts its form
 * through `dynamic(..., { ssr: false })`, so without a `loading:` fallback the
 * server ships an empty body and the user stares at a blank page until the chunk
 * lands. Asserting on the raw HTML keeps this free of render timing.
 */
test.describe("loading UX", () => {
  test("login ships a skeleton in the server HTML, not a blank body", async ({ request }) => {
    const response = await request.get("/login");
    expect(response.ok()).toBeTruthy();

    const html = await response.text();
    expect(html).toContain('data-testid="login-skeleton"');
  });

  test("login skeleton is replaced by the real form after hydration", async ({ page }) => {
    await page.goto("/login");
    await expect(locators.loginHeading(page)).toBeVisible();
    await expect(page.getByTestId("login-skeleton")).toHaveCount(0);
  });
});
