// app/api/vendor/bookings/[id]/status/route.ts
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    const { id } = await params;

    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (session.user.role !== 'VENDOR') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Get vendor profile
    const vendor = await prisma.vendorProfile.findUnique({
      where: { userId: session.user.id },
    });

    if (!vendor) {
      return NextResponse.json({ error: 'Vendor not found' }, { status: 404 });
    }

    const { status } = await request.json();

    if (!['ACCEPTED', 'DECLINED'].includes(status)) {
      return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
    }

    // Find the booking
    const booking = await prisma.vendorBooking.findFirst({
      where: {
        id: id,
        vendorId: vendor.id,
        bookingStatus: 'PENDING',
      },
      include: {
        paymentTransactions: true,
      },
    });

    if (!booking) {
      return NextResponse.json({ error: 'Booking not found or already processed' }, { status: 404 });
    }

    // Update booking status
    const updatedBooking = await prisma.vendorBooking.update({
      where: { id: booking.id },
      data: {
        bookingStatus: status,
        ...(status === 'DECLINED' && {
          vendorPaymentStatus: 'REFUNDED',
          paymentStatus: 'REFUNDED',
        }),
      },
    });

    // If declined, process refund
    if (status === 'DECLINED') {
      // Find the deposit payment transaction
      const depositTransaction = booking.paymentTransactions.find(
        (t) => t.paymentType === 'VENDOR_DEPOSIT' && t.status === 'SUCCESS'
      );

      if (depositTransaction) {
        // Mark for refund (actual refund would go through Khalti API)
        await prisma.refund.create({
          data: {
            originalTransactionId: depositTransaction.transactionId,
            // ✅ FIX: Convert Decimal to number
            refundAmount: booking.depositAmount || Number(booking.totalAmount) * 0.2,
            refundReason: 'Vendor declined booking',
            refundStatus: 'PROCESSED',
            paymentTransactionId: depositTransaction.id,
            vendorBookingId: booking.id,
          },
        });
      }
    }

    return NextResponse.json({
      success: true,
      booking: updatedBooking,
      message: status === 'ACCEPTED' 
        ? 'Booking accepted successfully' 
        : 'Booking declined and refund initiated',
    });
  } catch (error) {
    console.error('Error updating booking status:', error);
    return NextResponse.json({ error: 'Failed to update booking' }, { status: 500 });
  }
}