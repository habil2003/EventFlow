// app/api/admin/disputes/[id]/route.ts

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// ────────────────────────────────────────────────────────────────────
// GET - Admin view single dispute
// ────────────────────────────────────────────────────────────────────
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    const { id } = await params;

    if (!session || session.user?.role !== 'ADMIN') {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const dispute = await prisma.dispute.findUnique({
      where: { id },
      include: {
        vendorBooking: {
          include: {
            vendor: {
              include: {
                user: {
                  select: {
                    name: true,
                    email: true,
                  },
                },
              },
            },
            user: {
              select: {
                name: true,
                email: true,
              },
            },
            userSocialEvent: true,
            servicePackage: true,
            paymentTransactions: true,
            payouts: true,
            refunds: true,
          },
        },
        user: {
          select: {
            name: true,
            email: true,
          },
        },
      },
    });

    if (!dispute) {
      return NextResponse.json({ error: "Dispute not found" }, { status: 404 });
    }

    return NextResponse.json({
      dispute: {
        id: dispute.id,
        bookingId: dispute.bookingId,
        reason: dispute.reason,
        status: dispute.status,
        adminDecision: dispute.adminDecision,
        createdAt: dispute.createdAt,
        updatedAt: dispute.updatedAt,
        customer: {
          name: dispute.user?.name || dispute.vendorBooking?.user?.name || 'Unknown',
          email: dispute.user?.email || dispute.vendorBooking?.user?.email || 'Unknown',
        },
        vendor: {
          name: dispute.vendorBooking?.vendor?.businessName || 'Unknown Vendor',
          email: dispute.vendorBooking?.vendor?.user?.email || 'Unknown',
        },
        booking: {
          id: dispute.vendorBooking?.id,
          eventTitle: dispute.vendorBooking?.userSocialEvent?.title || 'Unknown Event',
          totalAmount: dispute.vendorBooking?.totalAmount || 0,
          depositAmount: dispute.vendorBooking?.depositAmount || 0,
          remainingAmount: dispute.vendorBooking?.remainingAmount || 0,
          packageName: dispute.vendorBooking?.servicePackage?.name || 'Unknown Package',
          paymentStatus: dispute.vendorBooking?.paymentStatus || 'Unknown',
          vendorPaymentStatus: dispute.vendorBooking?.vendorPaymentStatus || 'Unknown',
          bookingStatus: dispute.vendorBooking?.bookingStatus || 'Unknown',
          payouts: dispute.vendorBooking?.payouts || [],
          refunds: dispute.vendorBooking?.refunds || [],
        },
      },
    });

  } catch (error) {
    console.error("Error fetching dispute:", error);
    return NextResponse.json(
      { error: "Failed to fetch dispute" },
      { status: 500 }
    );
  }
}

