 
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { initiateKhaltiPayment, verifyKhaltiPayment } from "@/lib/payment/khalti";

const ORIGIN = process.env.KHALTI_ENVIRONMENT;
const ORIGINAL_SECRET = process.env.KHALTI_SECRET_KEY;

function jsonFetch(response: { status: number; body: unknown }) {
  const mock = vi.fn().mockResolvedValue({
    ok: response.status >= 200 && response.status < 300,
    status: response.status,
    json: async () => response.body,
  });
  vi.stubGlobal("fetch", mock);
  return mock;
}

describe("initiateKhaltiPayment", () => {
  beforeEach(() => {
    process.env.KHALTI_SECRET_KEY = "test_secret";
    process.env.KHALTI_ENVIRONMENT = "sandbox";
  });
  afterEach(() => {
    process.env.KHALTI_ENVIRONMENT = ORIGIN;
    if (ORIGINAL_SECRET === undefined) delete process.env.KHALTI_SECRET_KEY;
    else process.env.KHALTI_SECRET_KEY = ORIGINAL_SECRET;
  });

  const params = {
    amount: 100.5,
    transactionId: "txn-test",
    returnUrl: "https://app.example.com/verify?txn=txn-test",
    productName: "Ticket",
    customerName: "John",
    customerEmail: "j@example.com",
    customerPhone: "9800000000",
  };

  it("posts to the sandbox initiate endpoint and returns pidx on success", async () => {
    const fetchMock = jsonFetch({ status: 200, body: { pidx: "pidx-123", payment_url: "https://pay/" } });

    const result = await initiateKhaltiPayment(params);

    expect(result.success).toBe(true);
    expect(result.pidx).toBe("pidx-123");
    expect(result.payment_url).toBe("https://pay/");

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain("dev.khalti.com/api/v2/epayment/initiate/");
    const headers = init?.headers as Record<string, string>;
    expect(headers.Authorization).toBe("Key test_secret");
    const sent = JSON.parse(String(init?.body));
    expect(sent.amount).toBe(10050); // paisa
    expect(sent.purchase_order_id).toBe("txn-test");
  });

  it("returns success:false on non-ok response with error detail", async () => {
    jsonFetch({ status: 400, body: { detail: "Invalid amount" } });
    const result = await initiateKhaltiPayment(params);
    expect(result.success).toBe(false);
    expect(result.error).toBe("Invalid amount");
  });

  it("surfaces fetch errors as success:false", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network down")));
    const result = await initiateKhaltiPayment(params);
    expect(result.success).toBe(false);
    expect(result.error).toBe("network down");
  });
});

describe("verifyKhaltiPayment", () => {
  beforeEach(() => {
    process.env.KHALTI_SECRET_KEY = "test_secret";
    process.env.KHALTI_ENVIRONMENT = "sandbox";
  });
  afterEach(() => {
    process.env.KHALTI_ENVIRONMENT = ORIGIN;
    if (ORIGINAL_SECRET === undefined) delete process.env.KHALTI_SECRET_KEY;
    else process.env.KHALTI_SECRET_KEY = ORIGINAL_SECRET;
  });

  it("returns success with status and amount (converted from paisa) on Completed lookup", async () => {
    jsonFetch({
      status: 200,
      body: { status: "Completed", transaction_id: "txid", total_amount: 12000 },
    });
    const result = await verifyKhaltiPayment("pidx-123");
    expect(result.success).toBe(true);
    expect(result.status).toBe("Completed");
    expect(result.amount).toBe(120); // 12000 paisa / 100
  });

  it("does not return amount when total_amount is absent", async () => {
    jsonFetch({ status: 200, body: { status: "Pending" } });
    const result = await verifyKhaltiPayment("pidx-123");
    expect(result.success).toBe(true);
    expect(result.amount).toBeUndefined();
  });

  it("returns success:false when lookup is not ok", async () => {
    jsonFetch({ status: 500, body: {} });
    const result = await verifyKhaltiPayment("pidx-123");
    expect(result.success).toBe(false);
  });
});