import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    const url = new URL(request.url);
    const limit = url.searchParams.get("limit");

    const vendors = await prisma.vendorProfile.findMany({
      where: {
        user: {
          status: "APPROVED",
        },
      },
      include: {
        servicePackages: {
          where: {
            isActive: true,
          },
          select: {
            id: true,
            name: true,
            price: true,
            imageUrl: true,
          },
        },
        user: {
          select: {
            name: true,
            email: true,
          },
        },
      },
      take: limit ? parseInt(limit) : undefined,
    });

    const formattedVendors = vendors.map((vendor) => ({
      id: vendor.id,
      businessName: vendor.businessName,
      serviceType: vendor.serviceType,
      location: vendor.location,
      description: vendor.description,
      imageUrl: vendor.imageUrl,  // Now this exists in the schema
      packages: vendor.servicePackages,
    }));

    return NextResponse.json(formattedVendors);
  } catch (error) {
    console.error("Error fetching vendors:", error);
    return NextResponse.json(
      { error: "Failed to fetch vendors" },
      { status: 500 }
    );
  }
}