import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { sendVerificationEmail } from "@/lib/email";
import { getAppUrl } from "@/lib/app-url"; // ✅ Import getAppUrl

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { name, email, password, role } = body;

    // Validate required fields
    if (!name || !email || !password || !role) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: "Invalid email format" },
        { status: 400 }
      );
    }

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      return NextResponse.json(
        { error: "User already exists with this email" },
        { status: 400 }
      );
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Generate verification token
    const verificationToken = crypto.randomBytes(32).toString('hex');
    const verificationTokenExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    // Determine account status based on role and email verification
    const accountStatus = "PENDING"; // All start as PENDING until email verified

    // Create user
    const user = await prisma.user.create({
      data: {
        name,
        email,
        passwordHash: hashedPassword,
        role,
        status: accountStatus,
        verificationToken,
        verificationTokenExpires,
      },
    });

    // Role-specific profile creation
    if (role === "ORGANIZER") {
      const { businessName, businessType, phone } = body;

      if (!businessName || !businessType) {
        await prisma.user.delete({ where: { id: user.id } });
        return NextResponse.json(
          { error: "Business name and business type are required for organizers" },
          { status: 400 }
        );
      }

      await prisma.organizerProfile.create({
        data: {
          userId: user.id,
          businessName,
          businessType,
          phone: phone || null,
        },
      });
    }

    if (role === "VENDOR") {
      const { businessName, serviceType, location, phone, description } = body;

      if (!businessName || !serviceType || !location) {
        await prisma.user.delete({ where: { id: user.id } });
        return NextResponse.json(
          { error: "Business name, service type, and location are required for vendors" },
          { status: 400 }
        );
      }

      await prisma.vendorProfile.create({
        data: {
          userId: user.id,
          businessName,
          serviceType,
          location,
          description: description || null,
        },
      });
    }

    // ✅ FIX: Get dynamic app URL from request
    const appUrl = getAppUrl(request);
    console.log('📍 [register] App URL:', appUrl);

    // ✅ Send verification email with dynamic URL
    let emailSent = false;
    try {
      await sendVerificationEmail(email, verificationToken, appUrl); // ✅ Pass appUrl
      emailSent = true;
      console.log('✅ [register] Verification email sent to:', email);
    } catch (emailError) {
      console.error("❌ [register] Failed to send verification email:", emailError);
      // Don't fail registration if email fails, but log it
    }

    // Remove password from response
    const { passwordHash, ...userWithoutPassword } = user;

    let message = "";
    let requiresApproval = false;

    if (role === "USER") {
      message = "Account created successfully! Please check your email to verify your account.";
      requiresApproval = false;
    } else {
      message = "Registration submitted. Please check your email to verify your account, then wait for admin approval.";
      requiresApproval = true;
    }

    return NextResponse.json(
      {
        success: true,
        message,
        user: userWithoutPassword,
        requiresVerification: true,
        requiresApproval,
        emailSent,
        role,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("❌ [register] Registration error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}