// ────────────────────────────────────────────────────────────────────
// PATCH - Admin resolve dispute
// ────────────────────────────────────────────────────────────────────
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    const { id } = await params;

    if (!session || session.user?.role !== 'ADMIN') {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { status, adminDecision, notes } = await request.json();

    if (!status || !['RESOLVED', 'REJECTED'].includes(status)) {
      return NextResponse.json(
        { error: 'Invalid status. Must be RESOLVED or REJECTED' },
        { status: 400 }
      );
    }

    if (!adminDecision) {
      return NextResponse.json(
        { error: 'Admin decision is required' },
        { status: 400 }
      );
    }

    // ── FIND THE DISPUTE ──────────────────────────────────────────
    const dispute = await prisma.dispute.findUnique({
      where: { id },
      include: {
        vendorBooking: {
          include: {
            vendor: true,
            user: true,
            userSocialEvent: true,
          },
        },
      },
    });

    if (!dispute) {
      return NextResponse.json({ error: "Dispute not found" }, { status: 404 });
    }

    if (dispute.status === 'RESOLVED' || dispute.status === 'REJECTED') {
      return NextResponse.json(
        { error: `Dispute is already ${dispute.status.toLowerCase()}` },
        { status: 400 }
      );
    }

    // ── UPDATE DISPUTE ─────────────────────────────────────────────
    const updatedDispute = await prisma.dispute.update({
      where: { id },
      data: {
        status: status,
        adminDecision: adminDecision,
      },
    });

    // ── HANDLE DECISION: RESOLVED (Refund) ────────────────────────
    if (status === 'RESOLVED') {
      // Update booking status
      await prisma.vendorBooking.update({
        where: { id: dispute.bookingId },
        data: {
          vendorPaymentStatus: 'REFUNDED',
          paymentStatus: 'REFUNDED',
          bookingStatus: 'DECLINED',
          cancelledBy: 'ADMIN',
          cancellationReason: `Dispute resolved - ${adminDecision}`,
          cancelledAt: new Date(),
        },
      });

      // Create refund
      const booking = dispute.vendorBooking;
      const refundAmount = booking.depositAmount 
        ? Number(booking.depositAmount) 
        : Number(booking.totalAmount) * 0.2;

      // Find deposit transaction
      const depositTransaction = await prisma.paymentTransaction.findFirst({
        where: {
          vendorBookingId: booking.id,
          paymentType: 'VENDOR_DEPOSIT',
          status: 'SUCCESS',
        },
      });

      if (depositTransaction) {
        await prisma.refund.create({
          data: {
            originalTransactionId: depositTransaction.transactionId,
            refundAmount: refundAmount,
            refundReason: `Dispute resolved in customer favor: ${adminDecision}`,
            refundStatus: 'PENDING_ADMIN',
            paymentTransactionId: depositTransaction.id,
            vendorBookingId: booking.id,
            gatewayResponse: {
              method: 'MANUAL',
              refundPercentage: 100,
              processedBy: session.user.email,
              processedAt: new Date().toISOString(),
              adminNotes: notes,
            },
          },
        });

        // Notify admin that manual refund is needed
        try {
          await notifyAdminForManualRefund({
            bookingId: booking.id,
            amount: refundAmount,
            customerName: booking.user?.name || 'Customer',
            vendorName: booking.vendor?.businessName || 'Vendor',
            disputeId: dispute.id,
            adminEmail: session.user.email,
          });
        } catch (emailError) {
          console.error('Failed to notify admin for refund:', emailError);
        }
      }

      // Notify customer
      try {
        await notifyCustomerOfResolution({
          email: booking.user?.email || '',
          name: booking.user?.name || 'Customer',
          bookingId: booking.id,
          eventTitle: booking.userSocialEvent?.title || 'Event',
          decision: 'RESOLVED',
          adminDecision: adminDecision,
          refundAmount: refundAmount,
        });
      } catch (emailError) {
        console.error('Failed to notify customer:', emailError);
      }

      // Notify vendor
      try {
        await notifyVendorOfResolution({
          email: booking.vendor?.user?.email || '',
          name: booking.vendor?.businessName || 'Vendor',
          bookingId: booking.id,
          eventTitle: booking.userSocialEvent?.title || 'Event',
          decision: 'RESOLVED',
          adminDecision: adminDecision,
        });
      } catch (emailError) {
        console.error('Failed to notify vendor:', emailError);
      }

      return NextResponse.json({
        success: true,
        message: 'Dispute resolved. Refund initiated.',
        dispute: updatedDispute,
        refundAmount: refundAmount,
        requiresManualAction: true,
      });
    }

    // ── HANDLE DECISION: REJECTED ──────────────────────────────────
    if (status === 'REJECTED') {
      // Update booking status back to ACCEPTED
      await prisma.vendorBooking.update({
        where: { id: dispute.bookingId },
        data: {
          vendorPaymentStatus: 'FULLY_PAID',
          paymentStatus: 'HELD_IN_ESCROW',
          bookingStatus: 'ACCEPTED',
        },
      });

      // Notify customer
      try {
        await notifyCustomerOfResolution({
          email: dispute.vendorBooking?.user?.email || '',
          name: dispute.vendorBooking?.user?.name || 'Customer',
          bookingId: dispute.bookingId,
          eventTitle: dispute.vendorBooking?.userSocialEvent?.title || 'Event',
          decision: 'REJECTED',
          adminDecision: adminDecision,
          refundAmount: 0,
        });
      } catch (emailError) {
        console.error('Failed to notify customer:', emailError);
      }

      // Notify vendor
      try {
        await notifyVendorOfResolution({
          email: dispute.vendorBooking?.vendor?.user?.email || '',
          name: dispute.vendorBooking?.vendor?.businessName || 'Vendor',
          bookingId: dispute.bookingId,
          eventTitle: dispute.vendorBooking?.userSocialEvent?.title || 'Event',
          decision: 'REJECTED',
          adminDecision: adminDecision,
        });
      } catch (emailError) {
        console.error('Failed to notify vendor:', emailError);
      }

      return NextResponse.json({
        success: true,
        message: 'Dispute rejected. Booking restored.',
        dispute: updatedDispute,
      });
    }

    return NextResponse.json(
      { error: 'Invalid status' },
      { status: 400 }
    );

  } catch (error) {
    console.error("Error resolving dispute:", error);
    return NextResponse.json(
      { error: "Failed to resolve dispute" },
      { status: 500 }
    );
  }
}

