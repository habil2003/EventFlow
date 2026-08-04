// app/api/admin/release-funds/route.ts

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { sendEmail } from '@/lib/email';
import { RefundStatus } from '@prisma/client';

// Helper function to get platform commission rate
async function getPlatformCommissionRate(): Promise<number> {
  return Number(process.env.PLATFORM_COMMISSION || '0.1');
}

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || session.user?.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { bookingId, amount, type } = await request.json();

    console.log('Release funds request:', { bookingId, amount, type });

    // ─── TICKET BOOKING RELEASE ──────────────────────────────────
    const ticketBooking = await prisma.ticketBooking.findUnique({
      where: { id: bookingId },
      include: { 
        event: {
          include: {
            organizer: true,
          },
        },
        refunds: true,
        payouts: true,
      },
    });

    // ==========================================
    // HANDLE TICKET BOOKING RELEASE
    // ==========================================
    if (ticketBooking) {
      console.log('Processing ticket booking release:', ticketBooking.id);

      if (ticketBooking.escrowReleased) {
        return NextResponse.json({ 
          error: 'Funds already released for this ticket booking' 
        }, { status: 400 });
      }

      if (!ticketBooking.event.isCompleted) {
        return NextResponse.json({ 
          error: 'Cannot release funds: Event has not been marked as completed by the organizer.' 
        }, { status: 400 });
      }

      const activeRefund = ticketBooking.refunds.find(r => 
        [RefundStatus.PENDING_ADMIN, 'PROCESSING'].includes(r.refundStatus)
      );

      if (activeRefund) {
        return NextResponse.json({ 
          error: 'Cannot release funds: An active refund is in progress for this ticket booking.',
          refundId: activeRefund.id,
          refundStatus: activeRefund.refundStatus
        }, { status: 400 });
      }

      const existingPendingPayout = ticketBooking.payouts.find(p => 
        p.type === 'TICKET_SALES' && p.status === 'PENDING'
      );

      if (existingPendingPayout) {
        return NextResponse.json({ 
          error: 'A payout is already pending for this ticket booking. Please verify or cancel the existing payout first.',
          existingPayoutId: existingPendingPayout.id
        }, { status: 400 });
      }

      const commissionRate = await getPlatformCommissionRate();
      const totalAmount = Number(ticketBooking.totalAmount);
      const platformCommission = totalAmount * commissionRate;
      const organizerPayout = totalAmount - platformCommission;

      const updatedTicketBooking = await prisma.ticketBooking.update({
        where: { id: ticketBooking.id },
        data: {
          paymentStatus: 'PROCESSING_PAYOUT',
          escrowReleased: true,
          amountReleasedAt: new Date(),
        },
      });

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
        console.log('Created vendor profile for organizer:', organizerVendorProfile.id);
      }

      const payout = await prisma.payout.create({
        data: {
          ticketBookingId: ticketBooking.id,
          vendorId: organizerVendorProfile.id,
          amount: totalAmount,
          platformCommission: platformCommission,
          vendorPayout: organizerPayout,
          type: 'TICKET_SALES',
          status: 'PENDING',
          adminId: session.user.id,
          processedAt: null,
          notes: `Pending manual payout. Released by ${session.user.email} - Ticket sales for ${ticketBooking.event.title}. Platform commission: ${platformCommission}`,
          transactionId: `pending_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
        },
      });

      console.log('Ticket payout created (PENDING):', payout);

      try {
        const organizer = await prisma.user.findUnique({
          where: { id: ticketBooking.event.organizerId },
        });

        if (organizer?.email) {
          await sendEmail({
            to: organizer.email,
            subject: '💰 Ticket Payout Initiated - EventFlow',
            html: `<!-- email content -->`,
          });
          console.log(`✅ Ticket payout email sent to: ${organizer.email}`);
        }
      } catch (emailError) {
        console.error('Failed to send ticket payout email:', emailError);
      }

      return NextResponse.json({
        success: true,
        message: 'Ticket funds release initiated. Please manually transfer to organizer and verify.',
        type: 'TICKET',
        booking: updatedTicketBooking,
        payout: payout,
        requiresManualAction: true,
      });
    }

    // ─── VENDOR BOOKING RELEASE ──────────────────────────────────
    const vendorBooking = await prisma.vendorBooking.findUnique({
      where: { id: bookingId },
      include: { 
        vendor: {
          include: {
            user: true,
          },
        },
        user: true,
        payouts: true,
        refunds: true,
      },
    });

    if (!vendorBooking) {
      return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
    }

    // ─── VALIDATION: Check if DECLINED ──────────────────────────
    if (vendorBooking.bookingStatus === 'DECLINED') {
      return NextResponse.json({ 
        error: 'Cannot release funds for declined booking. This booking has been refunded.' 
      }, { status: 400 });
    }

    // ─── VALIDATION: Check for active refunds ────────────────────
    const activeRefund = vendorBooking.refunds.find(r => 
      [RefundStatus.PENDING_ADMIN, 'PROCESSING'].includes(r.refundStatus)
    );

    if (activeRefund) {
      return NextResponse.json({ 
        error: 'Cannot release funds: An active refund is in progress for this booking.',
        refundId: activeRefund.id,
        refundStatus: activeRefund.refundStatus
      }, { status: 400 });
    }

    // ─── HANDLE DEPOSIT RELEASE ──────────────────────────────────
    if (type === 'deposit') {
      // ✅ Check: Customer must have paid deposit
      if (!vendorBooking.depositPaidAt) {
        return NextResponse.json({ 
          error: 'Customer has not paid deposit yet. Cannot release deposit.' 
        }, { status: 400 });
      }
      
      // ✅ Check: Deposit not already released
      const hasDepositReleased = vendorBooking.payouts.some(p => 
        p.type === 'DEPOSIT' && p.status === 'COMPLETED'
      );
      if (hasDepositReleased) {
        return NextResponse.json({ 
          error: 'Deposit already released for this booking.' 
        }, { status: 400 });
      }

      // ✅ Check: Existing pending payout
      const existingPendingDeposit = vendorBooking.payouts.find(p => 
        p.type === 'DEPOSIT' && p.status === 'PENDING'
      );
      if (existingPendingDeposit) {
        return NextResponse.json({ 
          error: 'A deposit payout is already pending. Please verify or cancel it first.',
          existingPayoutId: existingPendingDeposit.id
        }, { status: 400 });
      }

      // ✅ Check: Vendor must have accepted
      if (vendorBooking.bookingStatus !== 'ACCEPTED') {
        return NextResponse.json({ 
          error: 'Cannot release deposit until vendor accepts the booking.',
          currentStatus: vendorBooking.bookingStatus
        }, { status: 400 });
      }

      // ✅ Calculate amounts
      const commissionRate = await getPlatformCommissionRate();
      const numericAmount = typeof amount === 'string' ? parseFloat(amount) : amount;
      const platformCommission = numericAmount * commissionRate;
      const vendorPayoutAmount = numericAmount - platformCommission;

      // ✅ Update booking
      const updatedBooking = await prisma.vendorBooking.update({
        where: { id: bookingId },
        data: {
          amountReleasedAt: new Date(),
          paymentStatus: 'PROCESSING_PAYOUT',
        },
      });

      // ✅ Create payout
      const payout = await prisma.payout.create({
        data: {
          bookingId: bookingId,
          vendorId: vendorBooking.vendorId,
          amount: numericAmount,
          platformCommission: platformCommission,
          vendorPayout: vendorPayoutAmount,
          type: 'DEPOSIT',
          status: 'PENDING',
          adminId: session.user.id,
          processedAt: null,
          notes: `Pending manual transfer. Released by ${session.user.email} - deposit payment. Platform commission: ${platformCommission}`,
          transactionId: `pending_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
        },
      });

      console.log('Deposit payout created (PENDING):', payout);

      // ✅ Send email
      try {
        const vendor = vendorBooking.vendor;
        if (vendor?.user?.email) {
          await sendEmail({
            to: vendor.user.email,
            subject: '💰 Deposit Payout Initiated - EventFlow',
            html: `<!-- email content -->`,
          });
        }
      } catch (emailError) {
        console.error('Failed to send email:', emailError);
      }

      return NextResponse.json({
        success: true,
        message: 'Deposit release initiated. Please manually transfer to vendor and verify.',
        type: 'DEPOSIT',
        booking: updatedBooking,
        payout: payout,
        requiresManualAction: true,
      });
    }

    // ─── HANDLE FULL RELEASE ──────────────────────────────────────
    else if (type === 'all') {
      console.log('Processing FULL release for booking:', bookingId);

      // ✅ Check: Must be FULLY_PAID
      if (vendorBooking.vendorPaymentStatus !== 'FULLY_PAID') {
        return NextResponse.json({ 
          error: 'Cannot release full amount. Booking is not fully paid.',
          currentStatus: vendorBooking.vendorPaymentStatus
        }, { status: 400 });
      }

      // ✅ Check: Vendor must have marked complete
      if (vendorBooking.vendorMarkedComplete !== true) {
        return NextResponse.json({ 
          error: 'Cannot release funds until vendor marks service as complete.',
          vendorMarkedComplete: vendorBooking.vendorMarkedComplete
        }, { status: 400 });
      }

      // ✅ Check: Customer must have confirmed
      if (vendorBooking.customerConfirmed !== true) {
        return NextResponse.json({ 
          error: 'Cannot release funds until customer confirms service completion.',
          customerConfirmed: vendorBooking.customerConfirmed
        }, { status: 400 });
      }

      // ✅ Check: Deposit not already released
      const hasDepositReleased = vendorBooking.payouts.some(p => 
        p.type === 'DEPOSIT' && p.status === 'COMPLETED'
      );
      if (hasDepositReleased) {
        return NextResponse.json({ 
          error: 'Deposit already released. Please release remaining amount instead.',
          recommendedAction: 'remaining'
        }, { status: 400 });
      }

      // ✅ Check: Remaining not already released
      const hasRemainingReleased = vendorBooking.payouts.some(p => 
        p.type === 'REMAINING' && p.status === 'COMPLETED'
      );
      if (hasRemainingReleased) {
        return NextResponse.json({ 
          error: 'Remaining amount already released. Please release deposit separately.',
          recommendedAction: 'deposit'
        }, { status: 400 });
      }

      // ✅ Check: Existing pending payout
      const existingPendingPayout = vendorBooking.payouts.find(p => 
        (p.type === 'DEPOSIT' || p.type === 'REMAINING') && p.status === 'PENDING'
      );
      if (existingPendingPayout) {
        return NextResponse.json({ 
          error: 'A payout is already pending. Please verify or cancel it first.',
          existingPayoutId: existingPendingPayout.id
        }, { status: 400 });
      }

      // ✅ Calculate amounts
      const commissionRate = await getPlatformCommissionRate();
      const numericAmount = typeof amount === 'string' ? parseFloat(amount) : amount;
      const platformCommission = numericAmount * commissionRate;
      const vendorPayoutAmount = numericAmount - platformCommission;

      // ✅ Update booking
      const updatedBooking = await prisma.vendorBooking.update({
        where: { id: bookingId },
        data: {
          paymentStatus: 'PROCESSING_PAYOUT',
          vendorPaymentStatus: 'PROCESSING_PAYOUT',
          amountReleasedAt: new Date(),
        },
      });

      // ✅ Create a single payout for the full amount
      const payout = await prisma.payout.create({
        data: {
          bookingId: bookingId,
          vendorId: vendorBooking.vendorId,
          amount: numericAmount,
          platformCommission: platformCommission,
          vendorPayout: vendorPayoutAmount,
          type: 'FULL',
          status: 'PENDING',
          adminId: session.user.id,
          processedAt: null,
          notes: `Pending manual transfer. Released by ${session.user.email} - full amount (deposit + remaining). Platform commission: ${platformCommission}`,
          transactionId: `pending_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
        },
      });

      console.log('Full payout created (PENDING):', payout);

      // ✅ Send email
      try {
        const vendor = vendorBooking.vendor;
        if (vendor?.user?.email) {
          await sendEmail({
            to: vendor.user.email,
            subject: '💰 Full Payout Initiated - EventFlow',
            html: `<!-- email content -->`,
          });
        }
      } catch (emailError) {
        console.error('Failed to send email:', emailError);
      }

      return NextResponse.json({
        success: true,
        message: 'Full amount release initiated. Please manually transfer to vendor and verify.',
        type: 'FULL',
        booking: updatedBooking,
        payout: payout,
        requiresManualAction: true,
      });
    }

    // ─── HANDLE REMAINING RELEASE ─────────────────────────────────
    else if (type === 'remaining') {
      // ✅ Check: Must be FULLY_PAID
      if (vendorBooking.vendorPaymentStatus !== 'FULLY_PAID') {
        return NextResponse.json({ 
          error: 'Cannot release remaining amount. Customer has not paid the remaining amount yet.',
          currentStatus: vendorBooking.vendorPaymentStatus,
          requiredStatus: 'FULLY_PAID'
        }, { status: 400 });
      }

      // ✅ Check: Vendor must have marked complete
      if (vendorBooking.vendorMarkedComplete !== true) {
        return NextResponse.json({ 
          error: 'Cannot release remaining funds until vendor marks service as complete.',
          vendorMarkedComplete: vendorBooking.vendorMarkedComplete
        }, { status: 400 });
      }

      // ✅ Check: Customer must have confirmed
      if (vendorBooking.customerConfirmed !== true) {
        return NextResponse.json({ 
          error: 'Cannot release remaining funds until customer confirms service completion.',
          customerConfirmed: vendorBooking.customerConfirmed
        }, { status: 400 });
      }

      // ✅ Check: Deposit must have been released
      const hasDepositReleased = vendorBooking.payouts.some(p => 
        p.type === 'DEPOSIT' && p.status === 'COMPLETED'
      );
      if (!hasDepositReleased) {
        return NextResponse.json({ 
          error: 'Cannot release remaining funds. Deposit has not been released yet.',
          requiredAction: 'deposit'
        }, { status: 400 });
      }

      // ✅ Check: Remaining amount exists
      if (!vendorBooking.remainingAmount || Number(vendorBooking.remainingAmount) <= 0) {
        return NextResponse.json({ 
          error: 'No remaining amount to release.' 
        }, { status: 400 });
      }

      // ✅ Check: Existing pending payout
      const existingPendingRemaining = vendorBooking.payouts.find(p => 
        p.type === 'REMAINING' && p.status === 'PENDING'
      );
      if (existingPendingRemaining) {
        return NextResponse.json({ 
          error: 'A remaining payout is already pending. Please verify or cancel it first.',
          existingPayoutId: existingPendingRemaining.id
        }, { status: 400 });
      }

      // ✅ Calculate amounts
      const commissionRate = await getPlatformCommissionRate();
      const numericAmount = typeof amount === 'string' ? parseFloat(amount) : amount;
      const platformCommission = numericAmount * commissionRate;
      const vendorPayoutAmount = numericAmount - platformCommission;

      // ✅ Update booking
      const updatedBooking = await prisma.vendorBooking.update({
        where: { id: bookingId },
        data: {
          paymentStatus: 'PROCESSING_PAYOUT',
          vendorPaymentStatus: 'PROCESSING_PAYOUT',
          amountReleasedAt: new Date(),
        },
      });

      // ✅ Create payout
      const payout = await prisma.payout.create({
        data: {
          bookingId: bookingId,
          vendorId: vendorBooking.vendorId,
          amount: numericAmount,
          platformCommission: platformCommission,
          vendorPayout: vendorPayoutAmount,
          type: 'REMAINING',
          status: 'PENDING',
          adminId: session.user.id,
          processedAt: null,
          notes: `Pending manual transfer. Released by ${session.user.email} - remaining amount. Platform commission: ${platformCommission}`,
          transactionId: `pending_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
        },
      });

      console.log('Remaining payout created (PENDING):', payout);

      // ✅ Send email
      try {
        const vendor = vendorBooking.vendor;
        if (vendor?.user?.email) {
          await sendEmail({
            to: vendor.user.email,
            subject: '💰 Remaining Payout Initiated - EventFlow',
            html: `<!-- email content -->`,
          });
        }
      } catch (emailError) {
        console.error('Failed to send email:', emailError);
      }

      return NextResponse.json({
        success: true,
        message: 'Remaining amount release initiated. Please manually transfer to vendor and verify.',
        type: 'REMAINING',
        booking: updatedBooking,
        payout: payout,
        requiresManualAction: true,
      });
    }

    return NextResponse.json({ error: 'Invalid release type' }, { status: 400 });
    
  } catch (error) {
    console.error('Error releasing funds:', error);
    return NextResponse.json({ error: 'Failed to release funds' }, { status: 500 });
  }
}