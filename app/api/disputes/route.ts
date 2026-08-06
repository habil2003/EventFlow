// app/api/disputes/route.ts

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// ────────────────────────────────────────────────────────────────────
// POST - File a dispute
// ────────────────────────────────────────────────────────────────────
export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || !session.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { bookingId, reason, description } = await request.json();

    // ── VALIDATE REQUIRED FIELDS ──────────────────────────────────
    if (!bookingId) {
      return NextResponse.json(
        { error: "Booking ID is required" },
        { status: 400 }
      );
    }

    if (!reason) {
      return NextResponse.json(
        { error: "Reason for dispute is required" },
        { status: 400 }
      );
    }

    // ── FIND THE BOOKING ──────────────────────────────────────────
    const booking = await prisma.vendorBooking.findFirst({
      where: {
        id: bookingId,
        userId: session.user.id,
      },
      include: {
        vendor: {
          include: {
            user: {
              select: {
                email: true,
                name: true,
              },
            },
          },
        },
        userSocialEvent: true,
        servicePackage: true,
        disputes: true,
      },
    });

    if (!booking) {
      return NextResponse.json(
        { error: "Booking not found" },
        { status: 404 }
      );
    }

    // ── VALIDATE BOOKING STATUS ───────────────────────────────────
    // Can only dispute if booking is not already completed/refunded
    const allowedStatuses = ['PENDING', 'ACCEPTED', 'COMPLETED'];
    if (!allowedStatuses.includes(booking.bookingStatus)) {
      return NextResponse.json(
        { 
          error: `Cannot file dispute. Booking status is ${booking.bookingStatus}.`,
          allowedStatuses
        },
        { status: 400 }
      );
    }

    // Check if already refunded
    if (booking.paymentStatus === 'REFUNDED') {
      return NextResponse.json(
        { error: "Cannot file dispute. This booking has already been refunded." },
        { status: 400 }
      );
    }

    // ── CHECK FOR EXISTING OPEN DISPUTE ───────────────────────────
    const existingDispute = booking.disputes.find(
      (d) => d.status === 'OPEN' || d.status === 'PENDING_ADMIN'
    );

    if (existingDispute) {
      return NextResponse.json(
        { 
          error: "You already have an open dispute for this booking.",
          disputeId: existingDispute.id,
          status: existingDispute.status
        },
        { status: 400 }
      );
    }

    // ── CREATE THE DISPUTE ────────────────────────────────────────
    const dispute = await prisma.dispute.create({
      data: {
        bookingId: booking.id,
        userId: session.user.id,
        vendorId: booking.vendorId,
        reason: reason,
        status: "OPEN",
        // Store additional data in a JSON field or as separate fields
        // Since your schema doesn't have description/evidence fields, 
        // we'll store them in a gatewayResponse JSON field or add them later
        // For now, we'll store in a separate model or use a workaround
      },
    });

    // ── UPDATE BOOKING STATUS ─────────────────────────────────────
    await prisma.vendorBooking.update({
      where: { id: booking.id },
      data: {
        vendorPaymentStatus: "DISPUTED",
        paymentStatus: "DISPUTED",
      },
    });

    // ── NOTIFY ADMIN ──────────────────────────────────────────────
    try {
      await notifyAdminOfDispute({
        disputeId: dispute.id,
        bookingId: booking.id,
        customerName: session.user.name || 'Customer',
        customerEmail: session.user.email || '',
        vendorName: booking.vendor.businessName,
        reason: reason,
        description: description || '',
        eventTitle: booking.userSocialEvent?.title || 'Event',
      });
    } catch (emailError) {
      console.error('Failed to notify admin of dispute:', emailError);
    }

    // ── NOTIFY VENDOR ─────────────────────────────────────────────
    try {
      await notifyVendorOfDispute({
        vendorEmail: booking.vendor.user?.email || '',
        vendorName: booking.vendor.businessName,
        bookingId: booking.id,
        customerName: session.user.name || 'Customer',
        reason: reason,
        eventTitle: booking.userSocialEvent?.title || 'Event',
      });
    } catch (emailError) {
      console.error('Failed to notify vendor of dispute:', emailError);
    }

    return NextResponse.json({
      success: true,
      message: "Dispute filed successfully. An admin will review your case within 24-48 hours.",
      dispute: {
        id: dispute.id,
        status: dispute.status,
        createdAt: dispute.createdAt,
        bookingId: dispute.bookingId,
      },
    }, { status: 201 });

  } catch (error) {
    console.error("Error filing dispute:", error);
    return NextResponse.json(
      { error: "Failed to file dispute. Please try again." },
      { status: 500 }
    );
  }
}

