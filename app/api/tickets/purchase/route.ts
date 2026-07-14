import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import crypto from "crypto";
import { initiateKhaltiPayment } from "@/lib/payment/khalti";
import { getAppUrl } from "@/lib/app-url";

// Generate unique ticket number with event prefix
async function generateTicketNumber(eventId: string): Promise<string> {
  const count = await prisma.ticketBooking.count({
    where: { eventId: eventId },
  });
  
  const shortEventId = eventId.substring(0, 6).toUpperCase();
  const sequentialNumber = String(count + 1).padStart(4, '0');
  return `TKT-${shortEventId}-${sequentialNumber}`;
}

// Generate unique QR code hash with uniqueness check
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

// Generate transaction ID
function generateTransactionId(): string {
  const timestamp = Date.now();
  const random = crypto.randomBytes(8).toString("hex");
  return `TKT_${timestamp}_${random}`;
}

// Prepare QR payload data
function prepareQRPayload(ticketId: string, eventId: string, userId: string, hash: string): string {
  const payload = {
    ticketId: ticketId,
    eventId: eventId,
    userId: userId,
    hash: hash,
    timestamp: new Date().toISOString(),
    signature: generateSimpleSignature(ticketId, eventId, userId, hash)
  };
  return JSON.stringify(payload);
}

// Generate simple signature
function generateSimpleSignature(ticketId: string, eventId: string, userId: string, hash: string): string {
  const data = `${ticketId}|${eventId}|${userId}|${hash}`;
  let signature = 0;
  for (let i = 0; i < data.length; i++) {
    signature = ((signature << 5) - signature) + data.charCodeAt(i);
    signature = signature & signature;
  }
  return signature.toString(36);
}

export async function POST(request: Request) {
  let createdTickets: any[] = [];
  let paymentTransaction: any = null;
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

    // ✅ Step 1: Create tickets and transaction in a single transaction
    const result = await prisma.$transaction(async (prisma) => {
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
          },
        },
      });

      // Create tickets
      const tickets = [];
      const ticketNumbers = [];
      
      for (let i = 0; i < qty; i++) {
        const ticketNumber = await generateTicketNumber(eventId);
        const qrCodeHash = await generateUniqueQRHash();
        
        const ticket = await prisma.ticketBooking.create({
          data: {
            userId: session.user.id,
            eventId,
            tierId,
            quantity: 1,
            totalAmount: price,
            ticketNumber: ticketNumber,
            gateway: "KHALTI",
            transactionId: `${transactionId}_${i + 1}`,
            qrCodeHash: qrCodeHash,
            paymentStatus: "PENDING",
            paymentIntentId: transaction.id,
          },
        });
        
        tickets.push(ticket);
        ticketNumbers.push(ticketNumber);
      }

      return {
        paymentTransaction: transaction,
        createdTickets: tickets,
        ticketNumbers: ticketNumbers,
      };
    });

    paymentTransaction = result.paymentTransaction;
    createdTickets = result.createdTickets;

    console.log(`✅ Created ${qty} ticket(s) for user ${session.user.email} for event ${event.title}`);
    console.log(`📋 Ticket numbers: ${result.ticketNumbers.join(', ')}`);

    // ✅ Step 2: Initiate payment with Khalti
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

    // ✅ Step 3: Handle Khalti response
    if (khaltiResult.success && khaltiResult.payment_url) {
      // ✅ Store pidx in transaction
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
        amount: totalAmount,
        tickets: createdTickets.map(t => ({
          id: t.id,
          ticketNumber: t.ticketNumber,
          qrCodeHash: t.qrCodeHash || '',
          qrPayload: prepareQRPayload(
            t.id,
            eventId,
            session.user.id,
            t.qrCodeHash || ''
          ),
        })),
        message: `Tickets created! Please complete payment to activate.`,
      });
      
    } else {
      // ❌ Step 4: Payment initiation FAILED - Clean up everything!
      console.error('❌ [purchase] Khalti initiation failed:', khaltiResult.error);

      // ✅ Delete all pending tickets and transaction
      await prisma.$transaction(async (prisma) => {
        // Delete tickets
        await prisma.ticketBooking.deleteMany({
          where: { paymentIntentId: paymentTransaction.id }
        });
        
        // Delete payment transaction
        await prisma.paymentTransaction.delete({
          where: { id: paymentTransaction.id }
        });
      });

      console.log(`🗑️ [purchase] Cleaned up ${createdTickets.length} pending tickets and transaction`);

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
    if (paymentTransaction) {
      try {
        await prisma.$transaction(async (prisma) => {
          await prisma.ticketBooking.deleteMany({
            where: { paymentIntentId: paymentTransaction.id }
          });
          await prisma.paymentTransaction.delete({
            where: { id: paymentTransaction.id }
          });
        });
        console.log(`🗑️ [purchase] Cleaned up pending tickets after error`);
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