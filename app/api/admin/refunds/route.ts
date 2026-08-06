import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

// ✅ Helper: Calculate refund percentage from amount
function calculateRefundPercentageFromAmount(refundAmount: number, totalAmount: number): number | null {
  if (!totalAmount || totalAmount === 0) return null;
  return Math.round((refundAmount / totalAmount) * 100);
}

// ✅ Helper: Calculate days between two dates
function calculateDaysUntilEvent(eventDate: Date, cancellationDate: Date): number {
  const diffTime = eventDate.getTime() - cancellationDate.getTime();
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

// ✅ Helper: Get refund percentage based on days until event
function getRefundPercentageFromPolicy(daysUntilEvent: number): number {
  if (daysUntilEvent >= 7) return 100;
  if (daysUntilEvent >= 3) return 50;
  return 0;
}

export async function GET() {
  try {
    const session = await getServerSession(authOptions);

    if (!session || session.user?.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const refunds = await prisma.refund.findMany({
      include: {
        vendorBooking: {
          include: {
            vendor: true,
            user: true,
            servicePackage: true,
            userSocialEvent: true,
          },
        },
        ticketBooking: {
          include: {
            user: true,
            event: true,
            tier: true,
          },
        },
        paymentTransaction: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    const formattedRefunds = refunds.map((refund) => {
      const isTicketRefund = !!refund.ticketBookingId;

      // ✅ Calculate refund percentage
      let refundPercentage: number | null = null;
      let daysUntilEvent: number | null = null;

      const refundAmount = Number(refund.refundAmount);
      
      // Get total amount from booking
      let totalAmount: number | null = null;
      let eventDate: Date | null = null;
      let cancelledBy: string | null = null;

      if (isTicketRefund && refund.ticketBooking) {
        totalAmount = Number(refund.ticketBooking.totalAmount);
        eventDate = refund.ticketBooking.event?.eventDate || null;
        cancelledBy = 'CUSTOMER';
      } else if (refund.vendorBooking) {
        totalAmount = refund.vendorBooking.depositAmount 
          ? Number(refund.vendorBooking.depositAmount)
          : refund.vendorBooking.totalAmount 
            ? Number(refund.vendorBooking.totalAmount)
            : null;
        eventDate = refund.vendorBooking.userSocialEvent?.eventDate || null;
        cancelledBy = refund.vendorBooking.cancelledBy || null;
      }

      // ✅ 1. Check if percentage is in gatewayResponse
      const gatewayRefundPercentage = (refund.gatewayResponse as unknown as { refundPercentage?: number } | null)?.refundPercentage;
      if (gatewayRefundPercentage !== undefined && gatewayRefundPercentage !== null) {
        refundPercentage = gatewayRefundPercentage;
      }

      // ✅ 2. Calculate from amounts
      if (refundPercentage === null && refundAmount && totalAmount && totalAmount > 0) {
        refundPercentage = calculateRefundPercentageFromAmount(refundAmount, totalAmount);
      }

      // ✅ 3. For vendor declines, it's always 100%
      if (refundPercentage === null && cancelledBy === 'VENDOR') {
        refundPercentage = 100;
      }

      // ✅ 4. Calculate from days until event
      if (refundPercentage === null && eventDate) {
        const cancellationDate = refund.createdAt || new Date();
        daysUntilEvent = calculateDaysUntilEvent(eventDate, cancellationDate);
        refundPercentage = getRefundPercentageFromPolicy(daysUntilEvent);
      }

      // Build unified booking shape
      const booking = isTicketRefund
        ? {
            id: refund.ticketBooking?.id,
            type: 'TICKET' as const,
            eventTitle: refund.ticketBooking?.event?.title,
            eventDate: refund.ticketBooking?.event?.eventDate,
            totalAmount: refund.ticketBooking?.totalAmount,
            vendorName: null,
            customerName: refund.ticketBooking?.user?.name,
            customerEmail: refund.ticketBooking?.user?.email,
            packageName: refund.ticketBooking?.tier?.name,
          }
        : {
            id: refund.vendorBooking?.id,
            type: 'VENDOR' as const,
            eventTitle: refund.vendorBooking?.userSocialEvent?.title,
            eventDate: refund.vendorBooking?.userSocialEvent?.eventDate,
            totalAmount: refund.vendorBooking?.totalAmount,
            vendorName: refund.vendorBooking?.vendor?.businessName,
            customerName: refund.vendorBooking?.user?.name,
            customerEmail: refund.vendorBooking?.user?.email,
            packageName: refund.vendorBooking?.servicePackage?.name,
          };

      return {
        id: refund.id,
        originalTransactionId: refund.originalTransactionId,
        refundAmount: refund.refundAmount,
        refundReason: refund.refundReason,
        refundStatus: refund.refundStatus,
        gatewayRefundId: refund.gatewayRefundId,
        gatewayResponse: refund.gatewayResponse,
        createdAt: refund.createdAt,
        processedAt: refund.processedAt,
        cancelledBy: refund.vendorBooking?.cancelledBy ?? null,
        cancellationReason: refund.vendorBooking?.cancellationReason ?? null,
        // ✅ ADD: Refund percentage and related fields
        refundPercentage,
        daysUntilEvent,
        totalAmount,
        booking,
        paymentTransaction: {
          id: refund.paymentTransaction?.id,
          transactionId: refund.paymentTransaction?.transactionId,
          gatewayTransactionId: refund.paymentTransaction?.gatewayTransactionId,
          amount: refund.paymentTransaction?.amount,
          khaltiFee: refund.paymentTransaction?.khaltiFee,
        },
      };
    });

    return NextResponse.json({ refunds: formattedRefunds });
  } catch (error) {
    console.error('Error fetching refunds:', error);
    return NextResponse.json(
      { error: 'Failed to fetch refunds' },
      { status: 500 },
    );
  }
}