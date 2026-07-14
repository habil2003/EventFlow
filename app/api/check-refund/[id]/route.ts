// app/api/check-refund/[id]/route.ts
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    const { id } = await params;

    if (!session || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const refund = await prisma.refund.findUnique({
      where: { id },
      include: { paymentTransaction: true },
    });

    if (!refund) {
      return NextResponse.json({ error: 'Refund not found' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      refund: {
        id: refund.id,
        status: refund.refundStatus,
        amount: refund.refundAmount,
        createdAt: refund.createdAt,
        processedAt: refund.processedAt,
        gatewayTransactionId: refund.paymentTransaction?.gatewayTransactionId,
      },
    });
  } catch (error) {
    console.error('Error checking refund:', error);
    return NextResponse.json(
      { error: 'Failed to check refund status' },
      { status: 500 },
    );
  }
}