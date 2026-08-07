import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || session.user?.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const existing = await prisma.serviceType.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json(
        { error: "Service type not found" },
        { status: 404 }
      );
    }

    const body = await request.json();
    const type = await prisma.serviceType.update({
      where: { id },
      data: {
        label: typeof body.label === "string" ? body.label.trim() : undefined,
        emoji: typeof body.emoji === "string" ? body.emoji.trim() : undefined,
        isActive: typeof body.isActive === "boolean" ? body.isActive : undefined,
        sortOrder: typeof body.sortOrder === "number" ? body.sortOrder : undefined,
      },
    });

    return NextResponse.json({ success: true, data: type });
  } catch (error) {
    console.error("❌ [admin/service-types] Failed to update service type:", error);
    return NextResponse.json(
      { error: "Failed to update service type" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || session.user?.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const inUse = await prisma.vendorProfile.count({
      where: { serviceType: id },
    });

    if (inUse > 0) {
      return NextResponse.json(
        { error: `Cannot delete: ${inUse} vendor(s) use this service type. Deactivate it instead.` },
        { status: 400 }
      );
    }

    await prisma.serviceType.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("❌ [admin/service-types] Failed to delete service type:", error);
    return NextResponse.json(
      { error: "Failed to delete service type" },
      { status: 500 }
    );
  }
}
