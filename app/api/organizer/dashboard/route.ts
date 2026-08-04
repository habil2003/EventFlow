import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session || session.user?.role !== "ORGANIZER") {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const organizerId = session.user.id;

    // Get all events for this organizer
    const events = await prisma.ticketedEvent.findMany({
      where: {
        organizerId: organizerId,
      },
      include: {
        bookings: {
          include: {
            user: {
              select: {
                name: true,
                email: true,
              },
            },
          },
        },
        ticketTiers: true,
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    const now = new Date();
    const today = new Date(now);
    today.setHours(0, 0, 0, 0);

    // Calculate stats
    let totalTicketsSold = 0;
    let totalRevenue = 0;
    let checkInsToday = 0;
    const recentSales: any[] = [];
    const recentEvents: any[] = [];

    for (const event of events) {
      // Count tickets sold
      const soldCount = event.bookings.reduce((sum, b) => sum + b.quantity, 0);
      totalTicketsSold += soldCount;

      // Calculate revenue from completed bookings
      const eventRevenue = event.bookings
        .filter(b => b.paymentStatus === "COMPLETED")
        .reduce((sum, b) => sum + Number(b.totalAmount), 0);
      totalRevenue += eventRevenue;

      // Count check-ins today
      const todayCheckIns = event.bookings.filter(b => 
        b.checkedIn && 
        b.checkedInAt && 
        new Date(b.checkedInAt) >= today
      ).length;
      checkInsToday += todayCheckIns;

      // Get recent sales
      const eventRecentSales = event.bookings
        .filter(b => b.paymentStatus === "COMPLETED")
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        .slice(0, 3)
        .map(b => ({
          id: b.id,
          eventTitle: event.title,
          buyerName: b.user.name,
          amount: Number(b.totalAmount),
          createdAt: b.createdAt,
        }));
      recentSales.push(...eventRecentSales);

      // Get recent events
      if (recentEvents.length < 5) {
        recentEvents.push({
          id: event.id,
          title: event.title,
          eventDate: event.eventDate,
          ticketsSold: soldCount,
          revenue: eventRevenue,
          checkIns: event.bookings.filter(b => b.checkedIn).length,
          status: event.isCompleted ? 'completed' : 
                  new Date(event.eventDate) > now ? 'upcoming' : 'active',
        });
      }
    }

    // Sort recent sales by date
    recentSales.sort((a, b) => 
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );

    return NextResponse.json({
      totalEvents: events.length,
      activeEvents: events.filter(e => e.isActive && !e.isCompleted).length,
      upcomingEvents: events.filter(e => new Date(e.eventDate) > now && e.isActive).length,
      totalTicketsSold,
      totalRevenue,
      checkInsToday,
      recentEvents: recentEvents.slice(0, 5),
      recentSales: recentSales.slice(0, 10),
    });
  } catch (error) {
    console.error("Error fetching organizer dashboard stats:", error);
    return NextResponse.json(
      { error: "Failed to fetch dashboard stats" },
      { status: 500 }
    );
  }
}