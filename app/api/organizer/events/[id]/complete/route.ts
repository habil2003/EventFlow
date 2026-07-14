import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    const { id } = await params;

    if (!session || session.user?.role !== 'ORGANIZER') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if event exists and belongs to this organizer
    const event = await prisma.ticketedEvent.findFirst({
      where: {
        id: id,
        organizerId: session.user.id,
      },
    });

    if (!event) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 });
    }

    // Update event - mark as completed
    const updatedEvent = await prisma.ticketedEvent.update({
      where: { id: id },
      data: {
        isActive: false,
        isCompleted: true,
        completedAt: new Date(),
      },
    });

    return NextResponse.json({
      success: true,
      message: 'Event marked as completed',
      event: updatedEvent,
    });
  } catch (error) {
    console.error('Error completing event:', error);
    return NextResponse.json({ error: 'Failed to complete event' }, { status: 500 });
  }
}