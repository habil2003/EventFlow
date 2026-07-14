import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || !session.user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    if (session.user.role !== "ORGANIZER") {
      return NextResponse.json(
        { error: "Forbidden - Organizer access required" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { title, description, eventDate, eventTime, location, capacity, ticketTiers, imageUrl } = body;

    if (!title || !eventDate || !eventTime || !location || !ticketTiers || ticketTiers.length === 0) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Create event
    const event = await prisma.ticketedEvent.create({
      data: {
        title,
        description: description || "",
        eventDate: new Date(eventDate),
        eventTime,
        location,
        capacity: capacity || 0,
        imageUrl: imageUrl || null,
        organizerId: session.user.id,
      },
    });

    // Create ticket tiers
    for (const tier of ticketTiers) {
      await prisma.ticketTier.create({
        data: {
          eventId: event.id,
          name: tier.name,
          price: tier.price,
          quantity: tier.quantity,
          soldCount: 0,
        },
      });
    }

    return NextResponse.json(
      { message: "Event created successfully", eventId: event.id },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error creating event:", error);
    return NextResponse.json(
      { error: "Failed to create event" },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    const session = await getServerSession(authOptions);

    if (!session || !session.user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    if (session.user.role !== "ORGANIZER") {
      return NextResponse.json(
        { error: "Forbidden" },
        { status: 403 }
      );
    }

    const events = await prisma.ticketedEvent.findMany({
      where: {
        organizerId: session.user.id,
      },
      include: {
        ticketTiers: true,
        bookings: {
          include: {
            tier: true,
          },
        },
      },
      orderBy: {
        eventDate: "asc",
      },
    });

    const formattedEvents = events.map((event) => {
      let totalTicketsSold = 0;
      let totalRevenue = 0;
      
      event.bookings.forEach((booking) => {
        totalTicketsSold += booking.quantity;
        totalRevenue += typeof booking.totalAmount === 'string' 
          ? parseFloat(booking.totalAmount) 
          : Number(booking.totalAmount);
      });
      
      return {
        id: event.id,
        title: event.title,
        description: event.description,
        imageUrl: event.imageUrl,
        eventDate: event.eventDate,
        eventTime: event.eventTime,
        location: event.location,
        capacity: event.capacity,
        totalTicketsSold: totalTicketsSold,
        totalRevenue: totalRevenue,
        isActive: event.isActive ?? true,      // ✅ ADD THIS
        isCompleted: event.isCompleted ?? false, // ✅ ADD THIS
        completedAt: event.completedAt,         // ✅ ADD THIS
        ticketTiers: event.ticketTiers.map((tier) => ({
          id: tier.id,
          name: tier.name,
          price: typeof tier.price === 'string' ? parseFloat(tier.price) : Number(tier.price),
          quantity: tier.quantity,
          soldCount: tier.soldCount,
        })),
      };
    });

    return NextResponse.json(formattedEvents);
  } catch (error) {
    console.error("Error fetching events:", error);
    return NextResponse.json(
      { error: "Failed to fetch events" },
      { status: 500 }
    );
  }
}