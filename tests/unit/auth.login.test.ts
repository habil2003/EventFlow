/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, beforeEach, it, expect, vi } from "vitest";

const { prisma, bcryptCompare } = vi.hoisted(() => {
  const prisma: Record<string, any> = {};
  prisma.user = new Proxy(
    {},
    { get: (t: any, p: string) => (p in t ? t[p] : (t[p] = vi.fn())) }
  );
  return { prisma, bcryptCompare: vi.fn() };
});

vi.mock("@/lib/prisma", () => ({ prisma }));
vi.mock("bcryptjs", () => ({ default: { compare: bcryptCompare } }));

import { authOptions } from "@/lib/auth";

const credentials = authOptions.providers[0] as any;
const authorize = credentials.options.authorize.bind(credentials);

function userRecord(overrides: Record<string, any> = {}) {
  return {
    id: "u1",
    name: "Alice",
    email: "alice@example.com",
    passwordHash: "hashed",
    role: "USER",
    status: "APPROVED",
    emailVerified: new Date(),
    ...overrides,
  };
}

describe("CredentialsProvider.authorize", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    bcryptCompare.mockResolvedValue(true);
  });

  it("AUTH-001: accepts valid credentials for an APPROVED, verified user", async () => {
    prisma.user.findUnique.mockResolvedValue(userRecord());
    const result = await authorize({ email: "alice@example.com", password: "pass" });
    expect(result?.email).toBe("alice@example.com");
    expect(result?.role).toBe("USER");
    expect(result?.status).toBe("APPROVED");
  });

  it("AUTH-002: rejects a wrong password", async () => {
    prisma.user.findUnique.mockResolvedValue(userRecord());
    bcryptCompare.mockResolvedValue(false);
    await expect(authorize({ email: "alice@example.com", password: "wrong" })).rejects.toThrow(
      /Invalid email or password/
    );
  });

  it("AUTH-003: rejects an unverified email", async () => {
    prisma.user.findUnique.mockResolvedValue(userRecord({ emailVerified: null }));
    await expect(authorize({ email: "alice@example.com", password: "pass" })).rejects.toThrow(
      /verify your email/i
    );
  });

  it("AUTH-004: rejects a BLOCKED user", async () => {
    prisma.user.findUnique.mockResolvedValue(userRecord({ status: "BLOCKED" }));
    await expect(authorize({ email: "alice@example.com", password: "pass" })).rejects.toThrow(
      /suspended/i
    );
  });

  it("AUTH-005: rejects a user pending admin approval", async () => {
    prisma.user.findUnique.mockResolvedValue(userRecord({ status: "PENDING" }));
    await expect(authorize({ email: "alice@example.com", password: "pass" })).rejects.toThrow(
      /pending admin approval/i
    );
  });

  it("rejects a user that does not exist", async () => {
    prisma.user.findUnique.mockResolvedValue(null);
    await expect(authorize({ email: "ghost@example.com", password: "pass" })).rejects.toThrow(
      /Invalid email or password/
    );
  });

  it("rejects missing credentials", async () => {
    await expect(authorize({ email: "x@x.com", password: "" })).rejects.toThrow(/Missing email or password/);
  });
});

describe("authOptions.callbacks.session (SEC-4)", () => {
  beforeEach(() => vi.clearAllMocks());

  it("AUTH-013: re-fetches role/status from the DB on each session read", async () => {
    prisma.user.findUnique.mockResolvedValue({ role: "USER", status: "APPROVED" });
    const sessionCb = authOptions.callbacks!.session as any;
    const result = await sessionCb({
      session: { user: { id: "u1", role: "ADMIN", status: "APPROVED" } },
      token: { id: "u1", role: "ADMIN", status: "APPROVED" },
    });
    expect(result.user.role).toBe("USER");
    expect(prisma.user.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "u1" }, select: { role: true, status: true } })
    );
  });

  it("AUTH-014: falls back to the token role when the user is no longer in the DB", async () => {
    prisma.user.findUnique.mockResolvedValue(null);
    const sessionCb = authOptions.callbacks!.session as any;
    const result = await sessionCb({
      session: { user: { id: "u1", role: "ADMIN", status: "APPROVED" } },
      token: { id: "u1", role: "ADMIN", status: "APPROVED" },
    });
    expect(result.user.role).toBe("ADMIN");
  });
});