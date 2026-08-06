/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, beforeEach, it, expect, vi } from "vitest";
import { NextRequest } from "next/server";
import { GET } from "@/app/api/tickets/payment-callback/route";

const { prisma } = vi.hoisted(() => {
  const prisma: Record<string, any> = {
    paymentTransaction: {
      findFirst: vi.fn(),
      update: vi.fn(),
    },
    ticketBooking: {
      count: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
    },
    ticketTier: {
      update: vi.fn(),
    },
    ticketReservation: {
      findUnique: vi.fn(),
      delete: vi.fn(),
    },
  };
  return { prisma };
});

vi.mock("@/lib/prisma", () => ({ prisma }));
vi.mock("@/lib/payment/khalti", () => ({ verifyKhaltiPayment: vi.fn() }));

import { verifyKhaltiPayment } from "@/lib/payment/khalti";

function buildRequest(query: Record<string, string>): NextRequest {
  const q = new URLSearchParams(query);
  return new NextRequest(`http://localhost/api/tickets/payment-callback?${q.toString()}`);
}

function redirectLocation(res: Response): string {
  return res.headers.get("location") ?? "";
}

describe("GET /api/tickets/payment-callback", () => {
  const baseTx = {
    id: "ptx1",
    transactionId: "purchase-1",
    paymentType: "TICKET_PURCHASE",
    amount: 60,
    status: "PENDING",
    gatewayResponse: { reservationId: "res1" },
    ticketBooking: null,
  };

beforeEach(() => {
    vi.clearAllMocks();
    const namespaces = Object.values(prisma) as Array<Record<string, any>>;
    for (const ns of namespaces) {
      for (const key of Object.keys(ns)) {
        (ns[key] as any)?.mockReset?.();
      }
    }
    prisma.$transaction = vi.fn(async (fn: any) => fn(prisma));
  });

  it("redirects to my-tickets when purchase_order_id is missing", async () => {
    const res = await GET(buildRequest({ pidx: "p", status: "Completed" }));
    expect(redirectLocation(res)).toContain("/my-tickets");
  });

  it("redirects to failed when the transaction is not found", async () => {
    prisma.paymentTransaction.findFirst.mockResolvedValue(null);
    const res = await GET(buildRequest({ pidx: "p", status: "Completed", purchase_order_id: "p1" }));
    expect(redirectLocation(res)).toContain("/payment/failed");
  });

  it("treats already-COMPLETED transactions as idempotent and skips verification", async () => {
    prisma.paymentTransaction.findFirst.mockResolvedValue({ ...baseTx, status: "COMPLETED" });
    const res = await GET(buildRequest({ pidx: "p", status: "Completed", purchase_order_id: "p1" }));
    expect(redirectLocation(res)).toContain("already_processed");
    expect(verifyKhaltiPayment).not.toHaveBeenCalled();
  });

  it("does NOT mint tickets when Khalti lookup is not Completed (SEC-2)", async () => {
    prisma.paymentTransaction.findFirst.mockResolvedValue({ ...baseTx });
    vi.mocked(verifyKhaltiPayment).mockResolvedValue({ success: true, status: "Pending" });

    const res = await GET(buildRequest({ pidx: "p", status: "Completed", purchase_order_id: "p1" }));

    expect(redirectLocation(res)).toContain("/payment/failed");
    expect(prisma.ticketBooking.create).not.toHaveBeenCalled();
    expect(prisma.paymentTransaction.update).toHaveBeenCalled();
    expect(prisma.paymentTransaction.update.mock.calls[0][0].data.status).toBe("FAILED");
  });

  it("mints tickets only when lookup is Completed and amounts match", async () => {
    prisma.paymentTransaction.findFirst.mockResolvedValue(baseTx);
    vi.mocked(verifyKhaltiPayment).mockResolvedValue({ success: true, status: "Completed", amount: 60 });
    prisma.ticketReservation.findUnique.mockResolvedValue({
      id: "res1",
      userId: "u1",
      eventId: "e1",
      tierId: "t1",
      quantity: 2,
      tier: { price: 30 },
    });
    prisma.ticketBooking.count.mockResolvedValue(0);
    prisma.ticketBooking.findFirst.mockResolvedValue(null);
    prisma.ticketBooking.create.mockImplementation(({ data }: any) => ({ id: `t_${data.ticketNumber}` }));

    const res = await GET(buildRequest({ pidx: "p", status: "Completed", purchase_order_id: "p1" }));

    expect(redirectLocation(res)).toContain("/my-tickets?payment=success");
    expect(prisma.ticketBooking.create).toHaveBeenCalledTimes(2);
    expect(prisma.ticketReservation.delete).toHaveBeenCalled();
  });

  it("does NOT mint tickets when the gateway amount differs from the transaction amount", async () => {
    prisma.paymentTransaction.findFirst.mockResolvedValue(baseTx);
    vi.mocked(verifyKhaltiPayment).mockResolvedValue({ success: true, status: "Completed", amount: 1 });

    const res = await GET(buildRequest({ pidx: "p", status: "Completed", purchase_order_id: "p1" }));

    expect(redirectLocation(res)).toContain("/payment/failed");
    expect(prisma.ticketBooking.create).not.toHaveBeenCalled();
  });
});