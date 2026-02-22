import { NextRequest, NextResponse } from 'next/server';
import { logError, logInfo } from '@/lib/logger';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
    // Top-level try-catch: absolutely nothing escapes without a JSON response
    try {
        // --- Rate Limiting (lazy import to isolate failures) ---
        const { checkRateLimit, getRequestIp, RATE_LIMIT_MESSAGE_AR } = await import('@/lib/rateLimit');
        const ip = getRequestIp(request);
        const limit = await checkRateLimit({
            key: `team_add_member:${ip}`,
            limit: 10,
            windowMs: 10 * 60 * 1000,
        });

        if (!limit.allowed) {
            return NextResponse.json(
                { error: RATE_LIMIT_MESSAGE_AR },
                { status: 429 },
            );
        }

        // --- Parse body ---
        const body = await request.json().catch(() => ({}));

        // --- Import addMemberDirect lazily to isolate module-level crashes ---
        const { addMemberDirect } = await import('@/lib/team');

        // --- Execute ---
        await addMemberDirect(body, request);

        logInfo('team_member_added', {
            role: body?.role,
            email: body?.email,
        });

        return NextResponse.json({ success: true }, { status: 201 });
    } catch (error: unknown) {
        // Determine the error message, status, and raw info
        let status = 400;
        let message = 'تعذر إضافة العضو. حاول مرة أخرى.';
        let rawError = '';

        if (error && typeof error === 'object') {
            const err = error as Record<string, unknown>;

            // Check for TeamHttpError (by name or by status property)
            if (err.name === 'TeamHttpError' && typeof err.status === 'number') {
                status = err.status;
                message = String(err.message || message);
            } else if (error instanceof Error) {
                message = error.message || message;
                rawError = error.stack || '';
            }
        } else {
            rawError = String(error);
        }

        logError('team_add_member_failed', { message, status, rawError });
        return NextResponse.json({ error: message, rawError }, { status });
    }
}
