import { NextRequest, NextResponse } from 'next/server';
import { checkRateLimit, getRequestIp, RATE_LIMIT_MESSAGE_AR } from '@/lib/rateLimit';
import { requireMobileOfficeOwnerContext } from '@/lib/mobile/auth';
import { revokeMobileTeamInvitation } from '@/lib/mobile/team';
import { TeamHttpError } from '@/lib/team';

export const runtime = 'nodejs';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ invitationId: string }> | { invitationId: string } },
) {
  const ip = getRequestIp(request);
  const limit = await checkRateLimit({
    key: `mobile_team_revoke_invite:${ip}`,
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
    await revokeMobileTeamInvitation(auth.context, (await params).invitationId, request);
    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (error) {
    if (error instanceof TeamHttpError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: 'تعذر إلغاء الدعوة. حاول مرة أخرى.' }, { status: 400 });
  }
}
