// app/api/events/route.ts - Add galleryImages to response

import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const limit = url.searchParams.get("limit");
    const exclude = url.searchParams.get("exclude");
    const search = url.searchParams.get("search") || "";
    
    const where: Prisma.TicketedEventWhereInput = {
      eventDate: {
        gte: new Date(),
      },
      isActive: true,
    };

    if (exclude) {
      where.id = { not: exclude };
    }

    if (search) {
      where.OR = [
        { title: { contains: search, mode: "insensitive" } },
        { description: { contains: search, mode: "insensitive" } },
        { location: { contains: search, mode: "insensitive" } },
      ];
    }

    const events = await prisma.ticketedEvent.findMany({
      where,
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
      orderBy: {
        eventDate: "asc",
      },
      take: limit ? parseInt(limit) : undefined,
    });

    const total = await prisma.ticketedEvent.count({ where });

    const formattedEvents = events.map((event) => {
      const totalSold = event.ticketTiers.reduce((sum, tier) => sum + tier.soldCount, 0);
      const totalTickets = event.ticketTiers.reduce((sum, tier) => sum + tier.quantity, 0);
      
      return {
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
        totalSold,
        totalTickets,
        percentSold: totalTickets > 0 ? Math.round((totalSold / totalTickets) * 100) : 0,
        hasGallery: (event.galleryImages?.length || 0) > 0,
      };
    });

    return NextResponse.json({
      events: formattedEvents,
      total,
      limit: limit ? parseInt(limit) : events.length,
    });
  } catch (error) {
    console.error("Error fetching events:", error);
    return NextResponse.json(
      { error: "Failed to fetch events" },
      { status: 500 }
    );
  }
}