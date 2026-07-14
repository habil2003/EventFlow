import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);

    if (!session || !session.user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const tickets = await prisma.ticketBooking.findMany({
      where: {
        userId: session.user.id,
      },
      include: {
        event: true,
        tier: true,
        // ✅ Include latest refund for status display
        refunds: {
          take: 1,
          orderBy: { createdAt: "desc" },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    const formattedTickets = tickets.map((ticket) => {
      const latestRefund = ticket.refunds[0] ?? null;

      return {
        id: ticket.id,
        ticketNumber: ticket.ticketNumber,
        eventId: ticket.eventId,
        eventTitle: ticket.event.title,
        eventDate: ticket.event.eventDate,
        eventTime: ticket.event.eventTime,
        eventLocation: ticket.event.location,
        ticketName: ticket.tier.name,
        price: ticket.tier.price,
        quantity: ticket.quantity,
        totalAmount: ticket.totalAmount,
        qrCodeHash: ticket.qrCodeHash,
        checkedIn: ticket.checkedIn,
        checkedInAt: ticket.checkedInAt,
        transactionId: ticket.transactionId,
        createdAt: ticket.createdAt,
        paymentIntentId: ticket.paymentIntentId,
        paymentStatus: ticket.paymentStatus,
        // ✅ Refund fields
        refundStatus: latestRefund?.refundStatus ?? null,
        refundAmount: latestRefund ? Number(latestRefund.refundAmount) : null,
      };
    });

    return NextResponse.json(formattedTickets);
  } catch (error) {
    console.error("Error fetching tickets:", error);
    return NextResponse.json(
      { error: "Failed to fetch tickets" },
      { status: 500 }
    );
  }
}