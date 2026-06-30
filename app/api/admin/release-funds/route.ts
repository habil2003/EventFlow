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

    const { bookingId, amount, type } = await request.json();

    console.log('Release funds request:', { bookingId, amount, type });

    // First, check if it's a ticket booking
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
      },
    });

    // If it's a ticket booking, handle ticket release
    if (ticketBooking) {
      console.log('Processing ticket booking release:', ticketBooking.id);

      // Check if already released
      if (ticketBooking.escrowReleased) {
        return NextResponse.json({ 
          error: 'Funds already released for this ticket booking' 
        }, { status: 400 });
      }

      // Check if event is completed before releasing funds
      if (!ticketBooking.event.isCompleted) {
        return NextResponse.json({ 
          error: 'Cannot release funds: Event has not been marked as completed by the organizer.' 
        }, { status: 400 });
      }

      const totalAmount = Number(ticketBooking.totalAmount);
      const platformCommission = totalAmount * 0.1;
      const organizerPayout = totalAmount - platformCommission;

      // Update ticket booking to PROCESSING_PAYOUT (not COMPLETED yet)
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

      // If no vendor profile exists, create a temporary one for payout tracking
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

      // Create payout record as PENDING (not COMPLETED)
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

      return NextResponse.json({
        success: true,
        message: 'Ticket funds release initiated. Please manually transfer to organizer and verify.',
        type: 'TICKET',
        booking: updatedTicketBooking,
        payout: payout,
        requiresManualAction: true,
      });
    }

    // If not a ticket booking, check for vendor booking
    const vendorBooking = await prisma.vendorBooking.findUnique({
      where: { id: bookingId },
      include: { 
        vendor: true,
        payouts: true,
      },
    });

    if (!vendorBooking) {
      return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
    }

    // ✅ FIX 1: Handle DECLINED status properly
    if (vendorBooking.bookingStatus === ('DECLINED' as any)) {
      return NextResponse.json({ 
        error: 'Cannot release funds for declined booking. This booking has been refunded.' 
      }, { status: 400 });
    }

    // Get existing payouts to check what's already released
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
    const numericAmount = typeof amount === 'string' ? parseFloat(amount) : amount;
    const platformCommission = numericAmount * 0.1;
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
          case ('DECLINED' as any):
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
      
      // ✅ FIX 2: Convert Decimal to number for comparison
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