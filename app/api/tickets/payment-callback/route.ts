import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const pidx = searchParams.get('pidx');
    const status = searchParams.get('status');
    const purchaseOrderId = searchParams.get('purchase_order_id');

    console.log('📡 [payment-callback] Request received');
    console.log('📍 [payment-callback] Request URL:', request.url);
    console.log('📡 [payment-callback] Params:', { pidx, purchaseOrderId, status });

    // ✅ If no purchaseOrderId, this might be a redirect from successful payment
    if (!purchaseOrderId) {
      console.log('⚠️ [payment-callback] No purchase_order_id - redirecting to my-tickets');
      // ✅ Use the return URL from the request's referer or fallback to localhost
      const referer = request.headers.get('referer') || '';
      const baseUrl = referer ? new URL(referer).origin : 'https://localhost:3000';
      return NextResponse.redirect(
        `${baseUrl}/my-tickets?payment=success`
      );
    }

    // Find the payment transaction using YOUR transaction ID
    const paymentTransaction = await prisma.paymentTransaction.findFirst({
      where: {
        transactionId: purchaseOrderId,
        paymentType: "TICKET_PURCHASE",
      },
      include: {
        ticketBooking: {
          include: {
            event: true,
            tier: true,
            user: true,
          },
        },
      },
    });

    if (!paymentTransaction) {
      console.error('❌ [payment-callback] Payment transaction not found:', purchaseOrderId);
      return NextResponse.redirect(
        `https://localhost:3000/payment/failed?error=Transaction%20not%20found`
      );
    }

    console.log('✅ [payment-callback] Transaction found:', paymentTransaction.id);
    console.log('📍 [payment-callback] Current status:', paymentTransaction.status);

    // ✅ Get the original return URL from the transaction or use the stored one
    const gatewayResponse = paymentTransaction.gatewayResponse as any;
    
    // ✅ FIX: Use the stored returnUrl from the transaction (this was the ngrok URL)
    let redirectBase = 'https://localhost:3000';
    
    if (gatewayResponse?.returnUrl) {
      try {
        const url = new URL(gatewayResponse.returnUrl);
        redirectBase = url.origin;
        console.log('📍 [payment-callback] Using returnUrl from transaction:', redirectBase);
      } catch (e) {
        console.warn('⚠️ [payment-callback] Invalid returnUrl in transaction, using fallback');
      }
    }

    console.log('📍 [payment-callback] Redirect base:', redirectBase);

    // ✅ Check if already processed
    if (paymentTransaction.status === 'SUCCESS') {
      console.log('✅ [payment-callback] Payment already processed for:', purchaseOrderId);
      return NextResponse.redirect(
        `${redirectBase}/my-tickets?payment=already_processed`
      );
    }

    if (status === 'Completed') {
      console.log('✅ [payment-callback] Payment successful for transaction:', purchaseOrderId);

      // ✅ Update payment transaction
      await prisma.paymentTransaction.update({
        where: { id: paymentTransaction.id },
        data: {
          status: 'SUCCESS',
          gatewayTransactionId: pidx,
          gatewayResponse: { pidx, status, purchaseOrderId },
        },
      });

      // ✅ Update all tickets linked to this payment
      const updatedTickets = await prisma.ticketBooking.updateMany({
        where: {
          paymentIntentId: paymentTransaction.id,
        },
        data: {
          paymentStatus: 'HELD_IN_ESCROW',
        },
      });

      console.log(`✅ [payment-callback] Updated ${updatedTickets.count} tickets to HELD_IN_ESCROW`);

      // ✅ Update ticket tier sold counts
      const tickets = await prisma.ticketBooking.findMany({
        where: { paymentIntentId: paymentTransaction.id },
        include: { tier: true },
      });

      for (const ticket of tickets) {
        await prisma.ticketTier.update({
          where: { id: ticket.tierId },
          data: { soldCount: { increment: ticket.quantity || 1 } },
        });
        console.log(`✅ [payment-callback] Updated sold count for tier: ${ticket.tierId} (+${ticket.quantity || 1})`);
      }

      // ✅ Redirect to my-tickets on the correct domain
      console.log('🔗 [payment-callback] Redirecting to:', `${redirectBase}/my-tickets?payment=success`);
      return NextResponse.redirect(
        `${redirectBase}/my-tickets?payment=success`
      );
    } else {
      console.log('❌ [payment-callback] Payment failed for transaction:', purchaseOrderId);
      
      const deletedTickets = await prisma.ticketBooking.deleteMany({
        where: { paymentIntentId: paymentTransaction.id },
      });

      console.log(`🗑️ [payment-callback] Deleted ${deletedTickets.count} pending tickets`);

      await prisma.paymentTransaction.update({
        where: { id: paymentTransaction.id },
        data: { 
          status: 'FAILED',
          gatewayResponse: { pidx, status, purchaseOrderId, error: 'Payment failed' },
        },
      });

      return NextResponse.redirect(
        `${redirectBase}/payment/failed?error=Payment%20failed`
      );
    }
  } catch (error) {
    console.error('❌ [payment-callback] Error:', error);
    return NextResponse.redirect(
      `https://localhost:3000/payment/failed?error=Server%20error`
    );
  }
}