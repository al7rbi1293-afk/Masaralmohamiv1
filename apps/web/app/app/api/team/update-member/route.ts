import { NextRequest, NextResponse } from 'next/server';
import { checkRateLimit, getRequestIp, RATE_LIMIT_MESSAGE_AR } from '@/lib/rateLimit';
import { TeamHttpError, updateMemberProfile } from '@/lib/team';
import { logError, logInfo } from '@/lib/logger';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  const ip = getRequestIp(request);
  const limit = await checkRateLimit({
    key: `team_update_member:${ip}`,
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
    const userId = (body as any)?.user_id;
    const fullName = (body as any)?.full_name;
    const email = (body as any)?.email;
    const phone = (body as any)?.phone;

    await updateMemberProfile(
      {
        userId,
        fullName,
        email,
        phone,
      },
      request,
    );

    logInfo('team_member_updated', { userId });
    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (error) {
    if (error instanceof TeamHttpError) {
      logError('team_member_update_failed', { status: error.status, message: error.message });
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    const message = 'تعذر تحديث بيانات العضو. حاول مرة أخرى.';
    logError('team_member_update_failed', { message });
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
