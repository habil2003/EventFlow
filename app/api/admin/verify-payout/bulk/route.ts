import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || session.user?.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { 
      eventId, 
      bookingIds,
      transactionReference, 
      proofImageUrl, 
      transferMethod,
      notes 
    } = await request.json();

    if (!eventId || !bookingIds || bookingIds.length === 0) {
      return NextResponse.json({ error: 'Missing eventId or bookingIds' }, { status: 400 });
    }

    if (!transactionReference) {
      return NextResponse.json({ error: 'Missing transactionReference' }, { status: 400 });
    }

    if (!proofImageUrl) {
      return NextResponse.json({ error: 'Missing proofImageUrl' }, { status: 400 });
    }

    // Find all pending payouts for these bookings
    const payouts = await prisma.payout.findMany({
      where: {
        ticketBookingId: { in: bookingIds },
        status: 'PENDING',
        type: 'TICKET_SALES',
      },
      include: {
        ticketBooking: true,
      },
    });

    if (payouts.length === 0) {
      return NextResponse.json({ 
        error: 'No pending payouts found for these bookings' 
      }, { status: 404 });
    }

    const results = [];
    const errors = [];

    // Process each payout
    for (const payout of payouts) {
      try {
        // Update payout as COMPLETED
        const updatedPayout = await prisma.payout.update({
          where: { id: payout.id },
          data: {
            status: 'COMPLETED',
            khaltiPayoutId: transactionReference,
            processedAt: new Date(),
            adminId: session.user.id,
            notes: `[BULK VERIFICATION] Manual ${transferMethod} transfer completed. 
Reference: ${transactionReference}. 
Proof: ${proofImageUrl}
Verified by: ${session.user.email} (${session.user.name || 'Admin'})
${notes ? `Admin notes: ${notes}` : ''}`,
          },
        });

        // Update the associated ticket booking
        if (payout.ticketBookingId) {
          await prisma.ticketBooking.update({
            where: { id: payout.ticketBookingId },
            data: {
              paymentStatus: 'COMPLETED',
            },
          });
        }

        results.push({
          payoutId: payout.id,
          bookingId: payout.ticketBookingId,
          success: true,
        });
      } catch (error: any) {
        errors.push({
          payoutId: payout.id,
          bookingId: payout.ticketBookingId,
          error: error.message,
        });
      }
    }

    return NextResponse.json({
      success: true,
      totalProcessed: results.length,
      totalErrors: errors.length,
      results,
      errors,
      message: `Bulk verification completed: ${results.length} payouts verified, ${errors.length} failed.`,
      eventId: eventId,
      transactionReference,
    });

  } catch (error) {
    console.error('Error in bulk verification:', error);
    return NextResponse.json({ 
      error: 'Bulk verification failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}