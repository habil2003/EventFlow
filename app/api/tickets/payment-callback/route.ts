// app/api/tickets/payment-callback/route.ts

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyKhaltiPayment } from "@/lib/payment/khalti";
import crypto from "crypto";

async function generateTicketNumber(eventId: string): Promise<string> {
  const count = await prisma.ticketBooking.count({
    where: { eventId: eventId },
  });
  
  const shortEventId = eventId.substring(0, 6).toUpperCase();
  const sequentialNumber = String(count + 1).padStart(4, '0');
  return `TKT-${shortEventId}-${sequentialNumber}`;
}

async function generateUniqueQRHash(): Promise<string> {
  let hash: string;
  let exists: boolean;
  let attempts = 0;
  const maxAttempts = 5;
  
  do {
    hash = crypto.randomBytes(32).toString("hex");
    const existing = await prisma.ticketBooking.findFirst({
      where: { qrCodeHash: hash },
      select: { id: true }
    });
    exists = !!existing;
    attempts++;
    
    if (attempts > maxAttempts) {
      throw new Error("Failed to generate unique QR hash after " + maxAttempts + " attempts");
    }
  } while (exists);
  
  return hash;
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const pidx = searchParams.get('pidx');
    const status = searchParams.get('status');
    const purchaseOrderId = searchParams.get('purchase_order_id');

    const baseUrl = request.nextUrl.origin;

    console.log('📡 [payment-callback] Request received');
    console.log('📍 [payment-callback] Params:', { pidx, purchaseOrderId, status });

    if (!purchaseOrderId) {
      console.log('⚠️ [payment-callback] No purchase_order_id - redirecting');
      return NextResponse.redirect(
        `${baseUrl}/my-tickets?payment=success`
      );
    }

    const paymentTransaction = await prisma.paymentTransaction.findFirst({
      where: {
        transactionId: purchaseOrderId,
        paymentType: "TICKET_PURCHASE",
      },
      include: {
        ticketBooking: true,
      },
    });

    if (!paymentTransaction) {
      console.error('❌ [payment-callback] Transaction not found:', purchaseOrderId);
      return NextResponse.redirect(
        `${baseUrl}/payment/failed?error=Transaction%20not%20found`
      );
    }

    const gatewayResponse = paymentTransaction.gatewayResponse as unknown as { reservationId?: string } | null;
    const reservationId = gatewayResponse?.reservationId;

    console.log('📍 [payment-callback] Reservation ID:', reservationId);

    // ✅ FIXED: Use 'COMPLETED' instead of 'SUCCESS'
    if (paymentTransaction.status === 'COMPLETED') {
      console.log('✅ [payment-callback] Payment already processed');
      return NextResponse.redirect(
        `${baseUrl}/my-tickets?payment=already_processed`
      );
    }

    // ✅ SECURITY: Verify the payment server-side with Khalti lookup.
    // The `status` query param is attacker-controllable, so it must never
    // be trusted on its own. Only a successful gateway lookup can confirm
    // that the payment actually completed.
    const verification = pidx
      ? await verifyKhaltiPayment(pidx)
      : null;

    const verifiedComplete =
      verification?.success === true &&
      verification.status === "Completed";

    // Reconcile the amount Khalti actually collected against what we
    // recorded at initiation time (prevents paying a different amount).
    const amountMatches =
      verification?.amount === undefined ||
      Math.abs(Number(verification.amount) - Number(paymentTransaction.amount)) < 1;

    if (verifiedComplete && amountMatches) {
      console.log('✅ [payment-callback] Payment verified as Completed for transaction:', purchaseOrderId);

      if (!reservationId) {
        console.error('❌ [payment-callback] No reservation ID found in gatewayResponse');
        return NextResponse.redirect(
          `${baseUrl}/payment/failed?error=No%20reservation%20found`
        );
      }

      const reservation = await prisma.ticketReservation.findUnique({
        where: { id: reservationId },
        include: {
          event: true,
          tier: true,
        },
      });

      if (!reservation) {
        console.error('❌ [payment-callback] Reservation not found:', reservationId);
        return NextResponse.redirect(
          `${baseUrl}/payment/failed?error=Reservation%20not%20found`
        );
      }

      const result = await prisma.$transaction(async (prisma) => {
        // ✅ FIXED: Use 'COMPLETED' instead of 'SUCCESS'
        await prisma.paymentTransaction.update({
          where: { id: paymentTransaction.id },
          data: {
            status: 'COMPLETED',
            gatewayTransactionId: pidx,
            gatewayResponse: { pidx, status, purchaseOrderId },
          },
        });

        await prisma.ticketTier.update({
          where: { id: reservation.tierId },
          data: { soldCount: { increment: reservation.quantity } },
        });

        const tickets = [];
        for (let i = 0; i < reservation.quantity; i++) {
          const ticketNumber = await generateTicketNumber(reservation.eventId);
          const qrCodeHash = await generateUniqueQRHash();
          
          const ticket = await prisma.ticketBooking.create({
            data: {
              userId: reservation.userId,
              eventId: reservation.eventId,
              tierId: reservation.tierId,
              quantity: 1,
              totalAmount: Number(reservation.tier.price),
              ticketNumber: ticketNumber,
              gateway: "KHALTI",
              transactionId: `${purchaseOrderId}_${i + 1}`,
              qrCodeHash: qrCodeHash,
              paymentStatus: "HELD_IN_ESCROW",
              paymentIntentId: paymentTransaction.id,
            },
          });
          tickets.push(ticket);
        }

        await prisma.ticketReservation.delete({
          where: { id: reservation.id },
        });

        return tickets;
      });

      console.log(`✅ [payment-callback] Created ${result.length} tickets from reservation`);

      return NextResponse.redirect(
        `${baseUrl}/my-tickets?payment=success`
      );
    } else {
      console.log('❌ [payment-callback] Payment failed for transaction:', purchaseOrderId);
      
      await prisma.$transaction(async (prisma) => {
        if (reservationId) {
          await prisma.ticketReservation.delete({
            where: { id: reservationId }
          });
        }
        
        await prisma.paymentTransaction.update({
          where: { id: paymentTransaction.id },
          data: { 
            status: 'FAILED',
            gatewayResponse: { pidx, status, purchaseOrderId, error: 'Payment failed' },
          },
        });
      });

      console.log(`🗑️ [payment-callback] Cleaned up reservation and transaction`);

      return NextResponse.redirect(
        `${baseUrl}/payment/failed`
      );
    }
  } catch (error) {
    console.error('❌ [payment-callback] Error:', error);
    const baseUrl = request.nextUrl.origin;
    return NextResponse.redirect(
      `${baseUrl}/payment/failed`
    );
  }
}