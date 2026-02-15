import { NextResponse } from 'next/server';
import { sendEmail } from '@/lib/email';
import { getSmtpEnv, isSmtpConfigured } from '@/lib/env';

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const targetEmail = searchParams.get('to');

        if (!targetEmail) {
            return NextResponse.json(
                { error: 'Missing "to" query parameter. Usage: /api/test-email?to=your@email.com' },
                { status: 400 }
            );
        }

        const configured = isSmtpConfigured();
        let envDebug = {};

        try {
            const env = getSmtpEnv();
            envDebug = {
                host: env.host,
                port: env.port,
                user: env.user,
                from: env.from,
                passConfigured: !!env.pass, // Don't leak the password
            };
        } catch (e: any) {
            envDebug = { error: e.message };
        }

        if (!configured) {
            return NextResponse.json(
                {
                    error: 'SMTP not configured',
                    debug: envDebug
                },
                { status: 500 }
            );
        }

        await sendEmail({
            to: targetEmail,
            subject: 'Test Email from Masar Al-Muhami (Debug)',
            text: 'This is a test email to verify SMTP configuration.',
            html: '<p>This is a <strong>test email</strong> to verify SMTP configuration.</p>',
        });

        return NextResponse.json({
            success: true,
            message: 'Email sent successfully',
            debug: envDebug
        });

    } catch (error: any) {
        console.error('Test email failed:', error);
        return NextResponse.json(
            {
                success: false,
                error: error.message,
                stack: error.stack
            },
            { status: 500 }
        );
    }
}
