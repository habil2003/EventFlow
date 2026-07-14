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

    const package_ = await prisma.servicePackage.findUnique({
      where: { id },
      include: {
        packageAddOns: true,
      },
    });

    if (!package_) {
      return NextResponse.json(
        { error: "Package not found" },
        { status: 404 }
      );
    }

    // Verify package belongs to this vendor
    const vendor = await prisma.vendorProfile.findUnique({
      where: { userId: session.user.id },
    });

    if (!vendor || package_.vendorId !== vendor.id) {
      return NextResponse.json(
        { error: "Forbidden" },
        { status: 403 }
      );
    }

    // UPDATED: Include new fields in response
    const formattedPackage = {
      id: package_.id,
      name: package_.name,
      price: package_.price,
      description: package_.description,
      imageUrl: package_.imageUrl,
      galleryImages: package_.galleryImages,
      isActive: package_.isActive,
      // NEW FIELDS
      pricingType: package_.pricingType,
      minGuests: package_.minGuests,
      maxGuests: package_.maxGuests,
      serviceDetails: package_.serviceDetails,
      status: package_.status,
      addOns: package_.packageAddOns.map((addon) => ({
        id: addon.id,
        name: addon.name,
        extraPrice: addon.extraPrice,
        isOptional: addon.isOptional,
        pricingType: addon.pricingType, // NEW
      })),
    };

    return NextResponse.json(formattedPackage);
  } catch (error) {
    console.error("Error fetching package:", error);
    return NextResponse.json(
      { error: "Failed to fetch package" },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
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

    // UPDATED: Include new fields in destructuring
    const { 
      name, 
      price, 
      description, 
      isActive, 
      addOns, 
      imageUrl, 
      galleryImages,
      // NEW FIELDS
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

    // UPDATED: Update the package with new fields
    const updatedPackage = await prisma.servicePackage.update({
      where: { id },
      data: {
        name,
        price,
        description: description || "",
        isActive,
        imageUrl: imageUrl || null,
        galleryImages: galleryImages || [],
        // NEW FIELDS
        pricingType: pricingType || "fixed",
        minGuests: minGuests || null,
        maxGuests: maxGuests || null,
        serviceDetails: serviceDetails || null,
        status: status || "active",
      },
    });

    // Delete existing add-ons
    await prisma.packageAddOn.deleteMany({
      where: { packageId: id },
    });

    // UPDATED: Create new add-ons with pricingType
    if (addOns && addOns.length > 0) {
      for (const addon of addOns) {
        if (addon.name) {
          await prisma.packageAddOn.create({
            data: {
              packageId: id,
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
      { message: "Package updated successfully", packageId: updatedPackage.id },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error updating package:", error);
    return NextResponse.json(
      { error: "Failed to update package" },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
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

    const { isActive } = await request.json();

    const package_ = await prisma.servicePackage.update({
      where: { id },
      data: { isActive },
    });

    return NextResponse.json(package_);
  } catch (error) {
    console.error("Error updating package:", error);
    return NextResponse.json(
      { error: "Failed to update package" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
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

    await prisma.servicePackage.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting package:", error);
    return NextResponse.json(
      { error: "Failed to delete package" },
      { status: 500 }
    );
  }
}