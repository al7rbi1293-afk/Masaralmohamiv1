import { NextRequest, NextResponse } from 'next/server';
import { checkRateLimit, getRequestIp, RATE_LIMIT_MESSAGE_AR } from '@/lib/rateLimit';
import { addMemberDirect, TeamHttpError } from '@/lib/team';
import { logError, logInfo } from '@/lib/logger';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
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

    try {
        const body = await request.json().catch(() => ({}));
        await addMemberDirect(body, request);

        logInfo('team_member_added', {
            role: body?.role,
            email: body?.email,
        });

        return NextResponse.json({ success: true }, { status: 201 });
    } catch (error: any) {
        if (error && error.name === 'TeamHttpError') {
            logError('team_add_member_failed', { status: error.status, message: error.message });
            return NextResponse.json({ error: error.message }, { status: error.status });
        }

        const message = error instanceof Error ? error.message : 'تعذر إضافة العضو. حاول مرة أخرى.';
        logError('team_add_member_failed', { message, stack: error instanceof Error ? error.stack : undefined });
        return NextResponse.json({ error: message, rawError: String(error) }, { status: 400 });
    }
}
