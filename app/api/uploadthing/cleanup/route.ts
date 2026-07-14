// app/api/uploadthing/cleanup/route.ts

import { NextRequest, NextResponse } from "next/server";
import { deleteFileFromUploadThing } from "@/lib/uploadthing-cleanup";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { url } = await request.json();
    if (!url) {
      return NextResponse.json({ error: "URL is required" }, { status: 400 });
    }

    const result = await deleteFileFromUploadThing(url);
    return NextResponse.json({ success: result });
  } catch (error) {
    console.error("❌ Cleanup error:", error);
    return NextResponse.json({ error: "Failed to delete file" }, { status: 500 });
  }
}