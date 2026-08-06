// app/api/user/cancel-booking/route.ts

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

const KHALTI_FEE_PERCENT = Number(process.env.KHALTI_FEE_PERCENT || '0');

export function calculateRefundPercentage(eventDate: Date): number {
  const now = new Date();
  const daysUntilEvent = Math.ceil(
    (eventDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
  );
  if (daysUntilEvent >= 7) return 100;
  if (daysUntilEvent >= 3) return 50;
  return 0;
}

export function calculateRefundAmount(
  paidAmount: number,
  khaltiFee: number,
  refundPercentage: number,
): { refundAmount: number; platformKeeps: number } {
  if (refundPercentage === 0) {
    return { refundAmount: 0, platformKeeps: paidAmount };
  }

  if (refundPercentage === 100) {
    const refundAmount = Math.max(0, paidAmount - khaltiFee);
    const platformKeeps = khaltiFee;
    return { refundAmount, platformKeeps };
  }

  const refundAmount = Math.round((paidAmount * refundPercentage) / 100 * 100) / 100;
  const platformKeeps = paidAmount - refundAmount;
  return { refundAmount, platformKeeps };
}

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { bookingId, bookingType, reason } = await request.json();

    if (!bookingId || !bookingType) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 },
      );
    }

    // ── VENDOR BOOKING CANCELLATION ──────────────────────────────
    if (bookingType === 'VENDOR') {
      const booking = await prisma.vendorBooking.findFirst({
        where: {
          id: bookingId,
          userId: session.user.id,
          bookingStatus: { in: ['PENDING', 'ACCEPTED'] },
          // ✅ SECURITY/FINANCE: Never allow cancelling a booking whose funds
          // have already been released to the vendor — otherwise a refund
          // could be created for money that is no longer held by the platform.
          amountReleasedAt: null,
        },
        include: {
          paymentTransactions: {
            where: { status: 'COMPLETED' }, // ✅ FIXED: Use 'COMPLETED' instead of 'SUCCESS'
            orderBy: { createdAt: 'desc' },
          },
          userSocialEvent: true,
        },
      });

      if (!booking) {
        return NextResponse.json(
          { error: 'Booking not found or cannot be cancelled' },
          { status: 404 },
        );
      }

      const depositTransaction = booking.paymentTransactions.find(
        (t) => t.paymentType === 'VENDOR_DEPOSIT',
      );

      const hasDeposit = !!depositTransaction;
      const depositAmount = hasDeposit
        ? Number(depositTransaction!.amount)
        : Number(booking.depositAmount) || Number(booking.totalAmount) * 0.2;

      const khaltiFee = hasDeposit
        ? Number(depositTransaction!.khaltiFee)
        : 0;

      const eventDate = booking.userSocialEvent.eventDate;
      const refundPercentage = hasDeposit
        ? calculateRefundPercentage(eventDate)
        : 0;

      const { refundAmount, platformKeeps } = calculateRefundAmount(
        depositAmount,
        khaltiFee,
        refundPercentage,
      );

      await prisma.vendorBooking.update({
        where: { id: bookingId },
        data: {
          bookingStatus: 'DECLINED',
          cancelledBy: 'CUSTOMER',
          cancellationReason: reason || 'Customer cancelled booking',
          cancelledAt: new Date(),
          vendorPaymentStatus: hasDeposit
            ? refundAmount > 0
              ? 'REFUNDED'
              : 'DEPOSIT_PAID'
            : 'PENDING',
          paymentStatus: hasDeposit
            ? refundAmount > 0
              ? 'REFUNDED'
              : 'COMPLETED'
            : 'FAILED',
        },
      });

      if (hasDeposit && refundAmount > 0) {
        await prisma.refund.create({
          data: {
            originalTransactionId: depositTransaction!.transactionId,
            refundAmount: refundAmount,
            refundReason:
              reason ||
              `Customer cancelled booking. ${refundPercentage}% refund applied.`,
            refundStatus: 'PENDING_ADMIN',
            paymentTransactionId: depositTransaction!.id,
            vendorBookingId: booking.id,
            gatewayResponse: {
              refundPercentage,
              depositAmount,
              khaltiFee,
              refundAmount,
              platformKeeps,
              daysUntilEvent: Math.ceil(
                (eventDate.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24),
              ),
              cancelledAt: new Date().toISOString(),
              cancelledBy: session.user.email,
              reason: reason || 'No reason provided',
            },
          },
        });
      }

      let message = '';
      if (!hasDeposit) {
        message = 'Booking cancelled successfully. No payment was made, so no refund is due.';
      } else if (refundPercentage === 0) {
        message = `Booking cancelled. No refund available — cancellation was less than 3 days before the event.`;
      } else if (refundPercentage === 100) {
        message = `Booking cancelled. Full refund of NPR ${refundAmount.toLocaleString()} will be processed within 3-7 business days.`;
      } else {
        message = `Booking cancelled. Partial refund of NPR ${refundAmount.toLocaleString()} (${refundPercentage}%) will be processed within 3-7 business days.`;
      }

      return NextResponse.json({
        success: true,
        message,
        refund: hasDeposit
          ? {
              amount: refundAmount,
              percentage: refundPercentage,
              platformKeeps,
              khaltiFee,
              eligible: refundAmount > 0,
            }
          : null,
      });
    }

    // ── TICKET BOOKING CANCELLATION ──────────────────────────────
    if (bookingType === 'TICKET') {
      const ticket = await prisma.ticketBooking.findFirst({
        where: {
          id: bookingId,
          userId: session.user.id,
          paymentStatus: 'HELD_IN_ESCROW',
          checkedIn: false,
        },
        include: {
          event: true,
          tier: true,
          paymentTransactions: {
            where: { status: 'COMPLETED' }, // ✅ FIXED: Use 'COMPLETED' instead of 'SUCCESS'
            orderBy: { createdAt: 'desc' },
          },
        },
      });

      if (!ticket) {
        return NextResponse.json(
          { error: 'Ticket not found or cannot be cancelled' },
          { status: 404 },
        );
      }

      if (new Date(ticket.event.eventDate) < new Date()) {
        return NextResponse.json(
          { error: 'Cannot cancel tickets for past events' },
          { status: 400 },
        );
      }

      const ticketTransaction = ticket.paymentTransactions[0];
      const paidAmount = Number(ticket.totalAmount);
      const khaltiFee = ticketTransaction
        ? Number(ticketTransaction.khaltiFee)
        : 0;

      const refundPercentage = calculateRefundPercentage(ticket.event.eventDate);
      const { refundAmount, platformKeeps } = calculateRefundAmount(
        paidAmount,
        khaltiFee,
        refundPercentage,
      );

      await prisma.ticketBooking.update({
        where: { id: bookingId },
        data: {
          paymentStatus: refundAmount > 0 ? 'REFUNDED' : 'COMPLETED',
        },
      });

      await prisma.ticketTier.update({
        where: { id: ticket.tierId },
        data: { soldCount: { decrement: ticket.quantity } },
      });

      if (refundAmount > 0 && ticketTransaction) {
        await prisma.refund.create({
          data: {
            originalTransactionId: ticketTransaction.transactionId,
            refundAmount: refundAmount,
            refundReason:
              reason ||
              `Customer cancelled ticket. ${refundPercentage}% refund applied.`,
            refundStatus: 'PENDING_ADMIN',
            paymentTransactionId: ticketTransaction.id,
            ticketBookingId: ticket.id,
            gatewayResponse: {
              refundPercentage,
              paidAmount,
              khaltiFee,
              refundAmount,
              platformKeeps,
              daysUntilEvent: Math.ceil(
                (ticket.event.eventDate.getTime() - new Date().getTime()) /
                  (1000 * 60 * 60 * 24),
              ),
              cancelledAt: new Date().toISOString(),
              cancelledBy: session.user.email,
              reason: reason || 'No reason provided',
            },
          },
        });
      }

      let message = '';
      if (refundPercentage === 0) {
        message = `Ticket cancelled. No refund available — cancellation was less than 3 days before the event.`;
      } else if (refundPercentage === 100) {
        message = `Ticket cancelled. Full refund of NPR ${refundAmount.toLocaleString()} will be processed within 3-7 business days.`;
      } else {
        message = `Ticket cancelled. Partial refund of NPR ${refundAmount.toLocaleString()} (${refundPercentage}%) will be processed within 3-7 business days.`;
      }

      return NextResponse.json({
        success: true,
        message,
        refund: {
          amount: refundAmount,
          percentage: refundPercentage,
          platformKeeps,
          khaltiFee,
          eligible: refundAmount > 0,
        },
      });
    }

    return NextResponse.json({ error: 'Invalid booking type' }, { status: 400 });
  } catch (error) {
    console.error('Error cancelling booking:', error);
    return NextResponse.json(
      { error: 'Failed to cancel booking' },
      { status: 500 },
    );
  }
}