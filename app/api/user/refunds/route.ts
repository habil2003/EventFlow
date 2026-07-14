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

// Helper: Get refund percentage based on days until event
function getRefundPercentageFromPolicy(daysUntilEvent: number): number {
  if (daysUntilEvent >= 7) return 100;
  if (daysUntilEvent >= 3) return 50;
  return 0;
}

// Helper: Calculate refund percentage from data
function calculateRefundPercentage(
  refund: any,
  gatewayResponse: any,
  refundAmount: number,
  totalAmount: number | null,
  daysUntilEvent: number | null,
  cancelledBy: string | null
): number | null {
  let percentage: number | null = null;

  // 1. Try to get from gatewayResponse
  if (gatewayResponse?.refundPercentage !== undefined && gatewayResponse?.refundPercentage !== null) {
    percentage = gatewayResponse.refundPercentage;
  }

  // 2. Try to get from refund object directly
  if (percentage === null && (refund as any).refundPercentage !== undefined && (refund as any).refundPercentage !== null) {
    percentage = (refund as any).refundPercentage;
  }

  // 3. Calculate from amounts
  if (percentage === null && refundAmount && totalAmount && totalAmount > 0) {
    percentage = calculateRefundPercentageFromAmount(refundAmount, totalAmount);
  }

  // 4. For vendor declines, it's always 100% of deposit
  if (percentage === null && cancelledBy === 'VENDOR') {
    percentage = 100;
  }

  // 5. Calculate from days until event using policy
  if (percentage === null && daysUntilEvent !== null) {
    percentage = getRefundPercentageFromPolicy(daysUntilEvent);
  }

  return percentage;
}

