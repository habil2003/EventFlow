// app/api/admin/notifications/route.ts
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);

    if (!session || session.user?.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const [
      pendingVendors,
      pendingOrganizers,
      openDisputes,
      pendingRefunds,
      escrowBookings,
      failedPayouts,
      pendingVendorBookings,
    ] = await Promise.all([
      prisma.user.findMany({
        where: { role: "VENDOR", status: "PENDING" },
        include: { vendorProfile: { select: { businessName: true } } },
        orderBy: { createdAt: "asc" },
        take: 10,
      }),
      prisma.user.findMany({
        where: { role: "ORGANIZER", status: "PENDING" },
        include: { organizerProfile: { select: { businessName: true } } },
        orderBy: { createdAt: "asc" },
        take: 10,
      }),
      prisma.dispute.findMany({
        where: { status: "OPEN" },
        include: {
          vendorBooking: {
            select: {
              userSocialEvent: { select: { title: true } },
            },
          },
        },
        orderBy: { createdAt: "asc" },
        take: 10,
      }),
      prisma.refund.findMany({
        where: { refundStatus: "PENDING_ADMIN" },
        include: {
          ticketBooking: { select: { event: { select: { title: true } } } },
          vendorBooking: {
            select: { userSocialEvent: { select: { title: true } } },
          },
        },
        orderBy: { createdAt: "asc" },
        take: 10,
      }),
      prisma.vendorBooking.findMany({
        where: {
          paymentStatus: { in: ["HELD_IN_ESCROW", "PROCESSING_PAYOUT"] },
        },
        select: { id: true, totalAmount: true, paymentStatus: true },
      }),
      prisma.payout.findMany({
        where: { status: "FAILED" },
        orderBy: { updatedAt: "desc" },
        take: 10,
      }),
      prisma.vendorBooking.findMany({
        where: { bookingStatus: "PENDING" },
        include: {
          vendor: { select: { businessName: true } },
          userSocialEvent: { select: { title: true } },
        },
        orderBy: { createdAt: "asc" },
        take: 10,
      }),
    ]);

    const items: {
      id: string;
      type: string;
      severity: "warning" | "critical" | "info";
      title: string;
      description: string;
      link: string;
      createdAt: Date;
    }[] = [];

    pendingVendors.forEach((v) =>
      items.push({
        id: `vendor-${v.id}`,
        type: "VENDOR_APPROVAL",
        severity: "warning",
        title: `Vendor approval pending: ${v.vendorProfile?.businessName || v.name}`,
        description: `${v.name} (${v.email}) is waiting for approval.`,
        link: "/admin/approvals?tab=vendors",
        createdAt: v.createdAt,
      })
    );

    pendingOrganizers.forEach((o) =>
      items.push({
        id: `organizer-${o.id}`,
        type: "ORGANIZER_APPROVAL",
        severity: "warning",
        title: `Organizer approval pending: ${o.organizerProfile?.businessName || o.name}`,
        description: `${o.name} (${o.email}) is waiting for approval.`,
        link: "/admin/approvals?tab=organizers",
        createdAt: o.createdAt,
      })
    );

    openDisputes.forEach((d) =>
      items.push({
        id: `dispute-${d.id}`,
        type: "DISPUTE",
        severity: "critical",
        title: `Open dispute on ${d.vendorBooking?.userSocialEvent?.title || "a booking"}`,
        description: `${d.reason}`,
        link: `/admin/disputes?id=${d.id}`,
        createdAt: d.createdAt,
      })
    );

    pendingRefunds.forEach((r) =>
      items.push({
        id: `refund-${r.id}`,
        type: "REFUND",
        severity: "critical",
        title: `Manual refund pending: NPR ${Number(r.refundAmount).toLocaleString()}`,
        description: `Refund ${r.id} requires admin action.`,
        link: "/admin/refunds",
        createdAt: r.createdAt,
      })
    );

    pendingVendorBookings.forEach((b) =>
      items.push({
        id: `booking-${b.id}`,
        type: "VENDOR_BOOKING",
        severity: "info",
        title: `Booking awaiting response: ${b.userSocialEvent?.title || "Social event"}`,
        description: `${b.vendor?.businessName || "Vendor"} has not responded yet.`,
        link: "/admin/bookings",
        createdAt: b.createdAt,
      })
    );

    failedPayouts.forEach((p) =>
      items.push({
        id: `payout-${p.id}`,
        type: "PAYOUT",
        severity: "critical",
        title: `Failed payout: NPR ${Number(p.amount).toLocaleString()}`,
        description: `Payout ${p.id} failed and needs review.`,
        link: "/admin/payouts",
        createdAt: p.updatedAt,
      })
    );

    items.sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );

    const escrowTotal = escrowBookings.reduce(
      (sum, b) => sum + Number(b.totalAmount || 0),
      0
    );

    const summary = {
      vendorApprovals: pendingVendors.length,
      organizerApprovals: pendingOrganizers.length,
      openDisputes: openDisputes.length,
      pendingRefunds: pendingRefunds.length,
      pendingBookings: pendingVendorBookings.length,
      failedPayouts: failedPayouts.length,
      escrowHeld: escrowBookings.length,
      escrowAmount: escrowTotal,
      unread: items.length,
    };

    return NextResponse.json({ success: true, items, summary });
  } catch (error) {
    console.error("Error fetching notifications:", error);
    return NextResponse.json(
      { error: "Failed to fetch notifications" },
      { status: 500 }
    );
  }
}
