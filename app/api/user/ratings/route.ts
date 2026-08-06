// app/api/user/ratings/route.ts

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { Prisma, RatingType } from "@prisma/client";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || !session.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "20");
    const skip = (page - 1) * limit;
    const type = searchParams.get("type"); // Optional filter: VENDOR or EVENT

    const where: Prisma.RatingWhereInput = {
      userId: session.user.id,
    };

    if (type && (type === "VENDOR" || type === "EVENT")) {
      where.type = type as RatingType;
    }

    const [ratings, total] = await Promise.all([
      prisma.rating.findMany({
        where,
        include: {
          vendor: {
            select: {
              id: true,
              businessName: true,
              location: true,
              serviceType: true,
              imageUrl: true,
            },
          },
          event: {
            select: {
              id: true,
              title: true,
              location: true,
              eventDate: true,
              imageUrl: true,
            },
          },
          vendorBooking: {
            select: {
              id: true,
              bookingReference: true,
              startDate: true,
              endDate: true,
            },
          },
          ticketBooking: {
            select: {
              id: true,
              ticketNumber: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.rating.count({ where }),
    ]);

    const formattedRatings = ratings.map((r) => {
      const base = {
        id: r.id,
        rating: r.rating,
        review: r.review,
        type: r.type,
        isVerified: r.isVerified,
        createdAt: r.createdAt,
        updatedAt: r.updatedAt,
      };

      if (r.type === "VENDOR") {
        return {
          ...base,
          vendor: r.vendor
            ? {
                id: r.vendor.id,
                businessName: r.vendor.businessName,
                location: r.vendor.location,
                serviceType: r.vendor.serviceType,
                imageUrl: r.vendor.imageUrl,
              }
            : null,
          vendorBooking: r.vendorBooking
            ? {
                id: r.vendorBooking.id,
                reference: r.vendorBooking.bookingReference,
                startDate: r.vendorBooking.startDate,
                endDate: r.vendorBooking.endDate,
              }
            : null,
          event: null,
          ticketBooking: null,
        };
      } else {
        return {
          ...base,
          event: r.event
            ? {
                id: r.event.id,
                title: r.event.title,
                location: r.event.location,
                eventDate: r.event.eventDate,
                imageUrl: r.event.imageUrl,
              }
            : null,
          ticketBooking: r.ticketBooking
            ? {
                id: r.ticketBooking.id,
                ticketNumber: r.ticketBooking.ticketNumber,
              }
            : null,
          vendor: null,
          vendorBooking: null,
        };
      }
    });

    // ── SUMMARY STATS ──────────────────────────────────────────────
    const stats = await prisma.rating.aggregate({
      where: { userId: session.user.id },
      _avg: { rating: true },
      _count: { rating: true },
    });

    const typeDistribution = await prisma.rating.groupBy({
      by: ["type"],
      where: { userId: session.user.id },
      _count: { type: true },
    });

    const typeCounts: Record<string, number> = {};
    typeDistribution.forEach((d) => {
      typeCounts[d.type] = d._count.type;
    });

    return NextResponse.json({
      success: true,
      data: {
        ratings: formattedRatings,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit),
          hasNext: skip + limit < total,
          hasPrev: page > 1,
        },
        stats: {
          average: stats._avg.rating ? Number(stats._avg.rating.toFixed(1)) : 0,
          total: stats._count.rating || 0,
          vendorCount: typeCounts["VENDOR"] || 0,
          eventCount: typeCounts["EVENT"] || 0,
        },
      },
    });
  } catch (error) {
    console.error("Error fetching user ratings:", error);
    return NextResponse.json(
      { error: "Failed to fetch ratings" },
      { status: 500 }
    );
  }
}