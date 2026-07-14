// app/api/admin/escrow/route.ts

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    const session = await getServerSession(authOptions);

    if (!session || session.user?.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // ✅ FIX: Get vendor bookings - EXCLUDE those with active refunds
    const vendorBookings = await prisma.vendorBooking.findMany({
      where: {
        bookingStatus: { notIn: ['DECLINED'] },
        depositPaidAt: { not: null },
        paymentStatus: {
          in: ['HELD_IN_ESCROW', 'PROCESSING_PAYOUT']
        },
        // ✅ Exclude bookings that have any refund (processed, pending, or failed)
        NOT: {
          OR: [
            {
              refunds: {
                some: {
                  refundStatus: { in: ['PROCESSED', 'PENDING_ADMIN', 'PENDING'] }
                }
              }
            }
          ]
        }
      },
      include: {
        vendor: true,
        user: true,
        userSocialEvent: true,
        servicePackage: true,
        payouts: true,
        refunds: true, // Include refunds to check status
      },
      orderBy: {
        depositPaidAt: 'desc',
      },
    });

    // Get ticket bookings with money held in escrow - EXCLUDE those with refunds
    const ticketBookings = await prisma.ticketBooking.findMany({
      where: {
        paymentStatus: {
          in: ['HELD_IN_ESCROW', 'PROCESSING_PAYOUT']
        },
        escrowReleased: false,
        // ✅ Exclude bookings that have any refund
        NOT: {
          refunds: {
            some: {
              refundStatus: { in: ['PROCESSED', 'PENDING_ADMIN', 'PENDING'] }
            }
          }
        }
      },
      include: {
        event: {
          include: {
            organizer: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
          },
        },
        user: true,
        tier: true,
        paymentTransactions: true,
        refunds: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    // Format vendor bookings with complete status tracking
    const formattedVendorBookings = vendorBookings.map((booking) => {
      const totalAmount = Number(booking.totalAmount);
      const depositAmount = booking.depositAmount ? Number(booking.depositAmount) : totalAmount * 0.2;
      const remainingAmount = booking.remainingAmount ? Number(booking.remainingAmount) : totalAmount - depositAmount;
      
      // Track what has been released by admin (COMPLETED payouts)
      const hasDepositPayout = booking.payouts.some(p => p.type === 'DEPOSIT' && p.status === 'COMPLETED');
      const hasRemainingPayout = booking.payouts.some(p => p.type === 'REMAINING' && p.status === 'COMPLETED');
      
      // Track pending payouts (waiting for manual verification)
      const pendingPayouts = booking.payouts.filter(p => p.status === 'PENDING');
      const hasPendingPayout = pendingPayouts.length > 0;
      
      // Track what customer has paid
      const customerPaidDeposit = !!booking.depositPaidAt;
      const customerPaidFull = booking.vendorPaymentStatus === 'FULLY_PAID' || !!booking.remainingPaidAt;
      
      // Track vendor acceptance status
      const vendorAccepted = booking.bookingStatus === 'ACCEPTED';
      const vendorPending = booking.bookingStatus === 'PENDING';
      const vendorDeclined = booking.bookingStatus === 'DECLINED';
      
      // ✅ Check if booking has an active refund
      const hasActiveRefund = booking.refunds.some(
        r => ['PROCESSED', 'PENDING_ADMIN', 'PENDING'].includes(r.refundStatus)
      );
      
      // Determine what buttons to show based on vendor acceptance
      let availableActions = [];
      
      if (booking.paymentStatus === 'HELD_IN_ESCROW' && !hasActiveRefund) {
        // DEPOSIT RELEASE CONDITIONS:
        // 1. Customer paid deposit
        // 2. Deposit NOT already released
        // 3. Remaining NOT already released
        // 4. Vendor MUST have accepted the booking
        if (customerPaidDeposit && !hasDepositPayout && !hasRemainingPayout && vendorAccepted) {
          availableActions.push('RELEASE_DEPOSIT');
        }
        
        // REMAINING RELEASE CONDITIONS:
        // 1. Customer paid FULL amount
        // 2. Remaining NOT already released
        if (customerPaidFull && !hasRemainingPayout) {
          availableActions.push('RELEASE_REMAINING');
        }
      }
      
      // Get vendor acceptance display text
      let vendorStatusDisplay = '';
      let vendorStatusColor = '';
      if (vendorAccepted) {
        vendorStatusDisplay = 'Vendor Accepted';
        vendorStatusColor = 'text-green-600 dark:text-green-400';
      } else if (vendorPending) {
        vendorStatusDisplay = 'Waiting for Vendor Approval';
        vendorStatusColor = 'text-yellow-600 dark:text-yellow-400';
      } else if (vendorDeclined) {
        vendorStatusDisplay = 'Vendor Declined';
        vendorStatusColor = 'text-red-600 dark:text-red-400';
      }
      
      return {
        id: booking.id,
        type: 'VENDOR',
        eventTitle: booking.userSocialEvent.title,
        eventDate: booking.userSocialEvent.eventDate,
        vendorName: booking.vendor.businessName,
        vendorId: booking.vendor.id,
        customerName: booking.user.name,
        customerEmail: booking.user.email,
        totalAmount: totalAmount,
        depositAmount: depositAmount,
        remainingAmount: remainingAmount,
        depositPaidAt: booking.depositPaidAt,
        remainingPaidAt: booking.remainingPaidAt,
        hasDepositPayout: hasDepositPayout,
        hasRemainingPayout: hasRemainingPayout,
        hasPendingPayout: hasPendingPayout,
        hasActiveRefund: hasActiveRefund,
        pendingPayouts: pendingPayouts.map(p => ({
          id: p.id,
          amount: p.amount,
          type: p.type,
          vendorPayout: p.vendorPayout,
        })),
        customerPaidDeposit: customerPaidDeposit,
        customerPaidFull: customerPaidFull,
        bookingStatus: booking.bookingStatus,
        paymentStatus: booking.paymentStatus,
        vendorPaymentStatus: booking.vendorPaymentStatus,
        amountReleasedAt: booking.amountReleasedAt,
        availableActions: availableActions,
        location: (booking.userSocialEvent as any).location || 'N/A',
        depositReleasedAt: booking.payouts.find(p => p.type === 'DEPOSIT')?.processedAt || null,
        vendorAccepted: vendorAccepted,
        vendorPending: vendorPending,
        vendorDeclined: vendorDeclined,
        vendorStatusDisplay: vendorStatusDisplay,
        vendorStatusColor: vendorStatusColor,
        depositReleaseDisabledReason: !vendorAccepted && customerPaidDeposit && !hasDepositPayout && !hasActiveRefund
          ? 'Waiting for vendor to accept booking'
          : hasActiveRefund
          ? 'Refund in progress - Cannot release funds'
          : null,
      };
    });

    // Format ticket bookings
    const formattedTicketBookings = ticketBookings.map((booking) => {
      const totalAmount = Number(booking.totalAmount);
      const platformCommission = totalAmount * 0.1;
      const organizerPayout = totalAmount - platformCommission;
      
      const hasActiveRefund = booking.refunds.some(
        r => ['PROCESSED', 'PENDING_ADMIN', 'PENDING'].includes(r.refundStatus)
      );

      return {
        id: booking.id,
        type: 'TICKET',
        eventTitle: booking.event.title,
        eventDate: booking.event.eventDate,
        eventLocation: booking.event.location,
        organizerName: booking.event.organizer?.name || 'Organizer',
        organizerId: booking.event.organizer?.id,
        customerName: booking.user.name,
        customerEmail: booking.user.email,
        totalAmount: totalAmount,
        platformCommission: platformCommission,
        organizerPayout: organizerPayout,
        ticketName: booking.tier.name,
        ticketNumber: booking.ticketNumber,
        quantity: booking.quantity,
        paymentStatus: booking.paymentStatus,
        escrowReleased: booking.escrowReleased,
        hasActiveRefund: hasActiveRefund,
        createdAt: booking.createdAt,
        paymentTransactionId: booking.paymentTransactions[0]?.id,
        isCompleted: booking.event.isCompleted || false,
        canRelease: booking.event.isCompleted === true && 
                    booking.paymentStatus === 'HELD_IN_ESCROW' && 
                    !hasActiveRefund,
        availableActions: booking.paymentStatus === 'HELD_IN_ESCROW' && 
                         booking.event.isCompleted === true && 
                         !hasActiveRefund 
                         ? ['RELEASE_TICKET'] 
                         : [],
      };
    });

    // Combine both types
    const allEscrowItems = [...formattedVendorBookings, ...formattedTicketBookings];

    return NextResponse.json({ 
      bookings: allEscrowItems,
      vendorCount: formattedVendorBookings.length,
      ticketCount: formattedTicketBookings.length,
    });
  } catch (error) {
    console.error('Error fetching escrow data:', error);
    return NextResponse.json({ error: 'Failed to fetch escrow data' }, { status: 500 });
  }
}