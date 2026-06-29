// app/api/vendor/bookings/route.ts
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

    if (session.user.role !== "VENDOR") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Get vendor profile
    const vendor = await prisma.vendorProfile.findUnique({
      where: { userId: session.user.id },
    });

    if (!vendor) {
      return NextResponse.json({ error: "Vendor not found" }, { status: 404 });
    }

    // Get all bookings for this vendor
    const bookings = await prisma.vendorBooking.findMany({
      where: { vendorId: vendor.id },
      include: {
        userSocialEvent: true,
        servicePackage: true,
        user: {
          select: {
            name: true,
            email: true,
          },
        },
        refunds: {
          take: 1,
          orderBy: {
            createdAt: "desc",
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    const formattedBookings = bookings.map((booking) => {
      const totalAmount = Number(booking.totalAmount);
      const depositAmount = booking.depositAmount
        ? Number(booking.depositAmount)
        : totalAmount * 0.2;
      const remainingAmount = booking.remainingAmount
        ? Number(booking.remainingAmount)
        : totalAmount * 0.8;

      // Get the most recent refund record
      const refund = booking.refunds[0];

      // Get decline reason from refund record if booking is declined
      const declineReason =
        booking.bookingStatus === "DECLINED" && refund
          ? refund.refundReason
          : undefined;

      return {
        id: booking.id,
        eventTitle: booking.userSocialEvent.title,
        eventDate: booking.userSocialEvent.eventDate,
        startDate: booking.startDate,        // ✅ ADD THIS
        endDate: booking.endDate,            // ✅ ADD THIS
        totalDays: booking.totalDays,        // ✅ ADD THIS
        guestCount: booking.userSocialEvent.guestCount,
        totalAmount: totalAmount,
        depositAmount: depositAmount,
        remainingAmount: remainingAmount,
        bookingStatus: booking.bookingStatus,
        vendorPaymentStatus: booking.vendorPaymentStatus || "PENDING",
        customerName: booking.user.name,
        customerEmail: booking.user.email,
        packageName: booking.servicePackage.name,
        depositPaidAt: booking.depositPaidAt,
        remainingPaidAt: booking.remainingPaidAt,
        createdAt: booking.createdAt,
        declineReason: declineReason,
        refundStatus: refund?.refundStatus,
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