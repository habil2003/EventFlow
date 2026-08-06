import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { Prisma, AccountStatus } from "@prisma/client";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getAppUrl } from "@/lib/app-url"; // ✅ Import getAppUrl
import { sendEmail } from "@/lib/email"; // ✅ Import email sender

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

    const { userId, role, status, reason } = await request.json();

    console.log("📊 [admin-update] Updating status:", { userId, role, status, reason });

    if (!userId || !status) {
      return NextResponse.json(
        { error: "Missing userId or status" },
        { status: 400 }
      );
    }

    // ✅ Get the user before updating
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      return NextResponse.json(
        { error: "User not found" },
        { status: 404 }
      );
    }

    // ✅ Get dynamic app URL
    const appUrl = getAppUrl(request);
    console.log('📍 [admin-update] App URL:', appUrl);

    // Prepare update data - also update role if approving
    const updateData: Prisma.UserUpdateInput = { status: status as AccountStatus };
    
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

    console.log("✅ [admin-update] User updated:", updatedUser.id, updatedUser.role, updatedUser.status);

    // ✅ Send email notification to user
    try {
      let subject = '';
      let html = '';

      if (status === "APPROVED") {
        subject = `✅ Account Approved - EventFlow`;
        html = `
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="utf-8">
            <title>Account Approved</title>
          </head>
          <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <div style="background: linear-gradient(135deg, #22c55e, #16a34a); padding: 30px; text-align: center; border-radius: 12px 12px 0 0;">
              <h1 style="color: white; margin: 0;">✅ Account Approved!</h1>
            </div>
            <div style="background: #ffffff; padding: 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 12px 12px;">
              <p>Dear ${user.name || 'User'},</p>
              <p>Great news! Your <strong>${role}</strong> account has been approved by our admin team.</p>
              <p>You can now log in and start using EventFlow:</p>
              <div style="text-align: center;">
                <a href="${appUrl}/login" style="display: inline-block; padding: 12px 24px; background: #4f46e5; color: white; text-decoration: none; border-radius: 8px; margin: 20px 0;">
                  Login to Your Account
                </a>
              </div>
              <p style="color: #6b7280; font-size: 12px;">
                ${role === 'ORGANIZER' 
                  ? 'You can now create and manage events, sell tickets, and check in attendees.' 
                  : 'You can now offer your services, manage bookings, and get paid.'}
              </p>
              <hr style="margin: 30px 0 20px; border-color: #e5e7eb;">
              <p style="color: #6b7280; font-size: 12px; text-align: center;">
                EventFlow Support Team
              </p>
            </div>
          </body>
          </html>
        `;
      } else if (status === "BLOCKED") {
        subject = `❌ Account Blocked - EventFlow`;
        html = `
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="utf-8">
            <title>Account Blocked</title>
          </head>
          <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <div style="background: linear-gradient(135deg, #dc2626, #b91c1c); padding: 30px; text-align: center; border-radius: 12px 12px 0 0;">
              <h1 style="color: white; margin: 0;">❌ Account Blocked</h1>
            </div>
            <div style="background: #ffffff; padding: 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 12px 12px;">
              <p>Dear ${user.name || 'User'},</p>
              <p>Your <strong>${role}</strong> account has been blocked by our admin team.</p>
              ${reason ? `<p><strong>Reason:</strong> ${reason}</p>` : ''}
              <p>If you believe this is a mistake, please contact our support team.</p>
              <div style="text-align: center;">
                <a href="${appUrl}/support" style="display: inline-block; padding: 12px 24px; background: #4f46e5; color: white; text-decoration: none; border-radius: 8px; margin: 20px 0;">
                  Contact Support
                </a>
              </div>
              <hr style="margin: 30px 0 20px; border-color: #e5e7eb;">
              <p style="color: #6b7280; font-size: 12px; text-align: center;">
                EventFlow Support Team
              </p>
            </div>
          </body>
          </html>
        `;
      }

      if (subject && html) {
        await sendEmail({
          to: user.email,
          subject,
          html,
        });
        console.log(`✅ [admin-update] Email sent to: ${user.email}`);
      }
    } catch (emailError) {
      console.error("❌ [admin-update] Failed to send email:", emailError);
      // Don't fail the approval if email fails
    }

    return NextResponse.json({ 
      success: true, 
      message: `${role} ${status.toLowerCase()} successfully`,
      user: updatedUser 
    });
  } catch (error) {
    console.error("❌ [admin-update] Error:", error);
    return NextResponse.json(
      { error: "Failed to update status", details: String(error) },
      { status: 500 }
    );
  }
}