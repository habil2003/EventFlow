// app/api/user/vendor-bookings/[id]/route.ts
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

    const booking = await prisma.vendorBooking.findFirst({
      where: {
        id: id,
        userId: session.user.id,
      },
      include: {
        vendor: true,
        servicePackage: true,
        bookingAddOns: {
          include: {
            packageAddOn: true,
          },
        },
        userSocialEvent: true,
        // ✅ Include latest refund for status display
        refunds: {
          take: 1,
          orderBy: { createdAt: "desc" },
        },
      },
    });

    if (!booking) {
      return NextResponse.json({ error: "Booking not found" }, { status: 404 });
    }

    const addOns = booking.bookingAddOns.map((ba) => ({
      name: ba.packageAddOn.name,
      price: Number(ba.priceAtBooking),
    }));

    const totalAmountNum = Number(booking.totalAmount);
    const depositAmount = booking.depositAmount
      ? Number(booking.depositAmount)
      : totalAmountNum * 0.2;
    const remainingAmount = booking.remainingAmount
      ? Number(booking.remainingAmount)
      : totalAmountNum * 0.8;

    let discountPercent = 0;
    const totalDays = booking.totalDays || 1;
    if (totalDays >= 8) discountPercent = 15;
    else if (totalDays >= 4) discountPercent = 10;
    else if (totalDays >= 2) discountPercent = 5;

    // Pull refund info from the latest refund record
    const latestRefund = booking.refunds[0] ?? null;

    const formattedBooking = {
      id: booking.id,
      vendorName: booking.vendor.businessName,
      serviceType: booking.vendor.serviceType,
      packageName: booking.servicePackage.name,
      totalAmount: totalAmountNum,
      depositAmount: depositAmount,
      remainingAmount: remainingAmount,
      vendorPaymentStatus: booking.vendorPaymentStatus || "PENDING",
      paymentStatus: booking.paymentStatus,
      bookingStatus: booking.bookingStatus,
      eventDate: booking.userSocialEvent.eventDate,
      startDate: booking.startDate,
      endDate: booking.endDate,
      totalDays: booking.totalDays,
      dailyRate: booking.dailyRate,
      discountPercent: discountPercent,
      eventTitle: booking.userSocialEvent.title,
      location: booking.vendor.location,
      addOns: addOns,
      createdAt: booking.createdAt,
      depositPaidAt: booking.depositPaidAt,
      remainingPaidAt: booking.remainingPaidAt,
      amountReleasedAt: booking.amountReleasedAt,
      // ✅ Cancellation fields
      cancelledBy: booking.cancelledBy,
      cancellationReason: booking.cancellationReason,
      cancelledAt: booking.cancelledAt,
      // ✅ Refund fields
      refundStatus: latestRefund?.refundStatus ?? null,
      refundAmount: latestRefund ? Number(latestRefund.refundAmount) : null,
      refundPercentage: latestRefund?.gatewayResponse
        ? (latestRefund.gatewayResponse as any).refundPercentage ?? null
        : null,
    };

    return NextResponse.json(formattedBooking);
  } catch (error) {
    console.error("Error fetching booking:", error);
    return NextResponse.json(
      { error: "Failed to fetch booking" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    const { id } = await params;

    if (!session || !session.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const booking = await prisma.vendorBooking.findFirst({
      where: {
        id: id,
        userId: session.user.id,
      },
      include: {
        paymentTransactions: true,
      },
    });

    if (!booking) {
      return NextResponse.json({ error: "Booking not found" }, { status: 404 });
    }

    if (booking.bookingStatus !== "PENDING") {
      return NextResponse.json(
        { error: "Cannot cancel this booking. Booking is already processed." },
        { status: 400 }
      );
    }

    if (booking.vendorPaymentStatus === "DEPOSIT_PAID") {
      return NextResponse.json(
        { error: "Deposit already paid. Use the refund cancellation flow instead." },
        { status: 400 }
      );
    }

    await prisma.vendorBooking.update({
      where: { id: id },
      data: {
        bookingStatus: "DECLINED",
        cancelledBy: "CUSTOMER",
        cancellationReason: "Customer cancelled booking",
        cancelledAt: new Date(),
        paymentStatus: "FAILED",
      },
    });

    return NextResponse.json({
      success: true,
      message: "Booking cancelled successfully",
    });
  } catch (error) {
    console.error("Error cancelling booking:", error);
    return NextResponse.json(
      { error: "Failed to cancel booking" },
      { status: 500 }
    );
  }
}