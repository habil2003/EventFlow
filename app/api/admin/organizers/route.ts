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

    if (session.user.role !== "ADMIN") {
      return NextResponse.json(
        { error: "Forbidden" },
        { status: 403 }
      );
    }

    const organizers = await prisma.user.findMany({
      where: {
        role: "ORGANIZER",
      },
      include: {
        organizedEvents: {
          select: {
            id: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    const formattedOrganizers = organizers.map((org) => ({
      id: org.id,
      name: org.name,
      email: org.email,
      status: org.status,
      createdAt: org.createdAt,
      _count: {
        organizedEvents: org.organizedEvents.length,
      },
    }));

    return NextResponse.json(formattedOrganizers);
  } catch (error) {
    console.error("Error fetching organizers:", error);
    return NextResponse.json(
      { error: "Failed to fetch organizers" },
      { status: 500 }
    );
  }
}