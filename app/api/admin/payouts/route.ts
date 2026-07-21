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

    // Build where clause - only show parent payouts (bulk payouts and individual non-bulk)
    const where: any = {
      bulkPayoutId: null,
    };

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
          childPayouts: {
            include: {
              ticketBooking: {
                include: {
                  user: true,
                  event: true,
                },
              },
              vendorBooking: {
                include: {
                  user: true,
                  userSocialEvent: true,
                },
              },
            },
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
        where: { status: 'COMPLETED', bulkPayoutId: null },
        _sum: { amount: true, platformCommission: true, vendorPayout: true },
      }),
      prisma.payout.aggregate({
        where: { status: 'PENDING', bulkPayoutId: null },
        _sum: { amount: true },
      }),
      prisma.payout.aggregate({
        where: { status: 'PROCESSING', bulkPayoutId: null },
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

      // ✅ Fix: Get event title from ticketBooking or child payouts
      let eventTitle = 'N/A';
      if (p.ticketBooking?.event?.title) {
        eventTitle = p.ticketBooking.event.title;
      } else if (p.vendorBooking?.userSocialEvent?.title) {
        eventTitle = p.vendorBooking.userSocialEvent.title;
      } else if (p.childPayouts && p.childPayouts.length > 0) {
        // For bulk payouts, get event title from first child
        const firstChild = p.childPayouts[0];
        if (firstChild?.ticketBooking?.event?.title) {
          eventTitle = firstChild.ticketBooking.event.title;
        }
      }

      // ✅ Check if this is a bulk payout and count child payouts
      const isBulk = p.type === 'TICKET_SALES_BULK';
      const childCount = p.childPayouts?.length || 0;

      // ✅ Recalculate from child payouts for bulk payouts
      let totalAmount = Number(p.amount);
      let totalCommission = Number(p.platformCommission);
      let totalVendorPayout = Number(p.vendorPayout);

      if (isBulk && p.childPayouts && p.childPayouts.length > 0) {
        // Recalculate from child payouts to ensure accuracy
        totalAmount = p.childPayouts.reduce((sum, child) => sum + Number(child.amount), 0);
        totalCommission = p.childPayouts.reduce((sum, child) => sum + Number(child.platformCommission), 0);
        totalVendorPayout = p.childPayouts.reduce((sum, child) => sum + Number(child.vendorPayout), 0);
      }

      return {
        id: p.id,
        amount: totalAmount,
        platformCommission: totalCommission,
        vendorPayout: totalVendorPayout,
        type: p.type,
        status: p.status,
        createdAt: p.createdAt,
        processedAt: p.processedAt,
        notes: p.notes,
        recipientName,
        recipientType,
        eventTitle, // ✅ Fixed - now shows event name for bulk payouts
        adminName: p.admin?.name || 'System',
        transactionId: p.transactionId,
        khaltiPayoutId: p.khaltiPayoutId,
        // ✅ Bulk-specific fields
        isBulk: isBulk,
        ticketCount: childCount, // ✅ Fixed - now shows ticket count
        childPayouts: p.childPayouts?.map(child => ({
          id: child.id,
          amount: Number(child.amount),
          vendorPayout: Number(child.vendorPayout),
          customerName: child.ticketBooking?.user?.name || 
                        child.vendorBooking?.user?.name || 
                        'Unknown',
          ticketNumber: child.ticketBooking?.ticketNumber || 'N/A',
        })) || [],
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
        countCompleted: await prisma.payout.count({ where: { status: 'COMPLETED', bulkPayoutId: null } }),
        countPending: await prisma.payout.count({ where: { status: 'PENDING', bulkPayoutId: null } }),
        countProcessing: await prisma.payout.count({ where: { status: 'PROCESSING', bulkPayoutId: null } }),
      },
    });
  } catch (error) {
    console.error('Error fetching payouts:', error);
    return NextResponse.json({ error: 'Failed to fetch payouts' }, { status: 500 });
  }
}