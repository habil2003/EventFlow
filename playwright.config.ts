import { defineConfig } from "@playwright/test";

const BASE = process.env.TARGET_URL || "http://localhost:3000";

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  timeout: 120_000,
  expect: { timeout: 30_000 },
  reporter: [["list"]],
  use: {
    baseURL: BASE,
    trace: "on-first-retry",
  },
  webServer: {
    command: "pnpm dev",
    url: BASE,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
