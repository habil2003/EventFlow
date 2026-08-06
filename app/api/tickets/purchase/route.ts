// app/api/tickets/purchase/route.ts

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { TicketReservation, PaymentTransaction } from "@prisma/client";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import crypto from "crypto";
import { initiateKhaltiPayment } from "@/lib/payment/khalti";
import { getAppUrl } from "@/lib/app-url";

// Generate transaction ID
function generateTransactionId(): string {
  const timestamp = Date.now();
  const random = crypto.randomBytes(8).toString("hex");
  return `TKT_${timestamp}_${random}`;
}

export async function POST(request: Request) {
  let reservation: TicketReservation | null = null;
  let paymentTransaction: PaymentTransaction | null = null;
  let transactionId: string = "";

  try {
    const session = await getServerSession(authOptions);

    if (!session || !session.user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const { eventId, tierId, quantity, returnUrl } = await request.json();

    if (!eventId || !tierId || !quantity) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    const qty = Number(quantity);
    if (qty < 1) {
      return NextResponse.json(
        { error: "Quantity must be at least 1" },
        { status: 400 }
      );
    }

    // ✅ Step 1: Validate event and tier
    const event = await prisma.ticketedEvent.findUnique({
      where: { id: eventId },
      include: {
        ticketTiers: true,
      },
    });

    if (!event) {
      return NextResponse.json(
        { error: "Event not found" },
        { status: 404 }
      );
    }

    if (event.isCompleted) {
      return NextResponse.json(
        { error: "This event has already ended" },
        { status: 400 }
      );
    }

    const eventDate = new Date(event.eventDate);
    if (eventDate < new Date()) {
      return NextResponse.json(
        { error: "This event has already passed" },
        { status: 400 }
      );
    }

    const tier = event.ticketTiers.find((t) => t.id === tierId);

    if (!tier) {
      return NextResponse.json(
        { error: "Ticket tier not found" },
        { status: 404 }
      );
    }

    const available = tier.quantity - tier.soldCount;
    if (available < qty) {
      return NextResponse.json(
        { error: `Only ${available} tickets available` },
        { status: 400 }
      );
    }

    const price = Number(tier.price);
    const totalAmount = price * qty;
    
    transactionId = generateTransactionId();

    // ✅ Step 2: Create RESERVATION and payment transaction in a single transaction
    const result = await prisma.$transaction(async (prisma) => {
      // Create reservation
      const reservation = await prisma.ticketReservation.create({
        data: {
          eventId: eventId,
          tierId: tierId,
          userId: session.user.id,
          quantity: qty,
          expiresAt: new Date(Date.now() + 10 * 60 * 1000), // 10 minutes
          status: "PENDING",
        },
      });

      // Create payment transaction
      const transaction = await prisma.paymentTransaction.create({
        data: {
          transactionId: transactionId,
          amount: totalAmount,
          amountInPaisa: totalAmount * 100,
          gateway: "KHALTI",
          paymentType: "TICKET_PURCHASE",
          status: "PENDING",
          gatewayResponse: { 
            eventId, 
            tierId, 
            quantity: qty,
            userId: session.user.id,
            returnUrl: returnUrl || '/my-tickets',
            reservationId: reservation.id,
          },
        },
      });

      return { reservation, paymentTransaction: transaction };
    });

    reservation = result.reservation;
    paymentTransaction = result.paymentTransaction;

    console.log(`✅ Created reservation for ${qty} ticket(s) for user ${session.user.email}`);
    console.log(`📋 Reservation ID: ${reservation.id}`);

    // ✅ Step 3: Initiate payment with Khalti
    const appUrl = getAppUrl(request);
    const callbackUrl = `${appUrl}/api/tickets/payment-callback`;

    console.log('📍 [purchase] Initiating Khalti payment...');
    console.log('📍 [purchase] Callback URL:', callbackUrl);
    console.log('📍 [purchase] Amount:', totalAmount);

    const khaltiResult = await initiateKhaltiPayment({
      amount: totalAmount,
      transactionId: transactionId,
      returnUrl: callbackUrl,
      websiteUrl: appUrl,
      productName: `Ticket: ${event.title}`,
      customerName: session.user.name || 'Customer',
      customerEmail: session.user.email || '',
    });

    console.log('📡 [purchase] Khalti Result:', khaltiResult);

    // ✅ Step 4: Handle Khalti response
    if (khaltiResult.success && khaltiResult.payment_url) {
      // Store pidx in transaction
      await prisma.paymentTransaction.update({
        where: { id: paymentTransaction.id },
        data: { pidx: khaltiResult.pidx },
      });

      console.log('✅ [purchase] Payment initiated successfully');
      console.log('🔗 [purchase] Payment URL:', khaltiResult.payment_url);

      return NextResponse.json({
        success: true,
        requiresPayment: true,
        payment_url: khaltiResult.payment_url,
        pidx: khaltiResult.pidx,
        transactionId: transactionId,
        paymentIntentId: paymentTransaction.id,
        reservationId: reservation.id,
        amount: totalAmount,
        message: `Tickets reserved! Please complete payment to activate. You have 10 minutes.`,
      });
      
    } else {
      // ❌ Payment initiation failed - cleanup reservation and transaction
      console.error('❌ [purchase] Khalti initiation failed:', khaltiResult.error);

      await prisma.$transaction(async (prisma) => {
        // Delete reservation
        await prisma.ticketReservation.delete({
          where: { id: reservation!.id }
        });
        
        // Delete payment transaction
        await prisma.paymentTransaction.delete({
          where: { id: paymentTransaction!.id }
        });
      });

      console.log(`🗑️ [purchase] Cleaned up reservation and transaction`);

      return NextResponse.json({
        success: false,
        error: khaltiResult.error || "Payment initiation failed. Please try again.",
        canRetry: true,
        message: "Your tickets were not booked. Please try again.",
      }, { status: 400 });
    }
    
  } catch (error) {
    console.error("❌ [purchase] Error:", error);

    // ✅ Cleanup on any error
    if (reservation) {
      try {
        await prisma.$transaction(async (prisma) => {
          await prisma.ticketReservation.delete({
            where: { id: reservation!.id }
          });
          if (paymentTransaction) {
            await prisma.paymentTransaction.delete({
              where: { id: paymentTransaction.id }
            });
          }
        });
        console.log(`🗑️ [purchase] Cleaned up reservation after error`);
      } catch (cleanupError) {
        console.error('❌ [purchase] Cleanup failed:', cleanupError);
      }
    }

    return NextResponse.json(
      { 
        error: "Failed to process request. Please try again.",
        canRetry: true,
        message: process.env.NODE_ENV === 'development' ? String(error) : undefined
      },
      { status: 500 }
    );
  }
}