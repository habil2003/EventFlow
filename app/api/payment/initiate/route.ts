// app/api/payment/initiate/route.ts
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { generateTransactionId, toPaisa } from '@/lib/payment';
import { getAppUrl } from '@/lib/app-url';

export async function POST(request: Request) {
  try {
    console.log('💰 [payment-initiate] Request received');
    console.log('📍 [payment-initiate] Request URL:', request.url);

    const session = await getServerSession(authOptions);
    if (!session) {
      console.error('❌ [payment-initiate] Unauthorized');
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

    console.log('📊 [payment-initiate] Request data:', { 
      gateway, 
      paymentType, 
      amount, 
      bookingId, 
      returnUrl: returnUrl?.substring(0, 100)
    });

    // ✅ Validate required fields
    if (!amount || amount <= 0) {
      return NextResponse.json({ error: 'Invalid amount' }, { status: 400 });
    }

    if (!bookingId) {
      return NextResponse.json({ error: 'Booking ID is required' }, { status: 400 });
    }

    // ✅ AUTO-DETECT: Get dynamic app URL
    const appUrl = getAppUrl(request);
    console.log('📍 [payment-initiate] Auto-detected App URL:', appUrl);

    // ✅ Verify the vendor booking exists with servicePackage
    const vendorBooking = await prisma.vendorBooking.findUnique({
      where: { id: bookingId },
      include: {
        vendor: true,
        user: true,
        servicePackage: true,
      },
    });

    if (!vendorBooking) {
      console.error('❌ [payment-initiate] Vendor booking not found:', bookingId);
      return NextResponse.json({ 
        success: false, 
        error: 'Booking not found' 
      }, { status: 404 });
    }

    console.log('✅ [payment-initiate] Vendor booking found:', vendorBooking.id);

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

    console.log('✅ [payment-initiate] Transaction created:', transaction.id);

    // ✅ Store return URL in transaction for later use
    await prisma.paymentTransaction.update({
      where: { id: transaction.id },
      data: { 
        gatewayResponse: { 
          returnUrl: returnUrl || '/my-bookings',
          initiatedAt: new Date().toISOString(),
        }
      }
    });

    let paymentResponse;
    
    // ✅ Build Khalti return URL with all necessary params
    const khaltiReturnUrl = `${appUrl}/api/payment/verify?gateway=${gateway}&transactionId=${transaction.transactionId}&returnUrl=${encodeURIComponent(returnUrl || '/my-bookings')}`;
    
    // ✅ FIX: Extract website URL from return URL
    const websiteUrl = new URL(khaltiReturnUrl).origin;
    
    console.log('🔗 [payment-initiate] Khalti return URL:', khaltiReturnUrl);
    console.log('🔗 [payment-initiate] Website URL (for Khalti):', websiteUrl);

    if (gateway === 'khalti') {
      // Verify Khalti secret key exists
      if (!process.env.KHALTI_SECRET_KEY) {
        console.error('❌ KHALTI_SECRET_KEY is not set in environment variables');
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
            website_url: websiteUrl,
            amount: toPaisa(amount),
            purchase_order_id: transaction.transactionId,
            purchase_order_name: orderName || vendorBooking.servicePackage?.name || 'EventFlow Booking',
            customer_info: {
              name: customerName || session.user.name || 'Customer',
              email: customerEmail || session.user.email || '',
            },
          }),
        });

        const responseText = await khaltiResponse.text();
        console.log('📡 [payment-initiate] Khalti raw response:', responseText);
        
        try {
          paymentResponse = JSON.parse(responseText);
        } catch (parseError) {
          console.error('❌ [payment-initiate] Failed to parse Khalti response:', responseText);
          return NextResponse.json({ 
            success: false, 
            error: 'Invalid response from payment gateway' 
          }, { status: 500 });
        }

        console.log('✅ [payment-initiate] Khalti parsed response:', paymentResponse);

        if (paymentResponse.pidx) {
          // ✅ Store pidx in transaction
          await prisma.paymentTransaction.update({
            where: { id: transaction.id },
            data: { pidx: paymentResponse.pidx }
          });

          console.log('✅ [payment-initiate] Payment initiated successfully');
          console.log('🔗 [payment-initiate] Payment URL:', paymentResponse.payment_url);

          return NextResponse.json({
            success: true,
            payment_url: paymentResponse.payment_url,
            transactionId: transaction.transactionId,
            pidx: paymentResponse.pidx,
          });
        } else {
          console.error('❌ [payment-initiate] Khalti error - no pidx:', paymentResponse);
          return NextResponse.json({ 
            success: false, 
            error: paymentResponse.detail || paymentResponse.error || 'Payment initiation failed' 
          }, { status: 400 });
        }
      } catch (khaltiError) {
        console.error('❌ [payment-initiate] Khalti API call failed:', khaltiError);
        return NextResponse.json({ 
          success: false, 
          error: 'Failed to connect to payment gateway' 
        }, { status: 500 });
      }
    }

    return NextResponse.json({ error: 'Invalid gateway' }, { status: 400 });

  } catch (error) {
    console.error('❌ [payment-initiate] Error:', error);
    return NextResponse.json({ 
      error: error instanceof Error ? error.message : 'Failed to initiate payment' 
    }, { status: 500 });
  }
}