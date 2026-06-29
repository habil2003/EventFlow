import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

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
        // ✅ FIXED: include ticketBooking
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

      // Build a unified booking shape for both types
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