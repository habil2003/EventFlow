import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || session.user?.role !== 'ORGANIZER') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const eventId = searchParams.get('eventId');
    const search = searchParams.get('search') || '';

    if (!eventId) {
      return NextResponse.json({ error: 'Event ID is required' }, { status: 400 });
    }

    // ✅ FIX: Changed from prisma.ticket to prisma.ticketBooking
    const tickets = await prisma.ticketBooking.findMany({
      where: {
        eventId: eventId,
        OR: [
          {
            ticketNumber: {
              contains: search,
              mode: 'insensitive',
            },
          },
          {
            user: {
              name: {
                contains: search,
                mode: 'insensitive',
              },
            },
          },
          {
            user: {
              email: {
                contains: search,
                mode: 'insensitive',
              },
            },
          },
        ],
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
        event: {
          select: {
            id: true,
            title: true,
            eventDate: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    // Format the response
    const formattedTickets = tickets.map(ticket => ({
      id: ticket.id,
      ticketNumber: ticket.ticketNumber,
      userName: ticket.user?.name || 'Unknown',
      userEmail: ticket.user?.email || 'Unknown',
      tierName: ticket.tier?.name || 'Standard',
      price: ticket.tier?.price || 0,
      checkedIn: ticket.checkedIn,
      checkedInAt: ticket.checkedInAt,
      createdAt: ticket.createdAt,
    }));

    return NextResponse.json({
      success: true,
      tickets: formattedTickets,
      total: formattedTickets.length,
    });

  } catch (error) {
    console.error('Error fetching tickets:', error);
    return NextResponse.json(
      { error: 'Failed to fetch tickets' },
      { status: 500 }
    );
  }
}