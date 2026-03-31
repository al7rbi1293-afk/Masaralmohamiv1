import { NextRequest, NextResponse } from 'next/server';
import { checkRateLimit, getRequestIp, RATE_LIMIT_MESSAGE_AR } from '@/lib/rateLimit';
import { requireMobileOfficeOwnerContext } from '@/lib/mobile/auth';
import { addMobileTeamMemberDirect } from '@/lib/mobile/team';
import { TeamHttpError } from '@/lib/team';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  const ip = getRequestIp(request);
  const limit = await checkRateLimit({
    key: `mobile_team_add_member:${ip}`,
    limit: 10,
    windowMs: 10 * 60 * 1000,
  });

  if (!limit.allowed) {
    return NextResponse.json({ error: RATE_LIMIT_MESSAGE_AR }, { status: 429 });
  }

  const auth = await requireMobileOfficeOwnerContext(request);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const body = await request.json().catch(() => ({}));
    const result = await addMobileTeamMemberDirect(auth.context, body, request);
    return NextResponse.json({ ok: true, emailStatus: result.emailStatus }, { status: 201 });
  } catch (error) {
    if (error instanceof TeamHttpError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: 'تعذر إضافة العضو. حاول مرة أخرى.' }, { status: 400 });
  }
}
