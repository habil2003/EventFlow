// app/api/vendors/[id]/ratings/route.ts

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "10");
    const skip = (page - 1) * limit;

    // ── CHECK IF VENDOR EXISTS ────────────────────────────────────
    const vendor = await prisma.vendorProfile.findUnique({
      where: { id },
      select: { id: true, businessName: true },
    });

    if (!vendor) {
      return NextResponse.json({ error: "Vendor not found" }, { status: 404 });
    }

    // ── GET RATINGS ────────────────────────────────────────────────
    const [ratings, total, stats] = await Promise.all([
      prisma.rating.findMany({
        where: {
          vendorId: id,
          type: "VENDOR",
        },
        include: {
          user: {
            select: {
              id: true,
              name: true,
            },
          },
          vendorBooking: {
            select: {
              id: true,
              bookingReference: true,
              startDate: true,
              endDate: true,
              servicePackage: {
                select: {
                  name: true,
                },
              },
            },
          },
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.rating.count({
        where: {
          vendorId: id,
          type: "VENDOR",
        },
      }),
      prisma.rating.aggregate({
        where: {
          vendorId: id,
          type: "VENDOR",
        },
        _avg: { rating: true },
        _count: { rating: true },
        _min: { rating: true },
        _max: { rating: true },
      }),
    ]);

    // ── RATING DISTRIBUTION ────────────────────────────────────────
    const distribution = await prisma.rating.groupBy({
      by: ["rating"],
      where: {
        vendorId: id,
        type: "VENDOR",
      },
      _count: {
        rating: true,
      },
      orderBy: {
        rating: "desc",
      },
    });

    const distributionMap: Record<number, number> = {};
    distribution.forEach((d) => {
      distributionMap[d.rating] = d._count.rating;
    });

    // ── FORMAT RESPONSE ────────────────────────────────────────────
    const formattedRatings = ratings.map((r) => ({
      id: r.id,
      rating: r.rating,
      review: r.review,
      userName: r.user.name,
      userId: r.user.id,
      isVerified: r.isVerified,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
      booking: r.vendorBooking
        ? {
            reference: r.vendorBooking.bookingReference,
            packageName: r.vendorBooking.servicePackage?.name || "Unknown Package",
            startDate: r.vendorBooking.startDate,
            endDate: r.vendorBooking.endDate,
          }
        : null,
    }));

    return NextResponse.json({
      success: true,
      data: {
        vendor: {
          id: vendor.id,
          businessName: vendor.businessName,
        },
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
          min: stats._min.rating || null,
          max: stats._max.rating || null,
          distribution: {
            5: distributionMap[5] || 0,
            4: distributionMap[4] || 0,
            3: distributionMap[3] || 0,
            2: distributionMap[2] || 0,
            1: distributionMap[1] || 0,
          },
        },
      },
    });
  } catch (error) {
    console.error("Error fetching vendor ratings:", error);
    return NextResponse.json(
      { error: "Failed to fetch ratings" },
      { status: 500 }
    );
  }
}