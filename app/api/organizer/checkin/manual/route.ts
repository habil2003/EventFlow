import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || !session.user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    if (session.user.role !== "ORGANIZER") {
      return NextResponse.json(
        { error: "Forbidden" },
        { status: 403 }
      );
    }

    const { eventId, email } = await request.json();

    if (!eventId || !email) {
      return NextResponse.json(
        { error: "Missing eventId or email" },
        { status: 400 }
      );
    }

    // Find user by email
    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      return NextResponse.json({
        success: false,
        message: "User not found",
      });
    }

    // Find ticket for this user and event
    const ticket = await prisma.ticketBooking.findFirst({
      where: {
        userId: user.id,
        eventId: eventId,
      },
      include: {
        tier: true,
      },
    });

    if (!ticket) {
      return NextResponse.json({
        success: false,
        message: "No ticket found for this user",
      });
    }

    if (ticket.checkedIn) {
      return NextResponse.json({
        success: false,
        message: "Ticket already checked in",
        attendee: {
          name: user.name,
          email: user.email,
          ticketName: ticket.tier.name,
          quantity: ticket.quantity,
        },
      });
    }

    // Mark as checked in
    await prisma.ticketBooking.update({
      where: { id: ticket.id },
      data: {
        checkedIn: true,
        checkedInAt: new Date(),
      },
    });

    return NextResponse.json({
      success: true,
      message: "Successfully checked in!",
      attendee: {
        name: user.name,
        email: user.email,
        ticketName: ticket.tier.name,
        quantity: ticket.quantity,
      },
    });
  } catch (error) {
    console.error("Error processing manual check-in:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}