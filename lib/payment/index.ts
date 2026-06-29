// lib/payment/index.ts
import { NepPayments } from 'neppayments';

// Initialize the payment gateway client
export const payments = new NepPayments({
  khalti: {
    secretKey: process.env.KHALTI_SECRET_KEY!,
    environment: (process.env.KHALTI_ENVIRONMENT as 'sandbox' | 'production') || 'sandbox'
  },
  esewa: {
    productCode: process.env.ESEWA_PRODUCT_CODE!,
    secretKey: process.env.ESEWA_SECRET_KEY!,
    environment: (process.env.KHALTI_ENVIRONMENT as 'sandbox' | 'production') || 'sandbox',
    successUrl: `${process.env.NEXT_PUBLIC_APP_URL}/api/payment/verify?gateway=esewa`,
    failureUrl: `${process.env.NEXT_PUBLIC_APP_URL}/api/payment/failure`
  }
});

// Amount conversion helpers
export const toPaisa = (rupees: number): number => rupees * 100;
export const toRupees = (paisa: number): number => paisa / 100;

// Generate unique transaction ID
export const generateTransactionId = (prefix: string = 'txn'): string => {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
};

// Direct Khalti API functions (fallback if neppayments has issues)
export async function initiateKhaltiPaymentDirect(data: {
  amount: number;
  purchaseOrderId: string;
  purchaseOrderName: string;
  customerName: string;
  customerEmail: string;
  returnUrl: string;
}) {
  const response = await fetch('https://dev.khalti.com/api/v2/epayment/initiate/', {
    method: 'POST',
    headers: {
      'Authorization': `Key ${process.env.KHALTI_SECRET_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      return_url: data.returnUrl,
      website_url: process.env.NEXT_PUBLIC_APP_URL,
      amount: data.amount,
      purchase_order_id: data.purchaseOrderId,
      purchase_order_name: data.purchaseOrderName,
      customer_info: {
        name: data.customerName,
        email: data.customerEmail,
      },
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    console.error('Khalti API error:', text);
    throw new Error(`Khalti API error: ${response.status}`);
  }

  return response.json();
}

export async function verifyKhaltiPaymentDirect(pidx: string) {
  const response = await fetch('https://dev.khalti.com/api/v2/epayment/lookup/', {
    method: 'POST',
    headers: {
      'Authorization': `Key ${process.env.KHALTI_SECRET_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ pidx }),
  });

  if (!response.ok) {
    const text = await response.text();
    console.error('Khalti verify error:', text);
    throw new Error(`Khalti verify error: ${response.status}`);
  }

  return response.json();
}

export async function refundKhaltiPaymentDirect(transactionId: string, amount: number) {
  const response = await fetch('https://dev.khalti.com/api/v2/epayment/refund/', {
    method: 'POST',
    headers: {
      'Authorization': `Key ${process.env.KHALTI_SECRET_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      transaction_id: transactionId,
      amount: amount,
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    console.error('Khalti refund error:', text);
    throw new Error(`Khalti refund error: ${response.status}`);
  }

  return response.json();
}