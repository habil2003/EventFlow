import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const [totalUsers, totalEvents, totalVendors] = await Promise.all([
      prisma.user.count(),
      prisma.ticketedEvent.count(),
      prisma.vendorProfile.count(),
    ]);

    return NextResponse.json({
      totalUsers,
      totalEvents,
      totalVendors,
      avgRating: 4.8, // You can calculate this from actual reviews if you have them
    });
  } catch (error) {
    console.error("Error fetching public stats:", error);
    return NextResponse.json(
      { error: "Failed to fetch stats" },
      { status: 500 }
    );
  }
}