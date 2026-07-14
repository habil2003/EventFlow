// lib/email.ts

import nodemailer from 'nodemailer';

// Create transporter with Brevo SMTP
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT),
  secure: false, // false for port 587
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

// ✅ Helper to get base URL dynamically
function getBaseUrl(customBaseUrl?: string): string {
  if (customBaseUrl) return customBaseUrl;
  return process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
}

// ✅ UPDATED: Send verification email with dynamic URL
export async function sendVerificationEmail(
  email: string, 
  token: string,
  baseUrl?: string // ✅ NEW: Optional dynamic URL
) {
  const appUrl = getBaseUrl(baseUrl);
  const verificationUrl = `${appUrl}/verify-email?token=${token}`;
  
  console.log('📧 [email] Verification link:', verificationUrl);
  
  await transporter.sendMail({
    from: `"EventFlow" <${process.env.SMTP_FROM}>`,
    to: email,
    subject: 'Verify your email address',
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Verify Your Email</title>
      </head>
      <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #4f46e5, #7c3aed); padding: 30px; text-align: center; border-radius: 12px 12px 0 0;">
          <h1 style="color: white; margin: 0;">🎉 Welcome to EventFlow!</h1>
        </div>
        <div style="background: #ffffff; padding: 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 12px 12px;">
          <p>Hi there,</p>
          <p>Thanks for signing up! Please verify your email address to get started.</p>
          <div style="text-align: center;">
            <a href="${verificationUrl}" style="display: inline-block; padding: 12px 24px; background: #4f46e5; color: white; text-decoration: none; border-radius: 8px; margin: 20px 0;">
              Verify Email Address
            </a>
          </div>
          <p>Or copy this link: <code style="background: #f3f4f6; padding: 8px; display: block; word-break: break-all;">${verificationUrl}</code></p>
          <p>This link expires in <strong>24 hours</strong>.</p>
          <p>If you didn't create an account, you can ignore this email.</p>
        </div>
        <div style="text-align: center; padding: 20px; color: #6b7280; font-size: 12px;">
          <p>EventFlow — Nepal's Complete Event Management Solution</p>
          <p>© 2026 EventFlow. All rights reserved.</p>
        </div>
      </body>
      </html>
    `,
  });
}

// ✅ UPDATED: Send password reset email with dynamic URL
export async function sendPasswordResetEmail(
  email: string, 
  token: string,
  baseUrl?: string // ✅ NEW: Optional dynamic URL
) {
  const appUrl = getBaseUrl(baseUrl);
  const resetUrl = `${appUrl}/reset-password?token=${token}`;
  
  console.log('📧 [email] Password reset link:', resetUrl);
  
  await transporter.sendMail({
    from: `"EventFlow" <${process.env.SMTP_FROM}>`,
    to: email,
    subject: 'Reset Your Password',
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Reset Your Password</title>
      </head>
      <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #4f46e5, #7c3aed); padding: 30px; text-align: center; border-radius: 12px 12px 0 0;">
          <h1 style="color: white; margin: 0;">🔐 Reset Your Password</h1>
        </div>
        <div style="background: #ffffff; padding: 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 12px 12px;">
          <p>Hi there,</p>
          <p>We received a request to reset your password. Click the button below to create a new password:</p>
          <div style="text-align: center;">
            <a href="${resetUrl}" style="display: inline-block; padding: 12px 24px; background: #4f46e5; color: white; text-decoration: none; border-radius: 8px; margin: 20px 0;">
              Reset Password
            </a>
          </div>
          <p>Or copy this link: <code style="background: #f3f4f6; padding: 8px; display: block; word-break: break-all;">${resetUrl}</code></p>
          <p>This link expires in <strong>1 hour</strong>.</p>
          <p>If you didn't request this, you can ignore this email.</p>
        </div>
        <div style="text-align: center; padding: 20px; color: #6b7280; font-size: 12px;">
          <p>EventFlow — Nepal's Complete Event Management Solution</p>
          <p>© 2026 EventFlow. All rights reserved.</p>
        </div>
      </body>
      </html>
    `,
  });
}

