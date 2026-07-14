import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (session.user.role !== "ORGANIZER" && session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id: eventId } = await params;

    const event = await prisma.ticketedEvent.findFirst({
      where: {
        id: eventId,
        organizerId: session.user.id,
      },
    });

    if (!event && session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Event not found" }, { status: 404 });
    }

    // Fetch all bookings for this event
    const bookings = await prisma.ticketBooking.findMany({
      where: {
        eventId: eventId,
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        tier: {
          select: {
            id: true,
            name: true,
            price: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    // Convert and validate all numeric fields
    const formattedBookings = bookings.map(booking => {
      // Get tier price as number
      let price = Number(booking.tier?.price) || 0;
      
      // Get quantity as number
      let quantity = Number(booking.quantity) || 1;
      
      // Calculate correct total amount based on tier price and quantity
      const calculatedTotal = price * quantity;
      
      // Get stored total amount
      let storedTotal = Number(booking.totalAmount) || 0;
      
      // Use calculated total if stored is 0 or mismatched
      const finalTotal = (storedTotal === 0 || storedTotal !== calculatedTotal) ? calculatedTotal : storedTotal;

      return {
        ...booking,
        quantity: quantity,
        totalAmount: finalTotal,
        tier: {
          ...booking.tier,
          price: price,
        },
      };
    });

    return NextResponse.json(formattedBookings);
  } catch (error) {
    console.error("Error fetching bookings:", error);
    return NextResponse.json({ error: "Failed to fetch bookings" }, { status: 500 });
  }
}