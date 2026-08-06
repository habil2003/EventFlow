/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, beforeEach, it, expect, vi } from "vitest";
import { POST } from "@/app/api/tickets/purchase/route";
import { jsonRequest, statusOf, readJson } from "../helpers/request";

const { prisma } = vi.hoisted(() => {
  const prisma: Record<string, any> = {};
  for (const n of ["ticketedEvent", "ticketReservation", "paymentTransaction"]) {
    prisma[n] = new Proxy(
      {},
      { get: (t: any, p: string) => (p in t ? t[p] : (t[p] = vi.fn())) }
    );
  }
  prisma.$transaction = async (fn: any) => fn(prisma);
  return { prisma };
});

vi.mock("@/lib/prisma", () => ({ prisma }));
vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
vi.mock("@/lib/app-url", () => ({ getAppUrl: () => "http://localhost:3000" }));
vi.mock("@/lib/payment/khalti", () => ({
  initiateKhaltiPayment: vi.fn(),
}));

import { getServerSession } from "next-auth";
import { initiateKhaltiPayment } from "@/lib/payment/khalti";

const URL = "http://localhost:3000/api/tickets/purchase";

const FUTURE_EVENT = {
  id: "ev1",
  title: "Concert",
  isCompleted: false,
  eventDate: new Date(Date.now() + 30 * 86400000),
  ticketTiers: [{ id: "tier1", quantity: 50, soldCount: 0, price: 1500 }],
};

function reset() {
  for (const n of ["ticketedEvent", "ticketReservation", "paymentTransaction"]) {
    for (const k of Object.keys(prisma[n])) prisma[n][k].mockReset?.();
  }
  vi.mocked(getServerSession).mockResolvedValue({ user: { id: "u1", email: "u@b.com", name: "U" } });
  prisma.ticketedEvent.findUnique.mockResolvedValue(FUTURE_EVENT);
  prisma.ticketReservation.create.mockResolvedValue({ id: "res1", status: "PENDING" });
  prisma.paymentTransaction.create.mockResolvedValue({ id: "ptx1", status: "PENDING" });
  prisma.paymentTransaction.update.mockResolvedValue({ id: "ptx1", pidx: "pidx" });
}

describe("POST /api/tickets/purchase", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    reset();
  });

  it("returns 401 when unauthenticated", async () => {
    vi.mocked(getServerSession).mockResolvedValue(null);
    const res = await POST(
      jsonRequest(URL, { eventId: "ev1", tierId: "tier1", quantity: 1, returnUrl: "/my-tickets" })
    );
    expect(statusOf(res)).toBe(401);
    expect(prisma.ticketReservation.create).not.toHaveBeenCalled();
  });

  it("returns 400 for missing required fields", async () => {
    const res = await POST(jsonRequest(URL, { eventId: "ev1" }));
    expect(statusOf(res)).toBe(400);
    expect((await readJson(res)).error).toMatch(/missing required/i);
  });

  it("returns 400 for quantity below 1", async () => {
    const res = await POST(jsonRequest(URL, { eventId: "ev1", tierId: "tier1", quantity: 0 }));
    expect(statusOf(res)).toBe(400);
    expect(prisma.ticketReservation.create).not.toHaveBeenCalled();
  });

  it("returns 404 for an unknown event", async () => {
    prisma.ticketedEvent.findUnique.mockResolvedValue(null);
    const res = await POST(jsonRequest(URL, { eventId: "nope", tierId: "tier1", quantity: 1 }));
    expect(statusOf(res)).toBe(404);
  });

  it("rejects purchase of a completed event", async () => {
    prisma.ticketedEvent.findUnique.mockResolvedValue({ ...FUTURE_EVENT, isCompleted: true });
    const res = await POST(jsonRequest(URL, { eventId: "ev1", tierId: "tier1", quantity: 1 }));
    expect(statusOf(res)).toBe(400);
    expect((await readJson(res)).error).toMatch(/ended/i);
  });

  it("rejects quantity exceeding available stock", async () => {
    prisma.ticketedEvent.findUnique.mockResolvedValue({
      ...FUTURE_EVENT,
      ticketTiers: [{ id: "tier1", quantity: 2, soldCount: 2, price: 1500 }],
    });
    const res = await POST(jsonRequest(URL, { eventId: "ev1", tierId: "tier1", quantity: 1 }));
    expect(statusOf(res)).toBe(400);
    expect((await readJson(res)).error).toMatch(/available/i);
  });

  it("TIX-001: a valid purchase creates a reservation, transaction, and initiates Khalti", async () => {
    vi.mocked(initiateKhaltiPayment).mockResolvedValue({ success: true, payment_url: "https://pay", pidx: "pidx1" });

    const res = await POST(
      jsonRequest(URL, { eventId: "ev1", tierId: "tier1", quantity: 1, returnUrl: "/my-tickets" })
    );

    expect(statusOf(res)).toBe(200);
    const body = (await readJson(res)) as { success: boolean; requiresPayment: boolean; pidx: string };
    expect(body.success).toBe(true);
    expect(body.requiresPayment).toBe(true);
    expect(body.pidx).toBe("pidx1");

    const reservCreate: any = prisma.ticketReservation.create.mock.calls[0][0];
    expect(reservCreate.data.quantity).toBe(1);
    expect(reservCreate.data.eventId).toBe("ev1");

    const txCreate: any = prisma.paymentTransaction.create.mock.calls[0][0];
    expect(txCreate.data.gateway).toBe("KHALTI");
    expect(txCreate.data.status).toBe("PENDING");
    expect(txCreate.data.amountInPaisa).toBe(1500 * 100);

    expect(prisma.paymentTransaction.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { pidx: "pidx1" } })
    );
  });

  it("cleans up the reservation and transaction when Khalti initiation fails", async () => {
    vi.mocked(initiateKhaltiPayment).mockResolvedValue({ success: false, error: "gateway down" });

    const res = await POST(
      jsonRequest(URL, { eventId: "ev1", tierId: "tier1", quantity: 1, returnUrl: "/my-tickets" })
    );

    expect(statusOf(res)).toBe(400);
    expect((await readJson(res)).success).toBe(false);
    expect(prisma.ticketReservation.delete).toHaveBeenCalled();
    expect(prisma.paymentTransaction.delete).toHaveBeenCalled();
  });
});