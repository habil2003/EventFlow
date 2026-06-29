import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request) {
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
        { error: "Forbidden - Admin access required" },
        { status: 403 }
      );
    }

    const { userId, role, status } = await request.json();

    console.log("Updating status:", { userId, role, status });

    if (!userId || !status) {
      return NextResponse.json(
        { error: "Missing userId or status" },
        { status: 400 }
      );
    }

    // Prepare update data - also update role if approving
    const updateData: any = { status: status };
    
    // If approving a user, also update their role to match the approval type
    if (status === "APPROVED") {
      if (role === "ORGANIZER") {
        updateData.role = "ORGANIZER";
      } else if (role === "VENDOR") {
        updateData.role = "VENDOR";
      }
    }

    // Update the user
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: updateData,
    });

    console.log("User updated:", updatedUser.id, updatedUser.role, updatedUser.status);

    return NextResponse.json({ 
      success: true, 
      message: `${role} ${status.toLowerCase()} successfully`,
      user: updatedUser 
    });
  } catch (error) {
    console.error("Error updating status:", error);
    return NextResponse.json(
      { error: "Failed to update status", details: String(error) },
      { status: 500 }
    );
  }
}