// app/api/user/vendor-bookings/[id]/route.ts

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// ────────────────────────────────────────────────────────────────────
// GET - Fetch single vendor booking for user
// ────────────────────────────────────────────────────────────────────
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    const { id } = await params;

    if (!session || !session.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const booking = await prisma.vendorBooking.findFirst({
      where: {
        id: id,
        userId: session.user.id,
      },
      include: {
        vendor: true,
        servicePackage: true,
        bookingAddOns: {
          include: {
            packageAddOn: true,
          },
        },
        userSocialEvent: true,
        payouts: true,
        refunds: {
          take: 1,
          orderBy: { createdAt: "desc" },
        },
        paymentTransactions: true,
      },
    });

    if (!booking) {
      return NextResponse.json({ error: "Booking not found" }, { status: 404 });
    }

    const addOns = booking.bookingAddOns.map((ba) => ({
      name: ba.packageAddOn.name,
      price: Number(ba.priceAtBooking),
    }));

    const totalAmountNum = Number(booking.totalAmount);
    const depositAmount = booking.depositAmount
      ? Number(booking.depositAmount)
      : totalAmountNum * 0.2;
    const remainingAmount = booking.remainingAmount
      ? Number(booking.remainingAmount)
      : totalAmountNum * 0.8;

    let discountPercent = 0;
    const totalDays = booking.totalDays || 1;
    if (totalDays >= 8) discountPercent = 15;
    else if (totalDays >= 4) discountPercent = 10;
    else if (totalDays >= 2) discountPercent = 5;

    const latestRefund = booking.refunds[0] ?? null;

    const payouts = booking.payouts || [];
    const depositPayout = payouts.find(p => p.type === 'DEPOSIT' && p.status === 'COMPLETED');
    const remainingPayout = payouts.find(p => p.type === 'REMAINING' && p.status === 'COMPLETED');
    const pendingPayouts = payouts.filter(p => p.status === 'PENDING');

    const depositReleased = !!depositPayout;
    const remainingReleased = !!remainingPayout;
    const fullyReleased = depositReleased && remainingReleased;
    const hasPendingPayout = pendingPayouts.length > 0;

    // ✅ NEW: Derive a single human-readable payout status + color for the frontend.
    // Without this, booking.payoutStatus / payoutStatusColor were undefined and
    // the "Payout Status" field on the booking detail page rendered blank.
    let payoutStatus = "Pending";
    let payoutStatusColor = "gray";

    if (booking.bookingStatus === "DECLINED") {
      payoutStatus = "N/A (Declined)";
      payoutStatusColor = "gray";
    } else if (fullyReleased) {
      payoutStatus = "Fully Released";
      payoutStatusColor = "green";
    } else if (depositReleased && booking.vendorPaymentStatus === "DEPOSIT_PAID") {
      payoutStatus = "Deposit Released";
      payoutStatusColor = "blue";
    } else if (hasPendingPayout) {
      payoutStatus = "Processing";
      payoutStatusColor = "yellow";
    } else if (
      booking.vendorPaymentStatus === "DEPOSIT_PAID" ||
      booking.vendorPaymentStatus === "FULLY_PAID"
    ) {
      payoutStatus = "Awaiting Release";
      payoutStatusColor = "gray";
    } else {
      payoutStatus = "Pending";
      payoutStatusColor = "gray";
    }

    // ✅ Check if customer can confirm (vendor marked complete + not already confirmed)
    const canConfirm = booking.vendorMarkedComplete === true && 
                       booking.customerConfirmed === false &&
                       booking.bookingStatus === 'COMPLETED';

    // ✅ Check if customer can cancel (only if not completed and no deposit paid)
    const canCancel = booking.bookingStatus === 'PENDING' && 
                      booking.vendorPaymentStatus === 'PENDING';

    const formattedBooking = {
      id: booking.id,
      vendorName: booking.vendor.businessName,
      serviceType: booking.vendor.serviceType,
      packageName: booking.servicePackage.name,
      totalAmount: totalAmountNum,
      depositAmount: depositAmount,
      remainingAmount: remainingAmount,
      vendorPaymentStatus: booking.vendorPaymentStatus || "PENDING",
      paymentStatus: booking.paymentStatus,
      bookingStatus: booking.bookingStatus,
      eventDate: booking.userSocialEvent.eventDate,
      startDate: booking.startDate,
      endDate: booking.endDate,
      totalDays: booking.totalDays,
      dailyRate: booking.dailyRate,
      discountPercent: discountPercent,
      eventTitle: booking.userSocialEvent.title,
      location: booking.vendor.location,
      addOns: addOns,
      createdAt: booking.createdAt,
      depositPaidAt: booking.depositPaidAt,
      remainingPaidAt: booking.remainingPaidAt,
      amountReleasedAt: booking.amountReleasedAt,

      // ✅ Vendor completion status
      vendorMarkedComplete: booking.vendorMarkedComplete,
      customerConfirmed: booking.customerConfirmed,
      canConfirm: canConfirm,
      canCancel: canCancel,

      // ✅ Payout status (NEW — was missing, caused blank "Payout Status" on frontend)
      payoutStatus: payoutStatus,
      payoutStatusColor: payoutStatusColor,

      // Payout fields
      payouts: payouts.map(p => ({
        id: p.id,
        type: p.type,
        amount: p.amount,
        status: p.status,
        processedAt: p.processedAt,
      })),
      depositReleased,
      remainingReleased,
      fullyReleased,
      hasPendingPayout,
      // ✅ Also expose release timestamps the frontend already expects
      depositReleasedAt: depositPayout?.processedAt ?? null,
      remainingReleasedAt: remainingPayout?.processedAt ?? null,

      // Cancellation fields
      cancelledBy: booking.cancelledBy,
      cancellationReason: booking.cancellationReason,
      cancelledAt: booking.cancelledAt,

      // Refund fields
      refundStatus: latestRefund?.refundStatus ?? null,
      refundAmount: latestRefund ? Number(latestRefund.refundAmount) : null,
      refundPercentage: latestRefund
        ? Math.round((Number(latestRefund.refundAmount) / depositAmount) * 100)
        : null,
    };

    return NextResponse.json(formattedBooking);
  } catch (error) {
    console.error("Error fetching booking:", error);
    return NextResponse.json(
      { error: "Failed to fetch booking" },
      { status: 500 }
    );
  }
}

