import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { checkRateLimit, getRequestIp } from '@/lib/rateLimit';
import { requireOrgIdForUser } from '@/lib/org';
import { getCurrentAuthUser } from '@/lib/supabase/auth-session';
import { createSupabaseServerClient, createSupabaseServerRlsClient } from '@/lib/supabase/server';
import { logAudit } from '@/lib/audit';
import { logError, logInfo } from '@/lib/logger';

const payloadSchema = z.object({
  user_id: z.string().uuid('العضو غير صحيح.'),
});

export async function POST(request: NextRequest, context: { params: { id: string } }) {
  const ip = getRequestIp(request);
  const limit = checkRateLimit({
    key: `matter_member_remove:${ip}`,
    limit: 20,
    windowMs: 10 * 60 * 1000,
  });

  if (!limit.allowed) {
    return NextResponse.json({ error: 'طلبات كثيرة. حاول لاحقًا.' }, { status: 429 });
  }

  try {
    const matterId = String(context.params.id || '').trim();
    if (!matterId) {
      return NextResponse.json({ error: 'القضية غير صحيحة.' }, { status: 400 });
    }

    const body = await request.json().catch(() => ({}));
    const parsed = payloadSchema.safeParse(body);
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

    const [{ data: membership }, { data: matter, error: matterError }] = await Promise.all([
      supabase
        .from('memberships')
        .select('role')
        .eq('org_id', orgId)
        .eq('user_id', user.id)
        .maybeSingle(),
      supabase
        .from('matters')
        .select('id, org_id, is_private, assigned_user_id')
        .eq('org_id', orgId)
        .eq('id', matterId)
        .maybeSingle(),
    ]);

    if (matterError || !matter) {
      return NextResponse.json({ error: 'القضية غير موجودة أو لا تملك صلاحية الوصول.' }, { status: 404 });
    }

    if (!matter.is_private) {
      return NextResponse.json({ error: 'هذه القضية ليست خاصة.' }, { status: 400 });
    }

    const isOwner = membership?.role === 'owner';
    const isAssignee = matter.assigned_user_id === user.id;
    if (!isOwner && !isAssignee) {
      return NextResponse.json({ error: 'لا تملك صلاحية لهذا الإجراء.' }, { status: 403 });
    }

    const service = createSupabaseServerClient();

    const { count: memberCount, error: countError } = await service
      .from('matter_members')
      .select('user_id', { count: 'exact', head: true })
      .eq('matter_id', matterId);

    if (countError) {
      throw countError;
    }

    if ((memberCount ?? 0) <= 1) {
      return NextResponse.json({ error: 'لا يمكن إزالة آخر عضو من القضية الخاصة.' }, { status: 400 });
    }

    const { error: deleteError } = await service
      .from('matter_members')
      .delete()
      .eq('matter_id', matterId)
      .eq('user_id', parsed.data.user_id);

    if (deleteError) {
      throw deleteError;
    }

    await logAudit({
      action: 'matter.member_removed',
      entityType: 'matter_member',
      meta: { matter_id: matterId, user_id: parsed.data.user_id },
      req: request,
    });

    logInfo('matter_member_removed', { matterId, userId: parsed.data.user_id });
    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (error) {
    const message = toUserMessage(error);
    logError('matter_member_remove_failed', { message });
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

