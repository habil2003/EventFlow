import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const types = await prisma.serviceType.findMany({
      where: { isActive: true },
      orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
      select: { id: true, label: true, emoji: true },
    });

    return NextResponse.json({ success: true, data: types });
  } catch (error) {
    console.error("❌ [service-types] Failed to load service types:", error);
    return NextResponse.json(
      { error: "Failed to load service types" },
      { status: 500 }
    );
  }
}
