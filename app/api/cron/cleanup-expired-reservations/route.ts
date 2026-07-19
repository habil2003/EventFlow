// app/api/cron/cleanup-expired-reservations/route.ts

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    // Delete expired reservations
    const deleted = await prisma.ticketReservation.deleteMany({
      where: {
        status: 'PENDING',
        expiresAt: { lt: new Date() },
      },
    });

    console.log(`🧹 Cleaned up ${deleted.count} expired reservations`);

    return NextResponse.json({
      success: true,
      deleted: deleted.count,
    });
  } catch (error) {
    console.error('❌ Cleanup error:', error);
    return NextResponse.json({ error: 'Cleanup failed' }, { status: 500 });
  }
}