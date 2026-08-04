// app/api/admin/verify-payout/route.ts

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
      payoutId, 
      transactionReference, 
      proofImageUrl, 
      transferMethod,
      notes 
    } = await request.json();

    // Validate required fields
    if (!payoutId) {
      return NextResponse.json({ 
        error: 'Missing required field: payoutId' 
      }, { status: 400 });
    }

    if (!transactionReference) {
      return NextResponse.json({ 
        error: 'Missing required field: transactionReference' 
      }, { status: 400 });
    }

    if (!proofImageUrl) {
      return NextResponse.json({ 
        error: 'Missing required field: proofImageUrl' 
      }, { status: 400 });
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

    // Get the pending payout
    const payout = await prisma.payout.findUnique({
      where: { id: payoutId },
      include: {
        vendorBooking: {
          include: {
            payouts: true,
          },
        },
        ticketBooking: true,
        vendor: true,
      },
    });

    if (!payout) {
      return NextResponse.json({ error: 'Payout not found' }, { status: 404 });
    }

    // Check if payout is already processed
    if (payout.status === 'COMPLETED') {
      return NextResponse.json({ 
        error: 'Payout is already completed' 
      }, { status: 400 });
    }

    if (payout.status !== 'PENDING') {
      return NextResponse.json({ 
        error: `Cannot verify payout with status: ${payout.status}` 
      }, { status: 400 });
    }

    // ✅ Update payout as COMPLETED with proof image in notes
    const updatedPayout = await prisma.payout.update({
      where: { id: payoutId },
      data: {
        status: 'COMPLETED',
        khaltiPayoutId: transactionReference,
        processedAt: new Date(),
        adminId: session.user.id,
        notes: `${payout.notes || ''}\n\n[VERIFIED] 
Manual ${transferMethod} transfer completed. 
Reference: ${transactionReference}. 
Proof: ${proofImageUrl}
Verified by: ${session.user.email} (${session.user.name || 'Admin'})
${notes ? `Admin notes: ${notes}` : ''}`,
      },
    });

    // ─── UPDATE BOOKING STATUS BASED ON PAYOUT TYPE ──────────────
    if (payout.bookingId && payout.vendorBooking) {
      const allPayouts = payout.vendorBooking.payouts;
      const completedPayouts = allPayouts.filter(p => p.status === 'COMPLETED' || (p.id === payoutId && updatedPayout.status === 'COMPLETED'));
      
      const hasDepositCompleted = completedPayouts.some(p => p.type === 'DEPOSIT');
      const hasRemainingCompleted = completedPayouts.some(p => p.type === 'REMAINING');
      const hasFullCompleted = completedPayouts.some(p => p.type === 'FULL');
      
      const vendorBooking = await prisma.vendorBooking.findUnique({
        where: { id: payout.bookingId },
        select: { remainingAmount: true }
      });
      
      const isRemainingZero = vendorBooking?.remainingAmount !== null && 
                              vendorBooking?.remainingAmount !== undefined && 
                              Number(vendorBooking.remainingAmount) === 0;

      // ─── CASE 1: FULL payout ─────────────────────────────────────
      if (payout.type === 'FULL') {
        // Full payout completed → Booking is fully done
        await prisma.vendorBooking.update({
          where: { id: payout.bookingId },
          data: {
            paymentStatus: 'COMPLETED',
            vendorPaymentStatus: 'COMPLETED',
          },
        });
      }
      
      // ─── CASE 2: REMAINING payout ───────────────────────────────
      else if (payout.type === 'REMAINING' || (payout.type === 'DEPOSIT' && isRemainingZero)) {
        // Fully paid and fully released
        await prisma.vendorBooking.update({
          where: { id: payout.bookingId },
          data: {
            paymentStatus: 'COMPLETED',
            vendorPaymentStatus: 'COMPLETED',
          },
        });
      } 
      
      // ─── CASE 3: DEPOSIT payout ──────────────────────────────────
      else if (payout.type === 'DEPOSIT' && hasDepositCompleted && !hasRemainingCompleted) {
        // Only deposit released, waiting for remaining payment from customer
        await prisma.vendorBooking.update({
          where: { id: payout.bookingId },
          data: {
            paymentStatus: 'HELD_IN_ESCROW',
            vendorPaymentStatus: 'DEPOSIT_PAID',
          },
        });
      }
    }

    // Handle ticket booking payouts
    if (payout.ticketBookingId) {
      const allTicketPayouts = await prisma.payout.findMany({
        where: { ticketBookingId: payout.ticketBookingId }
      });
      const allCompleted = allTicketPayouts.every(p => p.status === 'COMPLETED' || p.id === payoutId);
      
      if (allCompleted) {
        await prisma.ticketBooking.update({
          where: { id: payout.ticketBookingId },
          data: {
            paymentStatus: 'COMPLETED',
          },
        });
      } else {
        await prisma.ticketBooking.update({
          where: { id: payout.ticketBookingId },
          data: {
            paymentStatus: 'PROCESSING_PAYOUT',
          },
        });
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Payout verified and marked as completed',
      payout: updatedPayout,
    });

  } catch (error) {
    console.error('Error verifying payout:', error);
    return NextResponse.json({ 
      error: error instanceof Error ? error.message : 'Failed to verify payout' 
    }, { status: 500 });
  }
}