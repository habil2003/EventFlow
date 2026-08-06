/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, beforeEach, it, expect, vi } from "vitest";
import { NextRequest } from "next/server";
import { GET } from "@/app/api/payment/verify/route";

const { prisma } = vi.hoisted(() => {
  const prisma: Record<string, any> = {
    paymentTransaction: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    vendorBooking: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    ticketBooking: {
      findFirst: vi.fn(),
      update: vi.fn(),
      deleteMany: vi.fn(),
    },
  };
  return { prisma };
});

vi.mock("@/lib/prisma", () => ({ prisma }));
vi.mock("@/lib/payment/khalti", () => ({ verifyKhaltiPayment: vi.fn() }));
vi.mock("@/lib/app-url", () => ({ getAppUrl: () => "http://localhost:3000" }));

import { verifyKhaltiPayment } from "@/lib/payment/khalti";

function buildRequest(overrides: Record<string, string> = {}): NextRequest {
  const q = new URLSearchParams({
    gateway: "KHALTI",
    transactionId: "txn-1",
    status: "Completed",
    transaction_id: "gateway-tx",
    ...overrides,
  });
  return new NextRequest(`http://localhost/api/payment/verify?${q.toString()}`);
}

function redirectLocation(res: Response): string {
  return res.headers.get("location") ?? "";
}

describe("GET /api/payment/verify", () => {
  const baseTransaction = {
    id: "ptx1",
    transactionId: "txn-1",
    amount: 100,
    pidx: "pidx-1",
    status: "PENDING",
    paymentType: "VENDOR_DEPOSIT",
    vendorBookingId: "vb1",
    ticketBookingId: null,
    gatewayResponse: { returnUrl: "http://localhost/my-bookings" },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    prisma.paymentTransaction.findUnique.mockReset();
    prisma.paymentTransaction.update.mockReset();
    prisma.vendorBooking.findUnique.mockReset();
    prisma.vendorBooking.update.mockReset();
    prisma.ticketBooking.findFirst.mockReset();
    prisma.ticketBooking.update.mockReset();
    prisma.ticketBooking.deleteMany.mockReset();
  });

  it("redirects to failed when transactionId is missing", async () => {
    const res = await GET(new NextRequest("http://localhost/api/payment/verify"));
    expect(res.status).toBe(307);
    expect(redirectLocation(res)).toContain("/payment/failed");
  });

  it("redirects to failed when the transaction is not found", async () => {
    prisma.paymentTransaction.findUnique.mockResolvedValue(null);
    const res = await GET(buildRequest());
    expect(redirectLocation(res)).toContain("/payment/failed");
  });

  it("treats an already COMPLETED transaction as idempotent and skips gateway verify", async () => {
    prisma.paymentTransaction.findUnique.mockResolvedValue({ ...baseTransaction, status: "COMPLETED" });
    const res = await GET(buildRequest());
    expect(redirectLocation(res)).toContain("already_processed");
    expect(verifyKhaltiPayment).not.toHaveBeenCalled();
  });

  it("SEC-2: does NOT complete when Khalti lookup says PENDING, despite status=Completed in the URL", async () => {
    prisma.paymentTransaction.findUnique.mockResolvedValue({ ...baseTransaction });
    vi.mocked(verifyKhaltiPayment).mockResolvedValue({ success: true, status: "Pending" });

    const res = await GET(buildRequest());

    expect(redirectLocation(res)).toContain("/payment/failed");
    expect(prisma.paymentTransaction.update).toHaveBeenCalled();
    const data = prisma.paymentTransaction.update.mock.calls[0][0].data;
    expect(data.status).toBe("FAILED");
  });

  it("SEC-2: does NOT complete when amounts do not match the gateway record", async () => {
    prisma.paymentTransaction.findUnique.mockResolvedValue({ ...baseTransaction });
    vi.mocked(verifyKhaltiPayment).mockResolvedValue({ success: true, status: "Completed", amount: 999 });

    const res = await GET(buildRequest({ status: "Completed" }));

    expect(redirectLocation(res)).toContain("/payment/failed");
    expect(prisma.paymentTransaction.update.mock.calls[0][0].data.status).toBe("FAILED");
  });

  it("completes a vendor deposit when lookup is Completed and amount matches", async () => {
    prisma.paymentTransaction.findUnique.mockResolvedValue({ ...baseTransaction });
    vi.mocked(verifyKhaltiPayment).mockResolvedValue({ success: true, status: "Completed", amount: 100 });
    prisma.vendorBooking.findUnique.mockResolvedValue({ id: "vb1", totalAmount: 400 });
    prisma.vendorBooking.update.mockResolvedValue({});

    const res = await GET(buildRequest());

    expect(redirectLocation(res)).toContain("/payment/success");
    expect(prisma.paymentTransaction.update.mock.calls[0][0].data.status).toBe("COMPLETED");
    expect(prisma.vendorBooking.update.mock.calls[0][0].data.vendorPaymentStatus).toBe("DEPOSIT_PAID");
    expect(prisma.vendorBooking.update.mock.calls[0][0].data.remainingAmount).toBe(300);
  });
});