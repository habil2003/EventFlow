import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { AccountStatus } from '@prisma/client';
import { getAppUrl } from '@/lib/app-url'; // ✅ Import getAppUrl

export async function POST(request: Request) {
  try {
    const { token } = await request.json();

    // Validate token
    if (!token) {
      return NextResponse.json(
        { error: 'Verification token is required' },
        { status: 400 }
      );
    }

    console.log('🔍 [verify-email] Verifying token:', token.substring(0, 20) + '...');

    // Find user by token
    const user = await prisma.user.findFirst({
      where: {
        verificationToken: token,
      },
    });

    if (!user) {
      console.log('❌ [verify-email] User not found with token');
      return NextResponse.json(
        { error: 'Invalid verification token' },
        { status: 400 }
      );
    }

    // Check if token is expired
    if (user.verificationTokenExpires && new Date() > new Date(user.verificationTokenExpires)) {
      console.log('❌ [verify-email] Token expired for user:', user.email);
      return NextResponse.json(
        { 
          error: 'Verification link has expired. Please request a new one.',
          expired: true,
        },
        { status: 400 }
      );
    }

    // Check if already verified
    if (user.emailVerified) {
      console.log('✅ [verify-email] User already verified:', user.email);
      return NextResponse.json({
        success: true,
        message: 'Email already verified. You can now log in.',
        alreadyVerified: true,
      });
    }

    // ✅ FIX: Determine status based on role using proper enum values
    let newStatus: AccountStatus;
    let requiresApproval = false;

    // ORGANIZER and VENDOR need admin approval after email verification
    if (user.role === 'ORGANIZER' || user.role === 'VENDOR') {
      newStatus = 'PENDING'; // Keep as PENDING for admin approval
      requiresApproval = true;
    } else {
      newStatus = 'APPROVED'; // Users are approved immediately
    }

    // Update user
    await prisma.user.update({
      where: { id: user.id },
      data: {
        emailVerified: new Date(),
        verificationToken: null,
        verificationTokenExpires: null,
        status: newStatus,
      },
    });

    console.log('✅ [verify-email] Email verified for:', user.email, 'Status:', newStatus);

    // ✅ Get app URL for response (optional, for frontend)
    const appUrl = getAppUrl(request);
    console.log('📍 [verify-email] App URL:', appUrl);

    // Return role-specific response
    let message = 'Email verified successfully! You can now log in.';
    if (requiresApproval) {
      message = 'Email verified successfully! Your account is pending admin approval. You will receive an email once approved.';
    }

    return NextResponse.json({
      success: true,
      message,
      requiresApproval,
      role: user.role,
      appUrl, // ✅ Include appUrl for frontend
    });
  } catch (error) {
    console.error('❌ [verify-email] Verification error:', error);
    return NextResponse.json(
      { error: 'Failed to verify email. Please try again.' },
      { status: 500 }
    );
  }
}