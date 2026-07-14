// app/api/admin/payouts/route.ts
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || session.user?.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const type = searchParams.get('type');
    const search = searchParams.get('search');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');

    // Build where clause
    const where: any = {};

    if (status && status !== 'ALL') {
      where.status = status;
    }

    if (type && type !== 'ALL') {
      where.type = type;
    }

    if (search) {
      where.OR = [
        { vendor: { businessName: { contains: search, mode: 'insensitive' } } },
        { vendorBooking: { user: { name: { contains: search, mode: 'insensitive' } } } },
        { ticketBooking: { event: { title: { contains: search, mode: 'insensitive' } } } },
        { notes: { contains: search, mode: 'insensitive' } },
      ];
    }

    // Get payouts with pagination
    const [payouts, total] = await Promise.all([
      prisma.payout.findMany({
        where,
        include: {
          vendor: {
            include: {
              user: {
                select: { name: true, email: true },
              },
            },
          },
          vendorBooking: {
            include: {
              user: { select: { name: true, email: true } },
              userSocialEvent: true,
              servicePackage: true,
            },
          },
          ticketBooking: {
            include: {
              event: true,
              user: { select: { name: true, email: true } },
              tier: true,
            },
          },
          admin: {
            select: { name: true, email: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.payout.count({ where }),
    ]);

    // Calculate summary
    const summary = await prisma.$transaction([
      prisma.payout.aggregate({
        where: { status: 'COMPLETED' },
        _sum: { amount: true, platformCommission: true, vendorPayout: true },
      }),
      prisma.payout.aggregate({
        where: { status: 'PENDING' },
        _sum: { amount: true },
      }),
      prisma.payout.aggregate({
        where: { status: 'PROCESSING' },
        _sum: { amount: true },
      }),
    ]);

    const formattedPayouts = payouts.map(p => {
      let recipientName = 'Unknown';
      let recipientType = '';

      if (p.vendor) {
        recipientName = p.vendor.businessName || p.vendor.user?.name || 'Unknown Vendor';
        recipientType = 'Vendor';
      } else if (p.vendorBooking) {
        recipientName = p.vendorBooking.user?.name || 'Unknown Customer';
        recipientType = 'Vendor Booking';
      } else if (p.ticketBooking) {
        recipientName = p.ticketBooking.event?.title || 'Ticket Sales';
        recipientType = 'Organizer';
      }

      let eventTitle = 'N/A';
      if (p.vendorBooking?.userSocialEvent) {
        eventTitle = p.vendorBooking.userSocialEvent.title;
      } else if (p.ticketBooking?.event) {
        eventTitle = p.ticketBooking.event.title;
      }

      return {
        id: p.id,
        amount: Number(p.amount),
        platformCommission: Number(p.platformCommission),
        vendorPayout: Number(p.vendorPayout),
        type: p.type,
        status: p.status,
        createdAt: p.createdAt,
        processedAt: p.processedAt,
        notes: p.notes,
        recipientName,
        recipientType,
        eventTitle,
        adminName: p.admin?.name || 'System',
        transactionId: p.transactionId,
        khaltiPayoutId: p.khaltiPayoutId,
        vendorBookingId: p.bookingId,
        ticketBookingId: p.ticketBookingId,
      };
    });

    return NextResponse.json({
      success: true,
      data: formattedPayouts,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
      summary: {
        totalCompleted: Number(summary[0]._sum.amount || 0),
        totalCommission: Number(summary[0]._sum.platformCommission || 0),
        totalPaid: Number(summary[0]._sum.vendorPayout || 0),
        totalPending: Number(summary[1]._sum.amount || 0),
        totalProcessing: Number(summary[2]._sum.amount || 0),
        countCompleted: await prisma.payout.count({ where: { status: 'COMPLETED' } }),
        countPending: await prisma.payout.count({ where: { status: 'PENDING' } }),
        countProcessing: await prisma.payout.count({ where: { status: 'PROCESSING' } }),
      },
    });
  } catch (error) {
    console.error('Error fetching payouts:', error);
    return NextResponse.json({ error: 'Failed to fetch payouts' }, { status: 500 });
  }
}