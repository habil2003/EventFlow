// app/api/ratings/[id]/route.ts

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// ────────────────────────────────────────────────────────────────────
// GET - Fetch a single rating
// ────────────────────────────────────────────────────────────────────
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const rating = await prisma.rating.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            id: true,
            name: true,
          },
        },
        vendor: {
          select: {
            id: true,
            businessName: true,
            location: true,
          },
        },
        event: {
          select: {
            id: true,
            title: true,
            location: true,
            eventDate: true,
          },
        },
      },
    });

    if (!rating) {
      return NextResponse.json({ error: "Rating not found" }, { status: 404 });
    }

    return NextResponse.json({ rating });
  } catch (error) {
    console.error("Error fetching rating:", error);
    return NextResponse.json(
      { error: "Failed to fetch rating" },
      { status: 500 }
    );
  }
}

// ────────────────────────────────────────────────────────────────────
// PUT - Update a rating (only the author can update)
// ────────────────────────────────────────────────────────────────────
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    const { id } = await params;

    if (!session || !session.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { rating, review } = await request.json();

    // Validate
    if (rating === undefined || rating < 1 || rating > 5) {
      return NextResponse.json(
        { error: "Rating must be between 1 and 5" },
        { status: 400 }
      );
    }

    // Check if rating exists and belongs to user
    const existingRating = await prisma.rating.findUnique({
      where: { id },
    });

    if (!existingRating) {
      return NextResponse.json({ error: "Rating not found" }, { status: 404 });
    }

    if (existingRating.userId !== session.user.id) {
      return NextResponse.json(
        { error: "You can only update your own ratings" },
        { status: 403 }
      );
    }

    // Update rating
    const updatedRating = await prisma.rating.update({
      where: { id },
      data: {
        rating,
        review: review !== undefined ? review : existingRating.review,
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
          },
        },
        vendor: {
          select: {
            id: true,
            businessName: true,
          },
        },
        event: {
          select: {
            id: true,
            title: true,
          },
        },
      },
    });

    return NextResponse.json({
      success: true,
      message: "Rating updated successfully",
      rating: updatedRating,
    });
  } catch (error) {
    console.error("Error updating rating:", error);
    return NextResponse.json(
      { error: "Failed to update rating" },
      { status: 500 }
    );
  }
}

// ────────────────────────────────────────────────────────────────────
// DELETE - Delete a rating (only the author can delete)
// ────────────────────────────────────────────────────────────────────
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    const { id } = await params;

    if (!session || !session.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check if rating exists and belongs to user
    const existingRating = await prisma.rating.findUnique({
      where: { id },
    });

    if (!existingRating) {
      return NextResponse.json({ error: "Rating not found" }, { status: 404 });
    }

    if (existingRating.userId !== session.user.id) {
      return NextResponse.json(
        { error: "You can only delete your own ratings" },
        { status: 403 }
      );
    }

    await prisma.rating.delete({
      where: { id },
    });

    return NextResponse.json({
      success: true,
      message: "Rating deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting rating:", error);
    return NextResponse.json(
      { error: "Failed to delete rating" },
      { status: 500 }
    );
  }
}