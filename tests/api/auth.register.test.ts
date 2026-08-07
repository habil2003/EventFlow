/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, beforeEach, it, expect, vi } from "vitest";
import { POST } from "@/app/api/auth/register/route";
import { jsonRequest, statusOf, readJson } from "../helpers/request";

const { prisma } = vi.hoisted(() => {
  const prisma: Record<string, any> = {};
  const namespaces = [
    "user",
    "organizerProfile",
    "vendorProfile",
    "verificationToken",
    "serviceType",
  ];
  for (const n of namespaces) {
    prisma[n] = new Proxy(
      {},
      {
get: (target: Record<string, any>, prop: string) => {
          if (!(prop in target)) target[prop] = vi.fn();
          return target[prop];
        },
      }
    );
  }
  return { prisma };
});

vi.mock("@/lib/prisma", () => ({ prisma }));
vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
vi.mock("@/lib/email", () => ({ sendVerificationEmail: vi.fn().mockResolvedValue(true) }));
vi.mock("@/lib/app-url", () => ({ getAppUrl: () => "http://localhost:3000" }));

const URL = "http://localhost:3000/api/auth/register";

function resetMocks() {
  vi.clearAllMocks();
  for (const n of ["user", "organizerProfile", "vendorProfile", "verificationToken", "serviceType"]) {
    for (const k of Object.keys(prisma[n])) prisma[n][k].mockReset?.();
  }
}

