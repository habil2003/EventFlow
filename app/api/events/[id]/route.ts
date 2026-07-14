// app/api/events/[id]/route.ts - Add galleryImages to response

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const event = await prisma.ticketedEvent.findUnique({
      where: {
        id: id,
      },
      include: {
        ticketTiers: true,
        organizer: {
          select: {
            id: true,
            name: true,
            email: true,
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

    // Calculate ticket stats
    const totalTickets = event.ticketTiers.reduce((sum, tier) => sum + tier.quantity, 0);
    const totalSold = event.ticketTiers.reduce((sum, tier) => sum + tier.soldCount, 0);
    const percentSold = totalTickets > 0 ? Math.round((totalSold / totalTickets) * 100) : 0;

    return NextResponse.json({
      id: event.id,
      title: event.title,
      description: event.description,
      imageUrl: event.imageUrl,
      galleryImages: event.galleryImages || [], // ✅ ADD THIS
      eventDate: event.eventDate,
      eventTime: event.eventTime,
      location: event.location,
      capacity: event.capacity,
      organizer: event.organizer,
      ticketTiers: event.ticketTiers.map(tier => ({
        id: tier.id,
        name: tier.name,
        price: tier.price,
        quantity: tier.quantity,
        soldCount: tier.soldCount,
      })),
      totalTickets,
      totalSold,
      percentSold,
    });
  } catch (error) {
    console.error("Error fetching event:", error);
    return NextResponse.json(
      { error: "Failed to fetch event" },
      { status: 500 }
    );
  }
}