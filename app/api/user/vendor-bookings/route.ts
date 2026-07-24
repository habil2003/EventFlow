import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);

    if (!session || !session.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const bookings = await prisma.vendorBooking.findMany({
      where: {
        userId: session.user.id,
      },
      include: {
        vendor: true,
        servicePackage: true,
        userSocialEvent: true,
        payouts: true,  // ✅ ADDED: Include payouts
        refunds: {
          take: 1,
          orderBy: {
            createdAt: "desc",
          },
          include: {
            paymentTransaction: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    const formattedBookings = bookings.map((booking) => {
      const refund = booking.refunds[0];
      
      // ✅ Get payout information
      const payouts = booking.payouts || [];
      const depositPayout = payouts.find(p => p.type === 'DEPOSIT' && p.status === 'COMPLETED');
      const remainingPayout = payouts.find(p => p.type === 'REMAINING' && p.status === 'COMPLETED');
      const pendingPayouts = payouts.filter(p => p.status === 'PENDING');
      
      const depositReleased = !!depositPayout;
      const remainingReleased = !!remainingPayout;
      const fullyReleased = depositReleased && remainingReleased;
      const hasPendingPayout = pendingPayouts.length > 0;

      // ✅ Extract refund details
      let refundMethod = null;
      let refundReference = null;
      let refundProcessedBy = null;
      let refundProcessedAt = null;
      let refundPercentage = null;
      let refundKhaltiFee = null;
      let refundPlatformKeeps = null;

      if (refund?.gatewayResponse) {
        const gatewayResponse = refund.gatewayResponse as any;
        
        if (gatewayResponse.method === 'KHALTI_API') {
          refundMethod = 'KHALTI_API';
          refundReference = refund.gatewayRefundId;
          refundProcessedBy = gatewayResponse.processedBy || 'System';
          refundProcessedAt = gatewayResponse.processedAt || refund.processedAt;
          refundPercentage = gatewayResponse.refundPercentage;
          refundKhaltiFee = gatewayResponse.khaltiFee;
          refundPlatformKeeps = gatewayResponse.platformKeeps;
        } 
        else if (gatewayResponse.method === 'MANUAL' && gatewayResponse.transferMethod) {
          switch (gatewayResponse.transferMethod) {
            case 'BANK_TRANSFER':
              refundMethod = 'BANK_TRANSFER';
              break;
            case 'KHALTI_MANUAL':
              refundMethod = 'KHALTI_MANUAL';
              break;
            case 'CASH':
              refundMethod = 'CASH';
              break;
            case 'CHEQUE':
              refundMethod = 'CHEQUE';
              break;
            default:
              refundMethod = 'MANUAL';
          }
          refundReference = gatewayResponse.transactionReference;
          refundProcessedBy = gatewayResponse.processedBy || 'Admin';
          refundProcessedAt = gatewayResponse.processedAt || refund.processedAt;
        }
        else if (gatewayResponse.refundResult?.method === 'KHALTI_API') {
          refundMethod = 'KHALTI_API';
          refundReference = refund.gatewayRefundId;
          refundProcessedBy = 'System (Vendor Decline)';
          refundProcessedAt = refund.processedAt;
        }
      }

      return {
        id: booking.id,
        vendorName: booking.vendor.businessName,
        serviceType: booking.vendor.serviceType,
        packageName: booking.servicePackage.name,
        totalAmount: booking.totalAmount,
        bookingStatus: booking.bookingStatus,
        paymentStatus: booking.paymentStatus,
        eventDate: booking.userSocialEvent.eventDate,
        startDate: booking.startDate,
        endDate: booking.endDate,
        totalDays: booking.totalDays,
        eventTitle: booking.userSocialEvent.title,
        location: booking.vendor.location,
        createdAt: booking.createdAt,
        depositAmount: booking.depositAmount,
        remainingAmount: booking.remainingAmount,
        vendorPaymentStatus: booking.vendorPaymentStatus,
        declineReason: refund?.refundReason,
        
        // ✅ Payout information
        payouts: payouts.map(p => ({
          id: p.id,
          type: p.type,
          amount: p.amount,
          status: p.status,
          processedAt: p.processedAt,
        })),
        depositReleased: depositReleased,
        remainingReleased: remainingReleased,
        fullyReleased: fullyReleased,
        hasPendingPayout: hasPendingPayout,
        depositReleasedAt: depositPayout?.processedAt || null,
        remainingReleasedAt: remainingPayout?.processedAt || null,
        
        // Refund fields
        refundStatus: refund?.refundStatus,
        refundAmount: refund?.refundAmount,
        refundMethod: refundMethod,
        refundReference: refundReference,
        refundProcessedBy: refundProcessedBy,
        refundProcessedAt: refundProcessedAt,
        refundPercentage: refundPercentage,
        refundKhaltiFee: refundKhaltiFee,
        refundPlatformKeeps: refundPlatformKeeps,
        
        // Cancellation fields
        cancelledBy: booking.cancelledBy,
        cancellationReason: booking.cancellationReason,
        cancelledAt: booking.cancelledAt,
      };
    });

    return NextResponse.json(formattedBookings);
  } catch (error) {
    console.error("Error fetching vendor bookings:", error);
    return NextResponse.json(
      { error: "Failed to fetch bookings" },
      { status: 500 },
    );
  }
}