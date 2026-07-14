import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);

    if (!session || !session.user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    if (session.user.role !== "VENDOR") {
      return NextResponse.json(
        { error: "Forbidden" },
        { status: 403 }
      );
    }

    const vendor = await prisma.vendorProfile.findUnique({
      where: {
        userId: session.user.id,
      },
    });

    if (!vendor) {
      return NextResponse.json(
        { error: "Vendor profile not found" },
        { status: 404 }
      );
    }

    const packages = await prisma.servicePackage.findMany({
      where: {
        vendorId: vendor.id,
      },
      include: {
        packageAddOns: true,
        vendorBookings: {
          select: {
            id: true,
            bookingStatus: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    const formattedPackages = packages.map((pkg) => ({
      id: pkg.id,
      name: pkg.name,
      price: pkg.price,
      description: pkg.description,
      imageUrl: pkg.imageUrl,
      galleryImages: pkg.galleryImages,
      isActive: pkg.isActive,
      // NEW: Include new fields in response
      pricingType: pkg.pricingType,
      minGuests: pkg.minGuests,
      maxGuests: pkg.maxGuests,
      serviceDetails: pkg.serviceDetails,
      status: pkg.status,
      addOns: pkg.packageAddOns.map((addon) => ({
        id: addon.id,
        name: addon.name,
        extraPrice: addon.extraPrice,
        isOptional: addon.isOptional,
        pricingType: addon.pricingType, // NEW
      })),
      bookings: pkg.vendorBookings,
    }));

    return NextResponse.json(formattedPackages);
  } catch (error) {
    console.error("Error fetching packages:", error);
    return NextResponse.json(
      { error: "Failed to fetch packages" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || !session.user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    if (session.user.role !== "VENDOR") {
      return NextResponse.json(
        { error: "Forbidden" },
        { status: 403 }
      );
    }

    const vendor = await prisma.vendorProfile.findUnique({
      where: {
        userId: session.user.id,
      },
    });

    if (!vendor) {
      return NextResponse.json(
        { error: "Vendor profile not found" },
        { status: 404 }
      );
    }

    // UPDATED: Include new fields in destructuring
    const { 
      name, 
      price, 
      description, 
      addOns, 
      imageUrl, 
      galleryImages,
      // NEW FIELDS:
      pricingType,
      minGuests,
      maxGuests,
      serviceDetails,
      status
    } = await request.json();

    if (!name || !price) {
      return NextResponse.json(
        { error: "Package name and price are required" },
        { status: 400 }
      );
    }

    // UPDATED: Create package with new fields
    const newPackage = await prisma.servicePackage.create({
      data: {
        vendorId: vendor.id,
        name,
        price,
        description: description || "",
        imageUrl: imageUrl || null,
        galleryImages: galleryImages || [],
        isActive: true,
        // NEW FIELDS:
        pricingType: pricingType || "fixed",
        minGuests: minGuests || null,
        maxGuests: maxGuests || null,
        serviceDetails: serviceDetails || null,
        status: status || "draft",
      },
    });

    // UPDATED: Create add-ons with pricingType
    if (addOns && addOns.length > 0) {
      for (const addon of addOns) {
        if (addon.name) {
          await prisma.packageAddOn.create({
            data: {
              packageId: newPackage.id,
              name: addon.name,
              extraPrice: addon.extraPrice || 0,
              isOptional: addon.isOptional !== undefined ? addon.isOptional : true,
              pricingType: addon.pricingType || "fixed", // NEW
            },
          });
        }
      }
    }

    return NextResponse.json(
      { message: "Package created successfully", packageId: newPackage.id },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error creating package:", error);
    return NextResponse.json(
      { error: "Failed to create package" },
      { status: 500 }
    );
  }
}