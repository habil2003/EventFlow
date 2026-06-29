// app/api/payment/initiate/route.ts
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { generateTransactionId, toPaisa } from '@/lib/payment';

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { 
      gateway, 
      paymentType,
      amount, 
      bookingId,
      customerName,
      customerEmail,
      orderName,
      returnUrl
    } = await request.json();

    console.log('Payment initiation request:', { 
      gateway, 
      paymentType, 
      amount, 
      bookingId, 
      returnUrl: returnUrl?.substring(0, 100) // Log first 100 chars only
    });

    if (!amount || amount <= 0) {
      return NextResponse.json({ error: 'Invalid amount' }, { status: 400 });
    }

    // Create payment transaction record
    const transaction = await prisma.paymentTransaction.create({
      data: {
        transactionId: generateTransactionId(),
        amount: amount,
        amountInPaisa: toPaisa(amount),
        gateway: gateway.toUpperCase(),
        paymentType: paymentType,
        vendorBookingId: bookingId,
        status: 'PENDING'
      }
    });

    // Store return URL in transaction for later use
    await prisma.paymentTransaction.update({
      where: { id: transaction.id },
      data: { 
        gatewayResponse: { returnUrl: returnUrl || '/' }
      }
    });

    let paymentResponse;
    
    // CRITICAL FIX: Don't encode the returnUrl when passing to Khalti
    // The returnUrl should be a clean URL without encoding
    const khaltiReturnUrl = `${process.env.NEXT_PUBLIC_APP_URL}/api/payment/verify?gateway=${gateway}&transactionId=${transaction.transactionId}&returnUrl=${returnUrl || '/my-bookings'}`;
    
    console.log('Khalti return URL (to Khalti):', khaltiReturnUrl);

    if (gateway === 'khalti') {
      // Verify Khalti secret key exists
      if (!process.env.KHALTI_SECRET_KEY) {
        console.error('KHALTI_SECRET_KEY is not set in environment variables');
        return NextResponse.json({ 
          success: false, 
          error: 'Payment gateway configuration error' 
        }, { status: 500 });
      }

      
      try {
        const khaltiResponse = await fetch('https://dev.khalti.com/api/v2/epayment/initiate/', {
          method: 'POST',
          headers: {
            'Authorization': `Key ${process.env.KHALTI_SECRET_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            return_url: khaltiReturnUrl,
            website_url: process.env.NEXT_PUBLIC_APP_URL,
            amount: toPaisa(amount),
            purchase_order_id: transaction.transactionId,
            purchase_order_name: orderName || 'EventFlow Booking',
            customer_info: {
              name: customerName || session.user.name || 'Customer',
              email: customerEmail || session.user.email || '',
            },
          }),
        });

        const responseText = await khaltiResponse.text();
        console.log('Khalti raw response:', responseText);
        
        try {
          paymentResponse = JSON.parse(responseText);
        } catch (parseError) {
          console.error('Failed to parse Khalti response as JSON:', responseText);
          return NextResponse.json({ 
            success: false, 
            error: 'Invalid response from payment gateway' 
          }, { status: 500 });
        }

        console.log('Khalti parsed response:', paymentResponse);

        if (paymentResponse.pidx) {
          await prisma.paymentTransaction.update({
            where: { id: transaction.id },
            data: { pidx: paymentResponse.pidx }
          });

          return NextResponse.json({
            success: true,
            payment_url: paymentResponse.payment_url,
            transactionId: transaction.transactionId
          });
        } else {
          console.error('Khalti error - no pidx:', paymentResponse);
          return NextResponse.json({ 
            success: false, 
            error: paymentResponse.detail || paymentResponse.error || 'Payment initiation failed' 
          }, { status: 400 });
        }
      } catch (khaltiError) {
        console.error('Khalti API call failed:', khaltiError);
        return NextResponse.json({ 
          success: false, 
          error: 'Failed to connect to payment gateway' 
        }, { status: 500 });
      }
    }

    return NextResponse.json({ error: 'Invalid gateway' }, { status: 400 });

  } catch (error) {
    console.error('Payment initiation error:', error);
    return NextResponse.json({ 
      error: error instanceof Error ? error.message : 'Failed to initiate payment' 
    }, { status: 500 });
  }
}