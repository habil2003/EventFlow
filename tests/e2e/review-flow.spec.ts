// tests/e2e/review-flow.spec.ts
// Browser test proving the rating/review buttons actually render and submit
// end-to-end through the UI, once a user is ELIGIBLE:
//   - vendor review: a COMPLETED + customerConfirmed + vendorMarkedComplete booking
//   - event review: a paid, checked-in ticket for a completed (past) event
//
// Regression for bug where /api/user/vendor-bookings omitted the
// customerConfirmed / vendorMarkedComplete flags, so "Write Review" never showed.
//
// Requires the dev server (auto-started/reused via webServer in
// playwright.config.ts) and a DATABASE_URL in .env pointing at a dev DB.
// Cleanup deletes the seeded users (cascades all child records).

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
const EMAIL = `e2e.review.${SUFFIX}@eventflow.test`;
const PASSWORD = "E2E#Review!2026";

const ids = {
  vendorUserId: "",
  vendorId: "",
  packageId: "",
  organizerId: "",
  eventId: "",
  tierId: "",
  userEmail: EMAIL,
};

const daysFromNow = (n: number) => {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d;
};

test.beforeAll(async () => {
  const vendorUser = await prisma.user.create({
    data: {
      name: "E2E Vendor",
      email: `e2e.vendor.${SUFFIX}@eventflow.test`,
      passwordHash: "n/a",
      role: "VENDOR",
    },
  });
  ids.vendorUserId = vendorUser.id;
  const vendorProfile = await prisma.vendorProfile.create({
    data: {
      userId: vendorUser.id,
      businessName: "E2E Catering Co",
      serviceType: "Catering",
      location: "Kathmandu",
    },
  });
  ids.vendorId = vendorProfile.id;
  const pkg = await prisma.servicePackage.create({
    data: {
      vendorId: vendorProfile.id,
      name: "Gold Package",
      price: 50000,
      description: "Full catering service",
    },
  });
  ids.packageId = pkg.id;

  const orgUser = await prisma.user.create({
    data: {
      name: "E2E Organizer",
      email: `e2e.org.${SUFFIX}@eventflow.test`,
      passwordHash: "n/a",
      role: "ORGANIZER",
    },
  });
  ids.organizerId = orgUser.id;
  const event = await prisma.ticketedEvent.create({
    data: {
      title: "E2E Music Fest",
      eventDate: daysFromNow(-30),
      eventTime: "18:00",
      location: "Kathmandu",
      capacity: 200,
      organizerId: orgUser.id,
      isActive: true,
      isCompleted: true,
    },
  });
  ids.eventId = event.id;
  const tier = await prisma.ticketTier.create({
    data: { eventId: event.id, name: "General", price: 1000, quantity: 100 },
  });
  ids.tierId = tier.id;
});