// ────────────────────────────────────────────────────────────────────
// PATCH - Customer actions (confirm completion, cancel)
// ────────────────────────────────────────────────────────────────────
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    const { id } = await params;

    if (!session || !session.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { action } = await request.json();

    if (!action || !['CONFIRM_COMPLETION', 'CANCEL_BOOKING'].includes(action)) {
      return NextResponse.json(
        { error: 'Invalid action. Allowed: CONFIRM_COMPLETION, CANCEL_BOOKING' },
        { status: 400 }
      );
    }

    // ── FIND THE BOOKING ──────────────────────────────────────────
    const booking = await prisma.vendorBooking.findFirst({
      where: {
        id: id,
        userId: session.user.id,
      },
      include: {
        vendor: {
          include: {
            user: true,
          },
        },
        userSocialEvent: true,
        servicePackage: true,
        payouts: true,
        paymentTransactions: true,
      },
    });

    if (!booking) {
      return NextResponse.json(
        { error: "Booking not found" },
        { status: 404 }
      );
    }

    // ── ACTION: CONFIRM_COMPLETION ────────────────────────────────
    if (action === 'CONFIRM_COMPLETION') {
      // Validate: Vendor must have marked complete
      if (!booking.vendorMarkedComplete) {
        return NextResponse.json(
          { 
            error: 'Cannot confirm completion. Vendor has not marked this service as completed yet.',
            vendorMarkedComplete: false
          },
          { status: 400 }
        );
      }

      // Validate: Not already confirmed
      if (booking.customerConfirmed) {
        return NextResponse.json(
          { error: 'You have already confirmed completion for this booking.' },
          { status: 400 }
        );
      }

      // Validate: Booking must be COMPLETED
      if (booking.bookingStatus !== 'COMPLETED') {
        return NextResponse.json(
          { 
            error: `Cannot confirm. Booking status is ${booking.bookingStatus}. Expected COMPLETED.`,
            currentStatus: booking.bookingStatus
          },
          { status: 400 }
        );
      }

      // ── UPDATE: Mark customer as confirmed ──────────────────────
      const updatedBooking = await prisma.vendorBooking.update({
        where: { id: booking.id },
        data: {
          customerConfirmed: true,
        },
      });

      // ── CHECK: Both vendor and customer confirmed ──────────────
      // Since we just set customerConfirmed to true and vendorMarkedComplete is already true
      // Both are now confirmed → Ready for payout

      // Update vendorPaymentStatus to FULLY_PAID
      await prisma.vendorBooking.update({
        where: { id: booking.id },
        data: {
          vendorPaymentStatus: 'FULLY_PAID',
        },
      });

      // ── CREATE REMAINING PAYOUT ─────────────────────────────────
      const remainingAmount = booking.remainingAmount
        ? Number(booking.remainingAmount)
        : Number(booking.totalAmount) * 0.8;

      let payout = null;
      if (remainingAmount > 0) {
        payout = await prisma.payout.create({
          data: {
            bookingId: booking.id,
            vendorId: booking.vendorId,
            amount: remainingAmount,
            type: 'REMAINING',
            status: 'PENDING',
            notes: `Auto-created after customer confirmed completion. Booking: ${booking.bookingReference}`,
          },
        });
      }

      // ── NOTIFICATIONS ────────────────────────────────────────────
      // 1. Email to vendor
      try {
        await sendVendorConfirmationEmail({
          to: booking.vendor.user?.email || '',
          vendorName: booking.vendor.businessName,
          bookingId: booking.id,
          eventTitle: booking.userSocialEvent?.title || 'Event',
          bookingReference: booking.bookingReference,
          amount: remainingAmount,
        });
      } catch (emailError) {
        console.error('Failed to send vendor confirmation email:', emailError);
      }

      // 2. Email to customer (thank you)
      try {
        await sendCustomerThankYouEmail({
          to: session.user.email || '',
          name: session.user.name || 'Customer',
          bookingId: booking.id,
          eventTitle: booking.userSocialEvent?.title || 'Event',
          vendorName: booking.vendor.businessName,
          bookingReference: booking.bookingReference,
        });
      } catch (emailError) {
        console.error('Failed to send customer thank you email:', emailError);
      }

      // 3. Notify admin for payout
      try {
        await notifyAdminForPayout({
          bookingId: booking.id,
          vendorId: booking.vendorId,
          vendorName: booking.vendor.businessName,
          amount: remainingAmount,
          customerName: session.user.name || 'Customer',
          eventTitle: booking.userSocialEvent?.title || 'Event',
        });
      } catch (adminError) {
        console.error('Failed to notify admin:', adminError);
      }

      return NextResponse.json({
        success: true,
        message: 'Completion confirmed successfully! Your funds will be released to the vendor after admin verification.',
        booking: updatedBooking,
        payoutCreated: !!payout,
        payoutId: payout?.id || null,
        amount: remainingAmount,
        status: 'FULLY_PAID',
      });
    }

    // ── ACTION: CANCEL_BOOKING ────────────────────────────────────
    if (action === 'CANCEL_BOOKING') {
      // Validate: Can only cancel if PENDING and no deposit paid
      if (booking.bookingStatus !== 'PENDING') {
        return NextResponse.json(
          { 
            error: `Cannot cancel. Booking status is ${booking.bookingStatus}. Only PENDING bookings can be cancelled.`,
            currentStatus: booking.bookingStatus
          },
          { status: 400 }
        );
      }

      if (booking.vendorPaymentStatus !== 'PENDING' && booking.vendorPaymentStatus !== 'DEPOSIT_PAID') {
        return NextResponse.json(
          { 
            error: `Cannot cancel. Payment status is ${booking.vendorPaymentStatus}. Contact support.`,
            currentPaymentStatus: booking.vendorPaymentStatus
          },
          { status: 400 }
        );
      }

      // If deposit was paid, use the refund flow (separate endpoint)
      if (booking.vendorPaymentStatus === 'DEPOSIT_PAID') {
        return NextResponse.json(
          { 
            error: 'Deposit has already been paid. Please use the refund cancellation flow at /api/user/cancel-booking',
            useRefundEndpoint: true,
            bookingId: booking.id,
          },
          { status: 400 }
        );
      }

      // ── CANCEL (no deposit paid) ─────────────────────────────────
      const cancelledBooking = await prisma.vendorBooking.update({
        where: { id: booking.id },
        data: {
          bookingStatus: 'DECLINED',
          cancelledBy: 'CUSTOMER',
          cancellationReason: 'Customer cancelled booking before deposit payment',
          cancelledAt: new Date(),
          paymentStatus: 'FAILED',
        },
      });

      // Send cancellation email
      try {
        await sendBookingCancellationEmail({
          to: session.user.email || '',
          name: session.user.name || 'Customer',
          bookingId: booking.id,
          eventTitle: booking.userSocialEvent?.title || 'Event',
          vendorName: booking.vendor.businessName,
          bookingReference: booking.bookingReference,
        });
      } catch (emailError) {
        console.error('Failed to send cancellation email:', emailError);
      }

      return NextResponse.json({
        success: true,
        message: 'Booking cancelled successfully. No payment was made, so no refund is due.',
        booking: cancelledBooking,
        refundAmount: 0,
      });
    }

    return NextResponse.json(
      { error: 'Invalid action' },
      { status: 400 }
    );

  } catch (error) {
    console.error('Error processing customer action:', error);
    return NextResponse.json(
      { error: 'Failed to process request' },
      { status: 500 }
    );
  }
}

