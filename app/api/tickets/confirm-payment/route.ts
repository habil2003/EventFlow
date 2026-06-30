import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { initiateKhaltiPayment } from "@/lib/payment/khalti";

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || !session.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { paymentIntentId, returnUrl } = await request.json();

    const paymentTransaction = await prisma.paymentTransaction.findUnique({
      where: { id: paymentIntentId },
      include: {
        ticketBooking: true,
      },
    });

    if (!paymentTransaction) {
      return NextResponse.json({ error: "Payment intent not found" }, { status: 404 });
    }

    // ✅ FIX 1: Convert Decimal to number
    // ✅ FIX 2: Handle null/undefined for customer email
    const khaltiResult = await initiateKhaltiPayment({
      amount: Number(paymentTransaction.amount),
      transactionId: paymentTransaction.transactionId,
      returnUrl: returnUrl || `${process.env.NEXT_PUBLIC_APP_URL}/tickets/payment-callback`,
      productName: "Event Tickets",
      customerName: session.user.name || "Customer",
      customerEmail: session.user.email || '', // ✅ FIX: Provide fallback empty string
    });

    if (khaltiResult.success && khaltiResult.payment_url) {
      return NextResponse.json({
        success: true,
        payment_url: khaltiResult.payment_url,
        pidx: khaltiResult.pidx,
      });
    } else {
      return NextResponse.json(
        { error: khaltiResult.error || "Payment initiation failed" },
        { status: 400 }
      );
    }
  } catch (error) {
    console.error("Error confirming payment:", error);
    return NextResponse.json({ error: "Failed to initiate payment" }, { status: 500 });
  }
}