test("review options appear + submit on /my-bookings and /my-tickets", async ({ page, request, browser }) => {
  // ── Sign up the reviewer via UI ───────────────────────────────────────
  await page.goto("/signup");
  await page.getByPlaceholder("John Doe").fill("E2E Reviewer");
  await page.getByPlaceholder("you@example.com").fill(EMAIL);
  await page.getByPlaceholder("••••••••").nth(0).fill(PASSWORD);
  await page.getByPlaceholder("••••••••").nth(1).fill(PASSWORD);
  await page.getByRole("button", { name: /Create account/i }).click();
  await expect(page.getByRole("heading", { name: "Check Your Email" })).toBeVisible();

  const user = await prisma.user.findUniqueOrThrow({ where: { email: EMAIL } });
  await request.post("/api/auth/verify-email", { data: { token: user.verificationToken } });

  // ── Seed reviewable state for this reviewer ──────────────────────────
  const social = await prisma.userSocialEvent.create({
    data: {
      userId: user.id,
      title: "E2E Wedding",
      eventDate: daysFromNow(-45),
      guestCount: 20,
    },
  });
  await prisma.vendorBooking.create({
    data: {
      userSocialEventId: social.id,
      userId: user.id,
      vendorId: ids.vendorId,
      packageId: ids.packageId,
      totalAmount: 50000,
      paymentStatus: "COMPLETED",
      bookingStatus: "COMPLETED",
      gateway: "KHALTI",
      startDate: daysFromNow(-45),
      endDate: daysFromNow(-44),
      totalDays: 1,
      dailyRate: 50000,
      bookingReference: `E2E-REV-${SUFFIX}`,
      customerConfirmed: true,
      vendorMarkedComplete: true,
    },
  });
  await prisma.ticketBooking.create({
    data: {
      ticketNumber: `E2E-TK-${SUFFIX}`,
      userId: user.id,
      eventId: ids.eventId,
      tierId: ids.tierId,
      quantity: 1,
      totalAmount: 1000,
      paymentStatus: "COMPLETED",
      gateway: "KHALTI",
      checkedIn: true,
    },
  });

  // ── Sign in via UI ───────────────────────────────────────────────────
  await page.goto("/login");
  await page.locator("#email").fill(EMAIL);
  await page.locator("#password").fill(PASSWORD);
  await page.getByRole("button", { name: /Sign in/i }).click();
  await page.waitForURL("/");

  // ── VENDOR REVIEW appears on the Past bookings tab ──────────────────
  await page.goto("/my-bookings?tab=past");
  const vendorBtn = page.getByRole("button", { name: /Write Review/i }).first();
  await expect(vendorBtn).toBeVisible();
  await vendorBtn.click();
  await expect(
    page.getByRole("heading", { name: "Write a Review" }),
  ).toBeVisible();
  await page.locator("#review").fill("Great vendor, highly recommended!");
  await page.getByRole("button", { name: /Submit Review/i }).click();
  await expect(page.getByText("Thank you for your review! 🎉")).toBeVisible();
  // Frontend now hides the review option for that booking (one per booking)
  await expect(page.getByText("Reviewed ✓")).toBeVisible();
  await expect(page.getByRole("button", { name: /Write Review/i })).toHaveCount(0);
  await expect.poll(async () => {
    const r = await prisma.rating.findFirst({
      where: { userId: user.id, type: "VENDOR" },
    });
    return r ? r.rating : null;
  }).toBe(5);
  await expect.poll(async () => {
    const r = await prisma.rating.findFirst({
      where: { userId: user.id, type: "VENDOR" },
    });
    return r ? r.isVerified : null;
  }).toBe(true);

  // ── EVENT REVIEW appears on /my-tickets ─────────────────────────────
  await page.goto("/my-tickets");
  const eventBtn = page.getByRole("button", { name: /Review Event/i }).first();
  await expect(eventBtn).toBeVisible();
  await eventBtn.click();
  await expect(
    page.getByRole("heading", { name: "Write a Review" }),
  ).toBeVisible();
  await page.locator("#review").fill("Great event, well organized!");
  await page.getByRole("button", { name: /Submit Review/i }).click();
  await expect(page.getByText("Thank you for your review! 🎉")).toBeVisible();
  // Frontend now hides the review option and shows Reviewed ✓ (one per ticket)
  await expect(page.getByText("Reviewed ✓")).toBeVisible();
  await expect(page.getByRole("button", { name: /Review Event/i })).toHaveCount(0);
  await expect.poll(async () => {
    const r = await prisma.rating.findFirst({
      where: { userId: user.id, type: "EVENT" },
    });
    return r ? r.isVerified : null;
  }).toBe(true);

  // ── Landing page (logged-out visitor) shows the verified review ──────
  const guestCtx = await browser.newContext();
  const guest = await guestCtx.newPage();
  await guest.goto("/");
  await expect(guest.getByText("What Customers Say")).toBeVisible();
  await expect(guest.getByText("Great event, well organized!")).toBeVisible();
  await expect(guest.getByText("Verified").first()).toBeVisible();

  // Clicking the testimonial deep-links to the event detail page (Buy Tickets CTA)
  const testimonialLink = guest.getByRole("link", {
    name: /Event: E2E Music Fest/i,
  });
  await expect(testimonialLink).toBeVisible();
  await testimonialLink.click();
  await guest.waitForURL(new RegExp(`/events/${ids.eventId}`));
  await expect(
    guest.getByRole("heading", { name: "E2E Music Fest" }),
  ).toBeVisible();
  await expect(
    guest.getByText("Great event, well organized!"),
  ).toBeVisible();
  await expect(
    guest.getByRole("heading", { name: /Event Reviews/i }),
  ).toBeVisible();
  await guestCtx.close();
});

test.afterAll(async () => {
  await prisma.user.deleteMany({
    where: {
      email: {
        in: [
          EMAIL,
          `e2e.vendor.${SUFFIX}@eventflow.test`,
          `e2e.org.${SUFFIX}@eventflow.test`,
        ],
      },
    },
  });
  await prisma.$disconnect();
});