// ────────────────────────────────────────────────────────────────────
// DELETE - Cancel booking (legacy, kept for compatibility)
// ────────────────────────────────────────────────────────────────────
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    const { id } = await params;

    if (!session || !session.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const booking = await prisma.vendorBooking.findFirst({
      where: {
        id: id,
        userId: session.user.id,
      },
      include: {
        paymentTransactions: true,
      },
    });

    if (!booking) {
      return NextResponse.json({ error: "Booking not found" }, { status: 404 });
    }

    if (booking.bookingStatus !== "PENDING") {
      return NextResponse.json(
        { error: "Cannot cancel this booking. Booking is already processed." },
        { status: 400 }
      );
    }

    if (booking.vendorPaymentStatus === "DEPOSIT_PAID") {
      return NextResponse.json(
        { error: "Deposit already paid. Use the refund cancellation flow instead." },
        { status: 400 }
      );
    }

    await prisma.vendorBooking.update({
      where: { id: id },
      data: {
        bookingStatus: "DECLINED",
        cancelledBy: "CUSTOMER",
        cancellationReason: "Customer cancelled booking",
        cancelledAt: new Date(),
        paymentStatus: "FAILED",
      },
    });

    return NextResponse.json({
      success: true,
      message: "Booking cancelled successfully",
    });
  } catch (error) {
    console.error("Error cancelling booking:", error);
    return NextResponse.json(
      { error: "Failed to cancel booking" },
      { status: 500 }
    );
  }
}

