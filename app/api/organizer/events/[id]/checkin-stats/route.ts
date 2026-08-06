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

    // ✅ SECURITY: Only the event's own organizer (or an admin) may view
    // check-in stats. Without this, any authenticated user could read the
    // check-in data for any event on the platform.
    const event = await prisma.ticketedEvent.findUnique({
      where: { id },
      select: { organizerId: true },
    });

    if (!event) {
      return NextResponse.json({ error: "Event not found" }, { status: 404 });
    }

    const isOwner = event.organizerId === session.user.id;
    const isAdmin = session.user.role === "ADMIN";

    if (!isOwner && !isAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const tickets = await prisma.ticketBooking.findMany({
      where: {
        eventId: id,
      },
      include: {
        user: true,
      },
    });

    const checkedInCount = tickets.filter(t => t.checkedIn).length;
    const totalTickets = tickets.length;

    const recentScans = await prisma.ticketBooking.findMany({
      where: {
        eventId: id,
        checkedIn: true,
      },
      orderBy: {
        checkedInAt: "desc",
      },
      take: 10,
      include: {
        user: true,
      },
    });

    const formattedScans = recentScans.map(scan => ({
      id: scan.id,
      name: scan.user.name,
      time: scan.checkedInAt,
    }));

    return NextResponse.json({
      checkedInCount,
      totalTickets,
      recentScans: formattedScans,
    });
  } catch (error) {
    console.error("Error:", error);
    return NextResponse.json(
      { error: "Failed" },
      { status: 500 }
    );
  }
}