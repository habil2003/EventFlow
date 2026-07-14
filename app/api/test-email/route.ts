import { NextResponse } from 'next/server';
import nodemailer from 'nodemailer';

export async function GET() {
  try {
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

    // Send test email
    const info = await transporter.sendMail({
      from: `"EventFlow" <${process.env.SMTP_FROM}>`,
      to: 'habiltamang17@gmail.com', // Replace with your email
      subject: 'Test Email from EventFlow',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h1 style="color: #4f46e5;">✅ Brevo SMTP is Working!</h1>
          <p>Your email configuration is successfully set up.</p>
          <p>Now you can send:</p>
          <ul>
            <li>Email verification links</li>
            <li>Password reset emails</li>
            <li>Booking confirmations</li>
          </ul>
          <hr />
          <p style="color: #666; font-size: 12px;">EventFlow — Nepal's Complete Event Management Solution</p>
        </div>
      `,
    });

    console.log('Email sent:', info.messageId);
    
    return NextResponse.json({ 
      success: true, 
      message: 'Test email sent! Check your inbox.',
      messageId: info.messageId 
    });
  } catch (error) {
    console.error('Test email error:', error);
    
    // ✅ FIX: Handle unknown error type safely
    return NextResponse.json({ 
      error: 'Failed to send email',
      details: error instanceof Error ? error.message : 'Unknown error occurred'
    }, { status: 500 });
  }
}