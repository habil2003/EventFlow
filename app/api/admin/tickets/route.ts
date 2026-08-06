// app/api/admin/tickets/route.ts
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { Prisma, PaymentStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || session.user?.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search") || "";
    const status = searchParams.get("status") || "all";
    const limit = parseInt(searchParams.get("limit") || "50");
    const page = parseInt(searchParams.get("page") || "1");
    const skip = (page - 1) * limit;

    const where: Prisma.TicketBookingWhereInput = {};

    if (search) {
      where.OR = [
        { ticketNumber: { contains: search, mode: "insensitive" } },
        { event: { title: { contains: search, mode: "insensitive" } } },
        { user: { name: { contains: search, mode: "insensitive" } } },
        { user: { email: { contains: search, mode: "insensitive" } } },
      ];
    }

    if (status === "CHECKED_IN") {
      where.checkedIn = true;
    } else if (status === "NOT_CHECKED_IN") {
      where.checkedIn = false;
    } else if (status !== "all") {
      where.paymentStatus = status as PaymentStatus;
    }

    const [tickets, totalCount] = await Promise.all([
      prisma.ticketBooking.findMany({
        where,
        include: {
          user: {
            select: { id: true, name: true, email: true },
          },
          event: {
            select: { id: true, title: true, eventDate: true, location: true },
          },
          tier: {
            select: { id: true, name: true, price: true },
          },
        },
        orderBy: { createdAt: "desc" },
        take: limit,
        skip,
      }),
      prisma.ticketBooking.count({ where }),
    ]);

    const formatted = tickets.map((t) => ({
      id: t.id,
      ticketNumber: t.ticketNumber,
      quantity: t.quantity,
      totalAmount: t.totalAmount,
      paymentStatus: t.paymentStatus,
      checkedIn: t.checkedIn,
      checkedInAt: t.checkedInAt,
      createdAt: t.createdAt,
      user: t.user,
      event: t.event,
      tier: t.tier,
    }));

    const allTickets = await prisma.ticketBooking.findMany({ select: { id: true, checkedIn: true, paymentStatus: true } });
    const stats = {
      total: allTickets.length,
      checkedIn: allTickets.filter((t) => t.checkedIn).length,
      notCheckedIn: allTickets.filter((t) => !t.checkedIn).length,
      completed: allTickets.filter((t) => t.paymentStatus === "COMPLETED").length,
      pending: allTickets.filter((t) => t.paymentStatus === "PENDING").length,
      refunded: allTickets.filter((t) => t.paymentStatus === "REFUNDED").length,
      failed: allTickets.filter((t) => t.paymentStatus === "FAILED").length,
    };

    return NextResponse.json({
      tickets: formatted,
      stats,
      pagination: {
        total: totalCount,
        page,
        limit,
        totalPages: Math.ceil(totalCount / limit),
      },
    });
  } catch (error) {
    console.error("Error fetching tickets:", error);
    return NextResponse.json(
      { error: "Failed to fetch tickets" },
      { status: 500 }
    );
  }
}

export async function PATCH(request: Request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || session.user?.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id, checkedIn } = await request.json();

    if (!id) {
      return NextResponse.json(
        { error: "Ticket id is required" },
        { status: 400 }
      );
    }

    const existing = await prisma.ticketBooking.findUnique({ where: { id } });

    if (!existing) {
      return NextResponse.json(
        { error: "Ticket not found" },
        { status: 404 }
      );
    }

    const nextCheckedIn = typeof checkedIn === "boolean" ? checkedIn : !existing.checkedIn;

    const updated = await prisma.ticketBooking.update({
      where: { id },
      data: {
        checkedIn: nextCheckedIn,
        checkedInAt: nextCheckedIn ? new Date() : null,
      },
    });

    return NextResponse.json({
      success: true,
      message: nextCheckedIn
        ? "Ticket checked in successfully"
        : "Ticket check-in reverted",
      ticket: {
        id: updated.id,
        checkedIn: updated.checkedIn,
        checkedInAt: updated.checkedInAt,
      },
    });
  } catch (error) {
    console.error("Error updating ticket:", error);
    return NextResponse.json(
      { error: "Failed to update ticket" },
      { status: 500 }
    );
  }
}
