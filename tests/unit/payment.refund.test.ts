 
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { processKhaltiRefund } from "@/lib/payment/refund";

const ORIGINAL_ENV = process.env.KHALTI_ENVIRONMENT;
const ORIGINAL_SECRET = process.env.KHALTI_SECRET_KEY;

function mockFetchSequence(responses: Array<{ status: number; body: unknown }>) {
  const calls: Array<[string, RequestInit | undefined]> = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: string, init?: RequestInit) => {
      calls.push([input, init]);
      const r = responses.shift() ?? { status: 500, body: {} };
      return {
        ok: r.status >= 200 && r.status < 300,
        status: r.status,
        json: async () => r.body,
      };
    })
  );
  return calls;
}

describe("processKhaltiRefund", () => {
  beforeEach(() => {
    process.env.KHALTI_SECRET_KEY = "test_secret";
    process.env.KHALTI_ENVIRONMENT = "sandbox";
  });
  afterEach(() => {
    process.env.KHALTI_ENVIRONMENT = ORIGINAL_ENV;
    if (ORIGINAL_SECRET === undefined) delete process.env.KHALTI_SECRET_KEY;
    else process.env.KHALTI_SECRET_KEY = ORIGINAL_SECRET;
  });

  it("looks up the transaction then issues a partial refund in paisa", async () => {
    const calls = mockFetchSequence([
      { status: 200, body: { transaction_id: "gateway-tx", refunded: false } },
      { status: 200, body: { detail: "Transaction refund successful." } },
    ]);

    const result = await processKhaltiRefund("pidx", 50);

    expect(result.success).toBe(true);
    expect(result.requiresManual).toBe(false);

    // 1st call = lookup
    expect(calls[0][0]).toContain("/api/v2/epayment/lookup/");
    // 2nd call = refund
    expect(calls[1][0]).toContain("/api/merchant-transaction/gateway-tx/refund/");
    expect(JSON.parse(String(calls[1][1]?.body))).toEqual({ amount: 5000 }); // 50 NPR -> paisa
  });

  it("omits the amount body for a full refund", async () => {
    const calls = mockFetchSequence([
      { status: 200, body: { transaction_id: "gateway-tx", refunded: false } },
      { status: 200, body: { detail: "Transaction refund successful." } },
    ]);

    const result = await processKhaltiRefund("pidx");
    expect(result.success).toBe(true);
    expect(calls[1][1]?.body).toBeUndefined();
  });

  it("short-circuits when the payment was already refunded upstream", async () => {
    const calls = mockFetchSequence([
      { status: 200, body: { transaction_id: "gateway-tx", refunded: true } },
    ]);
    const result = await processKhaltiRefund("pidx");
    expect(result.success).toBe(true);
    expect(result.message).toContain("already refunded");
    expect(calls.length).toBe(1); // no refund call issued
  });

  it("returns requiresManual when lookup fails in sandbox", async () => {
    mockFetchSequence([{ status: 500, body: {} }]);
    const result = await processKhaltiRefund("pidx");
    expect(result.success).toBe(true);
    expect(result.requiresManual).toBe(true);
  });

  it("returns success:false when lookup yields no transaction_id", async () => {
    mockFetchSequence([{ status: 200, body: { refunded: false } }]);
    const result = await processKhaltiRefund("pidx");
    expect(result.success).toBe(false);
  });
});