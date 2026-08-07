import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const SLUG_REGEX = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session || session.user?.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const types = await prisma.serviceType.findMany({
      orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
    });

    return NextResponse.json({ success: true, data: types });
  } catch (error) {
    console.error("❌ [admin/service-types] Failed to list service types:", error);
    return NextResponse.json(
      { error: "Failed to list service types" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || session.user?.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { id, label, emoji, sortOrder, isActive } = body;

    if (!id || !label || !emoji) {
      return NextResponse.json(
        { error: "id, label, and emoji are required" },
        { status: 400 }
      );
    }

    const slug = String(id).trim().toLowerCase();
    if (!SLUG_REGEX.test(slug)) {
      return NextResponse.json(
        { error: "id must be a lowercase slug (letters, numbers, hyphens)" },
        { status: 400 }
      );
    }

    const existing = await prisma.serviceType.findUnique({ where: { id: slug } });
    if (existing) {
      return NextResponse.json(
        { error: `Service type '${slug}' already exists` },
        { status: 400 }
      );
    }

    const type = await prisma.serviceType.create({
      data: {
        id: slug,
        label: String(label).trim(),
        emoji: String(emoji).trim(),
        isActive: isActive !== false,
        sortOrder: typeof sortOrder === "number" ? sortOrder : 0,
      },
    });

    return NextResponse.json({ success: true, data: type }, { status: 201 });
  } catch (error) {
    console.error("❌ [admin/service-types] Failed to create service type:", error);
    return NextResponse.json(
      { error: "Failed to create service type" },
      { status: 500 }
    );
  }
}
