import { defineConfig, devices } from "@playwright/test";

const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3001";
const managerAuthFile = "e2e/.auth/manager.json";
const adminAuthFile = "e2e/.auth/admin.json";
const isCI = !!process.env.CI;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: isCI,
  retries: isCI ? 2 : 0,
  workers: isCI ? 1 : undefined,
  reporter: isCI
    ? [["github"], ["html", { open: "never", outputFolder: "playwright-report" }]]
    : "list",
  outputDir: "test-results",
  expect: {
    timeout: 10_000,
  },
  use: {
    baseURL,
    timezoneId: "Asia/Bangkok",
    trace: isCI ? "retain-on-failure" : "on-first-retry",
    screenshot: isCI ? "only-on-failure" : "off",
    video: isCI ? "retain-on-failure" : "off",
  },
  projects: [
    {
      name: "setup",
      testMatch: /auth\.setup\.ts/,
    },
    {
      name: "admin-setup",
      testMatch: /auth-admin\.setup\.ts/,
    },
    {
      name: "public",
      testMatch: /(smoke|loading-ux)\.spec\.ts/,
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "authenticated",
      testMatch: /(smoke-authenticated|resilience)\.spec\.ts/,
      dependencies: ["setup"],
      use: {
        ...devices["Desktop Chrome"],
        storageState: managerAuthFile,
      },
    },
    {
      name: "a11y",
      testMatch: /a11y\.spec\.ts/,
      dependencies: ["setup"],
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "flows",
      testMatch: /-flow\.spec\.ts/,
      testIgnore: /super-admin-branch-flow\.spec\.ts/,
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "admin-flows",
      testMatch: /super-admin-branch-flow\.spec\.ts/,
      dependencies: ["admin-setup"],
      use: {
        ...devices["Desktop Chrome"],
        storageState: adminAuthFile,
      },
    },
  ],
  webServer: process.env.PLAYWRIGHT_SKIP_WEBSERVER
    ? undefined
    : {
        command: "npm run dev",
        url: baseURL,
        reuseExistingServer: !isCI,
        timeout: 120_000,
      },
});
