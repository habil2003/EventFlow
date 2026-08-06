import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

const templates = [
  {
    key: 'verification',
    name: 'Email Verification',
    description:
      'Sent after signup so users confirm their email address. Includes a 24-hour verification link.',
    trigger: 'On user registration',
    subject: 'Verify your email address',
    to: 'New user',
    preview: `Hi there,

Thanks for signing up! Please verify your email address to get started.

[Verify Email Address]

This link expires in 24 hours.
If you didn't create an account, you can ignore this email.`,
  },
  {
    key: 'resetPassword',
    name: 'Password Reset',
    description:
      'Sent when a user requests a password reset. Includes a 1-hour reset link.',
    trigger: 'On password reset request',
    subject: 'Reset Your Password',
    to: 'Requesting user',
    preview: `Hi there,

We received a request to reset your password. Click the button below to create a new password:

[Reset Password]

This link expires in 1 hour.
If you didn't request this, you can ignore this email.`,
  },
  {
    key: 'bookingAccepted',
    name: 'Booking Accepted',
    description:
      'Notifies a customer that their vendor booking was accepted, with event, package and vendor details.',
    trigger: 'Vendor accepts a booking',
    subject: '✓ Booking Accepted! - {event title}',
    to: 'Customer',
    preview: `Dear {customer},

Great news! {vendor} has accepted your booking.

Booking Confirmed
  Event:    {event title}
  Date:     {event date}
  Package:  {package name}
  Vendor:   {vendor name}

The vendor will contact you shortly with further details about your event.

[View My Bookings]`,
  },
  {
    key: 'bookingDeclined',
    name: 'Booking Declined (Refund)',
    description:
      'Notifies a customer that a vendor declined their booking and shares the refund status (processed / pending / failed).',
    trigger: 'Vendor declines a booking',
    subject: 'Booking Declined by Vendor - {event title}',
    to: 'Customer',
    preview: `Dear {customer},

Unfortunately, {vendor} has declined your booking for {event title}.

Booking Details
  Event Date:    {event date}
  Package:       {package name}
  Vendor:        {vendor name}
  Amount Paid:   NPR {amount}

Refund Status: {PROCESSED | PENDING_ADMIN | FAILED}

[Browse Other Vendors]`,
  },
  {
    key: 'adminRefundAlert',
    name: 'Admin Manual Refund Alert',
    description:
      'Internal email to admins when a manual refund is required (e.g. Khalti refund cannot be automated). Links to refund management.',
    trigger: 'Manual refund required',
    subject: '🔴 ACTION REQUIRED: Manual Refund Needed - {bookingId}',
    to: 'Admin',
    preview: `A vendor declined a booking and manual refund is required.

Booking Details
  Booking ID:         {bookingId}
  Vendor:             {vendor}
  Customer:           {customerEmail}
  Refund Amount:      NPR {amount}
  Gateway Txn ID:     {transactionId}

Steps to Process:
  1. Login to Khalti Dashboard
  2. Search for the transaction ID
  3. Click "Refund" and enter the amount
  4. Confirm the refund
  5. Mark the refund as processed in admin

[Go to Refund Management]`,
  },
  {
    key: 'test',
    name: 'Generic SMTP Test',
    description:
      'Simple connectivity check that confirms SMTP credentials are working end to end.',
    trigger: 'Manual — admin panel',
    subject: 'Test Email from EventFlow',
    to: 'Admin',
    preview: `✅ SMTP is Working!

Your email configuration is successfully set up.
Now you can send:
  - Email verification links
  - Password reset emails
  - Booking confirmations`,
  },
];

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session || session.user?.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const smtpConfigured =
      Boolean(
        process.env.SMTP_HOST &&
          process.env.SMTP_USER &&
          process.env.SMTP_PASS &&
          process.env.SMTP_FROM
      );

    return NextResponse.json({ templates, smtpConfigured });
  } catch (error) {
    console.error('Email templates error:', error);
    return NextResponse.json(
      { error: 'Failed to load templates' },
      { status: 500 }
    );
  }
}
