// app/api/admin/verify-payout/bulk/route.ts

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
      payoutIds,
      transactionReference, 
      proofImageUrl, 
      transferMethod,
      notes 
    } = await request.json();

    console.log('Bulk verify request:', { eventId, bookingIds, payoutIds });

    // Validate required fields
    if (!eventId) {
      return NextResponse.json({ error: 'Missing eventId' }, { status: 400 });
    }

    if (!bookingIds || !Array.isArray(bookingIds) || bookingIds.length === 0) {
      return NextResponse.json({ error: 'Missing bookingIds' }, { status: 400 });
    }

    if (!transactionReference) {
      return NextResponse.json({ error: 'Missing transactionReference' }, { status: 400 });
    }

    if (!proofImageUrl) {
      return NextResponse.json({ error: 'Missing proofImageUrl' }, { status: 400 });
    }

    // Validate transferMethod
    const allowedMethods = ['BANK_TRANSFER', 'CASH', 'CHEQUE'];
    if (!transferMethod || !allowedMethods.includes(transferMethod)) {
      return NextResponse.json({ 
        error: `Invalid transferMethod. Allowed: ${allowedMethods.join(', ')}` 
      }, { status: 400 });
    }

    // Basic URL validation for proofImageUrl
    try {
      new URL(proofImageUrl);
    } catch {
      return NextResponse.json({ 
        error: 'Invalid proofImageUrl format' 
      }, { status: 400 });
    }

    // Find all pending payouts - either by bookingIds or payoutIds
    let payouts;
    if (payoutIds && payoutIds.length > 0) {
      // Use payoutIds directly if provided
      payouts = await prisma.payout.findMany({
        where: {
          id: { in: payoutIds },
          status: 'PENDING',
          type: 'TICKET_SALES',
        },
        include: {
          ticketBooking: true,
          parentPayout: true,
        },
      });
    } else {
      // Fallback to bookingIds
      payouts = await prisma.payout.findMany({
        where: {
          ticketBookingId: { in: bookingIds },
          status: 'PENDING',
          type: 'TICKET_SALES',
        },
        include: {
          ticketBooking: true,
          parentPayout: true,
        },
      });
    }

    console.log('Found payouts:', payouts.length);

    if (payouts.length === 0) {
      return NextResponse.json({ 
        error: 'No pending payouts found for these bookings' 
      }, { status: 404 });
    }

    // Track parent payout IDs for bulk update
    const parentPayoutIds = new Set<string>();
    for (const payout of payouts) {
      if (payout.parentPayout) {
        parentPayoutIds.add(payout.parentPayout.id);
      }
    }

    const results = [];
    const errors = [];

    // Process each payout
    for (const payout of payouts) {
      try {
        // ✅ Update payout as COMPLETED with proof image in notes
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

    // Update parent bulk payouts if all child payouts are completed
    for (const parentId of parentPayoutIds) {
      try {
        const allChildren = await prisma.payout.findMany({
          where: {
            bulkPayoutId: parentId,
          },
          select: { status: true },
        });

        const allCompleted = allChildren.every(p => p.status === 'COMPLETED');

        if (allCompleted) {
          // ✅ Also update parent bulk payout with proof image
          await prisma.payout.update({
            where: { id: parentId },
            data: {
              status: 'COMPLETED',
              khaltiPayoutId: transactionReference,
              processedAt: new Date(),
              adminId: session.user.id,
              notes: `[BULK VERIFICATION] All ${allChildren.length} child payouts verified. 
Transaction Reference: ${transactionReference}. 
Proof: ${proofImageUrl}
Verified by: ${session.user.email} (${session.user.name || 'Admin'})`,
            },
          });
        }
      } catch (error: any) {
        console.error(`Error updating parent payout ${parentId}:`, error);
        errors.push({
          parentPayoutId: parentId,
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
      parentPayoutsUpdated: parentPayoutIds.size,
      message: `Bulk verification completed: ${results.length} payouts verified, ${errors.length} failed. ${parentPayoutIds.size} parent payout(s) updated.`,
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