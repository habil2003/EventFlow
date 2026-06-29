import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { sendVerificationEmail } from "@/lib/email";

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
    // All users need email verification, but organizers/vendors also need admin approval
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

    // Send verification email (skip for now if no SMTP config)
    try {
      await sendVerificationEmail(email, verificationToken);
    } catch (emailError) {
      console.error("Failed to send verification email:", emailError);
      // Don't fail registration if email fails, but log it
    }

    // Remove password from response
    const { passwordHash, ...userWithoutPassword } = user;

    let message = "";
    if (role === "USER") {
      message = "Account created successfully! Please check your email to verify your account.";
    } else {
      message = "Registration submitted. Please check your email to verify your account, then wait for admin approval.";
    }

    return NextResponse.json(
      {
        message,
        user: userWithoutPassword,
        requiresVerification: true,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Registration error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}