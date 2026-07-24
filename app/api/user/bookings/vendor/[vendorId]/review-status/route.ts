// app/api/user/bookings/vendor/[vendorId]/review-status/route.ts

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ vendorId: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    const { vendorId } = await params;

    if (!session || !session.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check if user has a completed booking with this vendor
    const booking = await prisma.vendorBooking.findFirst({
      where: {
        userId: session.user.id,
        vendorId: vendorId,
        bookingStatus: "COMPLETED",
        customerConfirmed: true,
        vendorMarkedComplete: true,
      },
      orderBy: { createdAt: "desc" },
      take: 1,
    });

    // Check if user already reviewed this vendor
    let existingReview = null;
    if (booking) {
      const review = await prisma.rating.findFirst({
        where: {
          userId: session.user.id,
          vendorId: vendorId,
          vendorBookingId: booking.id,
        },
        select: {
          id: true,
          rating: true,
          review: true,
        },
      });
      if (review) {
        existingReview = review;
      }
    }

    return NextResponse.json({
      canReview: !!booking,
      hasReviewed: !!existingReview,
      existingReview: existingReview,
      bookingId: booking?.id || null,
    });
  } catch (error) {
    console.error("Error checking review status:", error);
    return NextResponse.json(
      { error: "Failed to check review status" },
      { status: 500 }
    );
  }
}