// app/api/vendor/bookings/[id]/status/route.ts

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { processKhaltiRefund } from "@/lib/payment/refund";
import { sendEmail, sendVendorDeclineRefundEmail, sendAdminManualRefundAlert } from "@/lib/email";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    console.log("=========================================");
    console.log("🔵 VENDOR DECLINE/ACCEPT API CALLED");
    console.log("=========================================");

    const session = await getServerSession(authOptions);
    const { id } = await params;

    if (!session || !session.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (session.user.role !== "VENDOR") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Get vendor profile
    const vendor = await prisma.vendorProfile.findUnique({
      where: { userId: session.user.id },
    });

    if (!vendor) {
      return NextResponse.json({ error: "Vendor not found" }, { status: 404 });
    }

    const { status, declineReason } = await request.json();

    if (!["ACCEPTED", "DECLINED"].includes(status)) {
      return NextResponse.json({ error: "Invalid status" }, { status: 400 });
    }

    // Find the booking
    const booking = await prisma.vendorBooking.findFirst({
      where: {
        id: id,
        vendorId: vendor.id,
        bookingStatus: "PENDING",
      },
      include: {
        paymentTransactions: {
          where: { status: "SUCCESS" },
        },
        payouts: true,
        vendor: true,
        user: true,
        userSocialEvent: true,
        servicePackage: true,
      },
    });

    if (!booking) {
      return NextResponse.json(
        { error: "Booking not found or already processed" },
        { status: 404 },
      );
    }

    // Check if vendor already received payout before decline
    if (status === "DECLINED") {
      const hasReceivedPayout = booking.payouts.some(
        (payout) => payout.status === "COMPLETED"
      );

      if (hasReceivedPayout) {
        console.log("❌ Cannot decline - payout already released to vendor");
        return NextResponse.json(
          {
            error: "Cannot decline booking: Payment has already been released to vendor. Please contact admin for manual refund.",
            code: "PAYOUT_ALREADY_RELEASED",
          },
          { status: 400 },
        );
      }

      const hasPendingPayout = booking.payouts.some(
        (payout) => payout.status === "PENDING"
      );

      if (hasPendingPayout) {
        console.log("❌ Cannot decline - payout already in progress");
        return NextResponse.json(
          {
            error: "Cannot decline booking: Payout is already being processed. Please wait or contact admin.",
            code: "PAYOUT_IN_PROGRESS",
          },
          { status: 400 },
        );
      }
    }

    // Check if deposit is paid before allowing accept
    if (
      status === "ACCEPTED" &&
      booking.vendorPaymentStatus !== "DEPOSIT_PAID"
    ) {
      return NextResponse.json(
        {
          error: "Cannot accept booking: Deposit not paid by customer",
        },
        { status: 400 },
      );
    }

    // ──────────────────────────────────────────────────────────────
    // PROCESS DECLINE (with full refund)
    // ──────────────────────────────────────────────────────────────
    if (status === "DECLINED") {
      console.log("=========================================");
      console.log("💰 PROCESSING VENDOR DECLINE REFUND");
      console.log("=========================================");

      // Find the deposit payment transaction
      const depositTransaction = booking.paymentTransactions.find(
        (t) => t.paymentType === "VENDOR_DEPOSIT" && t.status === "SUCCESS",
      );

      const refundAmount = Number(
        booking.depositAmount || Number(booking.totalAmount) * 0.2,
      );
      console.log(`💰 Refund amount: NPR ${refundAmount}`);

      // Update booking as declined first
      const updatedBooking = await prisma.vendorBooking.update({
        where: { id: booking.id },
        data: {
          bookingStatus: "DECLINED",
          cancelledBy: "VENDOR",
          cancellationReason: declineReason || "Vendor declined booking",
          cancelledAt: new Date(),
          vendorPaymentStatus: "DISPUTED",
          paymentStatus: "DISPUTED",
        },
      });

      // ✅ FIX: Handle case when no deposit transaction exists
      if (!depositTransaction || !depositTransaction.id) {
        console.error("❌ No valid deposit transaction found for refund");
        
        // Send email notification to admin about the issue
        await sendAdminManualRefundAlert(
          booking.id,
          booking.vendor.businessName,
          booking.user.email,
          refundAmount,
          "NO_TRANSACTION_FOUND"
        );

        // Send email to customer about the issue
        await sendVendorDeclineRefundEmail(
          booking.user.email,
          booking.user.name,
          {
            eventTitle: booking.userSocialEvent.title,
            eventDate: booking.userSocialEvent.eventDate.toISOString(),
            packageName: booking.servicePackage.name,
            vendorName: booking.vendor.businessName,
            refundAmount: refundAmount,
          },
          "FAILED"
        );

        return NextResponse.json({
          success: true,
          booking: updatedBooking,
          message: "Booking declined but refund could not be processed automatically. Admin has been notified.",
          requiresAdminAction: true,
        });
      }

      // Process refund via Khalti
      const refundResult = await processKhaltiRefund(
        depositTransaction.gatewayTransactionId,
        refundAmount,
      );

      console.log("📦 Refund result:", JSON.stringify(refundResult, null, 2));

      // Determine refund status
      let refundStatus: 'PROCESSED' | 'PENDING_ADMIN' | 'FAILED' = "PENDING";
      let refundMessage = "";

      if (refundResult.success) {
        if (refundResult.requiresManual) {
          refundStatus = "PENDING_ADMIN";
          refundMessage = "Manual refund required. Please process in Khalti dashboard.";
        } else {
          refundStatus = "PROCESSED";
          refundMessage = "Refund processed successfully via Khalti API.";
        }
      } else {
        refundStatus = "FAILED";
        refundMessage = refundResult.message;
      }

      // Update booking payment status based on refund
      await prisma.vendorBooking.update({
        where: { id: booking.id },
        data: {
          vendorPaymentStatus: refundStatus === "PROCESSED" ? "REFUNDED" : "DISPUTED",
          paymentStatus: refundStatus === "PROCESSED" ? "REFUNDED" : "DISPUTED",
        },
      });

      // ✅ FIX: Create refund record with valid paymentTransactionId
      await prisma.refund.create({
        data: {
          originalTransactionId: depositTransaction.transactionId,
          refundAmount: refundAmount,
          refundReason: declineReason || "Vendor declined booking",
          refundStatus: refundStatus,
          gatewayRefundId: refundResult.refundId || `refund_${Date.now()}`,
          gatewayResponse: refundResult,
          paymentTransactionId: depositTransaction.id, // ✅ Now this is valid
          vendorBookingId: booking.id,
        },
      });

      console.log(`✅ Refund record created with status: ${refundStatus}`);

      // Send email notification to customer
      await sendVendorDeclineRefundEmail(
        booking.user.email,
        booking.user.name,
        {
          eventTitle: booking.userSocialEvent.title,
          eventDate: booking.userSocialEvent.eventDate.toISOString(),
          packageName: booking.servicePackage.name,
          vendorName: booking.vendor.businessName,
          refundAmount: refundAmount,
        },
        refundStatus
      );

      // Send email to admin for manual refund cases
      if (refundStatus === "PENDING_ADMIN") {
        await sendAdminManualRefundAlert(
          booking.id,
          booking.vendor.businessName,
          booking.user.email,
          refundAmount,
          depositTransaction.gatewayTransactionId
        );
      }

      console.log("✅ Email notifications sent");

      // Build response message
      let responseMessage = "";
      if (refundStatus === "PROCESSED") {
        responseMessage = `Booking declined. Refund of NPR ${refundAmount.toLocaleString()} has been initiated.`;
      } else if (refundStatus === "PENDING_ADMIN") {
        responseMessage = `Booking declined. Refund requires manual processing by admin. Customer has been notified.`;
      } else {
        responseMessage = `Booking declined but refund failed. Admin has been notified and will contact you.`;
      }

      return NextResponse.json({
        success: true,
        booking: updatedBooking,
        message: responseMessage,
        refund: {
          amount: refundAmount,
          status: refundStatus,
          requiresManual: refundStatus === "PENDING_ADMIN",
        },
      });
    }

    // ──────────────────────────────────────────────────────────────
    // PROCESS ACCEPT
    // ──────────────────────────────────────────────────────────────
    if (status === "ACCEPTED") {
      const updatedBooking = await prisma.vendorBooking.update({
        where: { id: booking.id },
        data: {
          bookingStatus: "ACCEPTED",
        },
      });

      // Send acceptance email to customer
      await sendVendorAcceptanceEmail(
        booking.user.email,
        booking.user.name,
        {
          eventTitle: booking.userSocialEvent.title,
          eventDate: booking.userSocialEvent.eventDate.toISOString(),
          packageName: booking.servicePackage.name,
          vendorName: booking.vendor.businessName,
        }
      );

      console.log("✅ Acceptance email sent to customer");

      return NextResponse.json({
        success: true,
        booking: updatedBooking,
        message: "Booking accepted successfully",
      });
    }

    return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  } catch (error) {
    console.error("❌ FATAL ERROR:", error);
    return NextResponse.json(
      { error: "Failed to update booking" },
      { status: 500 },
    );
  }
}

// Helper function for vendor acceptance email (add to your email.ts if not exists)
async function sendVendorAcceptanceEmail(
  customerEmail: string,
  customerName: string,
  bookingDetails: {
    eventTitle: string;
    eventDate: string;
    packageName: string;
    vendorName: string;
  }
) {
  // This should be imported from your email.ts
  // For now, just log
  console.log(`📧 Would send acceptance email to ${customerEmail}`);
}