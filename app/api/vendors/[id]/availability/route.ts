import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    if (!startDate || !endDate) {
      return NextResponse.json({ error: 'Start date and end date required' }, { status: 400 });
    }

    const start = new Date(startDate);
    const end = new Date(endDate);

    // Get all bookings for this vendor in the date range
    const bookings = await prisma.vendorBooking.findMany({
      where: {
        vendorId: id,
        bookingStatus: { notIn: ['DECLINED'] }, // ✅ Fixed: removed 'CANCELLED'
        OR: [
          { startDate: { lte: end }, endDate: { gte: start } }
        ],
      },
      include: {
        userSocialEvent: true,
      },
    });

    // Get manually blocked dates
    const blockedDates = await prisma.vendorUnavailableDate.findMany({
      where: {
        vendorId: id,
        date: {
          gte: start,
          lte: end,
        },
      },
    });

    // Build array of unavailable dates
    const unavailableDates: string[] = [];

    bookings.forEach(booking => {
      const currentDate = new Date(booking.startDate);
      const endDateBooking = new Date(booking.endDate);
      
      while (currentDate <= endDateBooking) {
        unavailableDates.push(currentDate.toISOString().split('T')[0]);
        currentDate.setDate(currentDate.getDate() + 1);
      }
    });

    blockedDates.forEach(blocked => {
      unavailableDates.push(blocked.date.toISOString().split('T')[0]);
    });

    const uniqueUnavailableDates = [...new Set(unavailableDates)];

    return NextResponse.json({
      success: true,
      unavailableDates: uniqueUnavailableDates,
    });
  } catch (error) {
    console.error('Error fetching availability:', error);
    return NextResponse.json({ error: 'Failed to fetch availability' }, { status: 500 });
  }
}