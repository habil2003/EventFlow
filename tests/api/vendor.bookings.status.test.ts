/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, beforeEach, it, expect, vi } from "vitest";
import { PATCH } from "@/app/api/vendor/bookings/[id]/status/route";
import { jsonRequest, statusOf, readJson } from "../helpers/request";

const { prisma } = vi.hoisted(() => {
  const prisma: Record<string, any> = {};
  for (const n of ["vendorProfile", "vendorBooking", "refund", "payout"]) {
    prisma[n] = new Proxy(
      {},
      { get: (t: any, p: string) => (p in t ? t[p] : (t[p] = vi.fn())) }
    );
  }
  return { prisma };
});

vi.mock("@/lib/prisma", () => ({ prisma }));
vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));

import { getServerSession } from "next-auth";

const URL = "http://localhost:3000/api/vendor/bookings/vb1/status";
const VENDOR_SESSION = { user: { id: "uvendor", role: "VENDOR" } };

function params(id = "vb1") {
  return { params: Promise.resolve({ id }) };
}

function bookingFixture(overrides: Record<string, any> = {}) {
  return {
    id: "vb1",
    vendorId: "vendor1",
    bookingStatus: "PENDING",
    vendorPaymentStatus: "DEPOSIT_PAID",
    paymentStatus: "HELD_IN_ESCROW",
    depositPaidAt: new Date(),
    depositAmount: 250,
    totalAmount: 1000,
    remainingAmount: 750,
    vendorMarkedComplete: false,
    customerConfirmed: false,
    paymentTransactions: [
      { id: "ptx1", paymentType: "VENDOR_DEPOSIT", status: "COMPLETED", transactionId: "txg1" },
    ],
    userSocialEvent: { title: "Wedding" },
    user: { name: "Customer", email: "c@customer.com" },
    payouts: [],
    ...overrides,
  };
}

