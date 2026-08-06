// lib/payment/refund.ts

interface LookupResponse {
  transaction_id?: string;
  status?: string;
  total_amount?: number;
  mobile?: string;
  refunded?: boolean;
  amount?: number;
}

interface RefundResponse {
  detail?: string;
  error?: string;
  amount?: number;
  refund_id?: string;
}

/**
 * Process refund via Khalti Refund API
 * ✅ FIXED: Amount must be in PAISA, not NPR
 * 
 * @param pidx - The payment ID (pidx) from initiate response
 * @param amountNpr - Amount to refund in NPR (optional - omit for full refund)
 * @returns Refund result
 */
export async function processKhaltiRefund(
  pidx: string,
  amountNpr?: number
): Promise<{ success: boolean; message: string; data?: LookupResponse | RefundResponse; requiresManual?: boolean; refundId?: string }> {
  try {
    console.log('=========================================');
    console.log('💰 PROCESSING KHALTI REFUND');
    console.log('=========================================');
    console.log('PIDX:', pidx);
    if (amountNpr) console.log('Amount (NPR):', amountNpr);
    
    const isSandbox = process.env.KHALTI_ENVIRONMENT === 'sandbox';
    const baseUrl = isSandbox ? 'https://dev.khalti.com' : 'https://khalti.com';
    
    // STEP 1: Lookup transaction to get transaction_id
    console.log('📞 STEP 1: Looking up transaction...');
    const lookupResponse = await fetch(`${baseUrl}/api/v2/epayment/lookup/`, {
      method: 'POST',
      headers: {
        'Authorization': `Key ${process.env.KHALTI_SECRET_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ pidx }),
    });

    const lookupData = await lookupResponse.json();
    console.log('Lookup Response:', lookupData);

    if (!lookupResponse.ok) {
      console.error('❌ Lookup failed:', lookupData);
      
      if (isSandbox) {
        return {
          success: true,
          requiresManual: true,
          message: `Transaction lookup failed. Please process refund manually at ${baseUrl.replace('api', 'admin')}/transactions`,
        };
      }
      
      return {
        success: false,
        message: lookupData.detail || 'Failed to lookup transaction'
      };
    }

    const transactionId = lookupData.transaction_id;
    if (!transactionId) {
      console.error('❌ No transaction_id in lookup response');
      return {
        success: false,
        message: 'Could not find transaction_id for refund'
      };
    }
    
    console.log('✅ Transaction found. Transaction ID:', transactionId);
    
    // Check if already refunded
    if (lookupData.refunded === true) {
      console.log('⚠️ Transaction already refunded');
      return {
        success: true,
        message: 'Transaction already refunded',
        data: lookupData,
        requiresManual: false,
      };
    }

    // STEP 2: Process refund using transaction_id
    console.log('📞 STEP 2: Processing refund...');
    const refundUrl = `${baseUrl}/api/merchant-transaction/${transactionId}/refund/`;
    console.log('Refund URL:', refundUrl);
    
    // ✅ FIXED: Convert amount from NPR to PAISA (multiply by 100)
    const requestBody: Record<string, number> = {};
    if (amountNpr && amountNpr > 0) {
      const amountPaisa = Math.round(amountNpr * 100);
      requestBody.amount = amountPaisa; // Khalti expects amount in PAISA
      console.log(`Amount: ${amountNpr} NPR = ${amountPaisa} paisa`);
    } else {
      console.log('Processing full refund (no amount specified)');
    }

    const refundResponse = await fetch(refundUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Key ${process.env.KHALTI_SECRET_KEY}`,
        'Content-Type': 'application/json',
      },
      body: Object.keys(requestBody).length > 0 ? JSON.stringify(requestBody) : undefined,
    });

    const refundData: RefundResponse = await refundResponse.json();
    console.log('Refund Response:', refundData);

    // ✅ FIXED: Better response handling
    if (refundResponse.ok) {
      // Success case - check different response formats
      if (refundData.detail === 'Transaction refund successful.') {
        console.log('✅ Refund processed successfully!');
        return {
          success: true,
          requiresManual: false,
          message: 'Refund processed successfully',
          refundId: refundData.refund_id || `refund_${transactionId}`,
          data: refundData,
        };
      }
      
      // Some versions return amount instead of detail
      if (refundData.amount !== undefined) {
        console.log('✅ Refund processed successfully!');
        return {
          success: true,
          requiresManual: false,
          message: `Refund of NPR ${(refundData.amount / 100).toLocaleString()} processed successfully`,
          refundId: refundData.refund_id || `refund_${transactionId}`,
          data: refundData,
        };
      }
      
      // Fallback success
      return {
        success: true,
        requiresManual: false,
        message: 'Refund processed successfully',
        refundId: `refund_${transactionId}`,
        data: refundData,
      };
    }
    
    // Handle API errors
    console.error('❌ Refund API failed:', refundData);
    
    // Check if error indicates manual refund needed
    const errorMsg = refundData.detail || refundData.error || '';
    const requiresManual = errorMsg.includes('manual') || 
                          errorMsg.includes('bank') || 
                          errorMsg.includes('mobile') ||
                          isSandbox;
    
    if (isSandbox || requiresManual) {
      return {
        success: true,
        requiresManual: true,
        message: `Refund requires manual processing in Khalti dashboard. Transaction ID: ${transactionId}`,
        refundId: `manual_${transactionId}`,
      };
    }
    
    return {
      success: false,
      requiresManual: false,
      message: errorMsg || 'Refund failed',
    };
    
  } catch (error) {
    console.error('❌ Refund error:', error);
    return {
      success: false,
      requiresManual: false,
      message: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Lookup transaction to get transaction_id from pidx
 */
export async function lookupTransaction(pidx: string): Promise<{
  success: boolean;
  transactionId?: string;
  status?: string;
  amount?: number;
  mobile?: string;
  refunded?: boolean;
  error?: string;
}> {
  try {
    console.log('🔍 Looking up transaction for pidx:', pidx);
    
    const isSandbox = process.env.KHALTI_ENVIRONMENT === 'sandbox';
    const baseUrl = isSandbox ? 'https://dev.khalti.com' : 'https://khalti.com';
    
    const response = await fetch(`${baseUrl}/api/v2/epayment/lookup/`, {
      method: 'POST',
      headers: {
        'Authorization': `Key ${process.env.KHALTI_SECRET_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ pidx }),
    });

    const data: LookupResponse = await response.json();

    if (!response.ok) {
      return {
        success: false,
        error: data.status || 'Lookup failed'
      };
    }

    return {
      success: true,
      transactionId: data.transaction_id,
      status: data.status,
      amount: data.total_amount ? data.total_amount / 100 : undefined,
      mobile: data.mobile,
      refunded: data.refunded === true,
    };
  } catch (error) {
    console.error('Lookup error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Simplified refund initiation function
 */
export async function initiateRefund(
  pidx: string,
  amountNpr: number
): Promise<{ success: boolean; message: string; refundId?: string; requiresManual?: boolean }> {
  const result = await processKhaltiRefund(pidx, amountNpr);
  
  return {
    success: result.success,
    message: result.message,
    refundId: result.refundId,
    requiresManual: result.requiresManual
  };
}