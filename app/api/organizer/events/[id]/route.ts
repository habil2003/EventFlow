// app/api/organizer/events/[id]/route.ts

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type TicketTierBody = {
  id?: string;
  name: string;
  price: number;
  quantity: number;
};

// GET - Fetch single event for organizer
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    const event = await prisma.ticketedEvent.findUnique({
      where: { id },
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
      return NextResponse.json({ error: "Event not found" }, { status: 404 });
    }

    if (event.organizerId !== session.user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // ✅ Calculate all stats
    const totalTickets = event.ticketTiers.reduce((sum, tier) => sum + tier.quantity, 0);
    const totalSold = event.ticketTiers.reduce((sum, tier) => sum + tier.soldCount, 0);
    const percentSold = totalTickets > 0 ? Math.round((totalSold / totalTickets) * 100) : 0;
    const totalRevenue = event.ticketTiers.reduce((sum, tier) => {
      return sum + (tier.soldCount * Number(tier.price));
    }, 0);

    return NextResponse.json({
      id: event.id,
      title: event.title,
      description: event.description,
      imageUrl: event.imageUrl,
      galleryImages: event.galleryImages || [],
      eventDate: event.eventDate,
      eventTime: event.eventTime,
      location: event.location,
      capacity: event.capacity,
      organizer: event.organizer,
      ticketTiers: event.ticketTiers.map(tier => ({
        id: tier.id,
        name: tier.name,
        price: Number(tier.price),
        quantity: tier.quantity,
        soldCount: tier.soldCount,
      })),
      // ✅ All stats for frontend
      totalTickets,
      totalSold,
      percentSold,
      totalRevenue,
      totalTicketsSold: totalSold,
      isActive: event.isActive ?? true,
      isCompleted: event.isCompleted ?? false,
      completedAt: event.completedAt,
    });
  } catch (error) {
    console.error("Error fetching event:", error);
    return NextResponse.json(
      { error: "Failed to fetch event" },
      { status: 500 }
    );
  }
}

