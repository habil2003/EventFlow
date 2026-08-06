 
import { describe, beforeEach, expect, it, vi, afterEach } from "vitest";
import {
  calculateRefundAmount,
  calculateRefundPercentage,
} from "@/app/api/user/cancel-booking/route";

describe("calculateRefundPercentage", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-01T12:00:00Z"));
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns 100 when ≥ 7 days until the event", () => {
    const later = new Date("2026-08-09T12:00:00Z"); // 8 days
    expect(calculateRefundPercentage(later)).toBe(100);
  });

  it("returns 50 when between 3 and 7 days", () => {
    expect(calculateRefundPercentage(new Date("2026-08-05T12:00:00Z"))).toBe(50); // 4 days
    expect(calculateRefundPercentage(new Date("2026-08-04T12:00:00Z"))).toBe(50); // 3 days
  });

  it("returns 0 when <3 days or in the past", () => {
    expect(calculateRefundPercentage(new Date("2026-08-03T12:00:00Z"))).toBe(0); // 2 days
    expect(calculateRefundPercentage(new Date("2026-07-30T12:00:00Z"))).toBe(0); // past
  });
});

describe("calculateRefundAmount", () => {
  it("refunds nothing at 0%, platform keeps everything", () => {
    const r = calculateRefundAmount(1000, 20, 0);
    expect(r.refundAmount).toBe(0);
    expect(r.platformKeeps).toBe(1000);
  });

  it("at 100% refunds paid minus gateway fee", () => {
    const r = calculateRefundAmount(1000, 20, 100);
    expect(r.refundAmount).toBe(980);
    expect(r.platformKeeps).toBe(20);
  });

  it("at 50% refunds half and never exceeds paid amount", () => {
    const r = calculateRefundAmount(1000, 20, 50);
    expect(r.refundAmount).toBe(500);
    expect(r.platformKeeps).toBe(500);
    expect(r.refundAmount + r.platformKeeps).toBe(1000);
  });

  it("never refunds more than was paid at any percentage", () => {
    for (const pct of [0, 30, 50, 100]) {
      const r = calculateRefundAmount(250, 10, pct);
      expect(r.refundAmount).toBeLessThanOrEqual(250);
    }
  });
});