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

    const [totalUsers, totalVendors, totalOrganizers, totalEvents, totalBookings, totalRevenue] = await Promise.all([
      prisma.user.count(),
      prisma.user.count({ where: { role: "VENDOR" } }),
      prisma.user.count({ where: { role: "ORGANIZER" } }),
      prisma.ticketedEvent.count(),
      prisma.vendorBooking.count(),
      prisma.ticketBooking.aggregate({
        _sum: { totalAmount: true },
      }),
    ]);

    return NextResponse.json({
      totalUsers,
      totalVendors,
      totalOrganizers,
      totalEvents,
      totalBookings,
      totalRevenue: totalRevenue._sum.totalAmount || 0,
    });
  } catch (error) {
    console.error("Error fetching stats:", error);
    return NextResponse.json(
      { error: "Failed to fetch stats" },
      { status: 500 }
    );
  }
}