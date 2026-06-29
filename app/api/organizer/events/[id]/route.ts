import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// ✅ ADD THIS GET ENDPOINT
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const session = await getServerSession(authOptions);

    if (!session || !session.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (session.user.role !== "ORGANIZER" && session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Fetch event with ticket tiers
    const event = await prisma.ticketedEvent.findFirst({
      where: {
        id,
        organizerId: session.user.id,
      },
      include: {
        ticketTiers: true,
      },
    });

    if (!event) {
      return NextResponse.json({ error: "Event not found" }, { status: 404 });
    }

    // Calculate totals
    const totalTicketsSold = event.ticketTiers.reduce((sum, tier) => sum + tier.soldCount, 0);
    const totalRevenue = event.ticketTiers.reduce((sum, tier) => sum + (tier.soldCount * tier.price), 0);

    return NextResponse.json({
      ...event,
      totalTicketsSold,
      totalRevenue,
    });
  } catch (error) {
    console.error("Error fetching event:", error);
    return NextResponse.json({ error: "Failed to fetch event" }, { status: 500 });
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const session = await getServerSession(authOptions);

    if (!session || !session.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (session.user.role !== "ORGANIZER") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const { title, description, eventDate, eventTime, location, capacity, ticketTiers, imageUrl } = body;

    if (!title || !eventDate || !eventTime || !location) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // Update event
    const updatedEvent = await prisma.ticketedEvent.update({
      where: { id },
      data: {
        title,
        description: description || "",
        eventDate: new Date(eventDate),
        eventTime,
        location,
        capacity: capacity || 0,
        imageUrl: imageUrl || null,
      },
    });

    // ✅ Get existing tiers to preserve sold counts
    const existingTiers = await prisma.ticketTier.findMany({
      where: { eventId: id },
    });

    // Create a map of existing sold counts by tier name
    const soldCountMap = new Map();
    existingTiers.forEach(tier => {
      soldCountMap.set(tier.name, tier.soldCount);
    });

    // ✅ Update or create tiers without deleting
    for (const tier of ticketTiers) {
      const existingTier = existingTiers.find(t => t.name === tier.name);
      
      if (existingTier) {
        // Update existing tier - PRESERVE soldCount
        await prisma.ticketTier.update({
          where: { id: existingTier.id },
          data: {
            name: tier.name,
            price: tier.price,
            quantity: tier.quantity,
            // ✅ Keep the existing soldCount, don't reset to 0
            soldCount: existingTier.soldCount,
          },
        });
      } else {
        // Create new tier with soldCount = 0
        await prisma.ticketTier.create({
          data: {
            eventId: id,
            name: tier.name,
            price: tier.price,
            quantity: tier.quantity,
            soldCount: 0,
          },
        });
      }
    }

    // ✅ Delete tiers that were removed in the edit
    const newTierNames = new Set(ticketTiers.map(t => t.name));
    const tiersToDelete = existingTiers.filter(t => !newTierNames.has(t.name));
    
    for (const tier of tiersToDelete) {
      // Only delete if no tickets sold
      if (tier.soldCount === 0) {
        await prisma.ticketTier.delete({ where: { id: tier.id } });
      }
      // If tickets were sold, keep the tier but maybe mark as inactive
    }

    return NextResponse.json({ 
      message: "Event updated successfully", 
      eventId: updatedEvent.id 
    });
  } catch (error) {
    console.error("Error updating event:", error);
    return NextResponse.json({ error: "Failed to update event" }, { status: 500 });
  }
}

// Your existing DELETE endpoint
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const session = await getServerSession(authOptions);

    if (!session || !session.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (session.user.role !== "ORGANIZER") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Delete all ticket tiers first
    await prisma.ticketTier.deleteMany({
      where: { eventId: id },
    });

    // Delete the event
    await prisma.ticketedEvent.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting event:", error);
    return NextResponse.json({ error: "Failed to delete event" }, { status: 500 });
  }
}