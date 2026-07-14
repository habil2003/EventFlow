import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// ============================================
// CONSTANTS (Use `as const` for type safety, but cast for Prisma)
// ============================================

const ALLOWED_PAYMENT_STATUSES = ["COMPLETED", "HELD_IN_ESCROW"] as const;
const GRACE_PERIOD_HOURS = 24;

type AllowedPaymentStatus = typeof ALLOWED_PAYMENT_STATUSES[number];

// ============================================
// HELPERS
// ============================================

function isValidPaymentStatus(status: string): status is AllowedPaymentStatus {
  return ALLOWED_PAYMENT_STATUSES.includes(status as AllowedPaymentStatus);
}

function getPaymentStatusMessage(status: string): string {
  const messages: Record<string, string> = {
    "PENDING": "payment is pending",
    "PROCESSING_PAYOUT": "payment is being processed",
    "FAILED": "payment failed",
    "REFUNDED": "ticket has been refunded",
    "DISPUTED": "ticket is under dispute",
  };
  return messages[status] || status;
}

function isEventActive(eventDate: Date, isCompleted: boolean): { active: boolean; message?: string } {
  if (isCompleted) {
    return { active: false, message: "Event has already ended" };
  }
  
  const now = new Date();
  const gracePeriodEnd = new Date(eventDate);
  gracePeriodEnd.setHours(gracePeriodEnd.getHours() + GRACE_PERIOD_HOURS);
  
  if (now > gracePeriodEnd) {
    return { 
      active: false, 
      message: `Event ended on ${eventDate.toLocaleDateString()}. Check-in period has expired.` 
    };
  }
  
  return { active: true };
}

// ============================================
// POST: Check-in
// ============================================

