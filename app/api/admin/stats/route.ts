import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);

    if (!session || !session.user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    if (session.user.role !== "ADMIN") {
      return NextResponse.json(
        { error: "Forbidden" },
        { status: 403 }
      );
    }

    // User counts
    const [totalUsers, totalVendors, totalOrganizers] = await Promise.all([
      prisma.user.count(),
      prisma.user.count({ where: { role: "VENDOR" } }),
      prisma.user.count({ where: { role: "ORGANIZER" } }),
    ]);

    // Event count
    const totalEvents = await prisma.ticketedEvent.count();

    // Booking counts - separate vendor and ticket
    const [vendorBookings, ticketBookings] = await Promise.all([
      prisma.vendorBooking.count(),
      prisma.ticketBooking.count(),
    ]);
    const totalBookings = vendorBookings + ticketBookings;

    // ✅ Revenue from ALL sources (ticket + vendor)
    const [ticketRevenue, vendorRevenue] = await Promise.all([
      prisma.ticketBooking.aggregate({
        _sum: { totalAmount: true },
      }),
      prisma.vendorBooking.aggregate({
        _sum: { totalAmount: true },
      }),
    ]);

    const totalRevenue = Number(ticketRevenue._sum.totalAmount || 0) + Number(vendorRevenue._sum.totalAmount || 0);

    // Payout statistics - separate for vendors and organizers
    const [vendorPayouts, organizerPayouts] = await Promise.all([
      prisma.payout.aggregate({
        where: {
          status: 'COMPLETED',
          type: { in: ['DEPOSIT', 'REMAINING', 'FULL'] },
        },
        _sum: { vendorPayout: true, platformCommission: true },
      }),
      prisma.payout.aggregate({
        where: {
          status: 'COMPLETED',
          type: { in: ['TICKET_SALES', 'TICKET_SALES_BULK'] },
        },
        _sum: { vendorPayout: true, platformCommission: true },
      }),
    ]);

    const releasedToVendors = Number(vendorPayouts._sum.vendorPayout || 0);
    const releasedToOrganizers = Number(organizerPayouts._sum.vendorPayout || 0);
    const totalReleased = releasedToVendors + releasedToOrganizers;

    // Commission breakdown
    const vendorCommission = Number(vendorPayouts._sum.platformCommission || 0);
    const organizerCommission = Number(organizerPayouts._sum.platformCommission || 0);

    // Pending approvals - use User table with status field
    const [pendingVendors, pendingOrganizers] = await Promise.all([
      prisma.user.count({
        where: { 
          role: "VENDOR",
          status: "PENDING" 
        } 
      }),
      prisma.user.count({
        where: { 
          role: "ORGANIZER",
          status: "PENDING" 
        } 
      }),
    ]);

    return NextResponse.json({
      totalUsers,
      totalVendors,
      totalOrganizers,
      totalEvents,
      totalBookings,
      vendorBookings,
      ticketBookings,
      totalRevenue,  // ✅ Now includes ALL revenue (ticket + vendor)
      releasedToVendors,
      releasedToOrganizers,
      totalReleased,
      vendorCommission,
      organizerCommission,
      pendingVendors,
      pendingOrganizers,
    });
  } catch (error) {
    console.error("Error fetching stats:", error);
    return NextResponse.json(
      { error: "Failed to fetch stats" },
      { status: 500 }
    );
  }
}