// PUT - Update event
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();

    const {
      title,
      description,
      eventDate,
      eventTime,
      location,
      capacity,
      ticketTiers,
      imageUrl,
      galleryImages,
    } = body;

    // Validate required fields
    if (!title || !eventDate || !eventTime || !location) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Check if event exists and user is the organizer
    const existingEvent = await prisma.ticketedEvent.findUnique({
      where: { id },
      include: { ticketTiers: true },
    });

    if (!existingEvent) {
      return NextResponse.json({ error: "Event not found" }, { status: 404 });
    }

    if (existingEvent.organizerId !== session.user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Validate capacity
    const numericCapacity = parseInt(capacity, 10);
    if (isNaN(numericCapacity) || numericCapacity < 1) {
      return NextResponse.json(
        { error: "Please enter a valid capacity (minimum 1)" },
        { status: 400 }
      );
    }

    // Validate ticket tiers
    if (!ticketTiers || ticketTiers.length === 0) {
      return NextResponse.json(
        { error: "At least one ticket tier is required" },
        { status: 400 }
      );
    }

    // Validate each tier
    for (const tier of ticketTiers) {
      if (!tier.name || tier.name.trim() === "") {
        return NextResponse.json(
          { error: "All ticket tiers must have a name" },
          { status: 400 }
        );
      }
      if (tier.price <= 0) {
        return NextResponse.json(
          { error: `Ticket tier "${tier.name}" must have a price greater than 0` },
          { status: 400 }
        );
      }
      if (tier.quantity <= 0) {
        return NextResponse.json(
          { error: `Ticket tier "${tier.name}" must have a quantity greater than 0` },
          { status: 400 }
        );
      }
    }

    // Validate total tickets don't exceed capacity
    const totalTickets = ticketTiers.reduce((sum: number, tier: TicketTierBody) => sum + tier.quantity, 0);
    if (totalTickets > numericCapacity) {
      return NextResponse.json(
        { error: `Total tickets (${totalTickets}) exceed event capacity (${numericCapacity})` },
        { status: 400 }
      );
    }

    // Check if any tier quantities were reduced below sold count
    const existingTiersMap = new Map(
      existingEvent.ticketTiers.map(t => [t.id, t])
    );

    for (const tier of ticketTiers) {
      if (tier.id) {
        const existingTier = existingTiersMap.get(tier.id);
        if (existingTier && tier.quantity < existingTier.soldCount) {
          return NextResponse.json(
            { 
              error: `Cannot reduce "${tier.name}" quantity below ${existingTier.soldCount} sold tickets.`,
              tierName: tier.name,
              soldCount: existingTier.soldCount,
            },
            { status: 400 }
          );
        }
      }
    }

    // Update the event with transaction
    const updatedEvent = await prisma.$transaction(async (prisma) => {
      // Update the event
      const event = await prisma.ticketedEvent.update({
        where: { id },
        data: {
          title,
          description,
          eventDate: new Date(`${eventDate}T${eventTime}`),
          eventTime,
          location,
          capacity: numericCapacity,
          imageUrl: imageUrl || null,
          galleryImages: galleryImages || [],
          updatedAt: new Date(),
        },
      });

      // Handle ticket tiers
      const existingTierIds = existingEvent.ticketTiers.map(t => t.id);
      const updatedTierIds = ticketTiers
        .filter((t: TicketTierBody) => t.id)
        .map((t: TicketTierBody) => t.id);

      // Delete tiers that were removed (only if no sold tickets)
      const tiersToDelete = existingTierIds.filter(
        (id) => !updatedTierIds.includes(id)
      );

      for (const tierId of tiersToDelete) {
        const tier = existingEvent.ticketTiers.find(t => t.id === tierId);
        if (tier && tier.soldCount === 0) {
          await prisma.ticketTier.delete({
            where: { id: tierId },
          });
        }
      }

      // Update or create tiers
      for (const tier of ticketTiers) {
        if (tier.id && existingTierIds.includes(tier.id)) {
          // Update existing tier
          await prisma.ticketTier.update({
            where: { id: tier.id },
            data: {
              name: tier.name,
              price: tier.price,
              quantity: tier.quantity,
            },
          });
        } else {
          // Create new tier
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
      }

      // Return updated event with ticket tiers
      return await prisma.ticketedEvent.findUnique({
        where: { id },
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
    });

    return NextResponse.json({
      success: true,
      message: "Event updated successfully",
      event: {
        id: updatedEvent?.id,
        title: updatedEvent?.title,
        description: updatedEvent?.description,
        imageUrl: updatedEvent?.imageUrl,
        galleryImages: updatedEvent?.galleryImages,
        eventDate: updatedEvent?.eventDate,
        eventTime: updatedEvent?.eventTime,
        location: updatedEvent?.location,
        capacity: updatedEvent?.capacity,
        ticketTiers: updatedEvent?.ticketTiers,
      },
    });
  } catch (error) {
    console.error("Error updating event:", error);
    return NextResponse.json(
      { error: "Failed to update event" },
      { status: 500 }
    );
  }
}

// DELETE - Delete event
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    // Check if event exists and user is the organizer
    const existingEvent = await prisma.ticketedEvent.findUnique({
      where: { id },
      include: {
        ticketTiers: true,
        bookings: true,
      },
    });

    if (!existingEvent) {
      return NextResponse.json({ error: "Event not found" }, { status: 404 });
    }

    if (existingEvent.organizerId !== session.user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Check if there are any bookings
    if (existingEvent.bookings && existingEvent.bookings.length > 0) {
      return NextResponse.json(
        { 
          error: "Cannot delete event with existing bookings. Please cancel all bookings first." 
        },
        { status: 400 }
      );
    }

    // Delete the event (cascade will delete ticket tiers)
    await prisma.ticketedEvent.delete({
      where: { id },
    });

    return NextResponse.json({
      success: true,
      message: "Event deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting event:", error);
    return NextResponse.json(
      { error: "Failed to delete event" },
      { status: 500 }
    );
  }
}