// app/api/user/recent-activity/route.ts
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

    // Get recent ticket bookings
    const ticketBookings = await prisma.ticketBooking.findMany({
      where: { userId },
      include: {
        event: {
          select: {
            title: true,
          },
        },
        tier: {
          select: {
            name: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 5,
    });

    // Get recent vendor bookings
    const vendorBookings = await prisma.vendorBooking.findMany({
      where: { userId },
      include: {
        vendor: {
          select: {
            businessName: true,
          },
        },
        servicePackage: {
          select: {
            name: true,
          },
        },
        userSocialEvent: {
          select: {
            title: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 5,
    });

    // Combine and format activities
    const activities = [
      ...ticketBookings.map((booking) => ({
        id: booking.id,
        type: 'ticket' as const,
        title: booking.event?.title || 'Unknown Event',
        date: booking.createdAt.toISOString(),
        status: booking.paymentStatus,
        amount: Number(booking.totalAmount),
      })),
      ...vendorBookings.map((booking) => ({
        id: booking.id,
        type: 'booking' as const,
        title: booking.vendor?.businessName || 'Unknown Vendor',
        date: booking.createdAt.toISOString(),
        status: booking.bookingStatus,
        amount: Number(booking.totalAmount),
      })),
    ];

    // Sort by date (newest first) and limit to 5
    const sortedActivities = activities
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 5);

    return NextResponse.json(sortedActivities);
  } catch (error) {
    console.error('Recent activity error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch recent activity' },
      { status: 500 }
    );
  }
}