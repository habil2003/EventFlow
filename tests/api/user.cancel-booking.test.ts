/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, beforeEach, afterEach, it, expect, vi } from "vitest";
import { POST } from "@/app/api/user/cancel-booking/route";
import { jsonRequest, statusOf, readJson } from "../helpers/request";

const { prisma } = vi.hoisted(() => {
  const prisma: Record<string, any> = {};
  for (const n of ["vendorBooking", "ticketBooking", "ticketTier", "refund"]) {
    prisma[n] = new Proxy(
      {},
      { get: (t: any, p: string) => (p in t ? t[p] : (t[p] = vi.fn())) }
    );
  }
  return { prisma };
});

vi.mock("@/lib/prisma", () => ({ prisma }));
vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
vi.mock("@/lib/email", () => ({ sendEmail: vi.fn().mockResolvedValue(true) }));
vi.mock("@/lib/app-url", () => ({ getAppUrl: () => "http://localhost:3000" }));

import { getServerSession } from "next-auth";

const SESSION = { user: { id: "u1", email: "c@customer.com" } };
const URL = "http://localhost:3000/api/user/cancel-booking";

function vendorBookingFixture(overrides: Record<string, unknown> = {}) {
  return {
    id: "vb1",
    userId: "u1",
    bookingStatus: "ACCEPTED",
    paymentStatus: "HELD_IN_ESCROW",
    depositPaidAt: new Date(),
    depositAmount: 250,
    amountReleasedAt: null,
    paymentTransactions: [
      {
        id: "ptx1",
        paymentType: "VENDOR_DEPOSIT",
        amount: 250,
        khaltiFee: 10,
        transactionId: "txg1",
        status: "COMPLETED",
      },
    ],
    userSocialEvent: { eventDate: new Date("2026-08-15T12:00:00Z") }, // 14 days out
    ...overrides,
  };
}

function ticketBookingFixture(overrides: Record<string, unknown> = {}) {
  return {
    id: "tb1",
    userId: "u1",
    totalAmount: 1000,
    quantity: 2,
    tierId: "tier1",
    paymentStatus: "HELD_IN_ESCROW",
    checkedIn: false,
    tier: { id: "tier1" },
    paymentTransactions: [
      { id: "ptxT", transactionId: "txgT", amount: 1000, khaltiFee: 20, status: "COMPLETED" },
    ],
    event: { id: "ev1", eventDate: new Date("2026-08-15T12:00:00Z") }, // 14 days out
    ...overrides,
  };
}

describe("POST /api/user/cancel-booking", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-01T12:00:00Z"));
    vi.mocked(getServerSession).mockResolvedValue(SESSION);
    for (const n of ["vendorBooking", "ticketBooking", "ticketTier", "refund"]) {
      for (const k of Object.keys(prisma[n])) prisma[n][k].mockReset?.();
    }
    prisma.vendorBooking.update.mockResolvedValue({});
    prisma.refund.create.mockImplementation(({ data }: any) => ({ id: "r1", ...data }));
  });
  afterEach(() => vi.useRealTimers());

  it("SEC-6: the cancellation query only matches bookings whose funds have not been released", async () => {
    prisma.vendorBooking.findFirst.mockResolvedValue(null); // released booking is filtered out
    const res = await POST(
      jsonRequest(URL, { bookingId: "vb1", bookingType: "VENDOR", reason: "x" })
    );
    expect(statusOf(res)).toBe(404);
    expect(prisma.refund.create).not.toHaveBeenCalled();
  });

  it("submits amountReleasedAt:null as part of the cancellation filter (SEC-6)", async () => {
    prisma.vendorBooking.findFirst.mockResolvedValue(vendorBookingFixture());
    await POST(jsonRequest(URL, { bookingId: "vb1", bookingType: "VENDOR" }));

    const where = prisma.vendorBooking.findFirst.mock.calls[0][0].where;
    expect(where.bookingStatus.in).toContain("ACCEPTED");
    expect(where.amountReleasedAt).toBeNull();
  });

  it("creates a 100% refund (deposit minus gateway fee) for a paid vendor booking", async () => {
    prisma.vendorBooking.findFirst.mockResolvedValue(vendorBookingFixture());

    const res = await POST(
      jsonRequest(URL, { bookingId: "vb1", bookingType: "VENDOR", reason: "x" })
    );

    expect(statusOf(res)).toBe(200);
    const body = (await readJson(res)) as { refund: { amount: number; percentage: number } };
    expect(body.refund.percentage).toBe(100); // 14 days out
    expect(body.refund.amount).toBe(240); // 250 deposit - 10 fee

    expect(prisma.refund.create.mock.calls[0][0].data.refundAmount).toBe(240);
    expect(prisma.refund.create.mock.calls[0][0].data.refundStatus).toBe("PENDING_ADMIN");
  });

