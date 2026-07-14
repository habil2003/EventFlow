import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || session.user?.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // ✅ Await the params promise
    const { id } = await params;

    const payout = await prisma.payout.findUnique({
      where: { id },
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
    });

    if (!payout) {
      return NextResponse.json({ error: 'Payout not found' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      data: payout,
    });
  } catch (error) {
    console.error('Error fetching payout:', error);
    return NextResponse.json({ error: 'Failed to fetch payout' }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || session.user?.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // ✅ Await the params promise
    const { id } = await params;
    const body = await request.json();
    const { status, notes } = body;

    // Check if payout exists
    const existingPayout = await prisma.payout.findUnique({
      where: { id },
    });

    if (!existingPayout) {
      return NextResponse.json({ error: 'Payout not found' }, { status: 404 });
    }

    const payout = await prisma.payout.update({
      where: { id },
      data: {
        status: status || existingPayout.status,
        notes: notes !== undefined ? notes : existingPayout.notes,
        processedAt: status === 'COMPLETED' ? new Date() : existingPayout.processedAt,
        adminId: session.user.id,
      },
    });

    return NextResponse.json({
      success: true,
      message: 'Payout updated successfully',
      data: payout,
    });
  } catch (error) {
    console.error('Error updating payout:', error);
    return NextResponse.json({ error: 'Failed to update payout' }, { status: 500 });
  }
}