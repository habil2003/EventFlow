// app/api/user/social-events/route.ts

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { computeEventDerivedStatus } from "@/lib/event-helpers";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);

    if (!session || !session.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const umbrellaEvents = await prisma.userSocialEvent.findMany({
      where: {
        userId: session.user.id,
      },
      include: {
        vendorBookings: {
          select: {
            totalAmount: true,
            bookingStatus: true,
            paymentStatus: true,
            vendorPaymentStatus: true,
            vendorId: true, // ✅ needed for distinct-vendor counting in the helper
            payouts: {
              select: {
                status: true,
                type: true,
                processedAt: true,
              },
            },
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    const formattedEvents = umbrellaEvents.map((event) => {
      const bookings = (event.vendorBookings || []).map((b) => ({
        bookingStatus: b.bookingStatus,
        totalAmount: Number(b.totalAmount),
        vendorId: b.vendorId,
      }));

      const {
        derivedStatus,
        derivedStatusLabel,
        totalSpent,
        vendorCount,
        bookingSummary,
      } = computeEventDerivedStatus(event.status, event.eventDate, bookings);

      return {
        id: event.id,
        title: event.title,
        eventDate: event.eventDate,
        guestCount: event.guestCount,
        status: event.status, // Original status from database
        derivedStatus: derivedStatus, // ✅ Derived status based on bookings + date
        derivedStatusLabel: derivedStatusLabel,
        vendorCount: vendorCount, // ✅ now excludes declined, counts distinct vendors
        totalSpent: totalSpent, // ✅ now excludes declined bookings
        createdAt: event.createdAt,
        bookingSummary: bookingSummary,
      };
    });

    return NextResponse.json(formattedEvents);
  } catch (error) {
    console.error("Error fetching umbrella events:", error);
    return NextResponse.json({ error: "Failed to fetch events" }, { status: 500 });
  }
}