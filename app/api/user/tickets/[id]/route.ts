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

    const formattedTicket = {
      id: ticket.id,
      ticketNumber: ticket.ticketNumber,
      eventId: ticket.eventId,
      userId: ticket.userId,
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
      paymentStatus: ticket.paymentStatus,
      createdAt: ticket.createdAt,
      user: {
        name: ticket.user.name,
        email: ticket.user.email,
      },
    };

    return NextResponse.json(formattedTicket);
    
  } catch (error) {
    console.error("Error fetching ticket:", error);
    return NextResponse.json(
      { error: "Failed to fetch ticket" },
      { status: 500 }
    );
  }
}