// app/api/cron/update-refunds/route.ts
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// This endpoint will be called by cron job
export async function GET(request: Request) {
  try {
    // Security: Verify secret key to prevent unauthorized access
    const authHeader = request.headers.get('authorization');
    const expectedSecret = process.env.CRON_SECRET_KEY;
    
    if (expectedSecret && authHeader !== `Bearer ${expectedSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Import dynamically to avoid issues
    const { updatePendingRefunds } = await import('@/lib/payment/check-refund-status');
    
    const result = await updatePendingRefunds();
    
    return NextResponse.json({
      success: true,
      message: 'Refund status check completed',
      result
    });
  } catch (error) {
    console.error('Cron job error:', error);
    return NextResponse.json(
      { error: 'Failed to update refunds' },
      { status: 500 }
    );
  }
}