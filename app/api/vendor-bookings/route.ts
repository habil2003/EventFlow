// app/api/vendor-bookings/route.ts
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { generateTransactionId, toPaisa } from '@/lib/payment';

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || !session.user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const { 
      vendorId, 
      packageId, 
      addOnIds, 
      startDate,
      endDate,
      guestCount, 
      eventTitle,
      existingEventId,
      totalAmount
    } = await request.json();

    // Validate required fields
    if (!vendorId || !packageId || !eventTitle) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Handle both single date and date range
    let start: Date;
    let end: Date;
    let totalDays: number;

    if (startDate && endDate) {
      // Multi-day booking
      start = new Date(startDate);
      end = new Date(endDate);
      
      if (start > end) {
        return NextResponse.json(
          { error: "End date must be after start date" },
          { status: 400 }
        );
      }
      
      totalDays = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
      
      if (totalDays > 30) {
        return NextResponse.json(
          { error: "Booking cannot exceed 30 consecutive days" },
          { status: 400 }
        );
      }
    } else if (startDate && !endDate) {
      // Single day booking (backward compatible)
      start = new Date(startDate);
      end = new Date(startDate);
      totalDays = 1;
    } else {
      return NextResponse.json(
        { error: "Start date and end date required" },
        { status: 400 }
      );
    }

    // Get vendor and package details
    const vendor = await prisma.vendorProfile.findUnique({
      where: { id: vendorId },
      include: {
        servicePackages: {
          include: {
            packageAddOns: true,
          },
        },
      },
    });

    if (!vendor) {
      return NextResponse.json({ error: "Vendor not found" }, { status: 404 });
    }

    const selectedPackage = vendor.servicePackages.find(p => p.id === packageId);
    if (!selectedPackage) {
      return NextResponse.json({ error: "Package not found" }, { status: 404 });
    }

    // Check availability for all days in range
    const existingBookings = await prisma.vendorBooking.findMany({
      where: {
        vendorId,
        bookingStatus: { notIn: ['DECLINED'] },
        OR: [
          { startDate: { lte: end }, endDate: { gte: start } }
        ],
      },
    });

    if (existingBookings.length > 0) {
      return NextResponse.json({ 
        error: "Vendor is not available for selected dates",
        conflicts: existingBookings.map(b => ({
          startDate: b.startDate,
          endDate: b.endDate,
        }))
      }, { status: 409 });
    }

    // Calculate total amount with multi-day discount
    const dailyRate = Number(selectedPackage.price);
    let baseTotal = dailyRate * totalDays;
    
    // Apply multi-day discount
    let discountPercent = 0;
    if (totalDays >= 8) discountPercent = 15;
    else if (totalDays >= 4) discountPercent = 10;
    else if (totalDays >= 2) discountPercent = 5;
    
    const discountAmount = (baseTotal * discountPercent) / 100;
    let calculatedTotal = baseTotal - discountAmount;
    
    // Add add-ons
    const guestCountNum = guestCount || 1;
    if (addOnIds && addOnIds.length > 0) {
      const addOnsTotal = selectedPackage.packageAddOns
        .filter(addOn => addOnIds.includes(addOn.id))
        .reduce((sum, addOn) => {
          if (addOn.pricingType === "per_person") {
            return sum + (Number(addOn.extraPrice) * guestCountNum);
          }
          return sum + Number(addOn.extraPrice);
        }, 0);
      calculatedTotal += addOnsTotal;
    }
    
    const finalTotal = totalAmount || calculatedTotal;
    const depositAmount = finalTotal * 0.2;

    // Find or create UserSocialEvent (Umbrella Event)
    let umbrellaEvent;

    if (existingEventId) {
      umbrellaEvent = await prisma.userSocialEvent.findFirst({
        where: {
          id: existingEventId,
          userId: session.user.id,
        },
      });
      
      if (!umbrellaEvent) {
        return NextResponse.json({ error: "Event not found" }, { status: 404 });
      }
      
      if (guestCount && umbrellaEvent.guestCount !== guestCount) {
        umbrellaEvent = await prisma.userSocialEvent.update({
          where: { id: umbrellaEvent.id },
          data: { guestCount: guestCount || umbrellaEvent.guestCount }
        });
      }
    }

    if (!umbrellaEvent) {
      umbrellaEvent = await prisma.userSocialEvent.findFirst({
        where: {
          userId: session.user.id,
          title: eventTitle,
        },
      });

      if (!umbrellaEvent) {
        umbrellaEvent = await prisma.userSocialEvent.create({
          data: {
            userId: session.user.id,
            title: eventTitle,
            eventDate: start,
            guestCount: guestCount || 0,
            status: "PLANNING",
          },
        });
      } else {
        umbrellaEvent = await prisma.userSocialEvent.update({
          where: { id: umbrellaEvent.id },
          data: {
            eventDate: start,
            guestCount: guestCount || umbrellaEvent.guestCount,
          }
        });
      }
    }

    // Create the vendor booking
    const booking = await prisma.vendorBooking.create({
      data: {
        userSocialEventId: umbrellaEvent.id,
        userId: session.user.id,
        vendorId: vendorId,
        packageId: packageId,
        totalAmount: finalTotal,
        depositAmount: depositAmount,
        remainingAmount: finalTotal - depositAmount,
        bookingStatus: "PENDING",
        paymentStatus: "PENDING",
        vendorPaymentStatus: "PENDING",
        gateway: "KHALTI",
        startDate: start,
        endDate: end,
        totalDays: totalDays,
        dailyRate: dailyRate,
        bookingReference: `BKG_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
      },
    });

    // Create booking add-ons
    if (addOnIds && addOnIds.length > 0) {
      for (const addOnId of addOnIds) {
        const addOn = selectedPackage.packageAddOns.find(a => a.id === addOnId);
        if (addOn) {
          let priceAtBooking = Number(addOn.extraPrice);
          if (addOn.pricingType === "per_person") {
            priceAtBooking = Number(addOn.extraPrice) * guestCountNum;
          }
          
          await prisma.bookingAddOn.create({
            data: {
              vendorBookingId: booking.id,
              addOnId: addOn.id,
              priceAtBooking: priceAtBooking,
            },
          });
        }
      }
    }

    // Create payment transaction for deposit
    const paymentTransaction = await prisma.paymentTransaction.create({
      data: {
        transactionId: generateTransactionId('vendor'),
        amount: depositAmount,
        amountInPaisa: toPaisa(depositAmount),
        gateway: 'KHALTI',
        paymentType: 'VENDOR_DEPOSIT',
        vendorBookingId: booking.id,
        status: 'PENDING'
      }
    });

    return NextResponse.json({
      success: true,
      bookingId: booking.id,
      umbrellaEventId: umbrellaEvent.id,
      totalAmount: finalTotal,
      depositAmount: depositAmount,
      remainingAmount: finalTotal - depositAmount,
      totalDays: totalDays,
      discountPercent: discountPercent,
      discountAmount: discountAmount,
      requiresPayment: true,
      paymentTransactionId: paymentTransaction.transactionId,
      message: "Please complete the payment to confirm your booking."
    }, { status: 201 });

  } catch (error) {
    console.error("Error creating vendor booking:", error);
    return NextResponse.json(
      { error: "Failed to create booking. Please try again." },
      { status: 500 }
    );
  }
}