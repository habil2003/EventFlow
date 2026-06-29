import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    const session = await getServerSession(authOptions);

    if (!session || session.user?.role !== 'VENDOR') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get vendor profile
    const vendor = await prisma.vendorProfile.findUnique({
      where: { userId: session.user.id },
    });

    if (!vendor) {
      return NextResponse.json({ error: 'Vendor not found' }, { status: 404 });
    }

    // Get all payouts for this vendor
    const payouts = await prisma.payout.findMany({
      where: { vendorId: vendor.id },
      include: {
        vendorBooking: {
          include: {
            userSocialEvent: true,
            servicePackage: true,
            user: true,
          },
        },
        admin: {
          select: { name: true, email: true },
        },
      },
      orderBy: { processedAt: 'desc' },
    });

    // Calculate summary
    const totalReleased = payouts.reduce((sum, p) => sum + Number(p.amount || 0), 0);
    const totalCommission = payouts.reduce((sum, p) => sum + Number(p.platformCommission || 0), 0);
    const totalReceived = payouts.reduce((sum, p) => sum + Number(p.vendorPayout || 0), 0);

    // Get pending bookings (deposit paid but not released)
    const pendingBookings = await prisma.vendorBooking.findMany({
      where: {
        vendorId: vendor.id,
        vendorPaymentStatus: 'DEPOSIT_PAID',
        amountReleasedAt: null,
        bookingStatus: 'ACCEPTED',
      },
      include: {
        userSocialEvent: true,
        servicePackage: true,
        user: true,
      },
    });

    const pendingAmount = pendingBookings.reduce((sum, b) => 
      sum + (b.depositAmount ? Number(b.depositAmount) : Number(b.totalAmount) * 0.2), 0
    );

    const formattedPayouts = payouts.map(p => ({
      id: p.id,
      amount: Number(p.amount),
      platformCommission: Number(p.platformCommission),
      vendorPayout: Number(p.vendorPayout),
      type: p.type,
      status: p.status,
      processedAt: p.processedAt,
      notes: p.notes,
      eventTitle: p.vendorBooking?.userSocialEvent?.title || 'N/A',
      packageName: p.vendorBooking?.servicePackage?.name || 'N/A',
      customerName: p.vendorBooking?.user?.name || 'N/A',
      adminName: p.admin?.name || 'System',
    }));

    const formattedPending = pendingBookings.map(b => ({
      id: b.id,
      eventTitle: b.userSocialEvent.title,
      eventDate: b.userSocialEvent.eventDate,
      depositAmount: b.depositAmount ? Number(b.depositAmount) : Number(b.totalAmount) * 0.2,
      totalAmount: Number(b.totalAmount),
      customerName: b.user.name,
      packageName: b.servicePackage.name,
    }));

    return NextResponse.json({
      success: true,
      summary: {
        totalReleased,
        totalCommission,
        totalReceived,
        pendingAmount,
        pendingCount: pendingBookings.length,
        totalPayouts: payouts.length,
      },
      payouts: formattedPayouts,
      pendingBookings: formattedPending,
    });
  } catch (error) {
    console.error('Error fetching vendor payouts:', error);
    return NextResponse.json({ error: 'Failed to fetch payouts' }, { status: 500 });
  }
}