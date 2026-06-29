import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

const KHALTI_FEE_PERCENT = Number(process.env.KHALTI_FEE_PERCENT || '0');

function calculateRefundPercentage(eventDate: Date): number {
  const now = new Date();
  const daysUntilEvent = Math.ceil(
    (eventDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
  );
  if (daysUntilEvent >= 7) return 100;
  if (daysUntilEvent >= 3) return 50;
  return 0;
}

// For full refunds only: deduct the Khalti fee the platform already paid
// For partial refunds: platform keeps enough to absorb the fee
function calculateRefundAmount(
  paidAmount: number,
  khaltiFee: number,
  refundPercentage: number,
): { refundAmount: number; platformKeeps: number } {
  if (refundPercentage === 0) {
    return { refundAmount: 0, platformKeeps: paidAmount };
  }

  if (refundPercentage === 100) {
    // Platform already paid Khalti their fee, so we can only refund what we received
    const refundAmount = Math.max(0, paidAmount - khaltiFee);
    const platformKeeps = khaltiFee; // Platform keeps only to cover the fee
    return { refundAmount, platformKeeps };
  }

  // Partial refund (50%): straightforward split, fee absorbed by platform's kept portion
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
          // ✅ Allow cancellation of both PENDING and ACCEPTED bookings
          bookingStatus: { in: ['PENDING', 'ACCEPTED'] },
        },
        include: {
          paymentTransactions: {
            where: { status: 'SUCCESS' },
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

      // Find the deposit transaction (if any)
      const depositTransaction = booking.paymentTransactions.find(
        (t) => t.paymentType === 'VENDOR_DEPOSIT',
      );

      const hasDeposit = !!depositTransaction;
      const depositAmount = hasDeposit
        ? Number(depositTransaction!.amount)
        : Number(booking.depositAmount) || Number(booking.totalAmount) * 0.2;

      // Khalti fee stored at transaction time (0 in test env)
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

      const daysUntilEvent = Math.ceil(
        (eventDate.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24),
      );

      // Update booking status
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
              : 'DEPOSIT_PAID' // Kept by platform per policy
            : 'PENDING',
          paymentStatus: hasDeposit
            ? refundAmount > 0
              ? 'REFUNDED'
              : 'COMPLETED'
            : 'FAILED',
        },
      });

      // ✅ Only create refund record if money is actually owed back
      if (hasDeposit && refundAmount > 0) {
        await prisma.refund.create({
          data: {
            originalTransactionId: depositTransaction!.transactionId,
            refundAmount: refundAmount,
            refundReason:
              reason ||
              `Customer cancelled booking. ${refundPercentage}% refund applied.`,
            refundStatus: 'PENDING_ADMIN', // ✅ FIXED: was 'PENDING'
            paymentTransactionId: depositTransaction!.id,
            vendorBookingId: booking.id,
            gatewayResponse: {
              refundPercentage,
              depositAmount,
              khaltiFee,
              refundAmount,
              platformKeeps,
              daysUntilEvent,
              cancelledAt: new Date().toISOString(),
              cancelledBy: session.user.email,
              reason: reason || 'No reason provided',
            },
          },
        });
      }

      // Build response message
      let message = '';
      if (!hasDeposit) {
        message =
          'Booking cancelled successfully. No payment was made, so no refund is due.';
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
            where: { status: 'SUCCESS' },
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

      const daysUntilEvent = Math.ceil(
        (ticket.event.eventDate.getTime() - new Date().getTime()) /
          (1000 * 60 * 60 * 24),
      );

      // Update ticket status
      await prisma.ticketBooking.update({
        where: { id: bookingId },
        data: {
          paymentStatus: refundAmount > 0 ? 'REFUNDED' : 'COMPLETED',
        },
      });

      // Restore ticket tier inventory
      await prisma.ticketTier.update({
        where: { id: ticket.tierId },
        data: { soldCount: { decrement: ticket.quantity } },
      });

      // ✅ Only create refund record if money is actually owed back
      if (refundAmount > 0 && ticketTransaction) {
        await prisma.refund.create({
          data: {
            originalTransactionId:
              ticketTransaction.transactionId,
            refundAmount: refundAmount,
            refundReason:
              reason ||
              `Customer cancelled ticket. ${refundPercentage}% refund applied.`,
            refundStatus: 'PENDING_ADMIN', // ✅ FIXED: was 'PENDING'
            paymentTransactionId: ticketTransaction.id,
            ticketBookingId: ticket.id,
            gatewayResponse: {
              refundPercentage,
              paidAmount,
              khaltiFee,
              refundAmount,
              platformKeeps,
              daysUntilEvent,
              cancelledAt: new Date().toISOString(),
              cancelledBy: session.user.email,
              reason: reason || 'No reason provided',
            },
          },
        });
      }

      // Build response message
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