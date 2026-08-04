import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";  // ← Import from lib/auth
import { prisma } from "@/lib/prisma";     // ← Import prisma from lib/prisma

// GET /api/admin/bookings - Get all bookings (ticket + vendor)
export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session || session.user?.role !== "ADMIN") {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search") || "";
    const type = searchParams.get("type") || "all";
    const status = searchParams.get("status") || "all";
    const limit = parseInt(searchParams.get("limit") || "50");
    const page = parseInt(searchParams.get("page") || "1");
    const skip = (page - 1) * limit;

    let ticketBookings: any[] = [];
    let vendorBookings: any[] = [];

    // Get ticket bookings
    if (type === "all" || type === "ticket") {
      const where: any = {};
      
      if (search) {
        where.OR = [
          { ticketNumber: { contains: search, mode: "insensitive" } },
          { event: { title: { contains: search, mode: "insensitive" } } },
          { user: { name: { contains: search, mode: "insensitive" } } },
        ];
      }

      if (status !== "all") {
        where.paymentStatus = status;
      }

      ticketBookings = await prisma.ticketBooking.findMany({
        where,
        include: {
          user: {
            select: { name: true, email: true },
          },
          event: {
            select: { id: true, title: true, eventDate: true, location: true },
          },
          tier: {
            select: { id: true, name: true, price: true },
          },
          payouts: true,
        },
        orderBy: { createdAt: "desc" },
        take: limit,
        skip: skip,
      });
    }

    // Get vendor bookings
    if (type === "all" || type === "vendor") {
      const where: any = {};
      
      if (search) {
        where.OR = [
          { bookingReference: { contains: search, mode: "insensitive" } },
          { userSocialEvent: { title: { contains: search, mode: "insensitive" } } },
          { user: { name: { contains: search, mode: "insensitive" } } },
          { vendor: { businessName: { contains: search, mode: "insensitive" } } },
        ];
      }

      if (status !== "all") {
        where.paymentStatus = status;
      }

      vendorBookings = await prisma.vendorBooking.findMany({
        where,
        include: {
          user: {
            select: { name: true, email: true },
          },
          vendor: {
            select: { id: true, businessName: true, location: true },
          },
          servicePackage: {
            select: { id: true, name: true, price: true },
          },
          userSocialEvent: {
            select: { id: true, title: true, eventDate: true },
          },
          payouts: true,
          refunds: true,
        },
        orderBy: { createdAt: "desc" },
        take: limit,
        skip: skip,
      });
    }

    // Combine and format
    const formattedTicketBookings = ticketBookings.map((b) => ({
      id: b.id,
      type: "TICKET",
      reference: b.ticketNumber,
      event: b.event.title,
      eventDate: b.event.eventDate,
      location: b.event.location,
      customer: b.user.name,
      customerEmail: b.user.email,
      amount: b.totalAmount,
      status: b.paymentStatus,
      date: b.createdAt,
      quantity: b.quantity,
      ticketNumber: b.ticketNumber,
      payouts: b.payouts,
    }));

    const formattedVendorBookings = vendorBookings.map((b) => ({
      id: b.id,
      type: "VENDOR",
      reference: b.bookingReference,
      event: b.userSocialEvent?.title || "Social Event",
      eventDate: b.userSocialEvent?.eventDate,
      vendorName: b.vendor.businessName,
      location: b.vendor.location,
      customer: b.user.name,
      customerEmail: b.user.email,
      amount: b.totalAmount,
      status: b.paymentStatus,
      date: b.createdAt,
      bookingReference: b.bookingReference,
      payouts: b.payouts,
      refunds: b.refunds,
    }));

    const allBookings = [...formattedTicketBookings, ...formattedVendorBookings];
    
    // Sort by date
    allBookings.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    // Calculate stats
    const stats = {
      total: allBookings.length,
      pending: allBookings.filter((b: any) => b.status === "PENDING").length,
      completed: allBookings.filter((b: any) => b.status === "COMPLETED").length,
      heldInEscrow: allBookings.filter((b: any) => b.status === "HELD_IN_ESCROW").length,
      processingPayout: allBookings.filter((b: any) => b.status === "PROCESSING_PAYOUT").length,
      refunded: allBookings.filter((b: any) => b.status === "REFUNDED").length,
      disputed: allBookings.filter((b: any) => b.status === "DISPUTED").length,
      failed: allBookings.filter((b: any) => b.status === "FAILED").length,
      totalRevenue: allBookings.reduce((sum: number, b: any) => sum + Number(b.amount || 0), 0),
      totalTicketBookings: allBookings.filter((b: any) => b.type === "TICKET").length,
      totalVendorBookings: allBookings.filter((b: any) => b.type === "VENDOR").length,
    };

    return NextResponse.json({
      bookings: allBookings,
      stats,
      pagination: {
        total: allBookings.length,
        page,
        limit,
        totalPages: Math.ceil(allBookings.length / limit),
      },
    });
  } catch (error) {
    console.error("Error fetching bookings:", error);
    return NextResponse.json(
      { error: "Failed to fetch bookings" },
      { status: 500 }
    );
  }
}