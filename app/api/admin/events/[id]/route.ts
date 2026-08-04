import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// GET /api/admin/events/[id] - Get single event
export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session || session.user?.role !== "ADMIN") {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const event = await prisma.ticketedEvent.findUnique({
      where: { id: params.id },
      include: {
        organizer: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        ticketTiers: true,
        bookings: {
          include: {
            user: {
              select: {
                name: true,
                email: true,
              },
            },
          },
        },
        _count: {
          select: {
            bookings: true,
            ticketTiers: true,
          },
        },
      },
    });

    if (!event) {
      return NextResponse.json(
        { error: "Event not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(event);
  } catch (error) {
    console.error("Error fetching event:", error);
    return NextResponse.json(
      { error: "Failed to fetch event" },
      { status: 500 }
    );
  }
}

// PATCH /api/admin/events/[id] - Update event
export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session || session.user?.role !== "ADMIN") {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { isActive, isCompleted, title, description, location } = body;

    // Check if event exists
    const existingEvent = await prisma.ticketedEvent.findUnique({
      where: { id: params.id },
    });

    if (!existingEvent) {
      return NextResponse.json(
        { error: "Event not found" },
        { status: 404 }
      );
    }

    // Update event
    const updatedEvent = await prisma.ticketedEvent.update({
      where: { id: params.id },
      data: {
        ...(isActive !== undefined && { isActive }),
        ...(isCompleted !== undefined && { isCompleted }),
        ...(title && { title }),
        ...(description !== undefined && { description }),
        ...(location && { location }),
        ...(isCompleted === true && { completedAt: new Date() }),
      },
    });

    return NextResponse.json(updatedEvent);
  } catch (error) {
    console.error("Error updating event:", error);
    return NextResponse.json(
      { error: "Failed to update event" },
      { status: 500 }
    );
  }
}

// DELETE /api/admin/events/[id] - Delete event (soft delete)
export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session || session.user?.role !== "ADMIN") {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Check if event exists
    const existingEvent = await prisma.ticketedEvent.findUnique({
      where: { id: params.id },
      include: {
        bookings: true,
      },
    });

    if (!existingEvent) {
      return NextResponse.json(
        { error: "Event not found" },
        { status: 404 }
      );
    }

    // Check if event has bookings
    if (existingEvent.bookings.length > 0) {
      return NextResponse.json(
        { error: "Cannot delete event with existing bookings. Deactivate instead." },
        { status: 400 }
      );
    }

    // Delete event
    await prisma.ticketedEvent.delete({
      where: { id: params.id },
    });

    return NextResponse.json(
      { message: "Event deleted successfully" },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error deleting event:", error);
    return NextResponse.json(
      { error: "Failed to delete event" },
      { status: 500 }
    );
  }
}