// ────────────────────────────────────────────────────────────────────
// GET - Get user's disputes
// ────────────────────────────────────────────────────────────────────
export async function GET() {
  try {
    const session = await getServerSession(authOptions);

    if (!session || !session.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const disputes = await prisma.dispute.findMany({
      where: {
        userId: session.user.id,
      },
      include: {
        vendorBooking: {
          include: {
            vendor: true,
            servicePackage: true,
            userSocialEvent: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    const formattedDisputes = disputes.map((dispute) => ({
      id: dispute.id,
      bookingId: dispute.bookingId,
      reason: dispute.reason,
      status: dispute.status,
      adminDecision: dispute.adminDecision,
      createdAt: dispute.createdAt,
      updatedAt: dispute.updatedAt,
      vendorName: dispute.vendorBooking?.vendor?.businessName || 'Unknown Vendor',
      eventTitle: dispute.vendorBooking?.userSocialEvent?.title || 'Unknown Event',
      packageName: dispute.vendorBooking?.servicePackage?.name || 'Unknown Package',
      totalAmount: dispute.vendorBooking?.totalAmount || 0,
    }));

    return NextResponse.json({ disputes: formattedDisputes });

  } catch (error) {
    console.error("Error fetching disputes:", error);
    return NextResponse.json(
      { error: "Failed to fetch disputes" },
      { status: 500 }
    );
  }
}

// ────────────────────────────────────────────────────────────────────
// HELPERS - Email Functions
// ────────────────────────────────────────────────────────────────────

async function notifyAdminOfDispute(data: {
  disputeId: string;
  bookingId: string;
  customerName: string;
  customerEmail: string;
  vendorName: string;
  reason: string;
  description: string;
  eventTitle: string;
}) {
  const { sendEmail } = await import('@/lib/email');

  const adminEmails = process.env.ADMIN_EMAILS?.split(',') || [];
  if (adminEmails.length === 0) {
    console.warn('No admin emails configured for dispute notification');
    return;
  }

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>⚠️ New Dispute Filed - Action Required</title>
    </head>
    <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background: linear-gradient(135deg, #dc2626, #b91c1c); padding: 30px; text-align: center; border-radius: 12px 12px 0 0;">
        <h1 style="color: white; margin: 0;">⚠️ New Dispute Filed</h1>
      </div>
      <div style="background: #ffffff; padding: 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 12px 12px;">
        <p>A new dispute has been filed and requires your attention.</p>
        <div style="background: #fef2f2; padding: 15px; border-radius: 8px; margin: 15px 0;">
          <p style="margin: 5px 0;"><strong>Dispute ID:</strong> ${data.disputeId}</p>
          <p style="margin: 5px 0;"><strong>Booking ID:</strong> ${data.bookingId}</p>
          <p style="margin: 5px 0;"><strong>Event:</strong> ${data.eventTitle}</p>
          <p style="margin: 5px 0;"><strong>Customer:</strong> ${data.customerName} (${data.customerEmail})</p>
          <p style="margin: 5px 0;"><strong>Vendor:</strong> ${data.vendorName}</p>
          <p style="margin: 5px 0;"><strong>Reason:</strong> ${data.reason}</p>
          ${data.description ? `<p style="margin: 5px 0;"><strong>Description:</strong> ${data.description}</p>` : ''}
        </div>
        <div style="text-align: center;">
          <a href="${process.env.NEXTAUTH_URL}/admin/disputes/${data.disputeId}" style="display: inline-block; padding: 12px 24px; background: #4f46e5; color: white; text-decoration: none; border-radius: 8px; margin: 20px 0;">
            Review Dispute
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
      subject: `⚠️ New Dispute: ${data.disputeId}`,
      html,
    });
  }
}

async function notifyVendorOfDispute(data: {
  vendorEmail: string;
  vendorName: string;
  bookingId: string;
  customerName: string;
  reason: string;
  eventTitle: string;
}) {
  if (!data.vendorEmail) return;

  const { sendEmail } = await import('@/lib/email');

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>⚠️ Dispute Filed on Your Booking</title>
    </head>
    <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background: linear-gradient(135deg, #f59e0b, #d97706); padding: 30px; text-align: center; border-radius: 12px 12px 0 0;">
        <h1 style="color: white; margin: 0;">⚠️ Dispute Filed</h1>
      </div>
      <div style="background: #ffffff; padding: 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 12px 12px;">
        <p>Dear ${data.vendorName},</p>
        <p>A dispute has been filed by <strong>${data.customerName}</strong> regarding your booking for <strong>${data.eventTitle}</strong>.</p>
        <div style="background: #fef2f2; padding: 15px; border-radius: 8px; margin: 15px 0;">
          <p style="margin: 5px 0;"><strong>Booking ID:</strong> ${data.bookingId}</p>
          <p style="margin: 5px 0;"><strong>Customer:</strong> ${data.customerName}</p>
          <p style="margin: 5px 0;"><strong>Reason:</strong> ${data.reason}</p>
        </div>
        <p style="color: #6b7280; font-size: 14px;">An admin will review the dispute and reach out if more information is needed.</p>
        <hr style="margin: 30px 0 20px; border-color: #e5e7eb;">
        <p style="color: #6b7280; font-size: 12px; text-align: center;">EventFlow Support Team</p>
      </div>
    </html>
  `;

  await sendEmail({
    to: data.vendorEmail,
    subject: `⚠️ Dispute Filed: ${data.bookingId}`,
    html,
  });
}