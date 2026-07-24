// app/api/user/social-events/[id]/route.ts
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { computeEventDerivedStatus } from "@/lib/event-helpers";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    const { id } = await params;

    if (!session || !session.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const umbrellaEvent = await prisma.userSocialEvent.findFirst({
      where: {
        id: id,
        userId: session.user.id,
      },
      include: {
        vendorBookings: {
          include: {
            vendor: true,
            servicePackage: true,
            payouts: true,
            refunds: {
              take: 1,
              orderBy: { createdAt: "desc" },
            },
          },
        },
      },
    });

    if (!umbrellaEvent) {
      return NextResponse.json({ error: "Event not found" }, { status: 404 });
    }

    // ✅ Use the shared helper for status/budget/vendor-count derivation
    const {
      derivedStatus,
      derivedStatusLabel,
      totalSpent,
      vendorCount,
      bookingSummary,
    } = computeEventDerivedStatus(
      umbrellaEvent.status,
      umbrellaEvent.eventDate,
      umbrellaEvent.vendorBookings.map((b) => ({
        bookingStatus: b.bookingStatus,
        totalAmount: Number(b.totalAmount),
        vendorId: b.vendorId,
      }))
    );

    // Still need per-booking payment breakdowns (deposits/remaining/fully paid)
    // for the detail page — the helper only handles status/budget/vendor-count.
    let totalDepositsPaid = 0;
    let totalRemaining = 0;
    let totalFullyPaid = 0;
    let totalReleased = 0;

    const bookingsWithStatus = umbrellaEvent.vendorBookings.map((booking) => {
      const totalAmount = Number(booking.totalAmount);
      const depositAmount = booking.depositAmount ? Number(booking.depositAmount) : totalAmount * 0.2;
      const remainingAmount = booking.remainingAmount ? Number(booking.remainingAmount) : totalAmount * 0.8;
      const isDeclined = booking.bookingStatus === "DECLINED";

      if (!isDeclined) {
        if (booking.vendorPaymentStatus === "DEPOSIT_PAID") {
          totalDepositsPaid += depositAmount;
          totalRemaining += remainingAmount;
        } else if (
          booking.vendorPaymentStatus === "FULLY_PAID" ||
          booking.vendorPaymentStatus === "COMPLETED"
        ) {
          totalFullyPaid += totalAmount;
        }
      }

      const payouts = booking.payouts || [];
      const depositPayout = payouts.find(p => p.type === 'DEPOSIT' && p.status === 'COMPLETED');
      const remainingPayout = payouts.find(p => p.type === 'REMAINING' && p.status === 'COMPLETED');

      if (depositPayout || remainingPayout) {
        totalReleased += totalAmount;
      }

      return {
        id: booking.id,
        vendorName: booking.vendor.businessName,
        serviceType: booking.vendor.serviceType,
        packageName: booking.servicePackage.name,
        totalAmount: totalAmount,
        depositAmount: depositAmount,
        remainingAmount: remainingAmount,
        bookingStatus: booking.bookingStatus,
        vendorPaymentStatus: booking.vendorPaymentStatus,
        paymentStatus: booking.paymentStatus,
        location: booking.vendor.location,
        createdAt: booking.createdAt,
        depositPaidAt: booking.depositPaidAt,
        remainingPaidAt: booking.remainingPaidAt,
        payouts: payouts.map(p => ({
          id: p.id,
          type: p.type,
          amount: p.amount,
          status: p.status,
          processedAt: p.processedAt,
        })),
        depositReleased: !!depositPayout,
        remainingReleased: !!remainingPayout,
        fullyReleased: !!(depositPayout && remainingPayout),
      };
    });

    const formattedEvent = {
      id: umbrellaEvent.id,
      title: umbrellaEvent.title,
      eventDate: umbrellaEvent.eventDate,
      guestCount: umbrellaEvent.guestCount,
      status: umbrellaEvent.status,
      derivedStatus: derivedStatus,
      derivedStatusLabel: derivedStatusLabel,
      vendorCount: vendorCount,
      totalSpent: totalSpent,
      totalDepositsPaid: totalDepositsPaid,
      totalRemaining: totalRemaining,
      totalFullyPaid: totalFullyPaid,
      totalReleased: totalReleased,
      createdAt: umbrellaEvent.createdAt,
      bookingSummary: bookingSummary,
      bookings: bookingsWithStatus,
    };

    return NextResponse.json(formattedEvent);
  } catch (error) {
    console.error("Error fetching event:", error);
    return NextResponse.json({ error: "Failed to fetch event" }, { status: 500 });
  }
}