it("does not create a refund when no deposit was paid", async () => {
    prisma.vendorBooking.findFirst.mockResolvedValue(vendorBookingFixture({ paymentTransactions: [] }));

    const res = await POST(
      jsonRequest(URL, { bookingId: "vb1", bookingType: "VENDOR", reason: "x" })
    );

    expect(statusOf(res)).toBe(200);
    expect(prisma.refund.create).not.toHaveBeenCalled();
  });

  it("REFUND-007: cancels a ticket, refunds, and decrements tier stock", async () => {
    prisma.ticketBooking.findFirst.mockResolvedValue(ticketBookingFixture());
    prisma.ticketBooking.update.mockResolvedValue({});
    prisma.ticketTier.update.mockResolvedValue({});
    prisma.refund.create.mockClear(); // clear so only the ticket refund is observed

    const res = await POST(
      jsonRequest(URL, { bookingId: "tb1", bookingType: "TICKET", reason: "changed plan" })
    );

    expect(statusOf(res)).toBe(200);
    const body = (await readJson(res)) as { refund: { amount: number; percentage: number } };
    expect(body.refund.percentage).toBe(100); // 14 days out
    expect(body.refund.amount).toBe(980); // 1000 - 20 fee

    const bookingUpdate: any = prisma.ticketBooking.update.mock.calls[0][0];
    expect(bookingUpdate.data.paymentStatus).toBe("REFUNDED");

    const tierUpdate: any = prisma.ticketTier.update.mock.calls[0][0];
    expect(tierUpdate.where.id).toBe("tier1");
    expect(tierUpdate.data.soldCount.decrement).toBe(2);

    expect(prisma.refund.create.mock.calls[0][0].data.refundStatus).toBe("PENDING_ADMIN");
    expect(prisma.refund.create.mock.calls[0][0].data.refundAmount).toBe(980);
  });

  it("REFUND-006: cannot cancel a ticket for a past event", async () => {
    prisma.ticketBooking.findFirst.mockResolvedValue(
      ticketBookingFixture({ event: { eventDate: new Date("2026-07-01T12:00:00Z") } })
    );
    prisma.ticketBooking.update.mockResolvedValue({});
    prisma.ticketTier.update.mockResolvedValue({});

    const res = await POST(
      jsonRequest(URL, { bookingId: "tb1", bookingType: "TICKET", reason: "x" })
    );

    expect(statusOf(res)).toBe(400);
    expect((await readJson(res)).error).toMatch(/past events/i);
    expect(prisma.ticketTier.update).not.toHaveBeenCalled();
    expect(prisma.refund.create).not.toHaveBeenCalled();
  });

  it("returns 404 when the ticket is already checked in (filtered by query)", async () => {
    prisma.ticketBooking.findFirst.mockResolvedValue(null);
    const res = await POST(
      jsonRequest(URL, { bookingId: "tb1", bookingType: "TICKET", reason: "x" })
    );
    expect(statusOf(res)).toBe(404);
    expect(prisma.refund.create).not.toHaveBeenCalled();
  });

  it("returns 400 for an unknown booking type", async () => {
    const res = await POST(jsonRequest(URL, { bookingId: "x", bookingType: "SUBSCRIPTION" }));
    expect(statusOf(res)).toBe(400);
  });
});