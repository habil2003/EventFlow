import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Unwrap the params promise
    const { id } = await params;

    const session = await getServerSession(authOptions);

    if (!session || !session.user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Fetch ticket with all needed relationships
    const ticket = await prisma.ticketBooking.findFirst({
      where: {
        id: id,
        userId: session.user.id,
      },
      include: {
        event: true,
        tier: true,
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    if (!ticket) {
      return NextResponse.json(
        { error: "Ticket not found" },
        { status: 404 }
      );
    }

    // ✅ Return complete ticket data with all fields needed for QR
    const formattedTicket = {
      id: ticket.id,
      ticketNumber: ticket.ticketNumber,
      eventId: ticket.eventId, // ✅ ADDED - needed for QR validation
      userId: ticket.userId, // ✅ ADDED - for QR payload
      eventTitle: ticket.event.title,
      eventDate: ticket.event.eventDate,
      eventTime: ticket.event.eventTime,
      eventLocation: ticket.event.location,
      ticketName: ticket.tier.name,
      quantity: ticket.quantity,
      totalAmount: ticket.totalAmount,
      qrCodeHash: ticket.qrCodeHash,
      checkedIn: ticket.checkedIn,
      checkedInAt: ticket.checkedInAt,
      transactionId: ticket.transactionId,
      paymentStatus: ticket.paymentStatus, // ✅ ADDED - for validation
      createdAt: ticket.createdAt, // ✅ ADDED - for QR timestamp
      paymentIntentId: ticket.paymentIntentId,
      gateway: ticket.gateway,
      // Include user info for display
      user: {
        name: ticket.user.name,
        email: ticket.user.email,
      },
    };

    // Log successful fetch for debugging
    console.log(`📋 Ticket fetched: ${ticket.ticketNumber} for ${ticket.user.name}`);

    return NextResponse.json(formattedTicket);
    
  } catch (error) {
    console.error("❌ Error fetching ticket:", error);
    return NextResponse.json(
      { 
        error: "Failed to fetch ticket",
        message: process.env.NODE_ENV === 'development' ? String(error) : undefined
      },
      { status: 500 }
    );
  }
}