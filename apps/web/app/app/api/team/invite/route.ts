import { NextRequest, NextResponse } from 'next/server';
import { checkRateLimit, getRequestIp, RATE_LIMIT_MESSAGE_AR } from '@/lib/rateLimit';
import { createInvitation, TeamHttpError } from '@/lib/team';
import { logError, logInfo } from '@/lib/logger';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  const ip = getRequestIp(request);
  const limit = checkRateLimit({
    key: `team_invite:${ip}`,
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
    const result = await createInvitation(
      {
        email: (body as any)?.email,
        role: (body as any)?.role,
        expiresIn: (body as any)?.expires_in,
      },
      request,
    );

    logInfo('team_invite_created', {
      email: result.invitation.email,
      role: result.invitation.role,
    });

    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    if (error instanceof TeamHttpError) {
      logError('team_invite_failed', { status: error.status, message: error.message });
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    const message = 'تعذر إنشاء الدعوة. حاول مرة أخرى.';
    logError('team_invite_failed', { message });
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
