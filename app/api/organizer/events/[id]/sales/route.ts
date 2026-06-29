import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const session = await getServerSession(authOptions);

    if (!session || !session.user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Verify event belongs to organizer
    const event = await prisma.ticketedEvent.findFirst({
      where: {
        id: id,
        organizerId: session.user.id,
      },
      include: {
        ticketTiers: true,
        bookings: {
          include: {
            user: true,
            tier: true,
          },
        },
      },
    });

    if (!event) {
      return NextResponse.json(
        { error: "Event not found" },
        { status: 404 }
      );
    }

    // Calculate totals with proper number conversion
    const totalTicketsSold = event.bookings.reduce(
      (sum, booking) => sum + booking.quantity, 
      0
    );
    
    const totalRevenue = event.bookings.reduce(
      (sum, booking) => sum + Number(booking.totalAmount), 
      0
    );

    const attendees = event.bookings.map((booking) => ({
      id: booking.id,
      name: booking.user.name,
      email: booking.user.email,
      ticketName: booking.tier.name,
      quantity: booking.quantity,
      totalAmount: Number(booking.totalAmount),
      checkedIn: booking.checkedIn,
      checkedInAt: booking.checkedInAt,
      createdAt: booking.createdAt,
    }));

    return NextResponse.json({
      event: {
        id: event.id,
        title: event.title,
        eventDate: event.eventDate,
        totalTicketsSold: totalTicketsSold,
        totalRevenue: totalRevenue,
        ticketTiers: event.ticketTiers.map((tier) => ({
          id: tier.id,
          name: tier.name,
          price: Number(tier.price),
          quantity: tier.quantity,
          soldCount: tier.soldCount,
        })),
      },
      attendees,
    });
  } catch (error) {
    console.error("Error fetching sales:", error);
    return NextResponse.json(
      { error: "Failed to fetch sales data" },
      { status: 500 }
    );
  }
}