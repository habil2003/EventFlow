// app/api/user/dashboard-stats/route.ts
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { prisma } from '@/lib/prisma';
import { authOptions } from '@/lib/auth';

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session || session.user?.role !== 'USER') {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const userId = session.user.id;

    // Get counts in parallel for better performance
    const [totalBookings, totalTickets, totalRefunds, upcomingEvents] = await Promise.all([
      // Count vendor bookings
      prisma.vendorBooking.count({
        where: { userId },
      }),
      // Count ticket bookings
      prisma.ticketBooking.count({
        where: { userId },
      }),
      // Count refunds
      prisma.refund.count({
        where: {
          OR: [
            { ticketBooking: { userId } },
            { vendorBooking: { userId } },
          ],
        },
      }),
      // Count upcoming events (events with future dates)
      prisma.ticketedEvent.count({
        where: {
          eventDate: {
            gte: new Date(),
          },
          isActive: true,
        },
      }),
    ]);

    return NextResponse.json({
      totalBookings: totalBookings + totalTickets, // Combined total
      totalTickets,
      totalRefunds,
      upcomingEvents,
    });
  } catch (error) {
    console.error('Dashboard stats error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch dashboard stats' },
      { status: 500 }
    );
  }
}