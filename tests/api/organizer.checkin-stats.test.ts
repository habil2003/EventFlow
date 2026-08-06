/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, beforeEach, it, expect, vi } from "vitest";
import { GET } from "@/app/api/organizer/events/[id]/checkin-stats/route";
import { emptyRequest, statusOf, readJson } from "../helpers/request";

const { prisma } = vi.hoisted(() => {
  const prisma: Record<string, any> = {};
  for (const n of ["ticketedEvent", "ticketBooking"]) {
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

function params(id = "e1") {
  return { params: Promise.resolve({ id }) };
}

describe("GET /api/organizer/events/[id]/checkin-stats", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    for (const n of ["ticketedEvent", "ticketBooking"]) {
      for (const k of Object.keys(prisma[n])) prisma[n][k].mockReset?.();
    }
    prisma.ticketedEvent.findUnique.mockResolvedValue({ organizerId: "org1" });
  });

  it("returns 401 when unauthenticated", async () => {
    vi.mocked(getServerSession).mockResolvedValue(null);
    const res = await GET(emptyRequest("http://localhost/api/checkin-stats/e1"), params());
    expect(statusOf(res)).toBe(401);
  });

  it("SEC-5: returns 403 for a logged-in user who does not own the event", async () => {
    vi.mocked(getServerSession).mockResolvedValue({ user: { id: "u1", role: "USER" } });
    const res = await GET(emptyRequest("http://localhost/api/checkin-stats/e1"), params());
    expect(statusOf(res)).toBe(403);
    expect(prisma.ticketBooking.findMany).not.toHaveBeenCalled();
  });

  it("returns 404 when the event does not exist", async () => {
    vi.mocked(getServerSession).mockResolvedValue({ user: { id: "org1", role: "ORGANIZER" } });
    prisma.ticketedEvent.findUnique.mockResolvedValue(null);
    const res = await GET(emptyRequest("http://localhost/api/checkin-stats/e1"), params());
    expect(statusOf(res)).toBe(404);
  });

  it("allows the event owner to read check-in stats", async () => {
    vi.mocked(getServerSession).mockResolvedValue({ user: { id: "org1", role: "ORGANIZER" } });
    prisma.ticketBooking.findMany.mockResolvedValue([
      { id: "t1", checkedIn: true, checkedInAt: new Date(), user: { name: "A" } },
      { id: "t2", checkedIn: false, checkedInAt: null, user: { name: "B" } },
    ]);

    const res = await GET(emptyRequest("http://localhost/api/checkin-stats/e1"), params());

    expect(statusOf(res)).toBe(200);
    const body = (await readJson(res)) as { checkedInCount: number; totalTickets: number };
    expect(body.totalTickets).toBe(2);
    expect(body.checkedInCount).toBe(1);
  });

  it("allows an ADMIN to read check-in stats for any event", async () => {
    vi.mocked(getServerSession).mockResolvedValue({ user: { id: "admin1", role: "ADMIN" } });
    prisma.ticketBooking.findMany.mockResolvedValue([]);
    const res = await GET(emptyRequest("http://localhost/api/checkin-stats/e1"), params());
    expect(statusOf(res)).toBe(200);
  });
});