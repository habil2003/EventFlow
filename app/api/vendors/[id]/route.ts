import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const session = await getServerSession(authOptions);

    const vendor = await prisma.vendorProfile.findUnique({
      where: {
        id: id,
      },
      include: {
        servicePackages: {
          where: {
            isActive: true,
          },
          include: {
            packageAddOns: true,
          },
        },
        user: {
          select: {
            name: true,
            email: true,
          },
        },
      },
    });

    if (!vendor) {
      return NextResponse.json(
        { error: "Vendor not found" },
        { status: 404 }
      );
    }

    const formattedVendor = {
      id: vendor.id,
      businessName: vendor.businessName,
      serviceType: vendor.serviceType,
      location: vendor.location,
      description: vendor.description,
      imageUrl: vendor.imageUrl,
      galleryImages: vendor.galleryImages,
      user: vendor.user,
      packages: vendor.servicePackages.map((pkg) => ({
        id: pkg.id,
        name: pkg.name,
        price: pkg.price,
        description: pkg.description,
        imageUrl: pkg.imageUrl,
        galleryImages: pkg.galleryImages,
        // ========== NEW FIELDS ==========
        pricingType: pkg.pricingType || "fixed",  // ← ADD THIS
        minGuests: pkg.minGuests,                 // ← ADD THIS
        maxGuests: pkg.maxGuests,                 // ← ADD THIS
        serviceDetails: pkg.serviceDetails,       // ← ADD THIS
        status: pkg.status,                       // ← ADD THIS
        // ========== END NEW FIELDS ==========
        addOns: pkg.packageAddOns.map((addOn) => ({
          id: addOn.id,
          name: addOn.name,
          extraPrice: addOn.extraPrice,
          isOptional: addOn.isOptional,
          // ========== NEW FIELD ==========
          pricingType: addOn.pricingType || "fixed",  // ← ADD THIS
          // ========== END NEW FIELD ==========
        })),
      })),
    };

    return NextResponse.json(formattedVendor);
  } catch (error) {
    console.error("Error fetching vendor:", error);
    return NextResponse.json(
      { error: "Failed to fetch vendor" },
      { status: 500 }
    );
  }
}