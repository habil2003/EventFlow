// app/api/payment/verify/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// Khalti fee percentage from env, defaults to 0 (test environment)
// Set KHALTI_FEE_PERCENT=2 (or your actual rate) in production
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

    console.log('Payment verification:', {
      gateway,
      transactionId,
      status,
      gatewayTransactionId,
      returnUrlParam,
    });

    if (!transactionId) {
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_APP_URL}/payment/failed`,
      );
    }

    const transaction = await prisma.paymentTransaction.findUnique({
      where: { transactionId },
    });

    if (!transaction) {
      console.error('Transaction not found:', transactionId);
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_APP_URL}/payment/failed`,
      );
    }

    if (status === 'Completed') {
      console.log('Payment successful for transaction:', transactionId);

      const paidAmount = Number(transaction.amount);
      const khaltiFee = calculateKhaltiFee(paidAmount);

      // Update payment transaction — store gateway ID and fee
      await prisma.paymentTransaction.update({
        where: { id: transaction.id },
        data: {
          status: 'SUCCESS',
          gatewayTransactionId: gatewayTransactionId,
          khaltiFee: khaltiFee,
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
          console.log('✅ Vendor booking updated to DEPOSIT_PAID');
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
        console.log('✅ Vendor booking updated to FULLY_PAID');
      }

      // ── TICKET PURCHASE ─────────────────────────────────────────
      else if (transaction.paymentType === 'TICKET_PURCHASE') {
        // Find the ticket booking linked via paymentIntentId
        const ticketBooking = await prisma.ticketBooking.findFirst({
          where: { paymentIntentId: transaction.id },
        });

        if (ticketBooking) {
          await prisma.ticketBooking.update({
            where: { id: ticketBooking.id },
            data: { paymentStatus: 'HELD_IN_ESCROW' },
          });

          // ✅ FIX: Link ticketBookingId back onto the transaction
          // so admin refund queries can find it
          await prisma.paymentTransaction.update({
            where: { id: transaction.id },
            data: { ticketBookingId: ticketBooking.id },
          });

          console.log('✅ Ticket booking updated to HELD_IN_ESCROW, transaction linked');
        }
      }

      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_APP_URL}/payment/success`,
      );
    } else {
      console.log('Payment failed for transaction:', transactionId);
      await prisma.paymentTransaction.update({
        where: { id: transaction.id },
        data: { status: 'FAILED' },
      });
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_APP_URL}/payment/failed`,
      );
    }
  } catch (error) {
    console.error('Payment verification error:', error);
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}/payment/failed`,
    );
  }
}