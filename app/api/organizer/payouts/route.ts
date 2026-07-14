import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    const session = await getServerSession(authOptions);

    if (!session || session.user?.role !== 'ORGANIZER') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get organizer's vendor profile (created during payout or setup)
    const organizerVendor = await prisma.vendorProfile.findFirst({
      where: { userId: session.user.id },
    });

    if (!organizerVendor) {
      // If no vendor profile exists, return empty data (not an error)
      return NextResponse.json({
        success: true,
        summary: {
          totalReleased: 0,
          totalCommission: 0,
          totalReceived: 0,
          pendingAmount: 0,
          pendingCount: 0,
          totalPayouts: 0,
        },
        payouts: [],
        pendingBookings: [],
      });
    }

    // Get all payouts for this organizer using the vendor profile ID
    const payouts = await prisma.payout.findMany({
      where: {
        type: 'TICKET_SALES',
        vendorId: organizerVendor.id,  // ✅ Use VendorProfile ID, not User ID
      },
      include: {
        ticketBooking: {
          include: {
            event: true,
            user: true,
            tier: true,
          },
        },
        admin: {
          select: { name: true, email: true },
        },
      },
      orderBy: { processedAt: 'desc' },
    });

    // Get ticket bookings that are in escrow (not yet released)
    const pendingTicketBookings = await prisma.ticketBooking.findMany({
      where: {
        event: {
          organizerId: session.user.id,
        },
        paymentStatus: 'HELD_IN_ESCROW',
        escrowReleased: false,
      },
      include: {
        event: true,
        user: true,
        tier: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    // Calculate summary
    const totalReleased = payouts.reduce((sum, p) => sum + Number(p.amount || 0), 0);
    const totalCommission = payouts.reduce((sum, p) => sum + Number(p.platformCommission || 0), 0);
    const totalReceived = payouts.reduce((sum, p) => sum + Number(p.vendorPayout || 0), 0);

    const pendingAmount = pendingTicketBookings.reduce((sum, b) => sum + Number(b.totalAmount), 0);
    const pendingCount = pendingTicketBookings.length;

    // Format payouts
    const formattedPayouts = payouts.map(p => ({
      id: p.id,
      amount: Number(p.amount),
      platformCommission: Number(p.platformCommission),
      vendorPayout: Number(p.vendorPayout),
      type: p.type,
      status: p.status,
      processedAt: p.processedAt,
      notes: p.notes,
      eventTitle: p.ticketBooking?.event?.title || 'Ticket Sales',
      ticketName: p.ticketBooking?.tier?.name,
      quantity: p.ticketBooking?.quantity,
      customerName: p.ticketBooking?.user?.name,
      adminName: p.admin?.name || 'System',
    }));

    // Format pending ticket bookings
    const formattedPending = pendingTicketBookings.map(booking => ({
      id: booking.id,
      eventTitle: booking.event.title,
      eventDate: booking.event.eventDate,
      totalAmount: Number(booking.totalAmount),
      ticketName: booking.tier.name,
      quantity: booking.quantity,
      customerName: booking.user.name,
      createdAt: booking.createdAt,
    }));

    return NextResponse.json({
      success: true,
      summary: {
        totalReleased,
        totalCommission,
        totalReceived,
        pendingAmount,
        pendingCount,
        totalPayouts: payouts.length,
      },
      payouts: formattedPayouts,
      pendingBookings: formattedPending,
    });
  } catch (error) {
    console.error('Error fetching organizer payouts:', error);
    return NextResponse.json({ error: 'Failed to fetch payouts' }, { status: 500 });
  }
}