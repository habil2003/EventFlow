// app/api/public/testimonials/route.ts
// Public, unauthenticated: returns top verified customer reviews (vendors +
// events) for the landing page "What customers say" section. Only surfaces
// reviews tied to a real, completed/attended interaction (`isVerified`) so the
// landing page never displays unverified or synthetic social proof.

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Show the reviewer's first name only (fall back to a friendly label).
function firstName(fullName: string): string {
  const trimmed = fullName.trim();
  if (!trimmed) return "Customer";
  return trimmed.split(/\s+/)[0] || "Customer";
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = Math.min(
      Math.max(parseInt(searchParams.get("limit") || "6"), 1),
      20,
    );

    const reviews = await prisma.rating.findMany({
      where: {
        isVerified: true,
        review: { not: null },
        OR: [{ vendorId: { not: null } }, { eventId: { not: null } }],
      },
      include: {
        user: { select: { id: true, name: true } },
        vendor: { select: { id: true, businessName: true } },
        event: { select: { id: true, title: true } },
      },
      orderBy: [{ rating: "desc" }, { createdAt: "desc" }],
      take: 200,
    });

    // De-duplicate by unique reviewer id so one person doesn't crowd the list.
    const seen = new Set<string>();
    const data: Array<{
      id: string;
      rating: number;
      review: string;
      type: "VENDOR" | "EVENT";
      entityId: string;
      entityName: string;
      reviewerName: string;
      reviewDate: string;
    }> = [];

    for (const r of reviews) {
      if (data.length >= limit) break;
      if (seen.has(r.userId)) continue;
      seen.add(r.userId);

      const isVendor = !!r.vendor && !!r.vendorId;
      if (!isVendor && !(r.event && r.eventId)) continue;

      data.push({
        id: r.id,
        rating: r.rating,
        review: r.review || "",
        type: isVendor ? "VENDOR" : "EVENT",
        entityId: isVendor ? (r.vendorId as string) : (r.eventId as string),
        entityName: isVendor ? (r.vendor?.businessName || "") : (r.event?.title || ""),
        reviewerName: firstName(r.user?.name || ""),
        reviewDate: r.createdAt.toISOString(),
      });
    }

    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error("Error fetching testimonials:", error);
    return NextResponse.json(
      { error: "Failed to fetch testimonials" },
      { status: 500 },
    );
  }
}