export async function POST(request: Request) {
  try {
    // 1. AUTHENTICATION
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json(
        { success: false, message: "Unauthorized - Please login" },
        { status: 401 }
      );
    }

    if (session.user.role !== "ORGANIZER") {
      return NextResponse.json(
        { success: false, message: "Forbidden - Organizer access required" },
        { status: 403 }
      );
    }

    // 2. PARSE REQUEST
    const body = await request.json();
    const { eventId, qrCode, email, ticketNumber, ticketId } = body;

    console.log("📥 [CHECKIN] Request:", { 
      eventId, 
      qrCode: qrCode?.substring(0, 50) + "...", 
      email, 
      ticketNumber, 
      ticketId 
    });

    if (!eventId) {
      return NextResponse.json({
        success: false,
        message: "Missing eventId",
      });
    }

    // ============================================
    // STEP 1: FIND TICKET (eventId MUST match)
    // ============================================

    let ticket = null;

    // Method 1: QR Code Scan
    if (qrCode) {
      const cleanQrCode = qrCode.trim().replace(/[\x00-\x1F\x7F]/g, '');
      let qrHash = cleanQrCode;
      let parsedData: any = null;

      try {
        parsedData = JSON.parse(cleanQrCode);
        console.log("📋 [CHECKIN] Parsed QR:", JSON.stringify(parsedData, null, 2));
        qrHash = parsedData.hash || parsedData.qrCodeHash || parsedData.ticketId || cleanQrCode;
      } catch {
        console.log("📋 [CHECKIN] QR is not JSON, using as is");
        qrHash = cleanQrCode;
      }

      console.log("🔍 [CHECKIN] Searching with:", { qrHash, eventId });

      // ✅ PRIMARY: Search by qrCodeHash + eventId
      ticket = await prisma.ticketBooking.findFirst({
        where: {
          qrCodeHash: qrHash,
          eventId: eventId,
        },
        include: {
          user: true,
          tier: true,
          event: true,
        },
      });

      // ✅ FALLBACK 1: Search by ticketId + eventId
      if (!ticket && parsedData?.ticketId) {
        ticket = await prisma.ticketBooking.findFirst({
          where: {
            id: parsedData.ticketId,
            eventId: eventId,
          },
          include: {
            user: true,
            tier: true,
            event: true,
          },
        });
      }

      // ✅ FALLBACK 2: Case-insensitive hash + eventId
      if (!ticket) {
        ticket = await prisma.ticketBooking.findFirst({
          where: {
            OR: [
              { qrCodeHash: qrHash.toLowerCase() },
              { qrCodeHash: qrHash.toUpperCase() },
            ],
            eventId: eventId,
          },
          include: {
            user: true,
            tier: true,
            event: true,
          },
        });
      }
    }
    
    // Method 2: Ticket Number + eventId
    else if (ticketNumber) {
      ticket = await prisma.ticketBooking.findFirst({
        where: {
          ticketNumber: ticketNumber,
          eventId: eventId,
        },
        include: {
          user: true,
          tier: true,
          event: true,
        },
      });
    }
    
    // Method 3: Ticket ID + eventId
    else if (ticketId) {
      ticket = await prisma.ticketBooking.findFirst({
        where: {
          id: ticketId,
          eventId: eventId,
        },
        include: {
          user: true,
          tier: true,
          event: true,
        },
      });
    }
    
    // Method 4: Email
    else if (email) {
      const user = await prisma.user.findUnique({
        where: { email: email },
      });
      
      if (!user) {
        return NextResponse.json({
          success: false,
          message: "❌ User not found with this email",
        });
      }
      
      const uncheckedTickets = await prisma.ticketBooking.findMany({
        where: {
          userId: user.id,
          eventId: eventId,
          checkedIn: false,
          // ✅ FIX: Convert readonly array to mutable array
          paymentStatus: { in: [...ALLOWED_PAYMENT_STATUSES] },
        },
        include: {
          user: true,
          tier: true,
          event: true,
        },
        orderBy: { createdAt: 'asc' },
      });
      
      if (uncheckedTickets.length === 0) {
        return NextResponse.json({
          success: false,
          message: "❌ No unchecked tickets found for this email",
        });
      }
      
      if (uncheckedTickets.length > 1) {
        return NextResponse.json({
          success: false,
          multipleTickets: true,
          tickets: uncheckedTickets.map(t => ({
            id: t.id,
            ticketNumber: t.ticketNumber,
            name: t.user.name,
            ticketName: t.tier.name,
          })),
          message: `📋 Found ${uncheckedTickets.length} unchecked tickets. Please select which one to check in.`,
        });
      }
      
      ticket = uncheckedTickets[0];
    }
    else {
      return NextResponse.json({
        success: false,
        message: "Missing QR code, ticket number, or email",
      });
    }

    // ============================================
    // STEP 2: TICKET NOT FOUND FOR THIS EVENT
    // ============================================

    if (!ticket) {
      console.log(`❌ [CHECKIN] No ticket found for event: ${eventId}`);
      return NextResponse.json({
        success: false,
        message: "❌ Ticket not found for this event. Please verify the QR code or ticket number.",
      });
    }

    // ============================================
    // STEP 3: VERIFY EVENT MATCH (EXPLICIT CHECK)
    // ============================================

    if (ticket.eventId !== eventId) {
      console.log(`❌ [CHECKIN] Event mismatch: ticket.eventId=${ticket.eventId}, selectedEventId=${eventId}`);
      console.log(`   Ticket belongs to: "${ticket.event?.title}"`);
      return NextResponse.json({
        success: false,
        message: `❌ This ticket belongs to "${ticket.event?.title}". Please select the correct event.`,
        ticketEventId: ticket.eventId,
        selectedEventId: eventId,
        ticketEventTitle: ticket.event?.title,
      });
    }

    console.log(`✅ [CHECKIN] Ticket found: ${ticket.ticketNumber}`, {
      eventId: ticket.eventId,
      eventTitle: ticket.event?.title,
      checkedIn: ticket.checkedIn,
      paymentStatus: ticket.paymentStatus,
    });

    // ============================================
    // STEP 4: CHECK PAYMENT STATUS
    // ============================================

    if (!isValidPaymentStatus(ticket.paymentStatus)) {
      return NextResponse.json({
        success: false,
        message: `❌ Cannot check in: ${getPaymentStatusMessage(ticket.paymentStatus)}. Please contact support.`,
        paymentStatus: ticket.paymentStatus,
      });
    }

    // ============================================
    // STEP 5: CHECK EVENT ACTIVE
    // ============================================

    const eventStatus = isEventActive(new Date(ticket.event.eventDate), ticket.event.isCompleted);
    if (!eventStatus.active) {
      return NextResponse.json({
        success: false,
        message: `❌ ${eventStatus.message}`,
        eventCompleted: ticket.event.isCompleted,
      });
    }

    // ============================================
    // STEP 6: CHECK IF ALREADY CHECKED IN
    // ============================================

    if (ticket.checkedIn) {
      const remainingTickets = await prisma.ticketBooking.count({
        where: {
          userId: ticket.userId,
          eventId: ticket.eventId,
          checkedIn: false,
          // ✅ FIX: Convert readonly array to mutable array
          paymentStatus: { in: [...ALLOWED_PAYMENT_STATUSES] },
        },
      });
      
      return NextResponse.json({
        success: false,
        message: `⚠️ Ticket already checked in! ${remainingTickets > 0 ? `User has ${remainingTickets} more ticket(s) to check in.` : ''}`,
        attendee: {
          name: ticket.user.name,
          email: ticket.user.email,
          ticketName: ticket.tier.name,
          ticketNumber: ticket.ticketNumber,
          quantity: ticket.quantity,
        },
        alreadyCheckedIn: true,
        checkedInAt: ticket.checkedInAt,
        remainingTickets,
      });
    }

    // ============================================
    // STEP 7: ATOMIC CHECK-IN
    // ============================================

    const updatedTicket = await prisma.ticketBooking.updateMany({
      where: {
        id: ticket.id,
        checkedIn: false,
      },
      data: {
        checkedIn: true,
        checkedInAt: new Date(),
      },
    });

    if (updatedTicket.count === 0) {
      return NextResponse.json({
        success: false,
        message: "⚠️ This ticket was just checked in by another scanner. Please refresh and try again.",
        alreadyCheckedIn: true,
      });
    }

    // ============================================
    // STEP 8: GET UPDATED TICKET & REMAINING COUNT
    // ============================================

    const finalTicket = await prisma.ticketBooking.findUnique({
      where: { id: ticket.id },
      include: {
        user: true,
        tier: true,
        event: true,
      },
    });

    const remainingTickets = await prisma.ticketBooking.count({
      where: {
        userId: ticket.userId,
        eventId: ticket.eventId,
        checkedIn: false,
        // ✅ FIX: Convert readonly array to mutable array
        paymentStatus: { in: [...ALLOWED_PAYMENT_STATUSES] },
      },
    });

    console.log(`✅ Checked in: ${ticket.user.name} (${ticket.ticketNumber}) for event: ${ticket.event.title}`);

    // ============================================
    // STEP 9: SUCCESS RESPONSE
    // ============================================

    return NextResponse.json({
      success: true,
      message: `✅ Checked in: ${ticket.user.name} (${ticket.tier.name})`,
      attendee: {
        name: ticket.user.name,
        email: ticket.user.email,
        ticketName: ticket.tier.name,
        ticketNumber: ticket.ticketNumber,
        quantity: ticket.quantity,
      },
      remainingTickets,
      isLastTicket: remainingTickets === 0,
      checkedInAt: finalTicket?.checkedInAt?.toISOString() || new Date().toISOString(),
    });
    
  } catch (error) {
    console.error("❌ Error processing check-in:", error);
    return NextResponse.json({
      success: false,
      message: "❌ Internal server error. Please try again.",
      error: process.env.NODE_ENV === 'development' ? String(error) : undefined,
    });
  }
}

// ============================================
// GET: Fetch tickets by email
// ============================================

export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user || session.user.role !== "ORGANIZER") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const eventId = searchParams.get('eventId');
    const email = searchParams.get('email');

    if (!eventId || !email) {
      return NextResponse.json({ error: "Missing parameters" }, { status: 400 });
    }

    const user = await prisma.user.findUnique({
      where: { email: decodeURIComponent(email) },
    });

    if (!user) {
      return NextResponse.json({ tickets: [] });
    }

    const tickets = await prisma.ticketBooking.findMany({
      where: {
        userId: user.id,
        eventId: eventId,
        checkedIn: false,
        // ✅ FIX: Convert readonly array to mutable array
        paymentStatus: { in: [...ALLOWED_PAYMENT_STATUSES] },
      },
      include: {
        tier: true,
        event: true,
        user: {
          select: {
            name: true,
            email: true,
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    return NextResponse.json({ tickets });
    
  } catch (error) {
    console.error("Error fetching tickets:", error);
    return NextResponse.json({ error: "Failed to fetch tickets" }, { status: 500 });
  }
}