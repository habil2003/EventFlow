import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { sendEmail } from '@/lib/email';

// Helper function to get platform commission rate
async function getPlatformCommissionRate(): Promise<number> {
  // You can make this configurable via env or database
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

    // ==========================================
    // FIRST: Check if it's a ticket booking
    // ==========================================
    const ticketBooking = await prisma.ticketBooking.findUnique({
      where: { id: bookingId },
      include: { 
        event: {
          include: {
            organizer: true,
          },
        },
        user: true,
        tier: true,
        paymentTransactions: true,
        refunds: true,
        payouts: true,
      },
    });

    // ==========================================
    // HANDLE TICKET BOOKING RELEASE
    // ==========================================
    if (ticketBooking) {
      console.log('Processing ticket booking release:', ticketBooking.id);

      // ✅ Check if already released
      if (ticketBooking.escrowReleased) {
        return NextResponse.json({ 
          error: 'Funds already released for this ticket booking' 
        }, { status: 400 });
      }

      // ✅ Check if event is completed before releasing funds
      if (!ticketBooking.event.isCompleted) {
        return NextResponse.json({ 
          error: 'Cannot release funds: Event has not been marked as completed by the organizer.' 
        }, { status: 400 });
      }

      // ✅ Check for active refunds
      const activeRefund = ticketBooking.refunds.find(r => 
        ['PENDING', 'PENDING_ADMIN', 'PROCESSING'].includes(r.refundStatus)
      );

      if (activeRefund) {
        return NextResponse.json({ 
          error: 'Cannot release funds: An active refund is in progress for this ticket booking.',
          refundId: activeRefund.id,
          refundStatus: activeRefund.refundStatus
        }, { status: 400 });
      }

      // ✅ Check for existing pending payout (prevent duplicates)
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

      // Update ticket booking to PROCESSING_PAYOUT
      const updatedTicketBooking = await prisma.ticketBooking.update({
        where: { id: ticketBooking.id },
        data: {
          paymentStatus: 'PROCESSING_PAYOUT',
          escrowReleased: true,
          amountReleasedAt: new Date(),
        },
      });

      // Try to find or create vendor profile for organizer
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

      // Create payout record as PENDING
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

      // ✅ Send email notification to organizer
      try {
        const organizer = await prisma.user.findUnique({
          where: { id: ticketBooking.event.organizerId },
        });

        if (organizer?.email) {
          await sendEmail({
            to: organizer.email,
            subject: '💰 Ticket Payout Initiated - EventFlow',
            html: `
              <!DOCTYPE html>
              <html>
              <head>
                <meta charset="utf-8">
                <title>Payout Initiated</title>
              </head>
              <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <div style="background: linear-gradient(135deg, #4f46e5, #7c3aed); padding: 30px; text-align: center; border-radius: 12px 12px 0 0;">
                  <h1 style="color: white; margin: 0;">💰 Payout Initiated</h1>
                </div>
                <div style="background: #ffffff; padding: 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 12px 12px;">
                  <p>Dear ${organizer.name || 'Organizer'},</p>
                  <p>A payout for your event <strong>${ticketBooking.event.title}</strong> has been initiated.</p>
                  <div style="background: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
                    <p style="margin: 5px 0;"><strong>Total Ticket Sales:</strong> NPR ${totalAmount.toLocaleString()}</p>
                    <p style="margin: 5px 0;"><strong>Platform Commission (${Math.round(commissionRate * 100)}%):</strong> NPR ${platformCommission.toLocaleString()}</p>
                    <p style="margin: 5px 0; font-size: 18px; color: #16a34a;"><strong>Your Payout:</strong> NPR ${organizerPayout.toLocaleString()}</p>
                  </div>
                  <p style="color: #6b7280; font-size: 14px;">The payout will be processed within 1-3 business days.</p>
                  <hr style="margin: 30px 0 20px; border-color: #e5e7eb;">
                  <p style="color: #6b7280; font-size: 12px; text-align: center;">EventFlow Support Team</p>
                </div>
              </body>
              </html>
            `,
          });
          console.log(`✅ Ticket payout email sent to: ${organizer.email}`);
        }
      } catch (emailError) {
        console.error('Failed to send ticket payout email:', emailError);
        // Don't fail the request if email fails
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

    // ==========================================
    // IF NOT TICKET, CHECK VENDOR BOOKING
    // ==========================================
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

    // ✅ Check for DECLINED status (using type assertion for enum)
    if (vendorBooking.bookingStatus === 'DECLINED' as any) {
      return NextResponse.json({ 
        error: 'Cannot release funds for declined booking. This booking has been refunded.' 
      }, { status: 400 });
    }

    // ✅ Check for active refunds
    const activeRefund = vendorBooking.refunds.find(r => 
      ['PENDING', 'PENDING_ADMIN', 'PROCESSING'].includes(r.refundStatus)
    );

    if (activeRefund) {
      return NextResponse.json({ 
        error: 'Cannot release funds: An active refund is in progress for this booking.',
        refundId: activeRefund.id,
        refundStatus: activeRefund.refundStatus
      }, { status: 400 });
    }

    // ✅ Check for existing pending payouts (prevent duplicates)
    const existingPendingDeposit = vendorBooking.payouts.find(p => 
      p.type === 'DEPOSIT' && p.status === 'PENDING'
    );
    const existingPendingRemaining = vendorBooking.payouts.find(p => 
      p.type === 'REMAINING' && p.status === 'PENDING'
    );

    if (type === 'deposit' && existingPendingDeposit) {
      return NextResponse.json({ 
        error: 'A deposit payout is already pending for this booking. Please verify or cancel the existing payout first.',
        existingPayoutId: existingPendingDeposit.id
      }, { status: 400 });
    }

    if (type === 'remaining' && existingPendingRemaining) {
      return NextResponse.json({ 
        error: 'A remaining payout is already pending for this booking. Please verify or cancel the existing payout first.',
        existingPayoutId: existingPendingRemaining.id
      }, { status: 400 });
    }

    // Get existing completed payouts
    const existingDepositPayout = vendorBooking.payouts.find(p => p.type === 'DEPOSIT' && p.status === 'COMPLETED');
    const existingRemainingPayout = vendorBooking.payouts.find(p => p.type === 'REMAINING' && p.status === 'COMPLETED');
    
    const hasDepositReleased = !!existingDepositPayout;
    const hasRemainingReleased = !!existingRemainingPayout;

    // Check if already fully released
    if (hasRemainingReleased) {
      return NextResponse.json({ 
        error: 'Funds already fully released for this booking.' 
      }, { status: 400 });
    }

    // Calculate amounts
    const commissionRate = await getPlatformCommissionRate();
    const numericAmount = typeof amount === 'string' ? parseFloat(amount) : amount;
    const platformCommission = numericAmount * commissionRate;
    const vendorPayoutAmount = numericAmount - platformCommission;

    console.log('Vendor commission calculation:', { numericAmount, platformCommission, vendorPayoutAmount });

    let updatedBooking;
    let payoutType;
    
    // ==========================================
    // HANDLE DEPOSIT RELEASE
    // ==========================================
    if (type === 'deposit') {
      // Check 1: Customer must have paid deposit
      if (!vendorBooking.depositPaidAt) {
        return NextResponse.json({ 
          error: 'Customer has not paid deposit yet. Cannot release deposit.' 
        }, { status: 400 });
      }
      
      // Check 2: Deposit not already released
      if (hasDepositReleased) {
        return NextResponse.json({ 
          error: 'Deposit already released for this booking.' 
        }, { status: 400 });
      }
      
      // Check 3: Vendor must have accepted the booking
      if (vendorBooking.bookingStatus !== 'ACCEPTED') {
        let statusMessage = '';
        switch (vendorBooking.bookingStatus) {
          case 'PENDING':
            statusMessage = 'Vendor has not responded to the booking request yet.';
            break;
          case 'DECLINED' as any:
            statusMessage = 'Vendor has declined this booking. Please process refund instead.';
            break;
          case 'COMPLETED':
            statusMessage = 'Booking is already completed.';
            break;
          default:
            statusMessage = `Booking status is ${vendorBooking.bookingStatus}`;
        }
        return NextResponse.json({ 
          error: `Cannot release deposit until vendor accepts the booking. ${statusMessage}`,
          currentStatus: vendorBooking.bookingStatus
        }, { status: 400 });
      }
      
      // Release Deposit Only - set to PROCESSING_PAYOUT
      updatedBooking = await prisma.vendorBooking.update({
        where: { id: bookingId },
        data: {
          amountReleasedAt: new Date(),
          paymentStatus: 'PROCESSING_PAYOUT',
        },
      });
      payoutType = 'DEPOSIT';
    } 
    // ==========================================
    // HANDLE REMAINING/FULL RELEASE
    // ==========================================
    else if (type === 'remaining') {
      // Check 1: Customer must have paid remaining amount
      if (!vendorBooking.remainingPaidAt && vendorBooking.vendorPaymentStatus !== 'FULLY_PAID') {
        return NextResponse.json({ 
          error: 'Customer has not paid remaining amount yet. Cannot release remaining funds.' 
        }, { status: 400 });
      }
      
      // Check 2: Verify remaining amount exists
      if (!vendorBooking.remainingAmount || Number(vendorBooking.remainingAmount) <= 0) {
        return NextResponse.json({ 
          error: 'No remaining amount to release.' 
        }, { status: 400 });
      }
      
      // Release Full/Remaining Amount - set to PROCESSING_PAYOUT
      updatedBooking = await prisma.vendorBooking.update({
        where: { id: bookingId },
        data: {
          paymentStatus: 'PROCESSING_PAYOUT',
          vendorPaymentStatus: 'PROCESSING_PAYOUT',
          amountReleasedAt: new Date(),
        },
      });
      payoutType = 'REMAINING';
    } 
    else {
      return NextResponse.json({ error: 'Invalid release type' }, { status: 400 });
    }

    // Create payout record as PENDING (not COMPLETED)
    const payout = await prisma.payout.create({
      data: {
        bookingId: bookingId,
        vendorId: vendorBooking.vendorId,
        amount: numericAmount,
        platformCommission: platformCommission,
        vendorPayout: vendorPayoutAmount,
        type: payoutType,
        status: 'PENDING',
        adminId: session.user.id,
        processedAt: null,
        notes: `Pending manual transfer. Released by ${session.user.email} - ${type === 'deposit' ? 'deposit payment' : 'remaining amount'}. Platform commission: ${platformCommission}`,
        transactionId: `pending_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
      },
    });

    console.log('Vendor payout created (PENDING):', payout);

    // ✅ Send email notification to vendor
    try {
      const vendor = vendorBooking.vendor;
      if (vendor?.user?.email) {
        const amountType = type === 'deposit' ? 'Deposit Payment' : 'Remaining Payment';
        await sendEmail({
          to: vendor.user.email,
          subject: `💰 ${amountType} Initiated - EventFlow`,
          html: `
            <!DOCTYPE html>
            <html>
            <head>
              <meta charset="utf-8">
              <title>Payout Initiated</title>
            </head>
            <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <div style="background: linear-gradient(135deg, #4f46e5, #7c3aed); padding: 30px; text-align: center; border-radius: 12px 12px 0 0;">
                <h1 style="color: white; margin: 0;">💰 ${amountType} Initiated</h1>
              </div>
              <div style="background: #ffffff; padding: 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 12px 12px;">
                <p>Dear ${vendor.businessName || 'Vendor'},</p>
                <p>A payout has been initiated for your booking.</p>
                <div style="background: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
                  <p style="margin: 5px 0;"><strong>Payment Type:</strong> ${amountType}</p>
                  <p style="margin: 5px 0;"><strong>Total Amount:</strong> NPR ${numericAmount.toLocaleString()}</p>
                  <p style="margin: 5px 0;"><strong>Platform Commission (${Math.round(commissionRate * 100)}%):</strong> NPR ${platformCommission.toLocaleString()}</p>
                  <p style="margin: 5px 0; font-size: 18px; color: #16a34a;"><strong>Your Payout:</strong> NPR ${vendorPayoutAmount.toLocaleString()}</p>
                </div>
                <p style="color: #6b7280; font-size: 14px;">The payout will be processed within 1-3 business days.</p>
                <hr style="margin: 30px 0 20px; border-color: #e5e7eb;">
                <p style="color: #6b7280; font-size: 12px; text-align: center;">EventFlow Support Team</p>
              </div>
            </body>
            </html>
          `,
        });
        console.log(`✅ Vendor payout email sent to: ${vendor.user.email}`);
      }
    } catch (emailError) {
      console.error('Failed to send vendor payout email:', emailError);
      // Don't fail the request if email fails
    }

    return NextResponse.json({
      success: true,
      message: type === 'deposit' 
        ? 'Deposit release initiated. Please manually transfer to vendor and verify.' 
        : 'Remaining amount release initiated. Please manually transfer to vendor and verify.',
      type: 'VENDOR',
      booking: updatedBooking,
      payout: payout,
      requiresManualAction: true,
    });
    
  } catch (error) {
    console.error('Error releasing funds:', error);
    return NextResponse.json({ error: 'Failed to release funds' }, { status: 500 });
  }
}