// ✅ NEW: Send vendor decline refund notification to customer (with dynamic URL)
export async function sendVendorDeclineRefundEmail(
  customerEmail: string,
  customerName: string,
  bookingDetails: {
    eventTitle: string;
    eventDate: string;
    packageName: string;
    vendorName: string;
    refundAmount: number;
  },
  refundStatus: 'PROCESSED' | 'PENDING_ADMIN' | 'FAILED',
  baseUrl?: string // ✅ NEW: Optional dynamic URL
) {
  const appUrl = getBaseUrl(baseUrl);
  
  let statusMessage = '';
  let statusColor = '';
  let statusIcon = '';
  
  switch (refundStatus) {
    case 'PROCESSED':
      statusMessage = `Your refund of NPR ${bookingDetails.refundAmount.toLocaleString()} has been processed successfully and will reflect in your account within 3-7 business days.`;
      statusColor = '#22c55e';
      statusIcon = '✓';
      break;
    case 'PENDING_ADMIN':
      statusMessage = `Your refund of NPR ${bookingDetails.refundAmount.toLocaleString()} is being processed by our team. You will receive another email once completed.`;
      statusColor = '#f59e0b';
      statusIcon = '⏳';
      break;
    case 'FAILED':
      statusMessage = `We encountered an issue processing your refund of NPR ${bookingDetails.refundAmount.toLocaleString()}. Our team has been notified and will contact you shortly.`;
      statusColor = '#ef4444';
      statusIcon = '⚠️';
      break;
  }
  
  await transporter.sendMail({
    from: `"EventFlow" <${process.env.SMTP_FROM}>`,
    to: customerEmail,
    subject: `Booking Declined by Vendor - ${bookingDetails.eventTitle}`,
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Booking Declined - Refund Status</title>
      </head>
      <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #dc2626, #b91c1c); padding: 30px; text-align: center; border-radius: 12px 12px 0 0;">
          <h1 style="color: white; margin: 0;">❌ Booking Declined</h1>
        </div>
        <div style="background: #ffffff; padding: 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 12px 12px;">
          <p>Dear ${customerName},</p>
          <p>Unfortunately, <strong>${bookingDetails.vendorName}</strong> has declined your booking for:</p>
          
          <div style="background-color: #f3f4f6; padding: 20px; border-radius: 12px; margin: 20px 0;">
            <h3 style="margin: 0 0 10px 0; color: #374151;">${bookingDetails.eventTitle}</h3>
            <p style="margin: 8px 0;"><strong>📅 Event Date:</strong> ${new Date(bookingDetails.eventDate).toLocaleDateString()}</p>
            <p style="margin: 8px 0;"><strong>📦 Package:</strong> ${bookingDetails.packageName}</p>
            <p style="margin: 8px 0;"><strong>🏢 Vendor:</strong> ${bookingDetails.vendorName}</p>
            <p style="margin: 8px 0;"><strong>💰 Amount Paid:</strong> NPR ${bookingDetails.refundAmount.toLocaleString()}</p>
          </div>
          
          <div style="background-color: ${statusColor}10; padding: 20px; border-radius: 12px; margin: 20px 0; border-left: 4px solid ${statusColor};">
            <p style="margin: 0; font-size: 18px; color: ${statusColor};">
              <strong>${statusIcon} Refund Status: ${refundStatus === 'PROCESSED' ? 'Completed' : refundStatus === 'PENDING_ADMIN' ? 'In Progress' : 'Requires Attention'}</strong>
            </p>
            <p style="margin: 10px 0 0 0; color: #4b5563;">${statusMessage}</p>
          </div>
          
          <p>We apologize for any inconvenience caused. You can browse other vendors for your event:</p>
          <div style="text-align: center;">
            <a href="${appUrl}/marketplace" style="display: inline-block; padding: 12px 24px; background: #4f46e5; color: white; text-decoration: none; border-radius: 8px; margin: 20px 0;">
              Browse Other Vendors
            </a>
          </div>
          
          <p>If you have any questions, please contact our support team.</p>
          <hr style="margin: 30px 0 20px; border-color: #e5e7eb;">
          <p style="color: #6b7280; font-size: 12px; text-align: center;">
            EventFlow Support Team<br>
            <a href="${appUrl}/support" style="color: #4f46e5;">Contact Support</a>
          </p>
        </div>
      </body>
      </html>
    `,
  });
}

// ✅ NEW: Send admin notification for manual refund required (with dynamic URL)
export async function sendAdminManualRefundAlert(
  bookingId: string,
  vendorName: string,
  customerEmail: string,
  refundAmount: number,
  gatewayTransactionId: string,
  baseUrl?: string // ✅ NEW: Optional dynamic URL
) {
  const appUrl = getBaseUrl(baseUrl);
  const dashboardUrl = `${appUrl}/admin/refunds`;
  
  await transporter.sendMail({
    from: `"EventFlow Admin" <${process.env.SMTP_FROM}>`,
    to: process.env.ADMIN_EMAIL || 'admin@eventflow.com',
    subject: `🔴 ACTION REQUIRED: Manual Refund Needed - ${bookingId}`,
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Manual Refund Required</title>
      </head>
      <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #dc2626, #b91c1c); padding: 30px; text-align: center; border-radius: 12px 12px 0 0;">
          <h1 style="color: white; margin: 0;">🔴 Manual Refund Required</h1>
        </div>
        <div style="background: #ffffff; padding: 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 12px 12px;">
          <p><strong>A vendor declined a booking and manual refund is required.</strong></p>
          
          <div style="background-color: #fef3c7; padding: 20px; border-radius: 12px; margin: 20px 0; border-left: 4px solid #f59e0b;">
            <h3 style="margin: 0 0 10px 0; color: #92400e;">Booking Details</h3>
            <p style="margin: 8px 0;"><strong>Booking ID:</strong> ${bookingId}</p>
            <p style="margin: 8px 0;"><strong>Vendor:</strong> ${vendorName}</p>
            <p style="margin: 8px 0;"><strong>Customer:</strong> ${customerEmail}</p>
            <p style="margin: 8px 0;"><strong>Refund Amount:</strong> <span style="font-size: 18px; font-weight: bold;">NPR ${refundAmount.toLocaleString()}</span></p>
            <p style="margin: 8px 0;"><strong>Gateway Transaction ID:</strong> <code>${gatewayTransactionId}</code></p>
          </div>
          
          <h3>Steps to Process:</h3>
          <ol style="margin: 15px 0; padding-left: 20px;">
            <li>Login to Khalti Dashboard (${process.env.KHALTI_ENVIRONMENT === 'sandbox' ? 'Test' : 'Live'})</li>
            <li>Go to Transactions and search for the transaction ID above</li>
            <li>Click "Refund" and enter amount: NPR ${refundAmount.toLocaleString()}</li>
            <li>Confirm the refund</li>
            <li>Return to admin panel and mark the refund as processed</li>
          </ol>
          
          <div style="text-align: center;">
            <a href="${dashboardUrl}" style="display: inline-block; padding: 12px 24px; background: #4f46e5; color: white; text-decoration: none; border-radius: 8px; margin: 20px 0;">
              Go to Refund Management
            </a>
          </div>
          
          <hr style="margin: 30px 0 20px; border-color: #e5e7eb;">
          <p style="color: #6b7280; font-size: 12px;">
            This is an automated notification. Please process this refund as soon as possible.
          </p>
        </div>
      </body>
      </html>
    `,
  });
}

