import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const pidx = searchParams.get('pidx');
    const status = searchParams.get('status');
    const purchaseOrderId = searchParams.get('purchase_order_id');  // ✅ Your transaction ID

    console.log('Ticket payment callback:', { pidx, purchaseOrderId, status });

    // Find the payment transaction using YOUR transaction ID (purchase_order_id)
    const paymentTransaction = await prisma.paymentTransaction.findFirst({
      where: {
        transactionId: purchaseOrderId,  // ✅ This matches your TKT_xxx format
        paymentType: "TICKET_PURCHASE",
      },
    });

    if (!paymentTransaction) {
      console.error('Payment transaction not found:', purchaseOrderId);
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_APP_URL}/payment/failed?error=Transaction not found`
      );
    }

    if (status === 'Completed') {
      // Update payment transaction
      await prisma.paymentTransaction.update({
        where: { id: paymentTransaction.id },
        data: {
          status: 'SUCCESS',
          gatewayTransactionId: pidx,
          gatewayResponse: { pidx, status, purchaseOrderId },
        },
      });

      // Update all tickets linked to this payment
      await prisma.ticketBooking.updateMany({
        where: {
          paymentIntentId: paymentTransaction.id,
        },
        data: {
          paymentStatus: 'HELD_IN_ESCROW',
        },
      });

      // Update ticket tier sold counts
      const tickets = await prisma.ticketBooking.findMany({
        where: { paymentIntentId: paymentTransaction.id },
        include: { tier: true },
      });

      for (const ticket of tickets) {
        await prisma.ticketTier.update({
          where: { id: ticket.tierId },
          data: { soldCount: { increment: 1 } },
        });
      }

      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_APP_URL}/my-tickets`
      );
    } else {
      // Payment failed - delete pending tickets
      await prisma.ticketBooking.deleteMany({
        where: { paymentIntentId: paymentTransaction.id },
      });

      await prisma.paymentTransaction.update({
        where: { id: paymentTransaction.id },
        data: { status: 'FAILED' },
      });

      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_APP_URL}/payment/failed?error=Payment failed`
      );
    }
  } catch (error) {
    console.error('Payment callback error:', error);
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}/payment/failed?error=Server error`
    );
  }
}