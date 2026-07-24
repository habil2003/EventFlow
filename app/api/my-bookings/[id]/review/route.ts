// app/api/my-bookings/[id]/review/route.ts

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// ────────────────────────────────────────────────────────────────────
// GET - Check if user can review this booking
// ────────────────────────────────────────────────────────────────────
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

    // ── FIND THE BOOKING ──────────────────────────────────────────
    const booking = await prisma.vendorBooking.findFirst({
      where: {
        id: id,
        userId: session.user.id,
      },
      include: {
        vendor: {
          select: {
            id: true,
            businessName: true,
          },
        },
        userSocialEvent: {
          select: {
            title: true,
            eventDate: true,
          },
        },
        ratings: true,
      },
    });

    if (!booking) {
      return NextResponse.json({ error: "Booking not found" }, { status: 404 });
    }

    // ── CHECK IF USER CAN RATE ────────────────────────────────────
    const canRate =
      booking.bookingStatus === "COMPLETED" &&
      booking.customerConfirmed === true &&
      booking.vendorMarkedComplete === true;

    const hasRated = booking.ratings.length > 0;

    // ── GET EXISTING RATING ──────────────────────────────────────
    let existingRating = null;
    if (hasRated) {
      existingRating = {
        id: booking.ratings[0].id,
        rating: booking.ratings[0].rating,
        review: booking.ratings[0].review,
        createdAt: booking.ratings[0].createdAt,
      };
    }

    return NextResponse.json({
      success: true,
      data: {
        bookingId: booking.id,
        bookingReference: booking.bookingReference,
        vendorName: booking.vendor?.businessName || "Unknown Vendor",
        eventTitle: booking.userSocialEvent?.title || "Unknown Event",
        eventDate: booking.userSocialEvent?.eventDate,
        canRate,
        hasRated,
        existingRating,
        conditions: {
          isCompleted: booking.bookingStatus === "COMPLETED",
          customerConfirmed: booking.customerConfirmed,
          vendorMarkedComplete: booking.vendorMarkedComplete,
        },
      },
    });
  } catch (error) {
    console.error("Error checking review status:", error);
    return NextResponse.json(
      { error: "Failed to check review status" },
      { status: 500 }
    );
  }
}