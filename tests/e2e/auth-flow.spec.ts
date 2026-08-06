// tests/e2e/auth-flow.spec.ts
// Browser smoke test driving the REAL UI end-to-end:
//   sign up (USER) → email verify → sign in → logged-in home.
//
// Requires the dev server (Playwright auto-starts/reuses it via webServer
// in playwright.config.ts). Requires a DATABASE_URL in .env pointing at a
// dev/throaway DB. Cleanup deletes the created test user.

import { test, expect } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const REPO = join(__dirname, "..", "..");
for (const line of readFileSync(join(REPO, ".env"), "utf8").split("\n")) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
  if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
}

const prisma = new PrismaClient();

const SUFFIX = Date.now();
const EMAIL = `e2e.user.${SUFFIX}@eventflow.test`;
const PASSWORD = "E2E#Test!2026";

test.afterAll(async () => {
  await prisma.user.deleteMany({ where: { email: EMAIL } });
  await prisma.$disconnect();
});

test("signup → verify email → signin as USER", async ({ page, request }) => {
  // ── Sign up (role USER is the default selection) ─────────────────────
  await page.goto("/signup");
  await page.getByPlaceholder("John Doe").fill("E2E User");
  await page.getByPlaceholder("you@example.com").fill(EMAIL);
  await page.getByPlaceholder("••••••••").nth(0).fill(PASSWORD);
  await page.getByPlaceholder("••••••••").nth(1).fill(PASSWORD);
  await page.getByRole("button", { name: /Create account/i }).click();

  await expect(page.getByRole("heading", { name: "Check Your Email" })).toBeVisible();

  // ── Email verification (mimics clicking the link in the email) ───────
  const user = await prisma.user.findUniqueOrThrow({ where: { email: EMAIL } });
  expect(user.emailVerified).toBeNull();
  const verify = await request.post("/api/auth/verify-email", {
    data: { token: user.verificationToken },
  });
  expect(verify.ok()).toBeTruthy();
  const verified = await prisma.user.findUniqueOrThrow({ where: { email: EMAIL } });
  expect(verified.emailVerified).not.toBeNull();

  // ── Sign in through the real UI ───────────────────────────────────────
  await page.goto("/login");
  await page.locator("#email").fill(EMAIL);
  await page.locator("#password").fill(PASSWORD);
  await page.getByRole("button", { name: /Sign in/i }).click();

  // Signed-in home renders
  await page.waitForURL("/");
  await expect(page).toHaveTitle(/EventFlow/);
  await expect(page.getByText(/Sign out/i).first()).toBeVisible();
});
