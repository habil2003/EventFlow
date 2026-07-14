// app/api/payment/verify/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAppUrl } from '@/lib/app-url';

const KHALTI_FEE_PERCENT = Number(process.env.KHALTI_FEE_PERCENT || '0');

function calculateKhaltiFee(amount: number): number {
  return Math.round((amount * KHALTI_FEE_PERCENT) / 100 * 100) / 100;
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const gateway = searchParams.get('gateway');
    const transactionId = searchParams.get('transactionId');
    const status = searchParams.get('status');
    const gatewayTransactionId =
      searchParams.get('transaction_id') || searchParams.get('tidx');
    const returnUrlParam = searchParams.get('returnUrl');

    console.log('📡 [payment-verify] Request received');
    console.log('📍 [payment-verify] Request URL:', request.url);
    console.log('📊 [payment-verify] Params:', {
      gateway,
      transactionId,
      status,
      gatewayTransactionId,
      returnUrlParam,
    });

    // ✅ AUTO-DETECT: Get dynamic app URL
    const appUrl = getAppUrl(request);
    console.log('📍 [payment-verify] Auto-detected App URL:', appUrl);

    // ✅ Validate transactionId
    if (!transactionId) {
      console.error('❌ [payment-verify] Missing transactionId');
      return NextResponse.redirect(
        `${appUrl}/payment/failed?error=Missing%20transaction%20ID`
      );
    }

    // ✅ Find the transaction
    const transaction = await prisma.paymentTransaction.findUnique({
      where: { transactionId },
      include: {
        vendorBooking: {
          include: {
            vendor: true,
            user: true,
          },
        },
        ticketBooking: {
          include: {
            event: true,
            tier: true,
          },
        },
      },
    });

    if (!transaction) {
      console.error('❌ [payment-verify] Transaction not found:', transactionId);
      return NextResponse.redirect(
        `${appUrl}/payment/failed?error=Transaction%20not%20found`
      );
    }

    console.log('✅ [payment-verify] Transaction found:', transaction.id);
    console.log('📍 [payment-verify] Current status:', transaction.status);

    // ✅ Get the original return URL from the transaction
    const gatewayResponse = transaction.gatewayResponse as any;
    const originalReturnUrl = gatewayResponse?.returnUrl || `${appUrl}/my-bookings`;

    console.log('📍 [payment-verify] Original return URL:', originalReturnUrl);

    // ✅ FIX: Build proper redirect URLs using existing pages
    let successRedirectUrl = `${appUrl}/payment/success`;
    let failedRedirectUrl = `${appUrl}/payment/failed`;

    // Extract bookingId from returnUrlParam if present
    if (returnUrlParam) {
      try {
        const url = new URL(returnUrlParam, appUrl);
        const bookingId = url.searchParams.get('bookingId');
        if (bookingId) {
          successRedirectUrl = `${appUrl}/payment/success?bookingId=${bookingId}`;
          failedRedirectUrl = `${appUrl}/payment/failed?bookingId=${bookingId}`;
        }
      } catch (e) {
        console.warn('⚠️ [payment-verify] Could not parse returnUrl:', returnUrlParam);
      }
    }

    // Also check if the originalReturnUrl has bookingId
    if (originalReturnUrl && originalReturnUrl.includes('bookingId=')) {
      const bookingIdMatch = originalReturnUrl.match(/bookingId=([^&?]+)/);
      if (bookingIdMatch && bookingIdMatch[1]) {
        successRedirectUrl = `${appUrl}/payment/success?bookingId=${bookingIdMatch[1]}`;
        failedRedirectUrl = `${appUrl}/payment/failed?bookingId=${bookingIdMatch[1]}`;
      }
    }

    // ✅ Check if already processed
    if (transaction.status === 'SUCCESS') {
      console.log('✅ [payment-verify] Transaction already processed:', transactionId);
      return NextResponse.redirect(
        `${successRedirectUrl}&payment=already_processed`
      );
    }

    if (status === 'Completed') {
      console.log('✅ [payment-verify] Payment successful for transaction:', transactionId);

      const paidAmount = Number(transaction.amount);
      const khaltiFee = calculateKhaltiFee(paidAmount);

      // ✅ Update payment transaction
      await prisma.paymentTransaction.update({
        where: { id: transaction.id },
        data: {
          status: 'SUCCESS',
          gatewayTransactionId: gatewayTransactionId,
          khaltiFee: khaltiFee,
          gatewayResponse: { 
            status, 
            gateway, 
            gatewayTransactionId,
            returnUrl: returnUrlParam,
          },
        },
      });

      // ── VENDOR DEPOSIT ──────────────────────────────────────────
      if (
        transaction.paymentType === 'VENDOR_DEPOSIT' &&
        transaction.vendorBookingId
      ) {
        const booking = await prisma.vendorBooking.findUnique({
          where: { id: transaction.vendorBookingId },
        });

        if (booking) {
          const depositAmount = paidAmount;
          const remainingAmount = Number(booking.totalAmount) - depositAmount;

          await prisma.vendorBooking.update({
            where: { id: transaction.vendorBookingId },
            data: {
              vendorPaymentStatus: 'DEPOSIT_PAID',
              depositTxId: gatewayTransactionId,
              depositPaidAt: new Date(),
              depositAmount: depositAmount,
              remainingAmount: remainingAmount,
              paymentStatus: 'HELD_IN_ESCROW',
            },
          });
          console.log('✅ [payment-verify] Vendor booking updated to DEPOSIT_PAID');
        }
      }

      // ── VENDOR REMAINING ────────────────────────────────────────
      else if (
        transaction.paymentType === 'VENDOR_REMAINING' &&
        transaction.vendorBookingId
      ) {
        await prisma.vendorBooking.update({
          where: { id: transaction.vendorBookingId },
          data: {
            vendorPaymentStatus: 'FULLY_PAID',
            remainingTxId: gatewayTransactionId,
            remainingPaidAt: new Date(),
            paymentStatus: 'HELD_IN_ESCROW',
          },
        });
        console.log('✅ [payment-verify] Vendor booking updated to FULLY_PAID');
      }

      // ── TICKET PURCHASE ─────────────────────────────────────────
      else if (transaction.paymentType === 'TICKET_PURCHASE') {
        const ticketBooking = await prisma.ticketBooking.findFirst({
          where: { paymentIntentId: transaction.id },
          include: {
            event: true,
            tier: true,
          },
        });

        if (ticketBooking) {
          await prisma.ticketBooking.update({
            where: { id: ticketBooking.id },
            data: { 
              paymentStatus: 'HELD_IN_ESCROW',
            },
          });

          await prisma.paymentTransaction.update({
            where: { id: transaction.id },
            data: { ticketBookingId: ticketBooking.id },
          });

          console.log('✅ [payment-verify] Ticket booking updated to HELD_IN_ESCROW, transaction linked');
        }
      }

      // ✅ Redirect to success page
      console.log('🔗 [payment-verify] Redirecting to:', successRedirectUrl);
      return NextResponse.redirect(
        successRedirectUrl
      );
    } else {
      console.log('❌ [payment-verify] Payment failed for transaction:', transactionId);
      
      await prisma.paymentTransaction.update({
        where: { id: transaction.id },
        data: { 
          status: 'FAILED',
          gatewayResponse: { status, gateway, gatewayTransactionId, error: 'Payment failed' },
        },
      });

      if (transaction.paymentType === 'TICKET_PURCHASE') {
        const deleted = await prisma.ticketBooking.deleteMany({
          where: { paymentIntentId: transaction.id },
        });
        console.log(`🗑️ [payment-verify] Deleted ${deleted.count} pending tickets`);
      }

      // ✅ Redirect to failed page
      console.log('🔗 [payment-verify] Redirecting to failed:', failedRedirectUrl);
      return NextResponse.redirect(
        failedRedirectUrl
      );
    }
  } catch (error) {
    console.error('❌ [payment-verify] Error:', error);
    const appUrl = getAppUrl(request);
    return NextResponse.redirect(
      `${appUrl}/payment/failed?error=Server%20error`
    );
  }
}