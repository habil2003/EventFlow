import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// GET /api/admin/transactions - Get all payment transactions
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
    const search = searchParams.get("search") || "";
    const type = searchParams.get("type") || "all";
    const status = searchParams.get("status") || "all";
    const limit = parseInt(searchParams.get("limit") || "50");
    const page = parseInt(searchParams.get("page") || "1");
    const skip = (page - 1) * limit;

    // Build where clause
    const where: any = {};

    if (search) {
      where.OR = [
        { transactionId: { contains: search, mode: "insensitive" } },
        { gatewayTransactionId: { contains: search, mode: "insensitive" } },
        { ticketBooking: { user: { name: { contains: search, mode: "insensitive" } } } },
        { ticketBooking: { event: { title: { contains: search, mode: "insensitive" } } } },
        { vendorBooking: { user: { name: { contains: search, mode: "insensitive" } } } },
        { vendorBooking: { userSocialEvent: { title: { contains: search, mode: "insensitive" } } } },
      ];
    }

    if (type !== "all") {
      where.paymentType = type;
    }

    if (status !== "all") {
      where.status = status;
    }

    // Get transactions
    const transactions = await prisma.paymentTransaction.findMany({
      where,
      include: {
        ticketBooking: {
          include: {
            user: {
              select: { name: true, email: true },
            },
            event: {
              select: { title: true },
            },
          },
        },
        vendorBooking: {
          include: {
            user: {
              select: { name: true, email: true },
            },
            userSocialEvent: {
              select: { title: true },
            },
            vendor: {
              select: { businessName: true },
            },
          },
        },
        refunds: true,
      },
      orderBy: { createdAt: "desc" },
      take: limit,
      skip: skip,
    });

    // Format transactions
    const formattedTransactions = transactions.map((t) => ({
      id: t.id,
      transactionId: t.transactionId,
      gatewayTransactionId: t.gatewayTransactionId,
      amount: t.amount,
      amountInPaisa: t.amountInPaisa,
      khaltiFee: t.khaltiFee,
      gateway: t.gateway,
      paymentType: t.paymentType,
      status: t.status,
      createdAt: t.createdAt,
      updatedAt: t.updatedAt,
      ticketBookingId: t.ticketBookingId,
      vendorBookingId: t.vendorBookingId,
      user: t.ticketBooking?.user || t.vendorBooking?.user || null,
      event: t.ticketBooking?.event?.title || t.vendorBooking?.userSocialEvent?.title || null,
      refunds: t.refunds,
    }));

    // Calculate stats
    const allTransactions = await prisma.paymentTransaction.findMany({
      where,
    });

    const stats = {
      total: allTransactions.length,
      pending: allTransactions.filter((t) => t.status === "PENDING").length,
      completed: allTransactions.filter((t) => t.status === "COMPLETED").length,
      failed: allTransactions.filter((t) => t.status === "FAILED").length,
      refunded: allTransactions.filter((t) => t.status === "REFUNDED").length,
      totalRevenue: allTransactions.reduce((sum, t) => sum + Number(t.amount || 0), 0),
      totalKhaltiFees: allTransactions.reduce((sum, t) => sum + Number(t.khaltiFee || 0), 0),
      ticketTransactions: allTransactions.filter((t) => t.paymentType === "TICKET_PURCHASE").length,
      vendorTransactions: allTransactions.filter((t) => t.paymentType === "VENDOR_DEPOSIT" || t.paymentType === "VENDOR_REMAINING").length,
    };

    return NextResponse.json({
      transactions: formattedTransactions,
      stats,
      pagination: {
        total: formattedTransactions.length,
        page,
        limit,
        totalPages: Math.ceil(formattedTransactions.length / limit),
      },
    });
  } catch (error) {
    console.error("Error fetching transactions:", error);
    return NextResponse.json(
      { error: "Failed to fetch transactions" },
      { status: 500 }
    );
  }
}