import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { initiateKhaltiPayment } from "@/lib/payment/khalti";
import { getAppUrl } from "@/lib/app-url";

export async function POST(request: Request) {
  try {
    console.log("💰 [confirm-payment] Request received");
    console.log("📍 [confirm-payment] Request URL:", request.url);

    const session = await getServerSession(authOptions);

    if (!session || !session.user) {
      console.error("❌ [confirm-payment] Unauthorized");
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { paymentIntentId, returnUrl } = await request.json();
    console.log("📍 [confirm-payment] paymentIntentId:", paymentIntentId);
    console.log("📍 [confirm-payment] returnUrl:", returnUrl);

    if (!paymentIntentId) {
      return NextResponse.json(
        { error: "Payment intent ID is required" },
        { status: 400 },
      );
    }

    const paymentTransaction = await prisma.paymentTransaction.findUnique({
      where: { id: paymentIntentId },
      include: {
        ticketBooking: {
          include: {
            event: true,
            tier: true,
          },
        },
      },
    });

    if (!paymentTransaction) {
      console.error(
        "❌ [confirm-payment] Payment intent not found:",
        paymentIntentId,
      );
      return NextResponse.json(
        { error: "Payment intent not found" },
        { status: 404 },
      );
    }

    // ✅ Get app URL from request
    const appUrl = getAppUrl(request);
    const callbackUrl = returnUrl || `${appUrl}/api/tickets/payment-callback`;

    // ✅ Extract website URL from callback URL
    const websiteUrl = new URL(callbackUrl).origin;

    console.log("📍 [confirm-payment] Auto-detected App URL:", appUrl);
    console.log("📍 [confirm-payment] Callback URL:", callbackUrl);
    console.log("📍 [confirm-payment] Website URL (for Khalti):", websiteUrl);
    console.log(
      "📍 [confirm-payment] Transaction ID:",
      paymentTransaction.transactionId,
    );
    console.log(
      "📍 [confirm-payment] Amount:",
      Number(paymentTransaction.amount),
    );

    // ✅ Store returnUrl in transaction for later use
    await prisma.paymentTransaction.update({
      where: { id: paymentTransaction.id },
      data: {
        gatewayResponse: {
          returnUrl: callbackUrl, // This is the ngrok URL
          initiatedAt: new Date().toISOString(),
        },
      },
    });

    // ✅ Get customer info from session
    const customerName = session.user.name || "Customer";
    const customerEmail = session.user.email || "";

    // ✅ Get product name from ticket booking
    const productName = paymentTransaction.ticketBooking?.event?.title
      ? `Ticket: ${paymentTransaction.ticketBooking.event.title}`
      : "Event Tickets";

    console.log("📍 [confirm-payment] Product Name:", productName);
    console.log("📍 [confirm-payment] Customer:", customerName, customerEmail);

    // ✅ Call Khalti with website URL
    const khaltiResult = await initiateKhaltiPayment({
      amount: Number(paymentTransaction.amount),
      transactionId: paymentTransaction.transactionId,
      returnUrl: callbackUrl,
      websiteUrl: websiteUrl,
      productName: productName,
      customerName: customerName,
      customerEmail: customerEmail,
    });

    console.log("📡 [confirm-payment] Khalti Result:", khaltiResult);

    if (khaltiResult.success && khaltiResult.payment_url) {
      // ✅ Store pidx in transaction
      await prisma.paymentTransaction.update({
        where: { id: paymentTransaction.id },
        data: { pidx: khaltiResult.pidx },
      });

      console.log("✅ [confirm-payment] Payment initiated successfully");
      console.log(
        "🔗 [confirm-payment] Payment URL:",
        khaltiResult.payment_url,
      );

      return NextResponse.json({
        success: true,
        payment_url: khaltiResult.payment_url,
        pidx: khaltiResult.pidx,
      });
    } else {
      console.error(
        "❌ [confirm-payment] Khalti initiation failed:",
        khaltiResult.error,
      );
      return NextResponse.json(
        {
          success: false,
          error: khaltiResult.error || "Payment initiation failed",
        },
        { status: 400 },
      );
    }
  } catch (error) {
    console.error("❌ [confirm-payment] Error:", error);
    return NextResponse.json(
      {
        error: "Failed to initiate payment",
        message:
          process.env.NODE_ENV === "development" ? String(error) : undefined,
      },
      { status: 500 },
    );
  }
}
