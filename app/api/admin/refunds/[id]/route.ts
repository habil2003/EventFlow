import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

// ✅ Helper: Calculate refund percentage from amount
function calculateRefundPercentageFromAmount(refundAmount: number, totalAmount: number): number | null {
  if (!totalAmount || totalAmount === 0) return null;
  return Math.round((refundAmount / totalAmount) * 100);
}

// ✅ Helper: Calculate days until event
function calculateDaysUntilEvent(eventDate: Date, cancellationDate: Date): number {
  const diffTime = eventDate.getTime() - cancellationDate.getTime();
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

// ✅ Helper: Get refund percentage based on days until event
function getRefundPercentageFromPolicy(daysUntilEvent: number): number {
  if (daysUntilEvent >= 7) return 100;
  if (daysUntilEvent >= 3) return 50;
  return 0;
}

// ✅ Helper: Calculate refund percentage for a refund
function calculateRefundPercentage(refund: any): { percentage: number | null; daysUntilEvent: number | null } {
  let refundPercentage: number | null = null;
  let daysUntilEvent: number | null = null;

  const refundAmount = Number(refund.refundAmount);
  let totalAmount: number | null = null;
  let eventDate: Date | null = null;
  let cancelledBy: string | null = null;

  // Get booking details
  if (refund.vendorBooking) {
    totalAmount = refund.vendorBooking.depositAmount 
      ? Number(refund.vendorBooking.depositAmount)
      : refund.vendorBooking.totalAmount 
        ? Number(refund.vendorBooking.totalAmount)
        : null;
    eventDate = refund.vendorBooking.userSocialEvent?.eventDate || null;
    cancelledBy = refund.vendorBooking.cancelledBy || null;
  } else if (refund.ticketBooking) {
    totalAmount = Number(refund.ticketBooking.totalAmount);
    eventDate = refund.ticketBooking.event?.eventDate || null;
    cancelledBy = 'CUSTOMER';
  }

  // ✅ 1. Check if percentage is already in gatewayResponse
  const gatewayResponse = refund.gatewayResponse as any;
  if (gatewayResponse?.refundPercentage !== undefined && gatewayResponse?.refundPercentage !== null) {
    refundPercentage = gatewayResponse.refundPercentage;
  }

  // ✅ 2. Calculate from amounts
  if (refundPercentage === null && refundAmount && totalAmount && totalAmount > 0) {
    refundPercentage = calculateRefundPercentageFromAmount(refundAmount, totalAmount);
  }

  // ✅ 3. For vendor declines, it's always 100% of deposit
  if (refundPercentage === null && cancelledBy === 'VENDOR') {
    refundPercentage = 100;
  }

  // ✅ 4. Calculate from days until event
  if (refundPercentage === null && eventDate) {
    const cancellationDate = refund.createdAt || new Date();
    daysUntilEvent = calculateDaysUntilEvent(eventDate, cancellationDate);
    refundPercentage = getRefundPercentageFromPolicy(daysUntilEvent);
  }

  return { percentage: refundPercentage, daysUntilEvent };
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await getServerSession(authOptions);
    const { id } = await params;

    if (!session || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { status, notes, transferMethod, transactionReference, useKhaltiApi } =
      await request.json();

    const refund = await prisma.refund.findUnique({
      where: { id },
      include: {
        paymentTransaction: true,
        vendorBooking: {
          include: {
            vendor: true,
            userSocialEvent: true,
          },
        },
        ticketBooking: {
          include: {
            event: true,
            tier: true,
          },
        },
      },
    });

    if (!refund) {
      return NextResponse.json({ error: 'Refund not found' }, { status: 404 });
    }

    // ✅ Calculate refund percentage
    const { percentage: refundPercentage, daysUntilEvent } = calculateRefundPercentage(refund);

    // Helper: mark the associated booking as refunded
    async function markBookingRefunded() {
      if (refund!.vendorBookingId) {
        await prisma.vendorBooking.update({
          where: { id: refund!.vendorBookingId },
          data: {
            paymentStatus: 'REFUNDED',
            bookingStatus: 'DECLINED',
          },
        });
      }
      if (refund!.ticketBookingId) {
        await prisma.ticketBooking.update({
          where: { id: refund!.ticketBookingId },
          data: { paymentStatus: 'REFUNDED' },
        });
      }
    }

    // ── PROCESSED ────────────────────────────────────────────────
    if (status === 'PROCESSED') {

      // OPTION 1: Manual refund
      if (transferMethod && transactionReference && useKhaltiApi === false) {
        const updatedRefund = await prisma.refund.update({
          where: { id },
          data: {
            refundStatus: 'PROCESSED',
            processedAt: new Date(),
            gatewayRefundId: transactionReference,
            gatewayResponse: {
              status: 'PROCESSED',
              method: 'MANUAL',
              transferMethod,
              transactionReference,
              adminNotes: notes,
              processedBy: session.user.email,
              processedAt: new Date().toISOString(),
              // ✅ ADD: Refund percentage
              refundPercentage,
              daysUntilEvent,
              refundAmount: Number(refund.refundAmount),
            },
          },
        });
        await markBookingRefunded();
        return NextResponse.json({
          success: true,
          refund: updatedRefund,
          method: 'MANUAL',
        });
      }

      // OPTION 2: Khalti API refund
      if (useKhaltiApi === true) {
        const gatewayTxId = refund.paymentTransaction?.gatewayTransactionId;

        if (!gatewayTxId) {
          return NextResponse.json(
            { error: 'Cannot process refund: Original Khalti transaction ID not found' },
            { status: 400 },
          );
        }

        const refundAmountInPaisa = Math.round(Number(refund.refundAmount) * 100);
        const isPaidInFull =
          refundAmountInPaisa ===
          Math.round(Number(refund.paymentTransaction?.amount) * 100);

        try {
          const khaltiUrl = `${
            process.env.NODE_ENV === 'production'
              ? 'https://khalti.com'
              : 'https://dev.khalti.com'
          }/api/merchant-transaction/${gatewayTxId}/refund/`;

          const body = isPaidInFull
            ? {} // Full refund: no body needed
            : { amount: refundAmountInPaisa }; // Partial refund: amount in paisa

          const khaltiResponse = await fetch(khaltiUrl, {
            method: 'POST',
            headers: {
              Authorization: `Key ${process.env.KHALTI_SECRET_KEY}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(body),
          });

          const khaltiResult = await khaltiResponse.json();

          if (!khaltiResponse.ok) {
            console.error('Khalti refund failed:', khaltiResult);

            await prisma.refund.update({
              where: { id },
              data: {
                refundStatus: 'FAILED',
                gatewayResponse: {
                  status: 'FAILED',
                  method: 'KHALTI_API',
                  khaltiError: khaltiResult,
                  adminNotes: notes,
                  processedBy: session.user.email,
                  attemptedAt: new Date().toISOString(),
                  // ✅ ADD: Refund percentage even on failure
                  refundPercentage,
                  daysUntilEvent,
                },
              },
            });

            return NextResponse.json(
              { error: khaltiResult.detail || 'Khalti refund API failed' },
              { status: 400 },
            );
          }

          const updatedRefund = await prisma.refund.update({
            where: { id },
            data: {
              refundStatus: 'PROCESSED',
              processedAt: new Date(),
              gatewayRefundId: `khalti_refund_${gatewayTxId}`,
              gatewayResponse: {
                status: 'PROCESSED',
                method: 'KHALTI_API',
                khaltiResponse: khaltiResult,
                originalTxId: gatewayTxId,
                refundAmountInPaisa,
                adminNotes: notes,
                processedBy: session.user.email,
                processedAt: new Date().toISOString(),
                // ✅ ADD: Refund percentage
                refundPercentage,
                daysUntilEvent,
                refundAmount: Number(refund.refundAmount),
              },
            },
          });

          await markBookingRefunded();

          return NextResponse.json({
            success: true,
            refund: updatedRefund,
            method: 'KHALTI_API',
            message: khaltiResult.detail,
          });
        } catch (khaltiError) {
          console.error('Khalti API error:', khaltiError);

          await prisma.refund.update({
            where: { id },
            data: {
              refundStatus: 'FAILED',
              gatewayResponse: {
                status: 'FAILED',
                method: 'KHALTI_API',
                error: (khaltiError as Error).message,
                adminNotes: notes,
                processedBy: session.user.email,
                attemptedAt: new Date().toISOString(),
                // ✅ ADD: Refund percentage even on failure
                refundPercentage,
                daysUntilEvent,
              },
            },
          });

          return NextResponse.json(
            { error: 'Failed to connect to Khalti refund API' },
            { status: 500 },
          );
        }
      }

      // FALLBACK: Mark processed with note only
      const updatedRefund = await prisma.refund.update({
        where: { id },
        data: {
          refundStatus: 'PROCESSED',
          processedAt: new Date(),
          gatewayResponse: {
            status: 'PROCESSED',
            method: 'MANUAL',
            adminNotes: notes,
            processedBy: session.user.email,
            processedAt: new Date().toISOString(),
            // ✅ ADD: Refund percentage
            refundPercentage,
            daysUntilEvent,
            refundAmount: Number(refund.refundAmount),
          },
        },
      });
      await markBookingRefunded();
      return NextResponse.json({ success: true, refund: updatedRefund, method: 'MANUAL' });
    }

    // ── FAILED ───────────────────────────────────────────────────
    if (status === 'FAILED') {
      const updatedRefund = await prisma.refund.update({
        where: { id },
        data: {
          refundStatus: 'FAILED',
          gatewayResponse: {
            ...(refund.gatewayResponse as object || {}),
            status: 'FAILED',
            adminNotes: notes,
            processedBy: session.user.email,
            updatedAt: new Date().toISOString(),
            // ✅ ADD: Refund percentage
            refundPercentage,
            daysUntilEvent,
          },
        },
      });
      return NextResponse.json({ success: true, refund: updatedRefund });
    }

    // ── OTHER STATUS UPDATES ─────────────────────────────────────
    const updatedRefund = await prisma.refund.update({
      where: { id },
      data: {
        refundStatus: status,
        gatewayResponse: {
          ...(refund.gatewayResponse as object || {}),
          status,
          adminNotes: notes,
          processedBy: session.user.email,
          updatedAt: new Date().toISOString(),
          // ✅ ADD: Refund percentage
          refundPercentage,
          daysUntilEvent,
        },
      },
    });
    return NextResponse.json({ success: true, refund: updatedRefund });

  } catch (error) {
    console.error('Error updating refund:', error);
    return NextResponse.json(
      { error: 'Failed to update refund' },
      { status: 500 },
    );
  }
}