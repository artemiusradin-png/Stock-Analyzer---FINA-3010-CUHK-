import { NextRequest, NextResponse } from 'next/server';

// Your email address where contact form messages will be sent
const RECIPIENT_EMAIL = 'artemis.radin.work@gmail.com';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, email, message } = body;

    if (!name || !email || !message) {
      return NextResponse.json(
        { error: 'Name, email, and message are required' },
        { status: 400 }
      );
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: 'Invalid email format' },
        { status: 400 }
      );
    }

    // Try to use Resend if API key is configured
    if (process.env.RESEND_API_KEY) {
      try {
        // Dynamic import to avoid build errors if Resend is not installed
        const { Resend } = await import('resend');
        const resend = new Resend(process.env.RESEND_API_KEY);
        
        await resend.emails.send({
          from: process.env.RESEND_FROM_EMAIL || 'contact@arqam.com',
          to: RECIPIENT_EMAIL,
          reply_to: email,
          subject: `Contact Form: ${name}`,
          html: `
            <h2>New Contact Form Submission</h2>
            <p><strong>Name:</strong> ${name}</p>
            <p><strong>Email:</strong> ${email}</p>
            <p><strong>Message:</strong></p>
            <p style="white-space: pre-wrap;">${message.replace(/\n/g, '<br>')}</p>
          `,
        });

        return NextResponse.json({
          success: true,
          message: 'Message sent successfully',
        });
      } catch (resendError: any) {
        console.error('Resend error:', resendError);
        // Fall through to fallback method
      }
    }

    // Fallback: Use a simple email service via fetch (e.g., EmailJS, Formspree, or similar)
    // Or log and return success (for development)
    console.log('Contact form submission:', { name, email, message });
    console.log('To set up email sending, add RESEND_API_KEY to your .env file');
    console.log('Or configure another email service in this API route');

    // For development: return success even without email service
    // In production, you should configure an email service
    return NextResponse.json({
      success: true,
      message: 'Message received. Email service not configured - check server logs.',
    });
  } catch (error: any) {
    console.error('Contact form error:', error);
    return NextResponse.json(
      { error: 'Failed to send message. Please try again.' },
      { status: 500 }
    );
  }
}
