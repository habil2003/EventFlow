// app/api/user/social-events/[id]/bookings/route.ts
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

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

    // Verify the umbrella event belongs to the user
    const umbrellaEvent = await prisma.userSocialEvent.findFirst({
      where: {
        id: id,
        userId: session.user.id,
      },
    });

    if (!umbrellaEvent) {
      return NextResponse.json({ error: "Event not found" }, { status: 404 });
    }

    // Fetch all vendor bookings for this umbrella event
    const bookings = await prisma.vendorBooking.findMany({
      where: {
        userSocialEventId: id,
      },
      include: {
        vendor: true,
        servicePackage: true,
        paymentTransactions: true,
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    const formattedBookings = bookings.map((booking) => {
      // Calculate amounts with proper defaults
      const totalAmount = Number(booking.totalAmount);
      const depositAmount = booking.depositAmount ? Number(booking.depositAmount) : totalAmount * 0.2;
      const remainingAmount = booking.remainingAmount ? Number(booking.remainingAmount) : totalAmount * 0.8;
      
      // Get deposit payment transaction
      const depositTransaction = booking.paymentTransactions.find(
        (t) => t.paymentType === "VENDOR_DEPOSIT" && t.status === "SUCCESS"
      );
      
      // Get remaining payment transaction
      const remainingTransaction = booking.paymentTransactions.find(
        (t) => t.paymentType === "VENDOR_REMAINING" && t.status === "SUCCESS"
      );

      return {
        id: booking.id,
        vendorName: booking.vendor.businessName,
        serviceType: booking.vendor.serviceType,
        packageName: booking.servicePackage.name,
        totalAmount: totalAmount,
        depositAmount: depositAmount,
        remainingAmount: remainingAmount,
        vendorPaymentStatus: booking.vendorPaymentStatus || "PENDING",
        bookingStatus: booking.bookingStatus,
        paymentStatus: booking.paymentStatus,
        location: booking.vendor.location,
        createdAt: booking.createdAt,
        eventDate: umbrellaEvent.eventDate,
        depositPaidAt: booking.depositPaidAt || depositTransaction?.createdAt,
        remainingPaidAt: booking.remainingPaidAt || remainingTransaction?.createdAt,
      };
    });

    return NextResponse.json(formattedBookings);
  } catch (error) {
    console.error("Error fetching event bookings:", error);
    return NextResponse.json(
      { error: "Failed to fetch bookings" },
      { status: 500 }
    );
  }
}