/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, beforeEach, it, expect, vi } from "vitest";
import { GET, PATCH } from "@/app/api/admin/disputes/[id]/route";
import { emptyRequest, jsonRequest, statusOf, readJson } from "../helpers/request";

const { prisma } = vi.hoisted(() => {
  const prisma: Record<string, any> = {};
  for (const n of ["dispute", "vendorBooking", "paymentTransaction", "refund"]) {
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

import { getServerSession } from "next-auth";

const ADMIN = { user: { id: "admin1", email: "admin@eventflow.test", role: "ADMIN" } };
const URL = "http://localhost:3000/api/admin/disputes/d1";
const BASE = "http://localhost:3000/api/admin/disputes/d1";

function params(id = "d1") {
  return { params: Promise.resolve({ id }) };
}

function disputeFixture(overrides: Record<string, any> = {}) {
  return {
    id: "d1",
    bookingId: "vb1",
    reason: "poor service",
    status: "OPEN",
    adminDecision: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    user: { name: "Customer", email: "c@customer.com" },
    vendorBooking: {
      id: "vb1",
      depositAmount: 250,
      totalAmount: 1000,
      amountReleasedAt: null,
      payouts: [],
      paymentStatus: "HELD_IN_ESCROW",
      vendorPaymentStatus: "PARTIALLY_PAID",
      bookingStatus: "ACCEPTED",
      vendor: { businessName: "Vendor Co", user: { name: "Vendor", email: "v@vendor.com" } },
      user: { name: "Customer", email: "c@customer.com" },
      userSocialEvent: { title: "Wedding" },
      ...overrides,
    },
    ...overrides,
  };
}

describe("GET /api/admin/disputes/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    for (const n of ["dispute", "vendorBooking", "paymentTransaction", "refund"]) {
      for (const k of Object.keys(prisma[n])) prisma[n][k].mockReset?.();
    }
    vi.mocked(getServerSession).mockResolvedValue(ADMIN);
  });

  it("DISP-001: an admin can read a dispute with its booking", async () => {
    prisma.dispute.findUnique.mockResolvedValue(disputeFixture());
    const res = await GET(emptyRequest(BASE), params());
    expect(statusOf(res)).toBe(200);
    const body = (await readJson(res)) as any;
    expect(body.dispute.id).toBe("d1");
    expect(body.dispute.booking.id).toBe("vb1");
    expect(body.dispute.customer.email).toBe("c@customer.com");
    expect(body.dispute.vendor.name).toBe("Vendor Co");
  });

  it("returns 401 for a non-admin", async () => {
    vi.mocked(getServerSession).mockResolvedValue({ user: { id: "u1", role: "USER" } });
    const res = await GET(emptyRequest(BASE), params());
    expect(statusOf(res)).toBe(401);
  });

  it("returns 404 for an unknown dispute", async () => {
    prisma.dispute.findUnique.mockResolvedValue(null);
    const res = await GET(emptyRequest(BASE), params());
    expect(statusOf(res)).toBe(404);
  });
});

describe("PATCH /api/admin/disputes/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    for (const n of ["dispute", "vendorBooking", "paymentTransaction", "refund"]) {
      for (const k of Object.keys(prisma[n])) prisma[n][k].mockReset?.();
    }
    vi.mocked(getServerSession).mockResolvedValue(ADMIN);
    prisma.dispute.findUnique.mockResolvedValue(disputeFixture());
    prisma.dispute.update.mockResolvedValue({ id: "d1", status: "RESOLVED", adminDecision: "refund" });
    prisma.vendorBooking.update.mockResolvedValue({});
    prisma.paymentTransaction.findFirst.mockResolvedValue({
      id: "ptx1",
      transactionId: "txg1",
      status: "COMPLETED",
      paymentType: "VENDOR_DEPOSIT",
    });
    prisma.refund.create.mockImplementation(({ data }: any) => ({ id: "r1", ...data }));
  });

  it("DISP-004: rejects an invalid status", async () => {
    const res = await PATCH(jsonRequest(URL, { status: "MAYBE", adminDecision: "x" }), params());
    expect(statusOf(res)).toBe(400);
    expect((await readJson(res)).error).toMatch(/invalid status/i);
  });

  it("requires an admin decision", async () => {
    const res = await PATCH(jsonRequest(URL, { status: "RESOLVED" }), params());
    expect(statusOf(res)).toBe(400);
    expect((await readJson(res)).error).toMatch(/decision is required/i);
  });

  it("DISP-003: rejects resolving a dispute that is already resolved", async () => {
    prisma.dispute.findUnique.mockResolvedValue(disputeFixture({ status: "RESOLVED" }));
    const res = await PATCH(jsonRequest(URL, { status: "REJECTED", adminDecision: "x" }), params());
    expect(statusOf(res)).toBe(400);
    expect((await readJson(res)).error).toMatch(/already resolved/i);
  });

  it("REFUND-011: RESOLVED looks up the deposit by COMPLETED status and creates a refund", async () => {
    const res = await PATCH(jsonRequest(URL, { status: "RESOLVED", adminDecision: "refund in favor" }), params());

    expect(statusOf(res)).toBe(200);
    const body = (await readJson(res)) as any;
    expect(body.refundAmount).toBe(250);

    const findWhere: any = prisma.paymentTransaction.findFirst.mock.calls[0][0].where;
    expect(findWhere.paymentType).toBe("VENDOR_DEPOSIT");
    expect(findWhere.status).toBe("COMPLETED");

    const refundData: any = prisma.refund.create.mock.calls[0][0].data;
    expect(refundData.refundAmount).toBe(250);
    expect(refundData.refundStatus).toBe("PENDING_ADMIN");
    expect(refundData.vendorBookingId).toBe("vb1");
  });

  it("REFUND-012: RESOLVED does NOT auto-refund when funds were already released", async () => {
    prisma.dispute.findUnique.mockResolvedValue(disputeFixture({ vendorBooking: { amountReleasedAt: new Date() } }));
    const res = await PATCH(jsonRequest(URL, { status: "RESOLVED", adminDecision: "refund in favor" }), params());
    expect(statusOf(res)).toBe(200);
    expect(prisma.refund.create).not.toHaveBeenCalled();
  });

  it("REFUND-012b: RESOLVED does NOT auto-refund when a payout is already COMPLETED", async () => {
    prisma.dispute.findUnique.mockResolvedValue(
      disputeFixture({ vendorBooking: { payouts: [{ status: "COMPLETED" }] } })
    );
    const res = await PATCH(jsonRequest(URL, { status: "RESOLVED", adminDecision: "refund in favor" }), params());
    expect(statusOf(res)).toBe(200);
    expect(prisma.refund.create).not.toHaveBeenCalled();
  });

  it("REJECTED restores the booking to ACCEPTED", async () => {
    const res = await PATCH(jsonRequest(URL, { status: "REJECTED", adminDecision: "vendor was right" }), params());
    expect(statusOf(res)).toBe(200);
    expect(prisma.refund.create).not.toHaveBeenCalled();

    const bookingUpdate: any = prisma.vendorBooking.update.mock.calls[0][0];
    expect(bookingUpdate.data.bookingStatus).toBe("ACCEPTED");
    expect(bookingUpdate.data.paymentStatus).toBe("HELD_IN_ESCROW");
  });
});