import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || !session.user) {
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

    const body = await request.json();
    const { eventId, qrCode, email, ticketNumber, ticketId } = body;

    if (!eventId) {
      return NextResponse.json({
        success: false,
        message: "Missing eventId",
      });
    }

    let ticket = null;

    // ============================================
    // 1. FIND TICKET - Multiple methods
    // ============================================

    // Method 1: QR Code Scan
    if (qrCode) {
      // Clean the QR data - trim whitespace and control characters
      const cleanQrCode = qrCode.trim().replace(/[\x00-\x1F\x7F]/g, '');
      
      // Try to parse as JSON first (if we encoded full data)
      let qrHash = cleanQrCode;
      try {
        const parsed = JSON.parse(cleanQrCode);
        // If it's JSON, extract the hash or ticket ID
        qrHash = parsed.hash || parsed.qrCodeHash || parsed.ticketId || cleanQrCode;
        console.log("📋 Parsed QR JSON:", parsed);
      } catch {
        // Not JSON, use as is
        qrHash = cleanQrCode;
      }

      console.log("🔍 Looking for ticket with QR hash:", qrHash.substring(0, 20) + "...");

      ticket = await prisma.ticketBooking.findFirst({
        where: {
          OR: [
            { qrCodeHash: qrHash },
            { id: qrHash }, // In case QR contains ticket ID
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
    
    // Method 2: Check-in by Ticket Number
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
    
    // Method 3: Check-in by Ticket ID
    else if (ticketId) {
      ticket = await prisma.ticketBooking.findUnique({
        where: { id: ticketId },
        include: {
          user: true,
          tier: true,
          event: true,
        },
      });
    }
    
    // Method 4: Manual check-in by Email
    else if (email && !ticketNumber) {
      const user = await prisma.user.findUnique({
        where: { email: email },
      });
      
      if (!user) {
        return NextResponse.json({
          success: false,
          message: "❌ User not found with this email",
        });
      }
      
      // Find all unchecked tickets for this user/event
      const uncheckedTickets = await prisma.ticketBooking.findMany({
        where: {
          userId: user.id,
          eventId: eventId,
          checkedIn: false,
        },
        include: {
          user: true,
          tier: true,
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
    // 2. TICKET VALIDATION
    // ============================================

    if (!ticket) {
      return NextResponse.json({
        success: false,
        message: "❌ Ticket not found for this event",
      });
    }

    // ✅ NEW: Check payment status
    if (ticket.paymentStatus !== "COMPLETED") {
      const statusMap = {
        "PENDING": "payment is pending",
        "HELD_IN_ESCROW": "payment is held in escrow",
        "PROCESSING_PAYOUT": "payment is being processed",
        "FAILED": "payment failed",
        "REFUNDED": "ticket has been refunded",
        "DISPUTED": "ticket is under dispute",
      };
      
      const statusMessage = statusMap[ticket.paymentStatus as keyof typeof statusMap] || ticket.paymentStatus;
      
      return NextResponse.json({
        success: false,
        message: `❌ Cannot check in: ${statusMessage}. Please contact support.`,
        paymentStatus: ticket.paymentStatus,
      });
    }

    // ✅ NEW: Check if event is completed
    if (ticket.event.isCompleted) {
      return NextResponse.json({
        success: false,
        message: `❌ Event "${ticket.event.title}" has already ended. Cannot check in.`,
        eventCompleted: true,
        completedAt: ticket.event.completedAt,
      });
    }

    // ✅ NEW: Check if event date has passed (with optional grace period)
    const eventDate = new Date(ticket.event.eventDate);
    const now = new Date();
    // Allow check-in up to 24 hours after event ends (configurable)
    const gracePeriodHours = 24;
    const gracePeriodEnd = new Date(eventDate);
    gracePeriodEnd.setHours(gracePeriodEnd.getHours() + gracePeriodHours);
    
    if (now > gracePeriodEnd) {
      return NextResponse.json({
        success: false,
        message: `❌ Event ended on ${eventDate.toLocaleDateString()}. Check-in period has expired.`,
        eventEnded: true,
      });
    }

    // Check if already checked in
    if (ticket.checkedIn) {
      const remainingTickets = await prisma.ticketBooking.count({
        where: {
          userId: ticket.userId,
          eventId: ticket.eventId,
          checkedIn: false,
          paymentStatus: "COMPLETED",
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
    // 3. MARK AS CHECKED IN (ATOMIC - Prevents Race Conditions)
    // ============================================

    // ✅ FIXED: Atomic update - only update if not already checked in
    const updatedTicket = await prisma.ticketBooking.updateMany({
      where: {
        id: ticket.id,
        checkedIn: false, // Only update if not checked in
      },
      data: {
        checkedIn: true,
        checkedInAt: new Date(),
      },
    });

    // Check if update was successful (prevents race condition)
    if (updatedTicket.count === 0) {
      // Someone else checked it in at the same time
      return NextResponse.json({
        success: false,
        message: "⚠️ This ticket was just checked in by another scanner. Please try again.",
        alreadyCheckedIn: true,
      });
    }

    // Get the updated ticket with fresh data
    const finalTicket = await prisma.ticketBooking.findUnique({
      where: { id: ticket.id },
      include: {
        user: true,
        tier: true,
        event: true,
      },
    });

    // Count remaining tickets for this user
    const remainingTickets = await prisma.ticketBooking.count({
      where: {
        userId: ticket.userId,
        eventId: ticket.eventId,
        checkedIn: false,
        paymentStatus: "COMPLETED",
      },
    });

    // Log successful check-in for audit
    console.log(`✅ Checked in: ${ticket.user.name} (${ticket.ticketNumber}) for event: ${ticket.event.title}`);

    // Return success response
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

// GET endpoint - Fetch tickets by email (for manual check-in)
export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session || !session.user || session.user.role !== "ORGANIZER") {
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
        paymentStatus: "COMPLETED", // ✅ Only show paid tickets
      },
      include: {
        tier: true,
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