// app/api/ratings/route.ts

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || !session.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { rating, review, vendorId, eventId, bookingId, type } = await request.json();

    // ── VALIDATE REQUIRED FIELDS ──────────────────────────────────
    if (rating === undefined || rating < 1 || rating > 5) {
      return NextResponse.json(
        { error: "Rating must be between 1 and 5" },
        { status: 400 }
      );
    }

    if (!vendorId && !eventId) {
      return NextResponse.json(
        { error: "Either vendorId or eventId is required" },
        { status: 400 }
      );
    }

    const ratingType = type || (vendorId ? "VENDOR" : "EVENT");

    // ── CHECK IF USER CAN RATE (VENDOR) ──────────────────────────
    if (vendorId) {
      // Check if booking exists and is completed
      const booking = await prisma.vendorBooking.findFirst({
        where: {
          userId: session.user.id,
          vendorId: vendorId,
          bookingStatus: "COMPLETED",
          customerConfirmed: true,
        },
        orderBy: { createdAt: "desc" },
        take: 1,
      });

      if (!booking) {
        return NextResponse.json(
          { 
            error: "You can only rate vendors after completing a booking",
            canRate: false,
            reason: "No completed booking found"
          },
          { status: 400 }
        );
      }

      // Check if already rated this vendor
      const existingRating = await prisma.rating.findFirst({
        where: {
          userId: session.user.id,
          vendorId: vendorId,
          vendorBookingId: booking.id,
        },
      });

      if (existingRating) {
        return NextResponse.json(
          { error: "You have already rated this vendor for this booking" },
          { status: 400 }
        );
      }

      // ── CREATE VENDOR RATING ─────────────────────────────────────
      const newRating = await prisma.rating.create({
        data: {
          rating,
          review: review || null,
          type: "VENDOR",
          userId: session.user.id,
          vendorId: vendorId,
          vendorBookingId: booking.id,
          isVerified: true,
        },
        include: {
          user: {
            select: {
              id: true,
              name: true,
            },
          },
          vendor: {
            select: {
              id: true,
              businessName: true,
            },
          },
        },
      });

      return NextResponse.json({
        success: true,
        message: "Thank you for your review!",
        rating: newRating,
        type: "VENDOR",
      }, { status: 201 });
    }

    // ── CHECK IF USER CAN RATE (EVENT) ────────────────────────────
    if (eventId) {
      // Check if user has a ticket and attended
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

      if (!ticket) {
        return NextResponse.json(
          { 
            error: "You can only rate events you have attended",
            canRate: false,
            reason: "No completed ticket found or event not attended"
          },
          { status: 400 }
        );
      }

      // Check if already rated this event
      const existingRating = await prisma.rating.findFirst({
        where: {
          userId: session.user.id,
          eventId: eventId,
          ticketBookingId: ticket.id,
        },
      });

      if (existingRating) {
        return NextResponse.json(
          { error: "You have already rated this event" },
          { status: 400 }
        );
      }

      // ── CREATE EVENT RATING ──────────────────────────────────────
      const newRating = await prisma.rating.create({
        data: {
          rating,
          review: review || null,
          type: "EVENT",
          userId: session.user.id,
          eventId: eventId,
          ticketBookingId: ticket.id,
          isVerified: true,
        },
        include: {
          user: {
            select: {
              id: true,
              name: true,
            },
          },
          event: {
            select: {
              id: true,
              title: true,
            },
          },
        },
      });

      return NextResponse.json({
        success: true,
        message: "Thank you for your event review!",
        rating: newRating,
        type: "EVENT",
      }, { status: 201 });
    }

    return NextResponse.json(
      { error: "Invalid request" },
      { status: 400 }
    );

  } catch (error) {
    console.error("Error creating rating:", error);
    return NextResponse.json(
      { error: "Failed to create rating" },
      { status: 500 }
    );
  }
}