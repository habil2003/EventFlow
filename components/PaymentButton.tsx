'use client';

import { useState } from 'react';

interface PaymentButtonProps {
  amount: number;
  bookingId: string;
  paymentType: 'TICKET_PURCHASE' | 'VENDOR_DEPOSIT' | 'VENDOR_REMAINING';
  gateway?: 'khalti' | 'esewa';
  buttonText?: string;
  returnUrl?: string;
  onSuccess?: () => void;
  onError?: (error: string) => void;
}

interface PaymentRequestBody {
  gateway: NonNullable<PaymentButtonProps['gateway']>;
  paymentType: PaymentButtonProps['paymentType'];
  amount: number;
  bookingId: string;
  customerName: string;
  customerEmail: string;
  orderName: string;
  returnUrl: string;
  paymentIntentId?: string;
}

export default function PaymentButton({
  amount,
  bookingId,
  paymentType,
  gateway = 'khalti',
  buttonText = 'Pay Now',
  returnUrl,
  onSuccess,
  onError
}: PaymentButtonProps) {
  const [loading, setLoading] = useState(false);

  const handlePayment = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    console.log('💰 [PaymentButton] Payment button clicked');
    console.log('📍 [PaymentButton] Current window location:', window.location.href);
    console.log('📍 [PaymentButton] Window origin:', window.location.origin);
    setLoading(true);
    
    try {
      // ✅ Auto-detect base URL from window
      const baseUrl = window.location.origin;
      
      // ✅ Determine API endpoint and return URL based on payment type
      let apiUrl = '/api/payment/initiate';
      let defaultReturnUrl = `${baseUrl}/api/payment/verify`;
      
      if (paymentType === 'TICKET_PURCHASE') {
        apiUrl = '/api/tickets/confirm-payment';
        defaultReturnUrl = `${baseUrl}/api/tickets/payment-callback`;
      }
      
      const finalReturnUrl = returnUrl || defaultReturnUrl;
      
      console.log('📍 [PaymentButton] Base URL:', baseUrl);
      console.log('📍 [PaymentButton] API URL:', apiUrl);
      console.log('📍 [PaymentButton] Return URL:', finalReturnUrl);
      console.log('📍 [PaymentButton] Payment Type:', paymentType);
      console.log('📍 [PaymentButton] Booking ID:', bookingId);

      // ✅ Build request body
      const requestBody: PaymentRequestBody = {
        gateway,
        paymentType,
        amount,
        bookingId,
        customerName: '',
        customerEmail: '',
        orderName: `Booking ${bookingId}`,
        returnUrl: finalReturnUrl,
      };

      if (paymentType === 'TICKET_PURCHASE') {
        requestBody.paymentIntentId = bookingId;
      }

      console.log('📤 [PaymentButton] Sending request to:', apiUrl);
      console.log('📤 [PaymentButton] Request body:', JSON.stringify(requestBody, null, 2));

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ [PaymentButton] Server error response:', errorText);
        throw new Error(`Server returned ${response.status}`);
      }

      const data = await response.json();
      console.log('📡 [PaymentButton] API Response:', data);

      if (data.success && data.payment_url) {
        console.log('🔗 [PaymentButton] Redirecting to:', data.payment_url);
        window.location.href = data.payment_url;
      } else {
        alert('Payment initiation failed: ' + (data.error || 'Unknown error'));
        onError?.(data.error || 'Failed to initiate payment');
      }
    } catch (error) {
      console.error('❌ [PaymentButton] Payment error:', error);
      alert('An error occurred while processing payment. Please try again.');
      onError?.('An error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={handlePayment}
      disabled={loading}
      type="button"
      className="w-full py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-lg font-semibold hover:shadow-md transition-all disabled:opacity-50 disabled:cursor-not-allowed"
    >
      {loading ? (
        <span className="flex items-center justify-center gap-2">
          <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          Processing...
        </span>
      ) : buttonText}
    </button>
  );
}