// ────────────────────────────────────────────────────────────────────
// HELPERS - Email Functions
// ────────────────────────────────────────────────────────────────────

async function notifyAdminForManualRefund(data: {
  bookingId: string;
  amount: number;
  customerName: string;
  vendorName: string;
  disputeId: string;
  adminEmail: string;
}) {
  const { sendEmail } = await import('@/lib/email');

  const adminEmails = process.env.ADMIN_EMAILS?.split(',') || [];
  if (adminEmails.length === 0) return;

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>💰 Manual Refund Required</title>
    </head>
    <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background: linear-gradient(135deg, #f59e0b, #d97706); padding: 30px; text-align: center; border-radius: 12px 12px 0 0;">
        <h1 style="color: white; margin: 0;">💰 Manual Refund Required</h1>
      </div>
      <div style="background: #ffffff; padding: 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 12px 12px;">
        <p>A dispute has been resolved in favor of the customer. Manual refund required.</p>
        <div style="background: #fef2f2; padding: 15px; border-radius: 8px; margin: 15px 0;">
          <p style="margin: 5px 0;"><strong>Booking ID:</strong> ${data.bookingId}</p>
          <p style="margin: 5px 0;"><strong>Dispute ID:</strong> ${data.disputeId}</p>
          <p style="margin: 5px 0;"><strong>Customer:</strong> ${data.customerName}</p>
          <p style="margin: 5px 0;"><strong>Vendor:</strong> ${data.vendorName}</p>
          <p style="margin: 5px 0; font-size: 18px; color: #dc2626;"><strong>Refund Amount:</strong> NPR ${data.amount.toLocaleString()}</p>
        </div>
        <div style="text-align: center;">
          <a href="${process.env.NEXTAUTH_URL}/admin/refunds" style="display: inline-block; padding: 12px 24px; background: #4f46e5; color: white; text-decoration: none; border-radius: 8px; margin: 20px 0;">
            Process Refund
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
      subject: `💰 Manual Refund Required: ${data.bookingId}`,
      html,
    });
  }
}

