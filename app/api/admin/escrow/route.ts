// app/api/admin/escrow/route.ts

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { RefundStatus } from '@prisma/client';

export async function GET() {
  try {
    const session = await getServerSession(authOptions);

    if (!session || session.user?.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // ─── GET VENDOR BOOKINGS ──────────────────────────────────────
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
              refundStatus: {
                in: [
                  RefundStatus.PROCESSED,
                  RefundStatus.PENDING_ADMIN
                ]
              }
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

    // ─── GET TICKET BOOKINGS ──────────────────────────────────────
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
              refundStatus: {
                in: [
                  RefundStatus.PROCESSED,
                  RefundStatus.PENDING_ADMIN
                ]
              }
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
        payouts: {
          include: {
            parentPayout: true,
            childPayouts: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    // ─── FORMAT VENDOR BOOKINGS ───────────────────────────────────
    const formattedVendorBookings = vendorBookings.map((booking) => {
      const totalAmount = Number(booking.totalAmount);
      const depositAmount = booking.depositAmount ? Number(booking.depositAmount) : totalAmount * 0.2;
      const remainingAmount = booking.remainingAmount ? Number(booking.remainingAmount) : totalAmount - depositAmount;
      
      const hasDepositPayout = booking.payouts.some(p => p.type === 'DEPOSIT' && p.status === 'COMPLETED');
      const hasRemainingPayout = booking.payouts.some(p => p.type === 'REMAINING' && p.status === 'COMPLETED');
      
      // ⬇️ Check for pending payouts
      const hasPendingDepositPayout = booking.payouts.some(p => p.type === 'DEPOSIT' && p.status === 'PENDING');
      const hasPendingRemainingPayout = booking.payouts.some(p => p.type === 'REMAINING' && p.status === 'PENDING');
      const hasPendingFullPayout = booking.payouts.some(p => p.type === 'FULL' && p.status === 'PENDING');
      const hasAnyPendingPayout = hasPendingDepositPayout || hasPendingRemainingPayout || hasPendingFullPayout;
      
      const pendingPayouts = booking.payouts.filter(p => p.status === 'PENDING');
      const hasPendingPayout = pendingPayouts.length > 0;
      
      const customerPaidDeposit = booking.vendorPaymentStatus === 'DEPOSIT_PAID' || 
                                 (booking.vendorPaymentStatus === 'FULLY_PAID' && !!booking.depositPaidAt);
      const customerPaidFull = booking.vendorPaymentStatus === 'FULLY_PAID' && !!booking.remainingPaidAt;
      
      const vendorAccepted = booking.bookingStatus === 'ACCEPTED';
      const vendorPending = booking.bookingStatus === 'PENDING';
      const vendorDeclined = booking.bookingStatus === 'DECLINED';
      
      const hasActiveRefund = booking.refunds.some(
        r => r.refundStatus === RefundStatus.PROCESSED || r.refundStatus === RefundStatus.PENDING_ADMIN
      );
      
      // ─── DISPLAY AMOUNTS FOR TABLE ────────────────────────────────────
      let displayAmount = 0;
      let displayCommission = 0;
      let displayPayout = 0;

      // For PROCESSING_PAYOUT, check the payout type
      if (booking.paymentStatus === 'PROCESSING_PAYOUT') {
        const payout = booking.payouts.find(p => p.status === 'PENDING');
        if (payout) {
          if (payout.type === 'FULL') {
            displayAmount = totalAmount;
            displayCommission = totalAmount * 0.1;
            displayPayout = totalAmount * 0.9;
          } else if (payout.type === 'REMAINING') {
            displayAmount = remainingAmount;
            displayCommission = remainingAmount * 0.1;
            displayPayout = remainingAmount * 0.9;
          } else if (payout.type === 'DEPOSIT') {
            displayAmount = depositAmount;
            displayCommission = depositAmount * 0.1;
            displayPayout = depositAmount * 0.9;
          }
        }
      } else if (booking.vendorPaymentStatus === 'FULLY_PAID') {
        // FULLY_PAID but still in HELD_IN_ESCROW → show remaining
        displayAmount = remainingAmount;
        displayCommission = remainingAmount * 0.1;
        displayPayout = remainingAmount * 0.9;
      } else {
        // DEPOSIT_PAID → show deposit
        displayAmount = depositAmount;
        displayCommission = depositAmount * 0.1;
        displayPayout = depositAmount * 0.9;
      }
      
      // ─── AVAILABLE ACTIONS ──────────────────────────────────────
      const availableActions: string[] = [];
      
      // Only show release actions if:
      // 1. Payment status is HELD_IN_ESCROW (not PROCESSING_PAYOUT)
      // 2. No active refund
      // 3. No pending payouts
      if (booking.paymentStatus === 'HELD_IN_ESCROW' && !hasActiveRefund && !hasAnyPendingPayout) {
        
        // ─── SCENARIO 1: DEPOSIT_PAID ────────────────────────────────
        // Show "Release Deposit" when:
        // - Vendor status is DEPOSIT_PAID
        // - Customer paid deposit
        // - No deposit payout exists (not even PENDING)
        // - Vendor has accepted
        if (booking.vendorPaymentStatus === 'DEPOSIT_PAID' && 
            customerPaidDeposit && 
            !hasDepositPayout && 
            vendorAccepted) {
          availableActions.push('RELEASE_DEPOSIT');
        }
        
        // ─── SCENARIO 2: FULLY_PAID + NO RELEASES ────────────────────
        // Show "Release Full" when:
        // - Vendor status is FULLY_PAID
        // - Customer paid full
        // - No deposit or remaining payout exists
        // - Vendor marked complete AND customer confirmed
        else if (booking.vendorPaymentStatus === 'FULLY_PAID' && 
                 customerPaidFull &&
                 !hasDepositPayout && 
                 !hasRemainingPayout &&
                 booking.vendorMarkedComplete === true &&
                 booking.customerConfirmed === true) {
          availableActions.push('RELEASE_FULL');
        }
        
        // ─── SCENARIO 3: FULLY_PAID + DEPOSIT RELEASED ──────────────
        // Show "Release Remaining" when:
        // - Vendor status is FULLY_PAID
        // - Customer paid full
        // - Deposit payout exists (COMPLETED)
        // - No remaining payout exists
        // - Vendor marked complete AND customer confirmed
        else if (booking.vendorPaymentStatus === 'FULLY_PAID' && 
                 customerPaidFull &&
                 hasDepositPayout && 
                 !hasRemainingPayout &&
                 booking.vendorMarkedComplete === true &&
                 booking.customerConfirmed === true) {
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
        displayAmount: displayAmount,
        displayCommission: displayCommission,
        displayPayout: displayPayout,
        depositPaidAt: booking.depositPaidAt,
        remainingPaidAt: booking.remainingPaidAt,
        hasDepositPayout: hasDepositPayout,
        hasRemainingPayout: hasRemainingPayout,
        hasPendingPayout: hasPendingPayout,
        hasPendingDepositPayout: hasPendingDepositPayout,
        hasPendingRemainingPayout: hasPendingRemainingPayout,
        hasActiveRefund: hasActiveRefund,
        pendingPayouts: pendingPayouts.map(p => ({
          id: p.id,
          amount: p.amount,
          type: p.type,
          vendorPayout: p.vendorPayout,
          status: p.status,
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
        depositReleaseDisabledReason: booking.vendorPaymentStatus === 'DEPOSIT_PAID' && !vendorAccepted && customerPaidDeposit && !hasActiveRefund
          ? 'Waiting for vendor to accept booking'
          : booking.vendorPaymentStatus === 'FULLY_PAID' && (!booking.vendorMarkedComplete || !booking.customerConfirmed)
          ? 'Waiting for vendor and customer to confirm completion'
          : hasActiveRefund
          ? 'Refund in progress - Cannot release funds'
          : hasAnyPendingPayout
          ? 'A payout is already pending for this booking'
          : null,
        canBulkRelease: availableActions.includes('RELEASE_REMAINING') || availableActions.includes('RELEASE_FULL'),
        bulkReleaseType: availableActions.includes('RELEASE_REMAINING') ? 'remaining' : 
                         availableActions.includes('RELEASE_FULL') ? 'all' :
                         availableActions.includes('RELEASE_DEPOSIT') ? 'deposit' : null,
        vendorMarkedComplete: booking.vendorMarkedComplete,
        customerConfirmed: booking.customerConfirmed,
      };
    });

    // ─── FORMAT TICKET BOOKINGS ───────────────────────────────────
    const formattedTicketBookings = ticketBookings.map((booking) => {
      const totalAmount = Number(booking.totalAmount);
      const commissionRate = 0.1;
      const platformCommission = totalAmount * commissionRate;
      const organizerPayout = totalAmount - platformCommission;
      
      const hasActiveRefund = booking.refunds.some(
        r => r.refundStatus === RefundStatus.PROCESSED || r.refundStatus === RefundStatus.PENDING_ADMIN
      );

      const pendingPayouts = booking.payouts.filter(p => p.status === 'PENDING');
      const hasPendingPayout = pendingPayouts.length > 0;

      const isCompleted = booking.event.isCompleted || false;
      const canRelease = booking.event.isCompleted === true && 
                        booking.paymentStatus === 'HELD_IN_ESCROW' && 
                        !hasActiveRefund &&
                        !hasPendingPayout;

      const hasParentPayout = booking.payouts.some(p => p.parentPayout !== null);

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
        displayAmount: totalAmount,
        displayCommission: platformCommission,
        displayPayout: organizerPayout,
        ticketName: booking.tier.name,
        ticketNumber: booking.ticketNumber,
        quantity: booking.quantity,
        paymentStatus: booking.paymentStatus,
        escrowReleased: booking.escrowReleased,
        hasActiveRefund: hasActiveRefund,
        hasPendingPayout: hasPendingPayout,
        hasParentPayout: hasParentPayout,
        pendingPayouts: pendingPayouts.map(p => ({
          id: p.id,
          amount: p.amount,
          type: p.type,
          vendorPayout: p.vendorPayout,
          isBulkChild: !!p.parentPayout,
          parentPayoutId: p.parentPayout?.id || null,
          status: p.status,
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

    // ─── GROUP TICKET BOOKINGS BY EVENT ───────────────────────────
    type TicketEventGroup = {
      eventId: string | null;
      eventTitle: string;
      eventDate: string | Date;
      eventLocation: string | null;
      organizerName: string;
      organizerId: string;
      bookings: (typeof formattedTicketBookings)[number][];
      displayCount: number;
      totalAmount: number;
      totalCommission: number;
      organizerPayout: number;
      bulkReleaseCount: number;
      bulkTotalAmount: number;
      bulkTotalCommission: number;
      bulkOrganizerPayout: number;
      processingCount: number;
      bookingIds: string[];
      canBulkReleaseAll: boolean;
    };

    const ticketBookingsByEvent = formattedTicketBookings.reduce<Record<string, TicketEventGroup>>((groups, booking) => {
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
          displayCount: 0,
          totalAmount: 0,
          totalCommission: 0,
          organizerPayout: 0,
          bulkReleaseCount: 0,
          bulkTotalAmount: 0,
          bulkTotalCommission: 0,
          bulkOrganizerPayout: 0,
          processingCount: 0,
          bookingIds: [],
          canBulkReleaseAll: true,
        };
      }
      
      groups[key].bookings.push(booking);
      groups[key].displayCount += 1;
      
      groups[key].totalAmount += booking.totalAmount || 0;
      groups[key].totalCommission += booking.platformCommission || 0;
      groups[key].organizerPayout += booking.organizerPayout || 0;
      
      if (booking.paymentStatus === 'HELD_IN_ESCROW' && booking.canRelease) {
        groups[key].bulkReleaseCount += 1;
        groups[key].bookingIds.push(booking.id);
        groups[key].bulkTotalAmount += booking.totalAmount || 0;
        groups[key].bulkTotalCommission += booking.platformCommission || 0;
        groups[key].bulkOrganizerPayout += booking.organizerPayout || 0;
      }
      
      if (booking.paymentStatus === 'PROCESSING_PAYOUT') {
        groups[key].processingCount += 1;
      }
      
      groups[key].canBulkReleaseAll = groups[key].bulkReleaseCount > 0;
      
      return groups;
    }, {});

    const eventGroups = Object.values(ticketBookingsByEvent);

    // ─── SUMMARY STATISTICS ────────────────────────────────────────
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

    // ─── RESPONSE ──────────────────────────────────────────────────
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
      bulkReleaseAvailable: eventGroups.some((group) => group.canBulkReleaseAll && group.bulkReleaseCount > 1),
    });
  } catch (error) {
    console.error('Error fetching escrow data:', error);
    return NextResponse.json({ error: 'Failed to fetch escrow data' }, { status: 500 });
  }
}