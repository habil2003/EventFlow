// app/api/user/tickets/event/[eventId]/review-status/route.ts

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ eventId: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    const { eventId } = await params;

    if (!session || !session.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check if user has a checked-in ticket for this event
    const ticket = await prisma.ticketBooking.findFirst({
      where: {
        userId: session.user.id,
        eventId: eventId,
        checkedIn: true,
        paymentStatus: "COMPLETED",
        event: {
          isCompleted: true,
        },
      },
      orderBy: { createdAt: "desc" },
      take: 1,
    });

    let existingReview = null;
    if (ticket) {
      const review = await prisma.rating.findFirst({
        where: {
          userId: session.user.id,
          eventId: eventId,
          ticketBookingId: ticket.id,
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
      canReview: !!ticket,
      hasReviewed: !!existingReview,
      existingReview: existingReview,
      ticketId: ticket?.id || null,
    });
  } catch (error) {
    console.error("Error checking event review status:", error);
    return NextResponse.json(
      { error: "Failed to check review status" },
      { status: 500 }
    );
  }
}