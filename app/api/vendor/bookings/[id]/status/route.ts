// app/api/vendor/bookings/[id]/status/route.ts

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    const { id } = await params;

    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (session.user.role !== 'VENDOR') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const vendor = await prisma.vendorProfile.findUnique({
      where: { userId: session.user.id },
    });

    if (!vendor) {
      return NextResponse.json({ error: 'Vendor not found' }, { status: 404 });
    }

    const { status } = await request.json();

    const allowedStatuses = ['ACCEPTED', 'DECLINED', 'COMPLETED'];
    if (!allowedStatuses.includes(status)) {
      return NextResponse.json(
        { error: 'Invalid status', allowed: allowedStatuses },
        { status: 400 }
      );
    }

    const booking = await prisma.vendorBooking.findFirst({
      where: {
        id: id,
        vendorId: vendor.id,
      },
      include: {
        paymentTransactions: true,
        userSocialEvent: true,
        user: true,
        payouts: true,
      },
    });

    if (!booking) {
      return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
    }

    // ── STATE TRANSITION VALIDATION ──────────────────────────────
    const transitionRules: Record<string, { from: string[] }> = {
      ACCEPTED: { from: ['PENDING'] },
      DECLINED: { from: ['PENDING', 'ACCEPTED'] },
      COMPLETED: { from: ['ACCEPTED'] },
    };

    const rule = transitionRules[status];
    if (!rule || !rule.from.includes(booking.bookingStatus)) {
      return NextResponse.json(
        { 
          error: `Cannot transition from ${booking.bookingStatus} to ${status}`,
          currentStatus: booking.bookingStatus,
          allowedFrom: rule?.from || []
        },
        { status: 400 }
      );
    }

    // ── ACCEPTED ──────────────────────────────────────────────────
    if (status === 'ACCEPTED') {
      if (booking.vendorPaymentStatus !== 'DEPOSIT_PAID' && 
          booking.vendorPaymentStatus !== 'FULLY_PAID') {
        return NextResponse.json(
          { 
            error: 'Cannot accept booking until deposit is paid',
            currentPaymentStatus: booking.vendorPaymentStatus
          },
          { status: 400 }
        );
      }

      const updatedBooking = await prisma.vendorBooking.update({
        where: { id: booking.id },
        data: { bookingStatus: 'ACCEPTED' },
      });

      return NextResponse.json({
        success: true,
        booking: updatedBooking,
        message: 'Booking accepted successfully.',
      });
    }

    // ── DECLINED ──────────────────────────────────────────────────
    if (status === 'DECLINED') {
      const depositTransaction = booking.paymentTransactions.find(
        (t) => t.paymentType === 'VENDOR_DEPOSIT' && t.status === 'COMPLETED'
      );

      const updatedBooking = await prisma.vendorBooking.update({
        where: { id: booking.id },
        data: {
          bookingStatus: 'DECLINED',
          vendorPaymentStatus: depositTransaction ? 'REFUNDED' : 'PENDING',
          paymentStatus: depositTransaction ? 'REFUNDED' : 'FAILED',
          cancelledBy: 'VENDOR',
          cancellationReason: 'Vendor declined the booking',
          cancelledAt: new Date(),
        },
      });

      if (depositTransaction) {
        const depositAmount = booking.depositAmount 
          ? Number(booking.depositAmount) 
          : Number(booking.totalAmount) * 0.2;

        await prisma.refund.create({
          data: {
            originalTransactionId: depositTransaction.transactionId,
            refundAmount: depositAmount,
            refundReason: 'Vendor declined booking - Full refund',
            refundStatus: 'PROCESSED', // ✅ Auto-processed for vendor declines
            paymentTransactionId: depositTransaction.id,
            vendorBookingId: booking.id,
            gatewayResponse: {
              method: 'KHALTI_API',
              refundPercentage: 100,
              processedBy: 'System (Vendor Decline)',
              processedAt: new Date().toISOString(),
            },
          },
        });
      }

      return NextResponse.json({
        success: true,
        booking: updatedBooking,
        message: depositTransaction 
          ? 'Booking declined. Refund has been initiated automatically.' 
          : 'Booking declined. No payment was made, so no refund is due.',
        refund: depositTransaction ? {
          amount: Number(booking.depositAmount || Number(booking.totalAmount) * 0.2),
          status: 'PROCESSED',
        } : null,
      });
    }

    // ── COMPLETED ──────────────────────────────────────────────────
    if (status === 'COMPLETED') {
      if (!booking.depositPaidAt) {
        return NextResponse.json(
          { error: 'Cannot mark as completed. Deposit not paid.' },
          { status: 400 }
        );
      }

      if (booking.bookingStatus !== 'ACCEPTED') {
        return NextResponse.json(
          { 
            error: 'Booking must be ACCEPTED before marking as COMPLETED',
            currentStatus: booking.bookingStatus
          },
          { status: 400 }
        );
      }

      if (booking.vendorMarkedComplete) {
        return NextResponse.json(
          { error: 'Booking already marked as completed by vendor' },
          { status: 400 }
        );
      }

      const updatedBooking = await prisma.vendorBooking.update({
        where: { id: booking.id },
        data: {
          vendorMarkedComplete: true,
          bookingStatus: 'COMPLETED',
        },
      });

      // ✅ Check if customer already confirmed
      if (booking.customerConfirmed) {
        await prisma.vendorBooking.update({
          where: { id: booking.id },
          data: { vendorPaymentStatus: 'FULLY_PAID' },
        });

        const remainingAmount = booking.remainingAmount 
          ? Number(booking.remainingAmount) 
          : Number(booking.totalAmount) * 0.8;

        if (remainingAmount > 0) {
          await prisma.payout.create({
            data: {
              bookingId: booking.id,
              vendorId: vendor.id,
              amount: remainingAmount,
              type: 'REMAINING',
              status: 'PENDING',
              notes: `Auto-created after vendor completion and customer confirmation.`,
            },
          });
        }

        return NextResponse.json({
          success: true,
          booking: updatedBooking,
          message: 'Service marked as completed. Customer has already confirmed. Payout will be processed by admin.',
          payoutInitiated: true,
        });
      }

      return NextResponse.json({
        success: true,
        booking: updatedBooking,
        message: 'Service marked as completed. Waiting for customer confirmation.',
        awaitingCustomerConfirmation: true,
      });
    }

    return NextResponse.json(
      { error: 'Invalid status transition' },
      { status: 400 }
    );

  } catch (error) {
    console.error('Error updating booking status:', error);
    return NextResponse.json(
      { error: 'Failed to update booking' },
      { status: 500 }
    );
  }
}