async function notifyCustomerOfResolution(data: {
  email: string;
  name: string;
  bookingId: string;
  eventTitle: string;
  decision: 'RESOLVED' | 'REJECTED';
  adminDecision: string;
  refundAmount: number;
}) {
  if (!data.email) return;

  const { sendEmail } = await import('@/lib/email');

  const isResolved = data.decision === 'RESOLVED';
  const color = isResolved ? '#22c55e' : '#dc2626';
  const title = isResolved ? '✅ Dispute Resolved in Your Favor' : '❌ Dispute Rejected';

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>${title}</title>
    </head>
    <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background: ${color}; padding: 30px; text-align: center; border-radius: 12px 12px 0 0;">
        <h1 style="color: white; margin: 0;">${title}</h1>
      </div>
      <div style="background: #ffffff; padding: 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 12px 12px;">
        <p>Dear ${data.name},</p>
        <p>Your dispute for <strong>${data.eventTitle}</strong> has been reviewed by our admin team.</p>
        <div style="background: ${isResolved ? '#f0fdf4' : '#fef2f2'}; padding: 15px; border-radius: 8px; margin: 15px 0;">
          <p style="margin: 5px 0;"><strong>Decision:</strong> ${data.decision}</p>
          <p style="margin: 5px 0;"><strong>Admin Notes:</strong> ${data.adminDecision}</p>
          ${isResolved ? `<p style="margin: 5px 0; font-size: 18px; color: #16a34a;"><strong>Refund Amount:</strong> NPR ${data.refundAmount.toLocaleString()}</p>` : ''}
        </div>
        ${isResolved ? '<p style="color: #6b7280; font-size: 14px;">Your refund will be processed within 3-7 business days.</p>' : ''}
        <div style="text-align: center;">
          <a href="${process.env.NEXTAUTH_URL}/my-bookings/${data.bookingId}" style="display: inline-block; padding: 12px 24px; background: #4f46e5; color: white; text-decoration: none; border-radius: 8px; margin: 20px 0;">
            View Booking
          </a>
        </div>
        <hr style="margin: 30px 0 20px; border-color: #e5e7eb;">
        <p style="color: #6b7280; font-size: 12px; text-align: center;">EventFlow Support Team</p>
      </div>
    </html>
  `;

  await sendEmail({
    to: data.email,
    subject: title,
    html,
  });
}

async function notifyVendorOfResolution(data: {
  email: string;
  name: string;
  bookingId: string;
  eventTitle: string;
  decision: 'RESOLVED' | 'REJECTED';
  adminDecision: string;
}) {
  if (!data.email) return;

  const { sendEmail } = await import('@/lib/email');

  const isResolved = data.decision === 'RESOLVED';
  const color = isResolved ? '#dc2626' : '#22c55e';
  const title = isResolved ? '⚠️ Dispute Resolved Against You' : '✅ Dispute Rejected';

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>${title}</title>
    </head>
    <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background: ${color}; padding: 30px; text-align: center; border-radius: 12px 12px 0 0;">
        <h1 style="color: white; margin: 0;">${title}</h1>
      </div>
      <div style="background: #ffffff; padding: 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 12px 12px;">
        <p>Dear ${data.name},</p>
        <p>The dispute for <strong>${data.eventTitle}</strong> has been reviewed by our admin team.</p>
        <div style="background: ${isResolved ? '#fef2f2' : '#f0fdf4'}; padding: 15px; border-radius: 8px; margin: 15px 0;">
          <p style="margin: 5px 0;"><strong>Decision:</strong> ${data.decision}</p>
          <p style="margin: 5px 0;"><strong>Admin Notes:</strong> ${data.adminDecision}</p>
        </div>
        ${isResolved ? '<p style="color: #dc2626; font-size: 14px;">A refund has been initiated for this booking.</p>' : '<p style="color: #16a34a; font-size: 14px;">The dispute has been rejected. Your funds will be released.</p>'}
        <hr style="margin: 30px 0 20px; border-color: #e5e7eb;">
        <p style="color: #6b7280; font-size: 12px; text-align: center;">EventFlow Support Team</p>
      </div>
    </html>
  `;

  await sendEmail({
    to: data.email,
    subject: title,
    html,
  });
}