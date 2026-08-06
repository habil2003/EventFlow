/* eslint-disable @typescript-eslint/no-explicit-any */
import { vi } from "vitest";

/**
 * Builds a Prisma-like mock client whose nested namespaces expose vi.fn().
 *
 * Usage:
 *   import { createPrismaMock } from "../helpers/prisma-mock";
 *   const prisma = createPrismaMock();
 *   vi.mock("@/lib/prisma", () => ({ prisma }));
 *
 * Then, per test:
 *   prisma.paymentTransaction.findUnique.mockResolvedValue({ ... });
 *   expect(prisma.payout.create).toHaveBeenCalledWith(expect.objectContaining({ ... }));
 */
export function createPrismaMock() {
  const namespaces = [
    "user",
    "organizerProfile",
    "vendorProfile",
    "paymentTransaction",
    "ticketBooking",
    "ticketTier",
    "ticketReservation",
    "vendorBooking",
    "payout",
    "refund",
    "dispute",
    "ticketedEvent",
    "verificationToken",
    "platformSetting",
  ];

  const prisma: Record<string, any> = {};

  for (const name of namespaces) {
    prisma[name] = new Proxy(
      {},
      {
        get: (target: Record<string, any>, prop: string) => {
          if (!(prop in target)) {
            target[prop] = vi.fn();
          }
          return target[prop];
        },
      }
    );
  }

  // Convenience helpers for tests.
  prisma.__reset = () => {
    for (const name of namespaces) {
      for (const key of Object.keys(prisma[name])) {
        prisma[name][key].mockReset?.();
      }
    }
  };

  return prisma;
}

export type PrismaMock = ReturnType<typeof createPrismaMock>;