describe("PATCH /api/vendor/bookings/[id]/status", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    for (const n of ["vendorProfile", "vendorBooking", "refund", "payout"]) {
      for (const k of Object.keys(prisma[n])) prisma[n][k].mockReset?.();
    }
    vi.mocked(getServerSession).mockResolvedValue(VENDOR_SESSION);
    prisma.vendorProfile.findUnique.mockResolvedValue({ id: "vendor1", userId: "uvendor" });
    prisma.vendorBooking.findFirst.mockResolvedValue(bookingFixture());
    prisma.vendorBooking.update.mockResolvedValue({});
    prisma.refund.create.mockImplementation(({ data }: any) => ({ id: "r1", ...data }));
    prisma.payout.create.mockImplementation(({ data }: any) => ({ id: "po1", ...data }));
  });

  it("returns 401 when unauthenticated", async () => {
    vi.mocked(getServerSession).mockResolvedValue(null);
    const res = await PATCH(jsonRequest(URL, { status: "ACCEPTED" }, { method: "PATCH" }), params());
    expect(statusOf(res)).toBe(401);
  });

  it("returns 403 for a non-vendor role", async () => {
    vi.mocked(getServerSession).mockResolvedValue({ user: { id: "u1", role: "USER" } });
    const res = await PATCH(jsonRequest(URL, { status: "ACCEPTED" }, { method: "PATCH" }), params());
    expect(statusOf(res)).toBe(403);
  });

  it("returns 404 when the vendor profile is missing", async () => {
    prisma.vendorProfile.findUnique.mockResolvedValue(null);
    const res = await PATCH(jsonRequest(URL, { status: "ACCEPTED" }, { method: "PATCH" }), params());
    expect(statusOf(res)).toBe(404);
  });

  it("rejects an invalid status value", async () => {
    const res = await PATCH(jsonRequest(URL, { status: "MAYBE" }, { method: "PATCH" }), params());
    expect(statusOf(res)).toBe(400);
    expect((await readJson(res)).error).toMatch(/invalid status/i);
  });

  it("BK-001: accepts a PENDING booking once the deposit is paid", async () => {
    const res = await PATCH(jsonRequest(URL, { status: "ACCEPTED" }, { method: "PATCH" }), params());
    expect(statusOf(res)).toBe(200);
    const update: any = prisma.vendorBooking.update.mock.calls[0][0];
    expect(update.where.id).toBe("vb1");
    expect(update.data.bookingStatus).toBe("ACCEPTED");
  });

  it("blocks acceptance before the deposit is paid", async () => {
    prisma.vendorBooking.findFirst.mockResolvedValue(
      bookingFixture({ vendorPaymentStatus: "PENDING" })
    );
    const res = await PATCH(jsonRequest(URL, { status: "ACCEPTED" }, { method: "PATCH" }), params());
    expect(statusOf(res)).toBe(400);
    expect((await readJson(res)).error).toMatch(/deposit is paid/i);
    expect(prisma.vendorBooking.update).not.toHaveBeenCalled();
  });

  it("validates the state transition (ACCEPTED only from PENDING)", async () => {
    prisma.vendorBooking.findFirst.mockResolvedValue(
      bookingFixture({ bookingStatus: "ACCEPTED" })
    );
    const res = await PATCH(jsonRequest(URL, { status: "ACCEPTED" }, { method: "PATCH" }), params());
    expect(statusOf(res)).toBe(400);
    expect((await readJson(res)).error).toMatch(/cannot transition/i);
  });

  it("BK-002: declining a paid booking auto-creates a full PROCESSED refund", async () => {
    const res = await PATCH(jsonRequest(URL, { status: "DECLINED" }, { method: "PATCH" }), params());

    expect(statusOf(res)).toBe(200);
    const body = (await readJson(res)) as { refund: { amount: number; status: string } };
    expect(body.refund.amount).toBe(250);
    expect(body.refund.status).toBe("PROCESSED");

    const bookingUpdate: any = prisma.vendorBooking.update.mock.calls[0][0];
    expect(bookingUpdate.data.bookingStatus).toBe("DECLINED");
    expect(bookingUpdate.data.vendorPaymentStatus).toBe("REFUNDED");

    const refundData: any = prisma.refund.create.mock.calls[0][0].data;
    expect(refundData.refundAmount).toBe(250);
    expect(refundData.refundStatus).toBe("PROCESSED");
    expect(refundData.originalTransactionId).toBe("txg1");
  });

  it("declining an unpaid booking does not create a refund", async () => {
    prisma.vendorBooking.findFirst.mockResolvedValue(
      bookingFixture({ paymentTransactions: [] })
    );
    const res = await PATCH(jsonRequest(URL, { status: "DECLINED" }, { method: "PATCH" }), params());
    expect(statusOf(res)).toBe(200);
    expect((await readJson(res)).message).toMatch(/no payment/i);
    expect(prisma.refund.create).not.toHaveBeenCalled();
  });

  it("BK-003: completing an accepted service waits for customer confirmation", async () => {
    prisma.vendorBooking.findFirst.mockResolvedValue(bookingFixture({ bookingStatus: "ACCEPTED" }));
    const res = await PATCH(jsonRequest(URL, { status: "COMPLETED" }, { method: "PATCH" }), params());
    expect(statusOf(res)).toBe(200);
    const body = (await readJson(res)) as { awaitingCustomerConfirmation: boolean };
    expect(body.awaitingCustomerConfirmation).toBe(true);

    const update: any = prisma.vendorBooking.update.mock.calls[0][0];
    expect(update.data.vendorMarkedComplete).toBe(true);
    expect(prisma.payout.create).not.toHaveBeenCalled();
  });

  it("BK-003b: completion after customer confirmation auto-creates a REMAINING payout", async () => {
    prisma.vendorBooking.findFirst.mockResolvedValue(
      bookingFixture({ bookingStatus: "ACCEPTED", customerConfirmed: true })
    );
    const res = await PATCH(jsonRequest(URL, { status: "COMPLETED" }, { method: "PATCH" }), params());
    expect(statusOf(res)).toBe(200);
    const body = (await readJson(res)) as { payoutInitiated: boolean };
    expect(body.payoutInitiated).toBe(true);

    const payoutData: any = prisma.payout.create.mock.calls[0][0].data;
    expect(payoutData.type).toBe("REMAINING");
    expect(payoutData.status).toBe("PENDING");
    expect(payoutData.amount).toBe(750);
  });

  it("cannot mark completed before the deposit is paid", async () => {
    prisma.vendorBooking.findFirst.mockResolvedValue(
      bookingFixture({ bookingStatus: "ACCEPTED", depositPaidAt: null })
    );
    const res = await PATCH(jsonRequest(URL, { status: "COMPLETED" }, { method: "PATCH" }), params());
    expect(statusOf(res)).toBe(400);
    expect((await readJson(res)).error).toMatch(/deposit not paid/i);
  });
});