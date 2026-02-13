import { NextRequest, NextResponse } from 'next/server';
import { checkRateLimit, getRequestIp } from '@/lib/rateLimit';
import { removeMember, TeamHttpError } from '@/lib/team';
import { logError, logInfo } from '@/lib/logger';

export async function POST(request: NextRequest) {
  const ip = getRequestIp(request);
  const limit = checkRateLimit({
    key: `team_remove_member:${ip}`,
    limit: 10,
    windowMs: 10 * 60 * 1000,
  });

  if (!limit.allowed) {
    return NextResponse.json(
      { error: 'تم إرسال طلبات كثيرة. حاول لاحقًا.' },
      { status: 429 },
    );
  }

  try {
    const body = await request.json().catch(() => ({}));
    const userId = (body as any)?.user_id;

    await removeMember({ userId }, request);

    logInfo('team_member_removed', { userId });
    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (error) {
    if (error instanceof TeamHttpError) {
      logError('team_remove_member_failed', { status: error.status, message: error.message });
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    const message = 'تعذر إزالة العضو. حاول مرة أخرى.';
    logError('team_remove_member_failed', { message });
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