describe("POST /api/auth/register", () => {
  beforeEach(() => resetMocks());

  it("rejects a request missing required fields", async () => {
    const res = await POST(jsonRequest(URL, { name: "A", email: "a@b.com" }));
    expect(statusOf(res)).toBe(400);
    expect((await readJson(res)).error).toBe("Missing required fields");
  });

  it("rejects privilege escalation with role=ADMIN (SEC-1)", async () => {
    const res = await POST(
      jsonRequest(URL, { name: "A", email: "a@b.com", password: "pass", role: "ADMIN" })
    );
    expect(statusOf(res)).toBe(400);
    expect((await readJson(res)).error).toBe("Invalid role");
    expect(prisma.user.create).not.toHaveBeenCalled();
  });

  it("rejects unknown role values", async () => {
    const res = await POST(
      jsonRequest(URL, { name: "A", email: "a@b.com", password: "pass", role: "SUPERUSER" })
    );
    expect(statusOf(res)).toBe(400);
  });

  it("rejects malformed email", async () => {
    const res = await POST(
      jsonRequest(URL, { name: "A", email: "not-an-email", password: "pass", role: "USER" })
    );
    expect(statusOf(res)).toBe(400);
    expect((await readJson(res)).error).toMatch(/email/i);
  });

  it("returns 400 for a duplicate email", async () => {
    prisma.user.findUnique.mockResolvedValue({ id: "existing" });
    const res = await POST(
      jsonRequest(URL, { name: "A", email: "a@b.com", password: "pass", role: "USER" })
    );
    expect(statusOf(res)).toBe(400);
    expect((await readJson(res)).error).toMatch(/already exists/i);
  });

  it("creates a USER account pending verification and does not require approval", async () => {
    prisma.user.findUnique.mockResolvedValue(null);
    prisma.user.create.mockResolvedValue({
      id: "u1",
      name: "A",
      email: "a@b.com",
      passwordHash: "hash",
      role: "USER",
      status: "PENDING",
      verificationToken: "tok",
      verificationTokenExpires: new Date(),
    });

    const res = await POST(
      jsonRequest(URL, { name: "A", email: "a@b.com", password: "pass", role: "USER" })
    );
    expect(statusOf(res)).toBe(201);

    interface Body { success: boolean; role: string; requiresApproval: boolean }
    const body = (await readJson(res)) as Body;
    expect(body.success).toBe(true);
    expect(body.role).toBe("USER");
    expect(body.requiresApproval).toBe(false);

    const createCall = prisma.user.create.mock.calls[0][0];
    expect(createCall.data.role).toBe("USER");
    expect(createCall.data.passwordHash).not.toBe("pass"); // hashed
  });

  it("creates an ADMIN via user.create is impossible because of the whitelist guard", async () => {
    prisma.user.findUnique.mockResolvedValue(null);
    prisma.user.create.mockResolvedValue({
      id: "u1",
      role: "ADMIN",
      status: "APPROVED",
      name: "A",
      email: "x@b.com",
      passwordHash: "h",
    });
    // The guard runs before user.create, so we still get 400.
    const res = await POST(
      jsonRequest(URL, { name: "A", email: "x@b.com", password: "p", role: "ADMIN" })
    );
    expect(statusOf(res)).toBe(400);
    expect(prisma.user.create).not.toHaveBeenCalled();
  });

  it("requires organizer business details and cleans up on missing them", async () => {
    prisma.user.findUnique.mockResolvedValue(null);
    prisma.user.create.mockResolvedValue({ id: "o1", role: "ORGANIZER", name: "O", email: "o@b.com", passwordHash: "h", status: "PENDING" });
    prisma.user.delete.mockResolvedValue({});

    const res = await POST(
      jsonRequest(URL, { name: "O", email: "o@b.com", password: "pass", role: "ORGANIZER" })
    );
    expect(statusOf(res)).toBe(400);
    expect((await readJson(res)).error).toMatch(/Business name/i);
    expect(prisma.user.delete).toHaveBeenCalled();
  });

  it("rejects a vendor service type that is not a known active slug", async () => {
    prisma.user.findUnique.mockResolvedValue(null);
    prisma.user.create.mockResolvedValue({ id: "v1", role: "VENDOR", name: "V", email: "v@b.com", passwordHash: "h", status: "PENDING" });
    prisma.user.delete.mockResolvedValue({});
    prisma.serviceType.findUnique.mockResolvedValue(null);

    const res = await POST(
      jsonRequest(URL, {
        name: "V", email: "v@b.com", password: "pass", role: "VENDOR",
        businessName: "Acme", serviceType: "made-up", location: "Kathmandu",
      })
    );
    expect(statusOf(res)).toBe(400);
    expect((await readJson(res)).error).toMatch(/service type/i);
    expect(prisma.user.delete).toHaveBeenCalled();
    expect(prisma.vendorProfile.create).not.toHaveBeenCalled();
  });

  it("rejects an inactive vendor service type", async () => {
    prisma.user.findUnique.mockResolvedValue(null);
    prisma.user.create.mockResolvedValue({ id: "v1", role: "VENDOR", name: "V", email: "v@b.com", passwordHash: "h", status: "PENDING" });
    prisma.user.delete.mockResolvedValue({});
    prisma.serviceType.findUnique.mockResolvedValue({ id: "catering", isActive: false });

    const res = await POST(
      jsonRequest(URL, {
        name: "V", email: "v@b.com", password: "pass", role: "VENDOR",
        businessName: "Acme", serviceType: "catering", location: "Kathmandu",
      })
    );
    expect(statusOf(res)).toBe(400);
    expect((await readJson(res)).error).toMatch(/service type/i);
  });

  it("normalizes and stores a valid vendor service type slug", async () => {
    prisma.user.findUnique.mockResolvedValue(null);
    prisma.user.create.mockResolvedValue({ id: "v1", role: "VENDOR", name: "V", email: "v@b.com", passwordHash: "h", status: "PENDING" });
    prisma.serviceType.findUnique.mockResolvedValue({ id: "catering", isActive: true });
    prisma.vendorProfile.create.mockResolvedValue({ id: "vp1" });
    prisma.user.delete.mockResolvedValue({});

    const res = await POST(
      jsonRequest(URL, {
        name: "V", email: "v@b.com", password: "pass", role: "VENDOR",
        businessName: "Acme", serviceType: "CATERING", location: "Kathmandu",
      })
    );
    expect(statusOf(res)).toBe(201);
    expect(prisma.serviceType.findUnique).toHaveBeenCalledWith({ where: { id: "catering" } });
    const createCall = prisma.vendorProfile.create.mock.calls[0][0];
    expect(createCall.data.serviceType).toBe("catering");
  });
});