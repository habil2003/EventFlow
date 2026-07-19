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

    // Get vendor bookings
    const vendorBookings = await prisma.vendorBooking.findMany({
      where: {
        bookingStatus: { notIn: ['DECLINED'] },
        depositPaidAt: { not: null },
        paymentStatus: {
          in: ['HELD_IN_ESCROW', 'PROCESSING_PAYOUT']
        },
        NOT: {
          refunds: {
            some: {
              refundStatus: { in: ['PROCESSED', 'PENDING_ADMIN', 'PENDING'] }
            }
          }
        }
      },
      include: {
        vendor: true,
        user: true,
        userSocialEvent: true,
        servicePackage: true,
        payouts: true,
        refunds: true,
      },
      orderBy: {
        depositPaidAt: 'desc',
      },
    });

    // ✅ FIX: Get ticket bookings - include PROCESSING_PAYOUT even if escrowReleased is true
    const ticketBookings = await prisma.ticketBooking.findMany({
      where: {
        paymentStatus: {
          in: ['HELD_IN_ESCROW', 'PROCESSING_PAYOUT']
        },
        OR: [
          { escrowReleased: false },
          { 
            escrowReleased: true,
            paymentStatus: 'PROCESSING_PAYOUT'
          }
        ],
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
        payouts: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    // Format vendor bookings
    const formattedVendorBookings = vendorBookings.map((booking) => {
      const totalAmount = Number(booking.totalAmount);
      const depositAmount = booking.depositAmount ? Number(booking.depositAmount) : totalAmount * 0.2;
      const remainingAmount = booking.remainingAmount ? Number(booking.remainingAmount) : totalAmount - depositAmount;
      
      const hasDepositPayout = booking.payouts.some(p => p.type === 'DEPOSIT' && p.status === 'COMPLETED');
      const hasRemainingPayout = booking.payouts.some(p => p.type === 'REMAINING' && p.status === 'COMPLETED');
      
      const pendingPayouts = booking.payouts.filter(p => p.status === 'PENDING');
      const hasPendingPayout = pendingPayouts.length > 0;
      
      const customerPaidDeposit = !!booking.depositPaidAt;
      const customerPaidFull = booking.vendorPaymentStatus === 'FULLY_PAID' || !!booking.remainingPaidAt;
      
      const vendorAccepted = booking.bookingStatus === 'ACCEPTED';
      const vendorPending = booking.bookingStatus === 'PENDING';
      const vendorDeclined = booking.bookingStatus === 'DECLINED';
      
      const hasActiveRefund = booking.refunds.some(
        r => ['PROCESSED', 'PENDING_ADMIN', 'PENDING'].includes(r.refundStatus)
      );
      
      let availableActions = [];
      
      if (booking.paymentStatus === 'HELD_IN_ESCROW' && !hasActiveRefund) {
        if (customerPaidDeposit && !hasDepositPayout && !hasRemainingPayout && vendorAccepted) {
          availableActions.push('RELEASE_DEPOSIT');
        }
        if (customerPaidFull && !hasRemainingPayout) {
          availableActions.push('RELEASE_REMAINING');
        }
      }
      
      return {
        id: booking.id,
        type: 'VENDOR' as const,
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
        location: 'N/A',
        depositReleasedAt: booking.payouts.find(p => p.type === 'DEPOSIT')?.processedAt || null,
        vendorAccepted: vendorAccepted,
        vendorPending: vendorPending,
        vendorDeclined: vendorDeclined,
        depositReleaseDisabledReason: !vendorAccepted && customerPaidDeposit && !hasDepositPayout && !hasActiveRefund
          ? 'Waiting for vendor to accept booking'
          : hasActiveRefund
          ? 'Refund in progress - Cannot release funds'
          : null,
        canBulkRelease: (availableActions.includes('RELEASE_DEPOSIT') || availableActions.includes('RELEASE_REMAINING')),
        bulkReleaseType: availableActions.includes('RELEASE_DEPOSIT') ? 'deposit' : 
                         availableActions.includes('RELEASE_REMAINING') ? 'remaining' : null,
      };
    });

    // Format ticket bookings with enhanced grouping data
    const formattedTicketBookings = ticketBookings.map((booking) => {
      const totalAmount = Number(booking.totalAmount);
      const commissionRate = 0.1;
      const platformCommission = totalAmount * commissionRate;
      const organizerPayout = totalAmount - platformCommission;
      
      const hasActiveRefund = booking.refunds.some(
        r => ['PROCESSED', 'PENDING_ADMIN', 'PENDING'].includes(r.refundStatus)
      );

      const pendingPayouts = booking.payouts.filter(p => p.status === 'PENDING');
      const hasPendingPayout = pendingPayouts.length > 0;

      const isCompleted = booking.event.isCompleted || false;
      const canRelease = booking.event.isCompleted === true && 
                        booking.paymentStatus === 'HELD_IN_ESCROW' && 
                        !hasActiveRefund;

      return {
        id: booking.id,
        type: 'TICKET' as const,
        eventTitle: booking.event.title,
        eventId: booking.event.id,
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
        hasPendingPayout: hasPendingPayout,
        pendingPayouts: pendingPayouts.map(p => ({
          id: p.id,
          amount: p.amount,
          type: p.type,
          vendorPayout: p.vendorPayout,
        })),
        createdAt: booking.createdAt,
        paymentTransactionId: booking.paymentTransactions[0]?.id,
        isCompleted: isCompleted,
        canRelease: canRelease,
        availableActions: canRelease ? ['RELEASE_TICKET'] : [],
        canBulkRelease: canRelease,
        bulkReleaseType: canRelease ? 'ticket' : null,
      };
    });

    // Get event groups for ticket bookings with more details
    const ticketBookingsByEvent = formattedTicketBookings.reduce((groups, booking) => {
      const key = booking.eventId || booking.eventTitle;
      if (!groups[key]) {
        groups[key] = {
          eventId: booking.eventId,
          eventTitle: booking.eventTitle,
          eventDate: booking.eventDate,
          eventLocation: booking.eventLocation,
          organizerName: booking.organizerName,
          organizerId: booking.organizerId,
          bookings: [],
          totalAmount: 0,
          totalCommission: 0,
          organizerPayout: 0,
          count: 0,
          bookingIds: [],
          canBulkReleaseAll: true,
        };
      }
      groups[key].bookings.push(booking);
      groups[key].totalAmount += booking.totalAmount || 0;
      groups[key].totalCommission += booking.platformCommission || 0;
      groups[key].organizerPayout += booking.organizerPayout || 0;
      groups[key].count += 1;
      groups[key].bookingIds.push(booking.id);
      
      // Check if any booking can't be released (for bulk release availability)
      if (!booking.canRelease && booking.paymentStatus !== 'PROCESSING_PAYOUT') {
        groups[key].canBulkReleaseAll = false;
      }
      
      return groups;
    }, {} as Record<string, any>);

    const eventGroups = Object.values(ticketBookingsByEvent);

    // Calculate summary statistics
    const totalEscrowAmount = [...formattedVendorBookings, ...formattedTicketBookings].reduce((sum, b) => {
      if (b.type === 'VENDOR') {
        if (b.hasDepositPayout && !b.hasRemainingPayout) {
          return sum + (b.remainingAmount || 0);
        }
        return sum + (b.depositAmount || 0);
      }
      return sum + b.totalAmount;
    }, 0);

    const releaseableVendors = formattedVendorBookings.filter(b => b.availableActions.length > 0);
    const releaseableTickets = formattedTicketBookings.filter(b => b.canRelease);
    const processingPayouts = [...formattedVendorBookings, ...formattedTicketBookings].filter(
      b => b.paymentStatus === 'PROCESSING_PAYOUT'
    );

    return NextResponse.json({ 
      bookings: [...formattedVendorBookings, ...formattedTicketBookings],
      vendorCount: formattedVendorBookings.length,
      ticketCount: formattedTicketBookings.length,
      eventGroups: eventGroups,
      summary: {
        totalEscrowAmount: totalEscrowAmount,
        releaseableVendors: releaseableVendors.length,
        releaseableTickets: releaseableTickets.length,
        processingPayouts: processingPayouts.length,
        totalItems: formattedVendorBookings.length + formattedTicketBookings.length,
      },
      bulkReleaseAvailable: eventGroups.some((group: any) => group.canBulkReleaseAll && group.count > 1),
    });
  } catch (error) {
    console.error('Error fetching escrow data:', error);
    return NextResponse.json({ error: 'Failed to fetch escrow data' }, { status: 500 });
  }
}