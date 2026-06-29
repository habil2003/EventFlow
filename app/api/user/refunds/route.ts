// app/api/user/refunds/route.ts

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// Helper: Calculate refund percentage from amount
function calculateRefundPercentageFromAmount(refundAmount: number, totalAmount: number): number | null {
  if (!totalAmount || totalAmount === 0) return null;
  return Math.round((refundAmount / totalAmount) * 100);
}

// Helper: Calculate days between two dates
function calculateDaysUntilEvent(eventDate: Date, cancellationDate: Date): number {
  const diffTime = eventDate.getTime() - cancellationDate.getTime();
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

// Helper: Get refund percentage based on days until event (customer policy)
function getRefundPercentageFromPolicy(daysUntilEvent: number): number {
  if (daysUntilEvent >= 7) return 100;
  if (daysUntilEvent >= 3) return 50;
  return 0;
}

export async function GET() {
  try {
    const session = await getServerSession(authOptions);

    if (!session || !session.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Fetch vendor refunds
    const vendorRefunds = await prisma.refund.findMany({
      where: {
        vendorBooking: {
          userId: session.user.id,
        },
      },
      include: {
        vendorBooking: {
          include: {
            vendor: true,
            servicePackage: true,
            userSocialEvent: true,
          },
        },
        paymentTransaction: true,
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    // Fetch ticket refunds
    const ticketRefunds = await prisma.refund.findMany({
      where: {
        ticketBooking: {
          userId: session.user.id,
        },
      },
      include: {
        ticketBooking: {
          include: {
            event: true,
            tier: true,
            user: true,
          },
        },
        paymentTransaction: true,
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    // Helper to extract refund details
    const extractRefundDetails = (gatewayResponse: any, refund: any) => {
      let refundMethod = null;
      let refundReference = null;
      let refundProcessedBy = null;
      let refundProcessedAt = null;
      let refundPercentage = null;
      let refundKhaltiFee = null;
      let refundPlatformKeeps = null;
      let daysUntilEvent = null;

      if (gatewayResponse) {
        if (gatewayResponse.method === 'KHALTI_API') {
          refundMethod = 'KHALTI_API';
          refundReference = refund.gatewayRefundId;
          refundProcessedBy = gatewayResponse.processedBy || 'System';
          refundProcessedAt = gatewayResponse.processedAt || refund.processedAt;
          refundPercentage = gatewayResponse.refundPercentage;
          refundKhaltiFee = gatewayResponse.khaltiFee;
          refundPlatformKeeps = gatewayResponse.platformKeeps;
          daysUntilEvent = gatewayResponse.daysUntilEvent;
        }
        else if (gatewayResponse.method === 'MANUAL' && gatewayResponse.transferMethod) {
          refundMethod = gatewayResponse.transferMethod;
          refundReference = gatewayResponse.transactionReference;
          refundProcessedBy = gatewayResponse.processedBy || 'Admin';
          refundProcessedAt = gatewayResponse.processedAt || refund.processedAt;
          refundPercentage = gatewayResponse.refundPercentage;
          refundKhaltiFee = gatewayResponse.khaltiFee;
          refundPlatformKeeps = gatewayResponse.platformKeeps;
          daysUntilEvent = gatewayResponse.daysUntilEvent;
        }
        else if (gatewayResponse.refundResult?.method === 'KHALTI_API') {
          refundMethod = 'KHALTI_API';
          refundReference = refund.gatewayRefundId;
          refundProcessedBy = 'System (Vendor Decline)';
          refundProcessedAt = refund.processedAt;
          refundPercentage = gatewayResponse.refundResult?.refundPercentage;
          refundKhaltiFee = gatewayResponse.refundResult?.khaltiFee;
        }
        else if (gatewayResponse.transferMethod) {
          refundMethod = gatewayResponse.transferMethod;
          refundReference = gatewayResponse.transactionReference;
          refundProcessedBy = gatewayResponse.processedBy || 'Admin';
          refundProcessedAt = gatewayResponse.processedAt || refund.processedAt;
          refundPercentage = gatewayResponse.refundPercentage;
        }
      }

      return {
        refundMethod,
        refundReference,
        refundProcessedBy,
        refundProcessedAt,
        refundPercentage,
        refundKhaltiFee,
        refundPlatformKeeps,
        daysUntilEvent,
      };
    };

    // Format vendor refunds
    const formattedVendorRefunds = vendorRefunds.map((refund) => {
      const gatewayResponse = refund.gatewayResponse as any;
      const refundDetails = extractRefundDetails(gatewayResponse, refund);
      
      const refundAmount = Number(refund.refundAmount);
      const totalAmount = refund.vendorBooking?.depositAmount 
        ? Number(refund.vendorBooking.depositAmount)
        : refund.vendorBooking?.totalAmount 
          ? Number(refund.vendorBooking.totalAmount)
          : null;

      // Calculate days until event
      let daysUntilEvent = refundDetails.daysUntilEvent;
      if (!daysUntilEvent && refund.vendorBooking?.userSocialEvent?.eventDate) {
        const cancellationDate = refund.createdAt || refund.cancelledAt || new Date();
        daysUntilEvent = calculateDaysUntilEvent(
          refund.vendorBooking.userSocialEvent.eventDate,
          cancellationDate
        );
      }

      // Calculate refund percentage (with fallbacks)
      let refundPercentage = refundDetails.refundPercentage;
      
      // Fallback 1: Calculate from amounts
      if (refundPercentage === null && refundAmount && totalAmount && totalAmount > 0) {
        refundPercentage = calculateRefundPercentageFromAmount(refundAmount, totalAmount);
      }
      
      // Fallback 2: For vendor declines, it's always 100% of deposit
      if (refundPercentage === null && refund.vendorBooking?.cancelledBy === 'VENDOR') {
        refundPercentage = 100;
      }
      
      // Fallback 3: Calculate from days until event using policy
      if (refundPercentage === null && daysUntilEvent !== null) {
        refundPercentage = getRefundPercentageFromPolicy(daysUntilEvent);
      }

      return {
        id: refund.id,
        bookingId: refund.vendorBookingId,
        type: "VENDOR",
        vendorName: refund.vendorBooking?.vendor?.businessName || "Unknown Vendor",
        eventTitle: refund.vendorBooking?.userSocialEvent?.title || "Unknown Event",
        eventDate: refund.vendorBooking?.userSocialEvent?.eventDate,
        packageName: refund.vendorBooking?.servicePackage?.name || "Unknown Package",
        totalAmount: totalAmount,
        refundAmount: refundAmount,
        refundStatus: refund.refundStatus,
        refundMethod: refundDetails.refundMethod,
        refundReference: refundDetails.refundReference,
        refundProcessedBy: refundDetails.refundProcessedBy,
        refundProcessedAt: refundDetails.refundProcessedAt,
        refundPercentage: refundPercentage,
        refundKhaltiFee: refundDetails.refundKhaltiFee,
        refundPlatformKeeps: refundDetails.refundPlatformKeeps,
        refundReason: refund.refundReason,
        cancelledBy: refund.vendorBooking?.cancelledBy,
        cancellationReason: refund.vendorBooking?.cancellationReason,
        daysUntilEvent: daysUntilEvent,
        createdAt: refund.createdAt,
        processedAt: refund.processedAt,
      };
    });

    // Format ticket refunds (similar logic)
    const formattedTicketRefunds = ticketRefunds.map((refund) => {
      const gatewayResponse = refund.gatewayResponse as any;
      const refundDetails = extractRefundDetails(gatewayResponse, refund);
      
      const refundAmount = Number(refund.refundAmount);
      const totalAmount = refund.ticketBooking?.totalAmount 
        ? Number(refund.ticketBooking.totalAmount)
        : null;

      let daysUntilEvent = refundDetails.daysUntilEvent;
      if (!daysUntilEvent && refund.ticketBooking?.event?.eventDate) {
        const cancellationDate = refund.createdAt || new Date();
        daysUntilEvent = calculateDaysUntilEvent(
          refund.ticketBooking.event.eventDate,
          cancellationDate
        );
      }

      let refundPercentage = refundDetails.refundPercentage;
      if (refundPercentage === null && refundAmount && totalAmount && totalAmount > 0) {
        refundPercentage = calculateRefundPercentageFromAmount(refundAmount, totalAmount);
      }
      if (refundPercentage === null && daysUntilEvent !== null) {
        refundPercentage = getRefundPercentageFromPolicy(daysUntilEvent);
      }

      return {
        id: refund.id,
        bookingId: refund.ticketBookingId,
        type: "TICKET",
        vendorName: refund.ticketBooking?.event?.organizer?.name || "Event Organizer",
        eventTitle: refund.ticketBooking?.event?.title || "Unknown Event",
        eventDate: refund.ticketBooking?.event?.eventDate,
        packageName: refund.ticketBooking?.tier?.name || "Ticket",
        totalAmount: totalAmount,
        refundAmount: refundAmount,
        refundStatus: refund.refundStatus,
        refundMethod: refundDetails.refundMethod,
        refundReference: refundDetails.refundReference,
        refundProcessedBy: refundDetails.refundProcessedBy,
        refundProcessedAt: refundDetails.refundProcessedAt,
        refundPercentage: refundPercentage,
        refundKhaltiFee: refundDetails.refundKhaltiFee,
        refundPlatformKeeps: refundDetails.refundPlatformKeeps,
        refundReason: refund.refundReason,
        cancelledBy: "CUSTOMER",
        cancellationReason: refund.refundReason,
        daysUntilEvent: daysUntilEvent,
        createdAt: refund.createdAt,
        processedAt: refund.processedAt,
      };
    });

    const allRefunds = [...formattedVendorRefunds, ...formattedTicketRefunds].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );

    return NextResponse.json({ refunds: allRefunds });
  } catch (error) {
    console.error("Error fetching user refunds:", error);
    return NextResponse.json(
      { error: "Failed to fetch refunds" },
      { status: 500 }
    );
  }
}