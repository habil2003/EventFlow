// app/api/user/social-events/route.ts

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
    
    const umbrellaEvents = await prisma.userSocialEvent.findMany({
      where: {
        userId: session.user.id,
      },
      include: {
        vendorBookings: {
          select: {
            totalAmount: true,
            bookingStatus: true,
          }
        }
      },
      orderBy: {
        createdAt: "desc",
      },
    });
    
    const formattedEvents = umbrellaEvents.map(event => ({
      id: event.id,
      title: event.title,
      eventDate: event.eventDate,
      guestCount: event.guestCount,
      status: event.status,
      vendorCount: event.vendorBookings.length,
      // ✅ FIXED: Convert to Number before summing
      totalSpent: event.vendorBookings.reduce((sum, booking) => {
        return sum + Number(booking.totalAmount);
      }, 0),
      createdAt: event.createdAt,
    }));
    
    return NextResponse.json(formattedEvents);
  } catch (error) {
    console.error("Error fetching umbrella events:", error);
    return NextResponse.json({ error: "Failed to fetch events" }, { status: 500 });
  }
}