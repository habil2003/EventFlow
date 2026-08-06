// app/api/admin/disputes/route.ts

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

// ────────────────────────────────────────────────────────────────────
// GET - Admin view all disputes
// ────────────────────────────────────────────────────────────────────
export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || session.user?.role !== 'ADMIN') {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');

    const where: Prisma.DisputeWhereInput = {};
    if (status && status !== 'ALL') {
      where.status = status;
    }

    const disputes = await prisma.dispute.findMany({
      where,
      include: {
        vendorBooking: {
          include: {
            vendor: {
              include: {
                user: {
                  select: {
                    name: true,
                    email: true,
                  },
                },
              },
            },
            user: {
              select: {
                name: true,
                email: true,
              },
            },
            userSocialEvent: true,
            servicePackage: true,
            paymentTransactions: true,
            payouts: true,
          },
        },
        user: {
          select: {
            name: true,
            email: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    const formattedDisputes = disputes.map((dispute) => ({
      id: dispute.id,
      bookingId: dispute.bookingId,
      reason: dispute.reason,
      status: dispute.status,
      adminDecision: dispute.adminDecision,
      createdAt: dispute.createdAt,
      updatedAt: dispute.updatedAt,
      customer: {
        name: dispute.user?.name || dispute.vendorBooking?.user?.name || 'Unknown',
        email: dispute.user?.email || dispute.vendorBooking?.user?.email || 'Unknown',
      },
      vendor: {
        name: dispute.vendorBooking?.vendor?.businessName || 'Unknown Vendor',
        email: dispute.vendorBooking?.vendor?.user?.email || 'Unknown',
      },
      booking: {
        eventTitle: dispute.vendorBooking?.userSocialEvent?.title || 'Unknown Event',
        totalAmount: dispute.vendorBooking?.totalAmount || 0,
        packageName: dispute.vendorBooking?.servicePackage?.name || 'Unknown Package',
        paymentStatus: dispute.vendorBooking?.paymentStatus || 'Unknown',
        vendorPaymentStatus: dispute.vendorBooking?.vendorPaymentStatus || 'Unknown',
      },
    }));

    // Summary stats
    const totalDisputes = await prisma.dispute.count();
    const openDisputes = await prisma.dispute.count({ where: { status: 'OPEN' } });
    const resolvedDisputes = await prisma.dispute.count({ where: { status: 'RESOLVED' } });

    return NextResponse.json({
      disputes: formattedDisputes,
      summary: {
        total: totalDisputes,
        open: openDisputes,
        resolved: resolvedDisputes,
      },
    });

  } catch (error) {
    console.error("Error fetching disputes:", error);
    return NextResponse.json(
      { error: "Failed to fetch disputes" },
      { status: 500 }
    );
  }
}