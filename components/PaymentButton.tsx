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
    
    console.log('Payment button clicked');
    setLoading(true);
    
    try {
      // Send the URL as-is without any encoding
      const finalReturnUrl = returnUrl || window.location.href;
      
      console.log('Sending return URL:', finalReturnUrl);

      const response = await fetch('/api/payment/initiate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          gateway,
          paymentType,
          amount,
          bookingId,
          customerName: '',
          customerEmail: '',
          orderName: `Booking ${bookingId}`,
          returnUrl: finalReturnUrl  // No encoding!
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Server error response:', errorText);
        throw new Error(`Server returned ${response.status}`);
      }

      const data = await response.json();
      console.log('API Response:', data);

      if (data.success && data.payment_url) {
        window.location.href = data.payment_url;
      } else {
        alert('Payment initiation failed: ' + (data.error || 'Unknown error'));
        onError?.(data.error || 'Failed to initiate payment');
      }
    } catch (error) {
      console.error('Payment error:', error);
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
      {loading ? 'Processing...' : buttonText}
    </button>
  );
}