// ────────────────────────────────────────────────────────────────────
// HELPERS - Email Functions
// ────────────────────────────────────────────────────────────────────

async function sendVendorConfirmationEmail(data: {
  to: string;
  vendorName: string;
  bookingId: string;
  eventTitle: string;
  bookingReference: string;
  amount: number;
}) {
  if (!data.to) return;

  const { sendEmail } = await import('@/lib/email');

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>✅ Customer Confirmed Completion</title>
    </head>
    <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background: linear-gradient(135deg, #22c55e, #16a34a); padding: 30px; text-align: center; border-radius: 12px 12px 0 0;">
        <h1 style="color: white; margin: 0;">✅ Customer Confirmed!</h1>
      </div>
      <div style="background: #ffffff; padding: 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 12px 12px;">
        <p>Dear ${data.vendorName},</p>
        <p>The customer has confirmed completion of your service for <strong>${data.eventTitle}</strong>.</p>
        <div style="background: #f3f4f6; padding: 15px; border-radius: 8px; margin: 15px 0;">
          <p style="margin: 5px 0;"><strong>Booking Reference:</strong> ${data.bookingReference}</p>
          <p style="margin: 5px 0;"><strong>Event:</strong> ${data.eventTitle}</p>
          <p style="margin: 5px 0; font-size: 18px; color: #16a34a;"><strong>Amount:</strong> NPR ${data.amount.toLocaleString()}</p>
        </div>
        <p style="color: #6b7280; font-size: 14px;">Your payment will be processed by the admin team within 1-3 business days.</p>
        <hr style="margin: 30px 0 20px; border-color: #e5e7eb;">
        <p style="color: #6b7280; font-size: 12px; text-align: center;">EventFlow Support Team</p>
      </div>
    </body>
    </html>
  `;

  await sendEmail({
    to: data.to,
    subject: `✅ Customer Confirmed Completion: ${data.bookingReference}`,
    html,
  });
}

async function sendCustomerThankYouEmail(data: {
  to: string;
  name: string;
  bookingId: string;
  eventTitle: string;
  vendorName: string;
  bookingReference: string;
}) {
  if (!data.to) return;

  const { sendEmail } = await import('@/lib/email');

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Thank You for Your Confirmation</title>
    </head>
    <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background: linear-gradient(135deg, #4f46e5, #7c3aed); padding: 30px; text-align: center; border-radius: 12px 12px 0 0;">
        <h1 style="color: white; margin: 0;">Thank You!</h1>
      </div>
      <div style="background: #ffffff; padding: 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 12px 12px;">
        <p>Dear ${data.name},</p>
        <p>Thank you for confirming the completion of your service with <strong>${data.vendorName}</strong> for <strong>${data.eventTitle}</strong>.</p>
        <p>Your confirmation has been recorded. The vendor will receive their payment within 1-3 business days.</p>
        <div style="background: #f3f4f6; padding: 15px; border-radius: 8px; margin: 15px 0;">
          <p style="margin: 5px 0;"><strong>Booking Reference:</strong> ${data.bookingReference}</p>
          <p style="margin: 5px 0;"><strong>Vendor:</strong> ${data.vendorName}</p>
          <p style="margin: 5px 0;"><strong>Event:</strong> ${data.eventTitle}</p>
        </div>
        <div style="text-align: center;">
          <a href="${process.env.NEXTAUTH_URL}/my-bookings/${data.bookingId}" style="display: inline-block; padding: 12px 24px; background: #4f46e5; color: white; text-decoration: none; border-radius: 8px; margin: 20px 0;">
            View Booking
          </a>
        </div>
        <hr style="margin: 30px 0 20px; border-color: #e5e7eb;">
        <p style="color: #6b7280; font-size: 12px; text-align: center;">EventFlow Support Team</p>
      </div>
    </body>
    </html>
  `;

  await sendEmail({
    to: data.to,
    subject: `✅ Confirmation Received: ${data.bookingReference}`,
    html,
  });
}

async function sendBookingCancellationEmail(data: {
  to: string;
  name: string;
  bookingId: string;
  eventTitle: string;
  vendorName: string;
  bookingReference: string;
}) {
  if (!data.to) return;

  const { sendEmail } = await import('@/lib/email');

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Booking Cancelled</title>
    </head>
    <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background: linear-gradient(135deg, #f59e0b, #d97706); padding: 30px; text-align: center; border-radius: 12px 12px 0 0;">
        <h1 style="color: white; margin: 0;">Booking Cancelled</h1>
      </div>
      <div style="background: #ffffff; padding: 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 12px 12px;">
        <p>Dear ${data.name},</p>
        <p>Your booking <strong>${data.bookingReference}</strong> for <strong>${data.eventTitle}</strong> with <strong>${data.vendorName}</strong> has been cancelled.</p>
        <p>No payment was made, so no refund is due.</p>
        <div style="text-align: center;">
          <a href="${process.env.NEXTAUTH_URL}/vendors" style="display: inline-block; padding: 12px 24px; background: #4f46e5; color: white; text-decoration: none; border-radius: 8px; margin: 20px 0;">
            Browse Vendors
          </a>
        </div>
        <hr style="margin: 30px 0 20px; border-color: #e5e7eb;">
        <p style="color: #6b7280; font-size: 12px; text-align: center;">EventFlow Support Team</p>
      </div>
    </body>
    </html>
  `;

  await sendEmail({
    to: data.to,
    subject: `❌ Booking Cancelled: ${data.bookingReference}`,
    html,
  });
}

async function notifyAdminForPayout(data: {
  bookingId: string;
  vendorId: string;
  vendorName: string;
  amount: number;
  customerName: string;
  eventTitle: string;
}) {
  const { sendEmail } = await import('@/lib/email');

  const adminEmails = process.env.ADMIN_EMAILS?.split(',') || [];
  if (adminEmails.length === 0) {
    console.warn('No admin emails configured for payout notification');
    return;
  }

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>💰 Payout Ready for Release</title>
    </head>
    <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background: linear-gradient(135deg, #f59e0b, #d97706); padding: 30px; text-align: center; border-radius: 12px 12px 0 0;">
        <h1 style="color: white; margin: 0;">💰 Payout Ready for Release</h1>
      </div>
      <div style="background: #ffffff; padding: 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 12px 12px;">
        <p>Dear Admin,</p>
        <p>A vendor booking is ready for payout. Both the vendor and customer have confirmed completion.</p>
        <div style="background: #f3f4f6; padding: 15px; border-radius: 8px; margin: 15px 0;">
          <p style="margin: 5px 0;"><strong>Booking ID:</strong> ${data.bookingId}</p>
          <p style="margin: 5px 0;"><strong>Vendor:</strong> ${data.vendorName}</p>
          <p style="margin: 5px 0;"><strong>Customer:</strong> ${data.customerName}</p>
          <p style="margin: 5px 0;"><strong>Event:</strong> ${data.eventTitle}</p>
          <p style="margin: 5px 0; font-size: 18px; color: #16a34a;"><strong>Amount:</strong> NPR ${data.amount.toLocaleString()}</p>
        </div>
        <div style="text-align: center;">
          <a href="${process.env.NEXTAUTH_URL}/admin/payouts" style="display: inline-block; padding: 12px 24px; background: #4f46e5; color: white; text-decoration: none; border-radius: 8px; margin: 20px 0;">
            Go to Payouts Dashboard
          </a>
        </div>
        <hr style="margin: 30px 0 20px; border-color: #e5e7eb;">
        <p style="color: #6b7280; font-size: 12px; text-align: center;">EventFlow Admin System</p>
      </div>
    </html>
  `;

  for (const email of adminEmails) {
    await sendEmail({
      to: email.trim(),
      subject: `💰 Payout Ready: Booking ${data.bookingId}`,
      html,
    });
  }
}