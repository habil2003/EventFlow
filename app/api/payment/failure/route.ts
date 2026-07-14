// app/api/payment/failure/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const transactionId = searchParams.get('transactionId');

    if (transactionId) {
      await prisma.paymentTransaction.update({
        where: { transactionId: transactionId },
        data: { status: 'FAILED' }
      });
    }

    return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/payment/failed`);
  } catch (error) {
    console.error('Payment failure error:', error);
    return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/payment/failed`);
  }
}