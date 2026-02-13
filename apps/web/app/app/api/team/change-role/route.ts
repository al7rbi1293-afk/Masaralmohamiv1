import { NextRequest, NextResponse } from 'next/server';
import { checkRateLimit, getRequestIp } from '@/lib/rateLimit';
import { changeMemberRole, TeamHttpError } from '@/lib/team';
import { logError, logInfo } from '@/lib/logger';

export async function POST(request: NextRequest) {
  const ip = getRequestIp(request);
  const limit = checkRateLimit({
    key: `team_change_role:${ip}`,
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
    const role = (body as any)?.role;

    await changeMemberRole({ userId, role }, request);

    logInfo('team_role_changed', { userId, role });
    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (error) {
    if (error instanceof TeamHttpError) {
      logError('team_role_change_failed', { status: error.status, message: error.message });
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    const message = 'تعذر تحديث الدور. حاول مرة أخرى.';
    logError('team_role_change_failed', { message });
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

