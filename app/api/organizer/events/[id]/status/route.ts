import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function PATCH(
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
    const { isActive } = body;

    // Update event status (you may need to add an `isActive` field to TicketedEvent model)
    const updatedEvent = await prisma.ticketedEvent.update({
      where: { id },
      data: { isActive: isActive },
    });

    return NextResponse.json({ success: true, isActive: updatedEvent.isActive });
  } catch (error) {
    console.error("Error updating event status:", error);
    return NextResponse.json({ error: "Failed to update status" }, { status: 500 });
  }
}