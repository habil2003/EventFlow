import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// GET /api/admin/analytics - Get analytics data
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
    const range = searchParams.get("range") || "30d";

    // Calculate date range
    const now = new Date();
    const startDate = new Date();
    
    switch (range) {
      case "7d":
        startDate.setDate(now.getDate() - 7);
        break;
      case "30d":
        startDate.setDate(now.getDate() - 30);
        break;
      case "90d":
        startDate.setDate(now.getDate() - 90);
        break;
      case "1y":
        startDate.setFullYear(now.getFullYear() - 1);
        break;
      default:
        startDate.setDate(now.getDate() - 30);
    }

    // Get previous period for growth calculation
    const prevStartDate = new Date(startDate);
    const prevEndDate = new Date(now);
    const periodLength = now.getTime() - startDate.getTime();
    prevStartDate.setTime(prevStartDate.getTime() - periodLength);
    prevEndDate.setTime(prevEndDate.getTime() - periodLength);

    // Get current and previous bookings counts
    const currentTicketBookings = await prisma.ticketBooking.count({
      where: {
        paymentStatus: "COMPLETED",
        createdAt: { gte: startDate, lte: now },
      },
    });

    const currentVendorBookings = await prisma.vendorBooking.count({
      where: {
        paymentStatus: "COMPLETED",
        createdAt: { gte: startDate, lte: now },
      },
    });

    const prevTicketBookings = await prisma.ticketBooking.count({
      where: {
        paymentStatus: "COMPLETED",
        createdAt: { gte: prevStartDate, lte: prevEndDate },
      },
    });

    const prevVendorBookings = await prisma.vendorBooking.count({
      where: {
        paymentStatus: "COMPLETED",
        createdAt: { gte: prevStartDate, lte: prevEndDate },
      },
    });

    // Get revenue data
    const totalRevenue = await prisma.paymentTransaction.aggregate({
      where: {
        status: "COMPLETED",
        createdAt: { gte: startDate, lte: now },
      },
      _sum: { amount: true },
    });

    const prevTotalRevenue = await prisma.paymentTransaction.aggregate({
      where: {
        status: "COMPLETED",
        createdAt: { gte: prevStartDate, lte: prevEndDate },
      },
      _sum: { amount: true },
    });

    // Get user counts
    const totalUsers = await prisma.user.count({
      where: {
        createdAt: { gte: startDate, lte: now },
      },
    });

    const prevTotalUsers = await prisma.user.count({
      where: {
        createdAt: { gte: prevStartDate, lte: prevEndDate },
      },
    });

    // Get vendor and organizer counts
    const totalVendors = await prisma.vendorProfile.count();
    const totalOrganizers = await prisma.organizerProfile.count();
    const totalEvents = await prisma.ticketedEvent.count({
      where: {
        isActive: true,
        isCompleted: false,
      },
    });

    // Calculate totals
    const totalBookings = currentTicketBookings + currentVendorBookings;
    const prevTotalBookings = prevTicketBookings + prevVendorBookings;

    // Calculate growth percentages
    const calculateGrowth = (current: number, previous: number) => {
      if (previous === 0) return current > 0 ? 100 : 0;
      return Math.round(((current - previous) / previous) * 100);
    };

    const revenueGrowth = calculateGrowth(
      Number(totalRevenue._sum.amount || 0),
      Number(prevTotalRevenue._sum.amount || 0)
    );
    const bookingGrowth = calculateGrowth(totalBookings, prevTotalBookings);
    const userGrowth = calculateGrowth(totalUsers, prevTotalUsers);

    // Revenue Trend
    const revenueTransactions = await prisma.paymentTransaction.findMany({
      where: {
        status: "COMPLETED",
        createdAt: { gte: startDate, lte: now },
      },
      select: {
        createdAt: true,
        amount: true,
      },
      orderBy: {
        createdAt: 'asc',
      },
    });

    const revenueMap = new Map();
    revenueTransactions.forEach(t => {
      const date = t.createdAt.toISOString().split('T')[0];
      if (!revenueMap.has(date)) {
        revenueMap.set(date, { date, revenue: 0, bookings: 0 });
      }
      revenueMap.get(date).revenue += Number(t.amount);
      revenueMap.get(date).bookings += 1;
    });
    const revenueTrend = Array.from(revenueMap.values());

    // Booking Trend
    const ticketBookingsList = await prisma.ticketBooking.findMany({
      where: {
        paymentStatus: "COMPLETED",
        createdAt: { gte: startDate, lte: now },
      },
      select: {
        createdAt: true,
      },
      orderBy: {
        createdAt: 'asc',
      },
    });

    const vendorBookingsList = await prisma.vendorBooking.findMany({
      where: {
        paymentStatus: "COMPLETED",
        createdAt: { gte: startDate, lte: now },
      },
      select: {
        createdAt: true,
      },
      orderBy: {
        createdAt: 'asc',
      },
    });

    const bookingMap = new Map();
    
    ticketBookingsList.forEach(t => {
      const date = t.createdAt.toISOString().split('T')[0];
      if (!bookingMap.has(date)) {
        bookingMap.set(date, { date, ticketBookings: 0, vendorBookings: 0 });
      }
      bookingMap.get(date).ticketBookings += 1;
    });

    vendorBookingsList.forEach(t => {
      const date = t.createdAt.toISOString().split('T')[0];
      if (!bookingMap.has(date)) {
        bookingMap.set(date, { date, ticketBookings: 0, vendorBookings: 0 });
      }
      bookingMap.get(date).vendorBookings += 1;
    });

    const bookingTrend = Array.from(bookingMap.values()).sort((a, b) => 
      a.date.localeCompare(b.date)
    );

    // Top Vendors
    const topVendorsRaw = await prisma.vendorBooking.groupBy({
      by: ['vendorId'],
      where: {
        paymentStatus: "COMPLETED",
        createdAt: { gte: startDate, lte: now },
      },
      _sum: {
        totalAmount: true,
      },
      _count: {
        id: true,
      },
      orderBy: {
        _sum: {
          totalAmount: 'desc',
        },
      },
      take: 5,
    });

    const vendorIds = topVendorsRaw.map(v => v.vendorId);
    const vendors = await prisma.vendorProfile.findMany({
      where: { id: { in: vendorIds } },
      select: { id: true, businessName: true },
    });
    const vendorMap = new Map(vendors.map(v => [v.id, v.businessName]));

    const topVendors = topVendorsRaw.map(v => ({
      name: vendorMap.get(v.vendorId) || 'Unknown Vendor',
      revenue: Number(v._sum.totalAmount || 0),
      bookings: v._count.id,
    }));

    // Top Organizers
    const topOrganizersRaw = await prisma.ticketBooking.groupBy({
      by: ['eventId'],
      where: {
        paymentStatus: "COMPLETED",
        createdAt: { gte: startDate, lte: now },
      },
      _sum: {
        totalAmount: true,
      },
      _count: {
        id: true,
      },
      orderBy: {
        _sum: {
          totalAmount: 'desc',
        },
      },
      take: 5,
    });

    const eventIds = topOrganizersRaw.map(e => e.eventId);
    const events = await prisma.ticketedEvent.findMany({
      where: { id: { in: eventIds } },
      include: {
        organizer: {
          select: { name: true },
        },
      },
    });
    const eventMap = new Map(events.map(e => [e.id, e.organizer.name]));

    const topOrganizers = topOrganizersRaw.map(e => ({
      name: eventMap.get(e.eventId) || 'Unknown Organizer',
      revenue: Number(e._sum.totalAmount || 0),
      events: e._count.id,
    }));

    // Payment Status Distribution
    const ticketStatusDistribution = await prisma.ticketBooking.groupBy({
      by: ['paymentStatus'],
      where: {
        createdAt: { gte: startDate, lte: now },
      },
      _count: {
        id: true,
      },
    });

    const vendorStatusDistribution = await prisma.vendorBooking.groupBy({
      by: ['paymentStatus'],
      where: {
        createdAt: { gte: startDate, lte: now },
      },
      _count: {
        id: true,
      },
    });

    const statusMap = new Map();
    ticketStatusDistribution.forEach(s => {
      statusMap.set(s.paymentStatus, (statusMap.get(s.paymentStatus) || 0) + s._count.id);
    });
    vendorStatusDistribution.forEach(s => {
      statusMap.set(s.paymentStatus, (statusMap.get(s.paymentStatus) || 0) + s._count.id);
    });

    const paymentStatusDistribution = Array.from(statusMap.entries()).map(([name, value]) => ({
      name,
      value,
    }));

    // Booking Type Distribution
    const ticketCount = await prisma.ticketBooking.count({
      where: {
        createdAt: { gte: startDate, lte: now },
      },
    });
    const vendorCount = await prisma.vendorBooking.count({
      where: {
        createdAt: { gte: startDate, lte: now },
      },
    });

    const bookingTypeDistribution = [
      { name: "Ticket Bookings", value: ticketCount },
      { name: "Vendor Bookings", value: vendorCount },
    ];

    // Monthly Stats
    const monthlyTransactions = await prisma.paymentTransaction.findMany({
      where: {
        status: "COMPLETED",
        createdAt: { gte: startDate, lte: now },
      },
      select: {
        createdAt: true,
        amount: true,
        ticketBookingId: true,
        vendorBookingId: true,
      },
    });

    const monthlyMap = new Map();
    monthlyTransactions.forEach(t => {
      const month = t.createdAt.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
      if (!monthlyMap.has(month)) {
        monthlyMap.set(month, { month, revenue: 0, bookings: 0, users: new Set() });
      }
      monthlyMap.get(month).revenue += Number(t.amount);
      monthlyMap.get(month).bookings += 1;
      
      if (t.ticketBookingId) {
        monthlyMap.get(month).users.add(t.ticketBookingId);
      }
      if (t.vendorBookingId) {
        monthlyMap.get(month).users.add(t.vendorBookingId);
      }
    });

    const monthlyStats = Array.from(monthlyMap.values()).map(m => ({
      month: m.month,
      revenue: m.revenue,
      bookings: m.bookings,
      users: m.users.size,
    }));

    return NextResponse.json({
      summary: {
        totalRevenue: Number(totalRevenue._sum.amount || 0),
        totalBookings,
        totalUsers,
        totalVendors,
        totalOrganizers,
        totalEvents,
        revenueGrowth,
        bookingGrowth,
        userGrowth,
      },
      revenueTrend: revenueTrend.map(item => ({
        date: item.date,
        revenue: item.revenue,
        bookings: item.bookings,
      })),
      bookingTrend: bookingTrend.map(item => ({
        date: item.date,
        ticketBookings: item.ticketBookings,
        vendorBookings: item.vendorBookings,
      })),
      topVendors,
      topOrganizers,
      paymentStatusDistribution,
      bookingTypeDistribution,
      monthlyStats: monthlyStats.slice(0, 12),
    });
  } catch (error) {
    console.error("Error fetching analytics:", error);
    return NextResponse.json(
      { error: "Failed to fetch analytics data" },
      { status: 500 }
    );
  }
}