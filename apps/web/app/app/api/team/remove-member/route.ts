import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { checkRateLimit, getRequestIp } from '@/lib/rateLimit';
import { requireOrgIdForUser } from '@/lib/org';
import { getCurrentAuthUser } from '@/lib/supabase/auth-session';
import { createSupabaseServerClient, createSupabaseServerRlsClient } from '@/lib/supabase/server';
import { logAudit } from '@/lib/audit';
import { logError, logInfo } from '@/lib/logger';

const removeMemberSchema = z.object({
  user_id: z.string().uuid('العضو غير صحيح.'),
});

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
    const parsed = removeMemberSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? 'تعذر التحقق من البيانات.' },
        { status: 400 },
      );
    }

    const user = await getCurrentAuthUser();
    if (!user) {
      return NextResponse.json({ error: 'يرجى تسجيل الدخول.' }, { status: 401 });
    }

    const orgId = await requireOrgIdForUser();
    const supabase = createSupabaseServerRlsClient();

    const { data: membership, error: membershipError } = await supabase
      .from('memberships')
      .select('role')
      .eq('org_id', orgId)
      .eq('user_id', user.id)
      .maybeSingle();

    if (membershipError) {
      throw membershipError;
    }

    if (!membership || membership.role !== 'owner') {
      return NextResponse.json({ error: 'لا تملك صلاحية لهذا الإجراء.' }, { status: 403 });
    }

    const service = createSupabaseServerClient();

    const { data: target, error: targetError } = await service
      .from('memberships')
      .select('id, role')
      .eq('org_id', orgId)
      .eq('user_id', parsed.data.user_id)
      .maybeSingle();

    if (targetError) {
      throw targetError;
    }

    if (!target) {
      return NextResponse.json({ error: 'العضو غير موجود.' }, { status: 404 });
    }

    if (target.role === 'owner') {
      const { count, error: ownersCountError } = await service
        .from('memberships')
        .select('id', { count: 'exact', head: true })
        .eq('org_id', orgId)
        .eq('role', 'owner');

      if (ownersCountError) {
        throw ownersCountError;
      }

      const ownersCount = count ?? 0;
      if (ownersCount <= 1) {
        return NextResponse.json(
          { error: 'لا يمكن إزالة آخر مالك في المكتب.' },
          { status: 400 },
        );
      }
    }

    const { error: deleteError } = await service
      .from('memberships')
      .delete()
      .eq('org_id', orgId)
      .eq('user_id', parsed.data.user_id);

    if (deleteError) {
      throw deleteError;
    }

    await logAudit({
      action: 'team.member_removed',
      entityType: 'membership',
      entityId: target.id,
      meta: {
        user_id: parsed.data.user_id,
        role: target.role,
      },
      req: request,
    });

    logInfo('team_member_removed', { orgId, userId: parsed.data.user_id, role: target.role });

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (error) {
    const message = toUserMessage(error);
    logError('team_remove_member_failed', { message });
    return NextResponse.json({ error: message }, { status: message === 'لا تملك صلاحية لهذا الإجراء.' ? 403 : 400 });
  }
}

function toUserMessage(error: unknown) {
  const message = error instanceof Error ? error.message : '';
  const normalized = message.toLowerCase();

  if (
    normalized.includes('permission denied') ||
    normalized.includes('not allowed') ||
    normalized.includes('violates row-level security')
  ) {
    return 'لا تملك صلاحية لهذا الإجراء.';
  }

  return 'تعذر إزالة العضو. حاول مرة أخرى.';
}

