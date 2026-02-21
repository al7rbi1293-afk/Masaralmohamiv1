import { NextRequest, NextResponse } from 'next/server';
import { checkRateLimit, getRequestIp, RATE_LIMIT_MESSAGE_AR } from '@/lib/rateLimit';
import { revokeInvitation, TeamHttpError } from '@/lib/team';
import { logError, logInfo } from '@/lib/logger';

export async function POST(request: NextRequest) {
  const ip = getRequestIp(request);
  const limit = await checkRateLimit({
    key: `team_revoke:${ip}`,
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
    const invitationId = (body as any)?.invitation_id;

    await revokeInvitation({ invitationId }, request);

    logInfo('team_invite_revoked', { invitationId });
    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (error) {
    if (error instanceof TeamHttpError) {
      logError('team_invite_revoke_failed', { status: error.status, message: error.message });
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    const message = 'تعذر إلغاء الدعوة. حاول مرة أخرى.';
    logError('team_invite_revoke_failed', { message });
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
