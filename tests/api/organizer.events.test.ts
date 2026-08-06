/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, beforeEach, it, expect, vi } from "vitest";
import { POST } from "@/app/api/organizer/events/route";
import { jsonRequest, statusOf, readJson } from "../helpers/request";

const { prisma } = vi.hoisted(() => {
  const prisma: Record<string, any> = {};
  for (const n of ["ticketedEvent", "ticketTier"]) {
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

const URL = "http://localhost:3000/api/organizer/events";
const validBody = {
  title: "Gala",
  description: "desc",
  eventDate: new Date(Date.now() + 30 * 86400000).toISOString(),
  eventTime: "18:00",
  location: "Kathmandu",
  capacity: 100,
  ticketTiers: [{ name: "General", price: 1500, quantity: 50 }],
};

describe("POST /api/organizer/events", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    for (const n of ["ticketedEvent", "ticketTier"]) {
      for (const k of Object.keys(prisma[n])) prisma[n][k].mockReset?.();
    }
    prisma.ticketedEvent.create.mockResolvedValue({ id: "ev1" });
    prisma.ticketTier.create.mockResolvedValue({ id: "tier1" });
  });

  it("EVT-002: returns 401 when unauthenticated", async () => {
    vi.mocked(getServerSession).mockResolvedValue(null);
    const res = await POST(jsonRequest(URL, validBody));
    expect(statusOf(res)).toBe(401);
    expect(prisma.ticketedEvent.create).not.toHaveBeenCalled();
  });

  it("EVT-002: returns 403 for a non-organizer role", async () => {
    vi.mocked(getServerSession).mockResolvedValue({ user: { id: "u1", role: "USER" } });
    const res = await POST(jsonRequest(URL, validBody));
    expect(statusOf(res)).toBe(403);
    expect(prisma.ticketedEvent.create).not.toHaveBeenCalled();
  });

  it("returns 400 for missing required fields", async () => {
    vi.mocked(getServerSession).mockResolvedValue({ user: { id: "o1", role: "ORGANIZER" } });
    const res = await POST(jsonRequest(URL, { title: "No tiers" }));
    expect(statusOf(res)).toBe(400);
  });

  it("EVT-001: an organizer creates an event with tiers", async () => {
    vi.mocked(getServerSession).mockResolvedValue({ user: { id: "o1", role: "ORGANIZER" } });
    const res = await POST(
      jsonRequest(URL, { ...validBody, ticketTiers: [validBody.ticketTiers[0], validBody.ticketTiers[0]] })
    );

    expect(statusOf(res)).toBe(201);
    expect((await readJson(res)).eventId).toBe("ev1");

    const eventCreate: any = prisma.ticketedEvent.create.mock.calls[0][0];
    expect(eventCreate.data.title).toBe("Gala");
    expect(eventCreate.data.organizerId).toBe("o1");

    expect(prisma.ticketTier.create).toHaveBeenCalledTimes(2);
    const tierCreate: any = prisma.ticketTier.create.mock.calls[0][0];
    expect(tierCreate.data.eventId).toBe("ev1");
    expect(tierCreate.data.soldCount).toBe(0);
  });
});