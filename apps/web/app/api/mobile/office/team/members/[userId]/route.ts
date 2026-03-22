import { NextRequest, NextResponse } from 'next/server';
import { checkRateLimit, getRequestIp, RATE_LIMIT_MESSAGE_AR } from '@/lib/rateLimit';
import { requireMobileOfficeOwnerContext } from '@/lib/mobile/auth';
import {
  changeMobileTeamMemberRole,
  removeMobileTeamMember,
  updateMobileTeamMemberProfile,
} from '@/lib/mobile/team';
import { TeamHttpError } from '@/lib/team';

export const runtime = 'nodejs';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> | { userId: string } },
) {
  const ip = getRequestIp(request);
  const limit = await checkRateLimit({
    key: `mobile_team_update_member:${ip}`,
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
    const userId = (await params).userId;
    const payload =
      body && typeof body === 'object'
        ? { ...(body as Record<string, unknown>), userId }
        : { userId };
    await updateMobileTeamMemberProfile(auth.context, payload, request);
    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (error) {
    if (error instanceof TeamHttpError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: 'تعذر تحديث بيانات العضو. حاول مرة أخرى.' }, { status: 400 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> | { userId: string } },
) {
  const ip = getRequestIp(request);
  const limit = await checkRateLimit({
    key: `mobile_team_member_action:${ip}`,
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
    const userId = (await params).userId;
    const action = String((body as { action?: unknown }).action || '').trim().toLowerCase();
    const hasRole = Boolean(body && typeof body === 'object' && 'role' in body);

    if (action === 'role' || (!action && hasRole)) {
      await changeMobileTeamMemberRole(auth.context, userId, body, request);
      return NextResponse.json({ ok: true }, { status: 200 });
    }

    const shouldRemove =
      action === 'remove' ||
      Boolean(body && typeof body === 'object' && ((body as { remove?: unknown }).remove === true || (body as { action?: unknown }).action === 'remove'));

    if (shouldRemove) {
      await removeMobileTeamMember(auth.context, userId, request);
      return NextResponse.json({ ok: true }, { status: 200 });
    }

    return NextResponse.json({ error: 'الإجراء غير صالح.' }, { status: 400 });
  } catch (error) {
    if (error instanceof TeamHttpError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: 'تعذر تنفيذ الطلب. حاول مرة أخرى.' }, { status: 400 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> | { userId: string } },
) {
  const ip = getRequestIp(request);
  const limit = await checkRateLimit({
    key: `mobile_team_remove_member:${ip}`,
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
    await removeMobileTeamMember(auth.context, (await params).userId, request);
    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (error) {
    if (error instanceof TeamHttpError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: 'تعذر إزالة العضو. حاول مرة أخرى.' }, { status: 400 });
  }
}