// ✅ Extract refund method - NO FALLBACKS
function extractRefundMethod(gatewayResponse: any): string | null {
  if (!gatewayResponse) return null;

  // Check all possible fields where method could be stored
  if (gatewayResponse.method) {
    const method = gatewayResponse.method.toUpperCase();
    if (method === 'KHALTI_API' || method === 'MANUAL') {
      return method;
    }
  }

  if (gatewayResponse.transferMethod) {
    const method = gatewayResponse.transferMethod.toUpperCase();
    if (['BANK_TRANSFER', 'KHALTI_MANUAL', 'CASH', 'CHEQUE'].includes(method)) {
      return method;
    }
  }

  if (gatewayResponse.type) {
    const method = gatewayResponse.type.toUpperCase();
    if (['KHALTI_API', 'BANK_TRANSFER', 'KHALTI_MANUAL', 'CASH', 'CHEQUE', 'MANUAL'].includes(method)) {
      return method;
    }
  }

  // ✅ Return null if no method found - NO FALLBACK
  return null;
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
            vendor: {
              select: {
                businessName: true,
                serviceType: true,
              },
            },
            servicePackage: {
              select: {
                name: true,
                price: true,
              },
            },
            userSocialEvent: {
              select: {
                title: true,
                eventDate: true,
                guestCount: true,
              },
            },
            user: {
              select: {
                name: true,
                email: true,
              },
            },
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
            event: {
              select: {
                title: true,
                eventDate: true,
                location: true,
                organizer: {
                  select: {
                    name: true,
                    email: true,
                  },
                },
              },
            },
            tier: {
              select: {
                name: true,
                price: true,
              },
            },
            user: {
              select: {
                name: true,
                email: true,
              },
            },
          },
        },
        paymentTransaction: true,
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    // Format vendor refunds - NO FALLBACKS
    const formattedVendorRefunds = vendorRefunds.map((refund) => {
      const gatewayResponse = refund.gatewayResponse as any;
      
      const refundAmount = Number(refund.refundAmount);
      const totalAmount = refund.vendorBooking?.depositAmount 
        ? Number(refund.vendorBooking.depositAmount)
        : refund.vendorBooking?.totalAmount 
          ? Number(refund.vendorBooking.totalAmount)
          : null;

      let daysUntilEvent = null;
      if (refund.vendorBooking?.userSocialEvent?.eventDate) {
        const cancellationDate = refund.createdAt || new Date();
        daysUntilEvent = calculateDaysUntilEvent(
          refund.vendorBooking.userSocialEvent.eventDate,
          cancellationDate
        );
      }

      const refundPercentage = calculateRefundPercentage(
        refund,
        gatewayResponse,
        refundAmount,
        totalAmount,
        daysUntilEvent,
        refund.vendorBooking?.cancelledBy || null
      );

      // ✅ Extract refund method - NO FALLBACK
      const refundMethod = extractRefundMethod(gatewayResponse);

      return {
        id: refund.id,
        bookingId: refund.vendorBookingId,
        type: "VENDOR" as const,
        vendorName: refund.vendorBooking?.vendor?.businessName || "Unknown Vendor",
        eventTitle: refund.vendorBooking?.userSocialEvent?.title || "Unknown Event",
        eventDate: refund.vendorBooking?.userSocialEvent?.eventDate,
        packageName: refund.vendorBooking?.servicePackage?.name || "Unknown Package",
        totalAmount: totalAmount,
        refundAmount: refundAmount,
        refundPercentage: refundPercentage,
        refundStatus: refund.refundStatus,
        refundMethod: refundMethod, // ✅ Real data, null if not found
        refundReference: refund.gatewayRefundId || null,
        refundProcessedBy: gatewayResponse?.processedBy || null,
        refundProcessedAt: gatewayResponse?.processedAt || refund.processedAt || null,
        refundKhaltiFee: gatewayResponse?.khaltiFee || null,
        refundPlatformKeeps: gatewayResponse?.platformKeeps || null,
        refundReason: refund.refundReason,
        cancelledBy: refund.vendorBooking?.cancelledBy || null,
        cancellationReason: refund.vendorBooking?.cancellationReason || refund.refundReason || null,
        daysUntilEvent: daysUntilEvent,
        createdAt: refund.createdAt,
        processedAt: refund.processedAt,
        gatewayResponse: gatewayResponse,
      };
    });

    // Format ticket refunds - NO FALLBACKS
    const formattedTicketRefunds = ticketRefunds.map((refund) => {
      const gatewayResponse = refund.gatewayResponse as any;
      
      const refundAmount = Number(refund.refundAmount);
      const totalAmount = refund.ticketBooking?.totalAmount 
        ? Number(refund.ticketBooking.totalAmount)
        : null;

      let daysUntilEvent = null;
      if (refund.ticketBooking?.event?.eventDate) {
        const cancellationDate = refund.createdAt || new Date();
        daysUntilEvent = calculateDaysUntilEvent(
          refund.ticketBooking.event.eventDate,
          cancellationDate
        );
      }

      const refundPercentage = calculateRefundPercentage(
        refund,
        gatewayResponse,
        refundAmount,
        totalAmount,
        daysUntilEvent,
        'CUSTOMER'
      );

      // ✅ Extract refund method - NO FALLBACK
      const refundMethod = extractRefundMethod(gatewayResponse);

      const organizerName = refund.ticketBooking?.event?.organizer?.name || 'Event Organizer';

      return {
        id: refund.id,
        bookingId: refund.ticketBookingId,
        type: "TICKET" as const,
        vendorName: organizerName,
        eventTitle: refund.ticketBooking?.event?.title || "Unknown Event",
        eventDate: refund.ticketBooking?.event?.eventDate,
        packageName: refund.ticketBooking?.tier?.name || "Ticket",
        totalAmount: totalAmount,
        refundAmount: refundAmount,
        refundPercentage: refundPercentage,
        refundStatus: refund.refundStatus,
        refundMethod: refundMethod, // ✅ Real data, null if not found
        refundReference: refund.gatewayRefundId || null,
        refundProcessedBy: gatewayResponse?.processedBy || null,
        refundProcessedAt: gatewayResponse?.processedAt || refund.processedAt || null,
        refundKhaltiFee: gatewayResponse?.khaltiFee || null,
        refundPlatformKeeps: gatewayResponse?.platformKeeps || null,
        refundReason: refund.refundReason,
        cancelledBy: "CUSTOMER",
        cancellationReason: refund.refundReason || null,
        daysUntilEvent: daysUntilEvent,
        createdAt: refund.createdAt,
        processedAt: refund.processedAt,
        gatewayResponse: gatewayResponse,
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