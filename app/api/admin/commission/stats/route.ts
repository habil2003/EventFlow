import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    const session = await getServerSession(authOptions);

    if (!session || session.user?.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get all completed payouts
    const payouts = await prisma.payout.findMany({
      where: { status: 'COMPLETED' },
      include: {
        vendorBooking: {
          include: {
            userSocialEvent: true,
            vendor: true,
            user: true,
          },
        },
        admin: {
          select: {
            name: true,
            email: true,
          },
        },
      },
      orderBy: { processedAt: 'desc' },
    });

    // Calculate totals
    const totalCommission = payouts.reduce((sum, p) => sum + Number(p.platformCommission || 0), 0);
    const totalReleased = payouts.reduce((sum, p) => sum + Number(p.amount || 0), 0);
    const totalVendorPayout = payouts.reduce((sum, p) => sum + Number(p.vendorPayout || 0), 0);

    // Group by type (deposit vs remaining)
    const depositPayouts = payouts.filter(p => p.type === 'DEPOSIT');
    const remainingPayouts = payouts.filter(p => p.type === 'REMAINING');

    const depositCommission = depositPayouts.reduce((sum, p) => sum + Number(p.platformCommission || 0), 0);
    const remainingCommission = remainingPayouts.reduce((sum, p) => sum + Number(p.platformCommission || 0), 0);

    // Format recent payouts for display
    const recentPayouts = payouts.slice(0, 10).map(p => ({
      id: p.id,
      amount: Number(p.amount),
      platformCommission: Number(p.platformCommission),
      vendorPayout: Number(p.vendorPayout),
      type: p.type,
      processedAt: p.processedAt,
      eventTitle: p.vendorBooking?.userSocialEvent?.title || 'N/A',
      vendorName: p.vendorBooking?.vendor?.businessName || 'N/A',
      customerName: p.vendorBooking?.user?.name || 'N/A',
      adminName: p.admin?.name || 'System',
    }));

    return NextResponse.json({
      success: true,
      summary: {
        totalCommission,
        totalReleased,
        totalVendorPayout,
        totalPayouts: payouts.length,
        depositCommission,
        remainingCommission,
      },
      recentPayouts,
    });
  } catch (error) {
    console.error('Error fetching commission stats:', error);
    return NextResponse.json({ error: 'Failed to fetch stats' }, { status: 500 });
  }
}