// ✅ NEW: Send vendor acceptance notification to customer (with dynamic URL)
export async function sendVendorAcceptanceEmail(
  customerEmail: string,
  customerName: string,
  bookingDetails: {
    eventTitle: string;
    eventDate: string;
    packageName: string;
    vendorName: string;
  },
  baseUrl?: string // ✅ NEW: Optional dynamic URL
) {
  const appUrl = getBaseUrl(baseUrl);
  
  await transporter.sendMail({
    from: `"EventFlow" <${process.env.SMTP_FROM}>`,
    to: customerEmail,
    subject: `✓ Booking Accepted! - ${bookingDetails.eventTitle}`,
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Booking Accepted</title>
      </head>
      <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #22c55e, #16a34a); padding: 30px; text-align: center; border-radius: 12px 12px 0 0;">
          <h1 style="color: white; margin: 0;">✓ Booking Accepted!</h1>
        </div>
        <div style="background: #ffffff; padding: 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 12px 12px;">
          <p>Dear ${customerName},</p>
          <p>Great news! <strong>${bookingDetails.vendorName}</strong> has accepted your booking.</p>
          
          <div style="background-color: #f0fdf4; padding: 20px; border-radius: 12px; margin: 20px 0; border-left: 4px solid #22c55e;">
            <h3 style="margin: 0 0 10px 0; color: #166534;">Booking Confirmed</h3>
            <p style="margin: 8px 0;"><strong>Event:</strong> ${bookingDetails.eventTitle}</p>
            <p style="margin: 8px 0;"><strong>Date:</strong> ${new Date(bookingDetails.eventDate).toLocaleDateString()}</p>
            <p style="margin: 8px 0;"><strong>Package:</strong> ${bookingDetails.packageName}</p>
            <p style="margin: 8px 0;"><strong>Vendor:</strong> ${bookingDetails.vendorName}</p>
          </div>
          
          <p>The vendor will contact you shortly with further details about your event.</p>
          
          <div style="text-align: center;">
            <a href="${appUrl}/my-bookings" style="display: inline-block; padding: 12px 24px; background: #4f46e5; color: white; text-decoration: none; border-radius: 8px; margin: 20px 0;">
              View My Bookings
            </a>
          </div>
          
          <hr style="margin: 30px 0 20px; border-color: #e5e7eb;">
          <p style="color: #6b7280; font-size: 12px; text-align: center;">
            EventFlow Support Team
          </p>
        </div>
      </body>
      </html>
    `,
  });
}

// ✅ NEW: Generic email sender function
export async function sendEmail({
  to,
  subject,
  html,
}: {
  to: string;
  subject: string;
  html: string;
}) {
  try {
    await transporter.sendMail({
      from: `"EventFlow" <${process.env.SMTP_FROM}>`,
      to,
      subject,
      html,
    });
    console.log(`✅ Email sent to ${to}`);
    return { success: true };
  } catch (error) {
    console.error(`❌ Failed to send email to ${to}:`, error);
    return { success: false, error };
  }
}