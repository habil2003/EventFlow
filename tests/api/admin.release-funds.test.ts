/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, beforeEach, it, expect, vi } from "vitest";
import { POST } from "@/app/api/admin/release-funds/route";
import { jsonRequest, statusOf, readJson } from "../helpers/request";

const { prisma } = vi.hoisted(() => {
  const prisma: Record<string, any> = {};
  for (const n of ["ticketBooking", "vendorBooking", "payout", "vendorProfile", "user"]) {
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

const ADMIN_SESSION = { user: { id: "admin1", role: "ADMIN", email: "admin@eventflow.com" } };
const URL = "http://localhost:3000/api/admin/release-funds";

function vendorBookingFixture(overrides: Record<string, unknown> = {}) {
  return {
    id: "vb1",
    bookingStatus: "ACCEPTED",
    vendorPaymentStatus: "FULLY_PAID",
    depositPaidAt: new Date(),
    depositAmount: 250,
    remainingAmount: 750,
    totalAmount: 1000,
    amountReleasedAt: null,
    vendorMarkedComplete: true,
    customerConfirmed: true,
    vendorId: "vendor1",
    vendor: { id: "vendor1", user: { email: "v@vendor.com" } },
    user: { id: "u1", email: "c@customer.com" },
    payouts: [],
    refunds: [],
    ...overrides,
  };
}

describe("POST /api/admin/release-funds", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.PLATFORM_COMMISSION = "0.1";
    for (const n of ["ticketBooking", "vendorBooking", "payout", "vendorProfile", "user"]) {
      for (const k of Object.keys(prisma[n])) prisma[n][k].mockReset?.();
    }
    vi.mocked(getServerSession).mockResolvedValue(ADMIN_SESSION);
    prisma.ticketBooking.findUnique.mockResolvedValue(null);
    prisma.vendorBooking.update.mockResolvedValue({});
    prisma.payout.create.mockImplementation(({ data }: any) => ({ id: "po1", ...data }));
  });

  it("rejects non-admin callers", async () => {
    vi.mocked(getServerSession).mockResolvedValue({ user: { id: "v1", role: "VENDOR" } });
    const res = await POST(jsonRequest(URL, { bookingId: "vb1", amount: 1, type: "deposit" }));
    expect(statusOf(res)).toBe(401);
    expect(prisma.payout.create).not.toHaveBeenCalled();
  });

  it("uses the DB depositAmount and ignores the client-supplied amount (SEC-3)", async () => {
    prisma.vendorBooking.findUnique.mockResolvedValue(vendorBookingFixture());
    const res = await POST(jsonRequest(URL, { bookingId: "vb1", amount: 1, type: "deposit" }));

    expect(statusOf(res)).toBe(200);
    const body = (await readJson(res)) as { type: string; payout: { amount: number; platformCommission: number } };
    expect(body.type).toBe("DEPOSIT");
    // Tampered amount=1 must NOT be used; DB depositAmount=250 is authoritative.
    expect(body.payout.amount).toBe(250);
    expect(body.payout.platformCommission).toBe(25);
  });

  it("derives the remaining amount from the booking, not the body", async () => {
    prisma.vendorBooking.findUnique.mockResolvedValue(
      vendorBookingFixture({
        payouts: [{ id: "po-deposit", type: "DEPOSIT", status: "COMPLETED" }],
      })
    );
    const res = await POST(jsonRequest(URL, { bookingId: "vb1", amount: 9999, type: "remaining" }));

    expect(statusOf(res)).toBe(200);
    const body = (await readJson(res)) as { type: string; payout: { amount: number } };
    expect(body.type).toBe("REMAINING");
    expect(body.payout.amount).toBe(750);
  });

  it("derives the full amount from totalAmount when releasing all", async () => {
    prisma.vendorBooking.findUnique.mockResolvedValue(vendorBookingFixture());
    const res = await POST(jsonRequest(URL, { bookingId: "vb1", amount: 1, type: "all" }));

    expect(statusOf(res)).toBe(200);
    const body = (await readJson(res)) as { type: string; payout: { amount: number } };
    expect(body.type).toBe("FULL");
    expect(body.payout.amount).toBe(1000);
  });

  it("blocks a deposit release when a deposit payout is already pending", async () => {
    const existing = vendorBookingFixture({
      payouts: [{ id: "po-x", type: "DEPOSIT", status: "PENDING" }],
    });
    prisma.vendorBooking.findUnique.mockResolvedValue(existing);
    const res = await POST(jsonRequest(URL, { bookingId: "vb1", amount: 250, type: "deposit" }));
    expect(statusOf(res)).toBe(400);
    expect(prisma.payout.create).not.toHaveBeenCalled();
  });

it("blocks a deposit release before the customer has paid the deposit", async () => {
    prisma.vendorBooking.findUnique.mockResolvedValue(vendorBookingFixture({ depositPaidAt: null }));
    const res = await POST(jsonRequest(URL, { bookingId: "vb1", amount: 250, type: "deposit" }));
    expect(statusOf(res)).toBe(400);
    expect(prisma.payout.create).not.toHaveBeenCalled();
  });

  it("ESC-005: blocks release when an active refund is pending", async () => {
    prisma.vendorBooking.findUnique.mockResolvedValue(
      vendorBookingFixture({ refunds: [{ id: "r1", refundStatus: "PENDING_ADMIN" }] })
    );
    const res = await POST(jsonRequest(URL, { bookingId: "vb1", type: "deposit" }));
    expect(statusOf(res)).toBe(400);
    expect((await readJson(res)).error).toMatch(/active refund/i);
    expect(prisma.payout.create).not.toHaveBeenCalled();
  });

  it("ESC-006: blocks a deposit release after the deposit is already released", async () => {
    prisma.vendorBooking.findUnique.mockResolvedValue(
      vendorBookingFixture({ payouts: [{ id: "po1", type: "DEPOSIT", status: "COMPLETED" }] })
    );
    const res = await POST(jsonRequest(URL, { bookingId: "vb1", amount: 250, type: "deposit" }));
    expect(statusOf(res)).toBe(400);
    expect((await readJson(res)).error).toMatch(/already released/i);
  });

  it("ESC-010: blocks full release until the vendor marks service complete", async () => {
    prisma.vendorBooking.findUnique.mockResolvedValue(vendorBookingFixture({ vendorMarkedComplete: false }));
    const res = await POST(jsonRequest(URL, { bookingId: "vb1", amount: 1, type: "all" }));
    expect(statusOf(res)).toBe(400);
    expect((await readJson(res)).error).toMatch(/marks service as complete/i);
    expect(prisma.payout.create).not.toHaveBeenCalled();
  });

  it("ESC-010b: blocks full release until the customer confirms completion", async () => {
    prisma.vendorBooking.findUnique.mockResolvedValue(vendorBookingFixture({ customerConfirmed: false }));
    const res = await POST(jsonRequest(URL, { bookingId: "vb1", amount: 1, type: "all" }));
    expect(statusOf(res)).toBe(400);
    expect((await readJson(res)).error).toMatch(/customer confirms/i);
    expect(prisma.payout.create).not.toHaveBeenCalled();
  });

  it("ESC-012: blocks full release when the deposit was already released (recommend remaining)", async () => {
    prisma.vendorBooking.findUnique.mockResolvedValue(
      vendorBookingFixture({ payouts: [{ id: "po1", type: "DEPOSIT", status: "COMPLETED" }] })
    );
    const res = await POST(jsonRequest(URL, { bookingId: "vb1", amount: 1, type: "all" }));
    expect(statusOf(res)).toBe(400);
    expect((await readJson(res)).error).toMatch(/Please release remaining/i);
  });

  it("ESC-008: blocks remaining release until the deposit has been released", async () => {
    prisma.vendorBooking.findUnique.mockResolvedValue(vendorBookingFixture({ payouts: [] }));
    const res = await POST(jsonRequest(URL, { bookingId: "vb1", amount: 1, type: "remaining" }));
    expect(statusOf(res)).toBe(400);
    expect((await readJson(res)).error).toMatch(/deposit has not been released/i);
    expect(prisma.payout.create).not.toHaveBeenCalled();
  });

  it("ESC-003: blocks ticket release before the event is completed", async () => {
    prisma.ticketBooking.findUnique.mockResolvedValue({
      id: "tb1",
      totalAmount: 1000,
      escrowReleased: false,
      event: { isCompleted: false, organizerId: "org1", title: "Concert" },
      refunds: [],
      payouts: [],
    });
    const res = await POST(jsonRequest(URL, { bookingId: "tb1", amount: 1, type: "ticket" }));
    expect(statusOf(res)).toBe(400);
    expect((await readJson(res)).error).toMatch(/not been marked as completed/i);
    expect(prisma.payout.create).not.toHaveBeenCalled();
  });

  it("releases ticket funds as a pending TICKET_SALES payout from the DB total", async () => {
    prisma.ticketBooking.findUnique.mockResolvedValue({
      id: "tb1",
      totalAmount: 1000,
      escrowReleased: false,
      event: { isCompleted: true, organizerId: "org1", title: "Concert" },
      refunds: [],
      payouts: [],
    });
    prisma.vendorProfile.findFirst.mockResolvedValue({ id: "vendor1", userId: "org1" });
    const res = await POST(jsonRequest(URL, { bookingId: "tb1", amount: 1, type: "ticket" }));

    expect(statusOf(res)).toBe(200);
    const body = (await readJson(res)) as { type: string; payout: { amount: number; platformCommission: number } };
    expect(body.type).toBe("TICKET");
    expect(body.payout.amount).toBe(1000);
    expect(body.payout.platformCommission).toBe(100);
  });
});