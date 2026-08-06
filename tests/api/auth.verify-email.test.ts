/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, beforeEach, it, expect, vi } from "vitest";
import { POST } from "@/app/api/auth/verify-email/route";
import { jsonRequest, statusOf, readJson } from "../helpers/request";

const { prisma } = vi.hoisted(() => {
  const prisma: Record<string, any> = {};
  for (const n of ["user"]) {
    prisma[n] = new Proxy(
      {},
      { get: (t: any, p: string) => (p in t ? t[p] : (t[p] = vi.fn())) }
    );
  }
  return { prisma };
});

vi.mock("@/lib/prisma", () => ({ prisma }));
vi.mock("@/lib/app-url", () => ({ getAppUrl: () => "http://localhost:3000" }));

const URL = "http://localhost:3000/api/auth/verify-email";

describe("POST /api/auth/verify-email", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    for (const k of Object.keys(prisma.user)) prisma.user[k].mockReset?.();
  });

  it("rejects a missing token", async () => {
    const res = await POST(jsonRequest(URL, {}));
    expect(statusOf(res)).toBe(400);
    expect((await readJson(res)).error).toMatch(/token is required/i);
  });

  it("rejects an invalid token (no user found)", async () => {
    prisma.user.findFirst.mockResolvedValue(null);
    const res = await POST(jsonRequest(URL, { token: "nope" }));
    expect(statusOf(res)).toBe(400);
    expect((await readJson(res)).error).toMatch(/invalid verification token/i);
  });

  it("rejects an expired token", async () => {
    prisma.user.findFirst.mockResolvedValue({
      id: "u1",
      role: "USER",
      emailVerified: null,
      verificationTokenExpires: new Date(Date.now() - 1000),
    });
    const res = await POST(jsonRequest(URL, { token: "tok" }));
    expect(statusOf(res)).toBe(400);
    expect((await readJson(res)).error).toMatch(/expired/i);
  });

  it("reports already verified emails without re-verifying", async () => {
    prisma.user.findFirst.mockResolvedValue({
      id: "u1",
      role: "USER",
      emailVerified: new Date(),
    });
    const res = await POST(jsonRequest(URL, { token: "tok" }));
    expect(statusOf(res)).toBe(200);
    const body = (await readJson(res)) as { alreadyVerified: boolean; success: boolean };
    expect(body.alreadyVerified).toBe(true);
    expect(body.success).toBe(true);
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it("AUTH-011/012: verifying a USER reaches APPROVED with no approval gate", async () => {
    prisma.user.findFirst.mockResolvedValue({
      id: "u1",
      role: "USER",
      emailVerified: null,
      verificationTokenExpires: new Date(Date.now() + 10000),
    });
    prisma.user.update.mockResolvedValue({});

    const res = await POST(jsonRequest(URL, { token: "tok" }));
    expect(statusOf(res)).toBe(200);
    const body = (await readJson(res)) as { requiresApproval: boolean; role: string };
    expect(body.requiresApproval).toBe(false);
    expect(body.role).toBe("USER");

    const updateArgs: any = prisma.user.update.mock.calls[0][0];
    expect(updateArgs.data.status).toBe("APPROVED");
    expect(updateArgs.data.emailVerified).toBeInstanceOf(Date);
    expect(updateArgs.data.verificationToken).toBeNull();
  });

  it("AUTH-011: verifying an ORGANIZER keeps status PENDING (admin approval required)", async () => {
    prisma.user.findFirst.mockResolvedValue({
      id: "u1",
      role: "ORGANIZER",
      emailVerified: null,
      verificationTokenExpires: new Date(Date.now() + 10000),
    });
    prisma.user.update.mockResolvedValue({});

    const res = await POST(jsonRequest(URL, { token: "tok" }));
    expect(statusOf(res)).toBe(200);
    const body = (await readJson(res)) as { requiresApproval: boolean };
    expect(body.requiresApproval).toBe(true);

    const updateArgs: any = prisma.user.update.mock.calls[0][0];
    expect(updateArgs.data.status).toBe("PENDING");
  });
});