// app/api/test-khalti-refund/route.ts
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { transactionId, amount } = await request.json();
    
    console.log('Testing Khalti Lookup API...');
    console.log('Transaction ID (pidx):', transactionId);
    
    const response = await fetch('https://dev.khalti.com/api/v2/epayment/lookup/', {
      method: 'POST',
      headers: {
        'Authorization': `Key ${process.env.KHALTI_SECRET_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        pidx: transactionId,
      }),
    });
    
    const data = await response.json();
    console.log('Lookup result:', data);
    
    return NextResponse.json({
      success: response.ok,
      status: response.status,
      data: data
    });
    
  } catch (error) {
    console.error('Test error:', error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}