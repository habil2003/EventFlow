// lib/payment/khalti.ts

interface InitiatePaymentParams {
  amount: number;
  transactionId: string;
  returnUrl: string;
  websiteUrl?: string;
  productName: string;
  customerName: string;
  customerEmail: string;
}

interface KhaltiResponse {
  pidx?: string;
  payment_url?: string;
  expires_at?: string;
  expires_in?: number;
  detail?: string;
  error?: string;
}

/**
 * Initiate Khalti payment for ticket purchases
 */
export async function initiateKhaltiPayment(params: InitiatePaymentParams): Promise<{
  success: boolean;
  payment_url?: string;
  pidx?: string;
  error?: string;
}> {
  try {
    const amountInPaisa = params.amount * 100;
    
    // ✅ Use provided websiteUrl or extract from returnUrl
    const websiteUrl = params.websiteUrl || new URL(params.returnUrl).origin;
    
    const isSandbox = process.env.KHALTI_ENVIRONMENT === 'sandbox';
    const apiUrl = isSandbox 
      ? 'https://dev.khalti.com/api/v2/epayment/initiate/'
      : 'https://khalti.com/api/v2/epayment/initiate/';

    console.log('🔗 [khalti] Return URL:', params.returnUrl);
    console.log('🔗 [khalti] Website URL:', websiteUrl);
    console.log('🔗 [khalti] Amount (paisa):', amountInPaisa);
    console.log('🔗 [khalti] Transaction ID:', params.transactionId);
    console.log('🔗 [khalti] Product:', params.productName);

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Key ${process.env.KHALTI_SECRET_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        return_url: params.returnUrl,
        website_url: websiteUrl,
        amount: amountInPaisa,
        purchase_order_id: params.transactionId,
        purchase_order_name: params.productName,
        customer_info: {
          name: params.customerName,
          email: params.customerEmail,
        },
      }),
    });

    const data: KhaltiResponse = await response.json();
    
    console.log('📡 [khalti] Khalti Response:', data);
    
    if (response.ok && data.pidx) {
      return {
        success: true,
        payment_url: data.payment_url,
        pidx: data.pidx,
      };
    } else {
      return {
        success: false,
        error: data.detail || data.error || 'Payment initiation failed',
      };
    }
  } catch (error) {
    console.error('❌ [khalti] Payment initiation error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Verify Khalti payment status
 */
export async function verifyKhaltiPayment(pidx: string): Promise<{
  success: boolean;
  status?: string;
  transactionId?: string;
  amount?: number;
}> {
  try {
    const isSandbox = process.env.KHALTI_ENVIRONMENT === 'sandbox';
    const apiUrl = isSandbox 
      ? 'https://dev.khalti.com/api/v2/epayment/lookup/'
      : 'https://khalti.com/api/v2/epayment/lookup/';

    console.log('🔗 [khalti] Verifying payment:', pidx);

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Key ${process.env.KHALTI_SECRET_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ pidx }),
    });

    const data = await response.json();
    
    console.log('📡 [khalti] Verification response:', data);
    
    if (response.ok) {
      return {
        success: true,
        status: data.status,
        transactionId: data.transaction_id,
        amount: data.total_amount ? data.total_amount / 100 : undefined,
      };
    } else {
      return {
        success: false,
      };
    }
  } catch (error) {
    console.error('❌ [khalti] Verification error:', error);
    return { success: false };
  }
}