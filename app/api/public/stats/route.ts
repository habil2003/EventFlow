import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const [totalUsers, totalEvents, totalVendors, ratingStats] = await Promise.all([
      prisma.user.count(),
      prisma.ticketedEvent.count(),
      prisma.vendorProfile.count(),
      // ✅ Calculate average rating from all ratings
      prisma.rating.aggregate({
        _avg: { rating: true },
        _count: { rating: true },
      }),
    ]);

    const averageRating = ratingStats._avg.rating || 0;
    const totalRatings = ratingStats._count.rating || 0;

    return NextResponse.json({
      totalUsers,
      totalEvents,
      totalVendors,
      avgRating: parseFloat(averageRating.toFixed(1)), // Round to 1 decimal
      totalRatings, // Optional: include total review count
    });
  } catch (error) {
    console.error("Error fetching public stats:", error);
    return NextResponse.json(
      { error: "Failed to fetch stats" },
      { status: 500 }
    );
  }
}