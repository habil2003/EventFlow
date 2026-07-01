import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// ============================================
// GET: Fetch event details
// ============================================

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

    // Fetch event with ticket tiers and bookings
    const event = await prisma.ticketedEvent.findFirst({
      where: {
        id,
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
    });

    if (!event) {
      return NextResponse.json({ error: "Event not found" }, { status: 404 });
    }

    // ============================================
    // ✅ FIX: Calculate from actual bookings (like Events List)
    // ============================================

    let totalTicketsSold = 0;
    let totalRevenue = 0;

    // Calculate from actual bookings
    event.bookings.forEach((booking) => {
      totalTicketsSold += booking.quantity;
      totalRevenue += typeof booking.totalAmount === 'string' 
        ? parseFloat(booking.totalAmount) 
        : Number(booking.totalAmount);
    });

    // Also update the soldCount in tiers to match actual bookings
    // Group bookings by tierId
    const tierBookingCounts = new Map();
    event.bookings.forEach((booking) => {
      const tierId = booking.tierId;
      tierBookingCounts.set(tierId, (tierBookingCounts.get(tierId) || 0) + booking.quantity);
    });

    // Update each tier's soldCount to match actual bookings
    const updatedTiers = await Promise.all(
      event.ticketTiers.map(async (tier) => {
        const actualSold = tierBookingCounts.get(tier.id) || 0;
        
        // If the database has incorrect soldCount, update it
        if (tier.soldCount !== actualSold) {
          console.log(`📊 Fixing tier ${tier.name}: ${tier.soldCount} → ${actualSold}`);
          await prisma.ticketTier.update({
            where: { id: tier.id },
            data: { soldCount: actualSold },
          });
        }
        
        return {
          id: tier.id,
          name: tier.name,
          price: typeof tier.price === 'string' ? parseFloat(tier.price) : Number(tier.price),
          quantity: tier.quantity,
          soldCount: actualSold,
        };
      })
    );

    // Format response (matching Events List format)
    const formattedEvent = {
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
      isActive: event.isActive ?? true,
      isCompleted: event.isCompleted ?? false,
      completedAt: event.completedAt,
      createdAt: event.createdAt,
      updatedAt: event.updatedAt,
      ticketTiers: updatedTiers,
    };

    console.log(`📊 Event ${event.title}: Total tickets sold = ${totalTicketsSold}`);

    return NextResponse.json(formattedEvent);
  } catch (error) {
    console.error("Error fetching event:", error);
    return NextResponse.json({ error: "Failed to fetch event" }, { status: 500 });
  }
}

// ============================================
// PUT: Update event
// ============================================

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

    // Get existing tiers to preserve sold counts
    const existingTiers = await prisma.ticketTier.findMany({
      where: { eventId: id },
    });

    // Update or create tiers
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

    // Delete tiers that were removed (only if no tickets sold)
    const newTierNames = new Set(ticketTiers.map((t: { name: string }) => t.name));
    const tiersToDelete = existingTiers.filter((t: { name: string }) => !newTierNames.has(t.name));
    
    for (const tier of tiersToDelete) {
      if (tier.soldCount === 0) {
        await prisma.ticketTier.delete({ where: { id: tier.id } });
      }
      // If tickets were sold, keep the tier
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

// ============================================
// DELETE: Delete event
// ============================================

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