// app/api/user/social-events/[id]/route.ts
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
          },
        },
      },
    });

    if (!umbrellaEvent) {
      return NextResponse.json({ error: "Event not found" }, { status: 404 });
    }

    // Calculate totals
    let totalSpent = 0;
    let totalDepositsPaid = 0;
    let totalRemaining = 0;

    umbrellaEvent.vendorBookings.forEach((booking) => {
      const totalAmount = Number(booking.totalAmount);
      const depositAmount = booking.depositAmount ? Number(booking.depositAmount) : totalAmount * 0.2;
      const remainingAmount = booking.remainingAmount ? Number(booking.remainingAmount) : totalAmount * 0.8;
      
      totalSpent += totalAmount;
      
      if (booking.vendorPaymentStatus === "DEPOSIT_PAID") {
        totalDepositsPaid += depositAmount;
        totalRemaining += remainingAmount;
      } else if (booking.vendorPaymentStatus === "FULLY_PAID") {
        totalDepositsPaid += totalAmount;
      }
    });

    const formattedEvent = {
      id: umbrellaEvent.id,
      title: umbrellaEvent.title,
      eventDate: umbrellaEvent.eventDate,
      guestCount: umbrellaEvent.guestCount,
      status: umbrellaEvent.status,
      vendorCount: umbrellaEvent.vendorBookings.length,
      totalSpent: totalSpent,
      totalDepositsPaid: totalDepositsPaid,
      totalRemaining: totalRemaining,
      createdAt: umbrellaEvent.createdAt,
    };

    return NextResponse.json(formattedEvent);
  } catch (error) {
    console.error("Error fetching event:", error);
    return NextResponse.json({ error: "Failed to fetch event" }, { status: 500 });
  }
}