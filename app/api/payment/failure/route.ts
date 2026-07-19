// app/api/payment/failure/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const transactionId = searchParams.get('transactionId');

    // ✅ Get base URL from request
    const baseUrl = request.nextUrl.origin;

    if (transactionId) {
      await prisma.paymentTransaction.update({
        where: { transactionId: transactionId },
        data: { status: 'FAILED' }
      });
    }

    return NextResponse.redirect(`${baseUrl}/payment/failed`);
  } catch (error) {
    console.error('Payment failure error:', error);
    const baseUrl = request.nextUrl.origin;
    return NextResponse.redirect(`${baseUrl}/payment/failed`);
  }
}