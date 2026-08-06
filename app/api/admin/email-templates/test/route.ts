import { NextRequest, NextResponse } from 'next/server';
import nodemailer from 'nodemailer';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

const wrapper = (content: string) => `
  <!DOCTYPE html>
  <html>
  <head><meta charset="utf-8"><title>EventFlow Email</title></head>
  <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
    <div style="background: linear-gradient(135deg, #4f46e5, #7c3aed); padding: 30px; text-align: center; border-radius: 12px 12px 0 0;">
      <h1 style="color: white; margin: 0;">${content === '' ? 'EventFlow' : 'EventFlow'}</h1>
    </div>
    <div style="background: #ffffff; padding: 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 12px 12px;">
      ${content}
    </div>
    <div style="text-align: center; padding: 20px; color: #6b7280; font-size: 12px;">
      <p>EventFlow — Nepal's Complete Event Management Solution</p>
      <p>© 2026 EventFlow. All rights reserved.</p>
    </div>
  </body>
  </html>
`;

const templates: Record<
  string,
  { subject: string; html: string }
> = {
  verification: {
    subject: 'Verify your email address',
    html: wrapper(`
      <p>Hi there,</p>
      <p>Thanks for signing up! Please verify your email address to get started.</p>
      <div style="text-align: center;">
        <a href="https://eventflow.example/verify-email?token=example" style="display: inline-block; padding: 12px 24px; background: #4f46e5; color: white; text-decoration: none; border-radius: 8px; margin: 20px 0;">Verify Email Address</a>
      </div>
      <p>This link expires in <strong>24 hours</strong>.</p>
      <p>If you didn't create an account, you can ignore this email.</p>
    `),
  },
  resetPassword: {
    subject: 'Reset Your Password',
    html: wrapper(`
      <p>Hi there,</p>
      <p>We received a request to reset your password. Click the button below to create a new password:</p>
      <div style="text-align: center;">
        <a href="https://eventflow.example/reset-password?token=example" style="display: inline-block; padding: 12px 24px; background: #4f46e5; color: white; text-decoration: none; border-radius: 8px; margin: 20px 0;">Reset Password</a>
      </div>
      <p>This link expires in <strong>1 hour</strong>.</p>
      <p>If you didn't request this, you can ignore this email.</p>
    `),
  },
  bookingAccepted: {
    subject: '✓ Booking Accepted! - Sample Event',
    html: wrapper(`
      <p>Dear <strong>Customer</strong>,</p>
      <p>Great news! <strong>Sample Vendor</strong> has accepted your booking.</p>
      <div style="background-color: #f0fdf4; padding: 20px; border-radius: 12px; margin: 20px 0; border-left: 4px solid #22c55e;">
        <h3 style="margin: 0 0 10px 0; color: #166534;">Booking Confirmed</h3>
        <p style="margin: 8px 0;"><strong>Event:</strong> Sample Event</p>
        <p style="margin: 8px 0;"><strong>Date:</strong> Jan 1, 2026</p>
        <p style="margin: 8px 0;"><strong>Package:</strong> Gold Package</p>
        <p style="margin: 8px 0;"><strong>Vendor:</strong> Sample Vendor</p>
      </div>
      <p>The vendor will contact you shortly with further details about your event.</p>
      <div style="text-align: center;">
        <a href="https://eventflow.example/my-bookings" style="display: inline-block; padding: 12px 24px; background: #4f46e5; color: white; text-decoration: none; border-radius: 8px; margin: 20px 0;">View My Bookings</a>
      </div>
    `),
  },
  bookingDeclined: {
    subject: 'Booking Declined by Vendor - Sample Event',
    html: wrapper(`
      <p>Dear <strong>Customer</strong>,</p>
      <p>Unfortunately, <strong>Sample Vendor</strong> has declined your booking for:</p>
      <div style="background-color: #f3f4f6; padding: 20px; border-radius: 12px; margin: 20px 0;">
        <h3 style="margin: 0 0 10px 0; color: #374151;">Sample Event</h3>
        <p style="margin: 8px 0;"><strong>Event Date:</strong> Jan 1, 2026</p>
        <p style="margin: 8px 0;"><strong>Package:</strong> Gold Package</p>
        <p style="margin: 8px 0;"><strong>Vendor:</strong> Sample Vendor</p>
        <p style="margin: 8px 0;"><strong>Amount Paid:</strong> NPR 5,000</p>
      </div>
      <div style="background-color: #fef3c710; padding: 20px; border-radius: 12px; margin: 20px 0; border-left: 4px solid #f59e0b;">
        <p style="margin: 0; font-size: 18px; color: #f59e0b;"><strong>⏳ Refund Status: In Progress</strong></p>
        <p style="margin: 10px 0 0 0; color: #4b5563;">Your refund is being processed by our team. You will receive another email once completed.</p>
      </div>
      <div style="text-align: center;">
        <a href="https://eventflow.example/marketplace" style="display: inline-block; padding: 12px 24px; background: #4f46e5; color: white; text-decoration: none; border-radius: 8px; margin: 20px 0;">Browse Other Vendors</a>
      </div>
    `),
  },
  adminRefundAlert: {
    subject: '🔴 ACTION REQUIRED: Manual Refund Needed - BK-123456',
    html: wrapper(`
      <p><strong>A vendor declined a booking and manual refund is required.</strong></p>
      <div style="background-color: #fef3c7; padding: 20px; border-radius: 12px; margin: 20px 0; border-left: 4px solid #f59e0b;">
        <h3 style="margin: 0 0 10px 0; color: #92400e;">Booking Details</h3>
        <p style="margin: 8px 0;"><strong>Booking ID:</strong> BK-123456</p>
        <p style="margin: 8px 0;"><strong>Vendor:</strong> Sample Vendor</p>
        <p style="margin: 8px 0;"><strong>Customer:</strong> customer@example.com</p>
        <p style="margin: 8px 0;"><strong>Refund Amount:</strong> <span style="font-size: 18px; font-weight: bold;">NPR 5,000</span></p>
        <p style="margin: 8px 0;"><strong>Gateway Transaction ID:</strong> <code>txn_123</code></p>
      </div>
      <h3>Steps to Process:</h3>
      <ol style="margin: 15px 0; padding-left: 20px;">
        <li>Login to Khalti Dashboard</li>
        <li>Go to Transactions and search for the transaction ID above</li>
        <li>Click "Refund" and enter the amount</li>
        <li>Confirm the refund</li>
        <li>Return to admin panel and mark the refund as processed</li>
      </ol>
    `),
  },
  test: {
    subject: 'Test Email from EventFlow',
    html: wrapper(`
      <h1 style="color: #4f46e5;">✅ SMTP is Working!</h1>
      <p>Your email configuration is successfully set up.</p>
      <ul>
        <li>Email verification links</li>
        <li>Password reset emails</li>
        <li>Booking confirmations</li>
      </ul>
    `),
  },
};

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || session.user?.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { template } = (await req.json()) as { template?: string };
    if (!template || !templates[template]) {
      return NextResponse.json({ error: 'Unknown template' }, { status: 400 });
    }

    if (
      !process.env.SMTP_HOST ||
      !process.env.SMTP_USER ||
      !process.env.SMTP_PASS ||
      !process.env.SMTP_FROM
    ) {
      return NextResponse.json(
        { error: 'SMTP is not configured. Add SMTP_HOST, SMTP_USER, SMTP_PASS, SMTP_FROM env vars.' },
        { status: 500 }
      );
    }

    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT),
      secure: false,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });

    const t = templates[template];
    await transporter.sendMail({
      from: `"EventFlow" <${process.env.SMTP_FROM}>`,
      to: session.user?.email as string,
      subject: `[TEST] ${t.subject}`,
      html: t.html,
    });

    return NextResponse.json({
      success: true,
      message: 'Test email sent to ' + session.user?.email,
    });
  } catch (error) {
    console.error('Test template email error:', error);
    return NextResponse.json(
      {
        error: 'Failed to send email',
        details: error instanceof Error ? error.message : 'Unknown error occurred',
      },
      { status: 500 }
    );
  }
}
