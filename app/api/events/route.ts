import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const limit = url.searchParams.get("limit");
    
    const events = await prisma.ticketedEvent.findMany({
      where: {
        eventDate: {
          gte: new Date(),
        },
      },
      include: {
        ticketTiers: true,
        organizer: {
          select: {
            name: true,
            email: true,
          },
        },
      },
      orderBy: {
        eventDate: "asc",
      },
      take: limit ? parseInt(limit) : undefined,
    });

    const formattedEvents = events.map((event) => ({
      id: event.id,
      title: event.title,
      description: event.description,
      imageUrl: event.imageUrl,
      eventDate: event.eventDate,
      eventTime: event.eventTime,
      location: event.location,
      capacity: event.capacity,
      organizer: event.organizer,
      ticketTiers: event.ticketTiers,
    }));

    return NextResponse.json(formattedEvents);
  } catch (error) {
    console.error("Error fetching events:", error);
    return NextResponse.json(
      { error: "Failed to fetch events" },
      { status: 500 }
    );
  }
}