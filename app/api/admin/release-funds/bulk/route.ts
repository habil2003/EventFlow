// app/api/admin/release-funds/bulk/route.ts

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

// Helper function to get platform commission rate
async function getPlatformCommissionRate(): Promise<number> {
  return Number(process.env.PLATFORM_COMMISSION || '0.1');
}

// Helper function to release a single ticket funds
async function releaseSingleTicketFunds(
  bookingId: string, 
  adminId: string, 
  adminEmail: string,
  eventTitle: string,
  bulkPayoutId?: string
) {
  const ticketBooking = await prisma.ticketBooking.findUnique({
    where: { id: bookingId },
    include: {
      event: {
        include: {
          organizer: true,
        },
      },
      user: true,
      refunds: true,
      payouts: true,
    },
  });

  if (!ticketBooking) {
    throw new Error(`Ticket booking ${bookingId} not found`);
  }

  // Check if already released
  if (ticketBooking.escrowReleased) {
    throw new Error(`Funds already released for ticket ${bookingId}`);
  }

  // Check if event is completed
  if (!ticketBooking.event.isCompleted) {
    throw new Error(`Event ${ticketBooking.event.title} has not been marked as completed`);
  }

  // Check for active refunds
  const activeRefund = ticketBooking.refunds.find(r =>
    ['PENDING', 'PENDING_ADMIN', 'PROCESSING'].includes(r.refundStatus)
  );

  if (activeRefund) {
    throw new Error(`Active refund in progress for ticket ${bookingId} (ID: ${activeRefund.id})`);
  }

  // Check for existing pending payout
  const existingPendingPayout = ticketBooking.payouts.find(p =>
    p.type === 'TICKET_SALES' && p.status === 'PENDING'
  );

  if (existingPendingPayout) {
    throw new Error(`Payout already pending for ticket ${bookingId} (ID: ${existingPendingPayout.id})`);
  }

  const commissionRate = await getPlatformCommissionRate();
  const totalAmount = Number(ticketBooking.totalAmount);
  const platformCommission = totalAmount * commissionRate;
  const organizerPayout = totalAmount - platformCommission;

  // Update ticket booking
  await prisma.ticketBooking.update({
    where: { id: ticketBooking.id },
    data: {
      paymentStatus: 'PROCESSING_PAYOUT',
      escrowReleased: true,
      amountReleasedAt: new Date(),
    },
  });

  // Find or create vendor profile for organizer
  let organizerVendorProfile = await prisma.vendorProfile.findFirst({
    where: { userId: ticketBooking.event.organizerId },
  });

  if (!organizerVendorProfile) {
    const organizerUser = await prisma.user.findUnique({
      where: { id: ticketBooking.event.organizerId },
    });

    organizerVendorProfile = await prisma.vendorProfile.create({
      data: {
        userId: ticketBooking.event.organizerId,
        businessName: `${organizerUser?.name || 'Organizer'}'s Events`,
        serviceType: 'Event Organizer',
        location: 'Nepal',
        description: 'Auto-created for ticket payouts',
      },
    });
  }

  // Create individual payout record
  const payout = await prisma.payout.create({
    data: {
      ticketBookingId: ticketBooking.id,
      vendorId: organizerVendorProfile.id,
      amount: totalAmount,
      platformCommission: platformCommission,
      vendorPayout: organizerPayout,
      type: 'TICKET_SALES',
      status: 'PENDING',
      adminId: adminId,
      processedAt: null,
      notes: `[BULK RELEASE] Pending manual payout. Released by ${adminEmail} - Ticket sales for ${eventTitle}. Platform commission: ${platformCommission}`,
      transactionId: `pending_bulk_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
      // ✅ Link to bulk payout if provided
      ...(bulkPayoutId ? { bulkPayoutId: bulkPayoutId } : {}),
    },
  });

  return {
    success: true,
    bookingId: bookingId,
    payoutId: payout.id,
    amount: totalAmount,
    netPayout: organizerPayout,
    platformCommission: platformCommission,
    customerName: ticketBooking.user?.name || 'Unknown',
    ticketNumber: ticketBooking.ticketNumber,
  };
}

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || session.user?.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { bookingIds, eventId } = await request.json();

    console.log('Bulk ticket release request:', { bookingIds, eventId, admin: session.user.email });

    // Validate input
    if (!bookingIds || !Array.isArray(bookingIds) || bookingIds.length === 0) {
      return NextResponse.json({ error: 'No booking IDs provided' }, { status: 400 });
    }

    if (bookingIds.length > 50) {
      return NextResponse.json({ 
        error: 'Maximum 50 ticket bookings can be released at once' 
      }, { status: 400 });
    }

    // Get event details first to ensure all bookings belong to the same event
    const firstBooking = await prisma.ticketBooking.findUnique({
      where: { id: bookingIds[0] },
      include: { 
        event: {
          include: {
            organizer: {
              include: {
                user: true
              }
            }
          }
        },
        user: true
      }
    });

    if (!firstBooking) {
      return NextResponse.json({ error: 'First booking not found' }, { status: 404 });
    }

    const eventTitle = firstBooking.event.title;
    const organizerId = firstBooking.event.organizerId;
    const organizerName = firstBooking.event.organizer?.user?.name || 'Organizer';

    // Verify all bookings belong to the same event and are valid
    const allBookings = await prisma.ticketBooking.findMany({
      where: {
        id: { in: bookingIds },
        eventId: firstBooking.event.id,
        paymentStatus: 'HELD_IN_ESCROW',
        escrowReleased: false,
      },
      include: {
        event: true,
        user: true,
        refunds: true,
        payouts: true,
      },
    });

    if (allBookings.length !== bookingIds.length) {
      const foundIds = allBookings.map(b => b.id);
      const missingIds = bookingIds.filter(id => !foundIds.includes(id));
      return NextResponse.json({ 
        error: `Some bookings are invalid or already released: ${missingIds.join(', ')}` 
      }, { status: 400 });
    }

    // Check if event is completed
    if (!firstBooking.event.isCompleted) {
      return NextResponse.json({ 
        error: `Event "${eventTitle}" has not been marked as completed. Cannot release tickets.` 
      }, { status: 400 });
    }

    // Check for active refunds in any booking
    const hasActiveRefund = allBookings.some(b => 
      b.refunds.some(r => ['PENDING', 'PENDING_ADMIN', 'PROCESSING'].includes(r.refundStatus))
    );

    if (hasActiveRefund) {
      return NextResponse.json({ 
        error: 'One or more bookings have active refunds. Cannot bulk release.' 
      }, { status: 400 });
    }

    // Check for existing pending payouts
    const hasPendingPayout = allBookings.some(b => 
      b.payouts.some(p => p.type === 'TICKET_SALES' && p.status === 'PENDING')
    );

    if (hasPendingPayout) {
      return NextResponse.json({ 
        error: 'One or more bookings already have pending payouts. Cannot bulk release.' 
      }, { status: 400 });
    }

    // Calculate totals for bulk payout
    const commissionRate = await getPlatformCommissionRate();
    let totalAmount = 0;
    let totalCommission = 0;
    let totalPayout = 0;

    allBookings.forEach(b => {
      const amount = Number(b.totalAmount);
      totalAmount += amount;
      totalCommission += amount * commissionRate;
      totalPayout += amount - (amount * commissionRate);
    });

    // ✅ Create a BULK payout record FIRST
    // Find or create vendor profile for organizer
    let organizerVendorProfile = await prisma.vendorProfile.findFirst({
      where: { userId: organizerId },
    });

    if (!organizerVendorProfile) {
      organizerVendorProfile = await prisma.vendorProfile.create({
        data: {
          userId: organizerId,
          businessName: `${organizerName}'s Events`,
          serviceType: 'Event Organizer',
          location: 'Nepal',
          description: 'Auto-created for ticket payouts',
        },
      });
    }

    // ✅ Create the bulk payout record
    const bulkPayout = await prisma.payout.create({
      data: {
        vendorId: organizerVendorProfile.id,
        amount: totalAmount,
        platformCommission: totalCommission,
        vendorPayout: totalPayout,
        type: 'TICKET_SALES_BULK',
        status: 'PENDING',
        adminId: session.user.id,
        processedAt: null,
        notes: `[BULK PAYOUT] ${allBookings.length} tickets for "${eventTitle}". Released by ${session.user.email}. Total: NPR ${totalAmount}. Platform commission: ${totalCommission}. Organizer receives: ${totalPayout}.`,
        transactionId: `bulk_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
        // ✅ Store event info for reference
      },
    });

    const results = [];
    const errors = [];
    let successCount = 0;

    // Process each booking - link to bulk payout
    for (const booking of allBookings) {
      try {
        const result = await releaseSingleTicketFunds(
          booking.id,
          session.user.id,
          session.user.email || 'admin',
          eventTitle,
          bulkPayout.id // ✅ Pass bulk payout ID to link
        );
        results.push(result);
        successCount++;
      } catch (error: any) {
        console.error(`Error releasing booking ${booking.id}:`, error);
        errors.push({
          bookingId: booking.id,
          error: error.message || 'Unknown error occurred'
        });
      }
    }

    return NextResponse.json({
      success: true,
      eventId: firstBooking.event.id,
      eventTitle: eventTitle,
      totalProcessed: results.length,
      totalErrors: errors.length,
      results,
      errors,
      // ✅ Include bulk payout info
      bulkPayout: {
        id: bulkPayout.id,
        totalAmount: totalAmount,
        totalCommission: totalCommission,
        totalPayout: totalPayout,
        ticketCount: allBookings.length,
      },
      summary: {
        successCount: successCount,
        failureCount: errors.length,
        totalAmount: totalAmount,
        totalCommission: totalCommission,
        totalNetPayout: totalPayout,
        totalBookings: results.length,
      },
      message: `Bulk release completed: ${successCount} successful, ${errors.length} failed for event "${eventTitle}".`
    });

  } catch (error) {
    console.error('Error in bulk release:', error);
    return NextResponse.json({ 
      error: 'Bulk release failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}