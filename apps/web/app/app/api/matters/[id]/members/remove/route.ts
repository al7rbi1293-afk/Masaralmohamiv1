import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { checkRateLimit, getRequestIp, RATE_LIMIT_MESSAGE_AR } from '@/lib/rateLimit';
import { createSupabaseServerRlsClient } from '@/lib/supabase/server';
import { getCurrentAuthUser } from '@/lib/supabase/auth-session';
import { requireOrgIdForUser } from '@/lib/org';
import { logAudit } from '@/lib/audit';
import { logError, logInfo } from '@/lib/logger';

export const runtime = 'nodejs';

const removeSchema = z.object({
  user_id: z.string().uuid('العضو غير صحيح.'),
});

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  const ip = getRequestIp(request);
  const limit = await checkRateLimit({
    key: `matter_members_remove:${ip}`,
    limit: 30,
    windowMs: 10 * 60 * 1000,
  });

  if (!limit.allowed) {
    return NextResponse.json(
      { error: RATE_LIMIT_MESSAGE_AR },
      { status: 429 },
    );
  }

  try {
    const currentUser = await getCurrentAuthUser();
    if (!currentUser) {
      return NextResponse.json({ error: 'الرجاء تسجيل الدخول.' }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const parsed = removeSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? 'تعذر التحقق من البيانات.' },
        { status: 400 },
      );
    }

    const orgId = await requireOrgIdForUser();
    const supabase = createSupabaseServerRlsClient();

    const { data: matter, error: matterError } = await supabase
      .from('matters')
      .select('id, org_id, is_private, assigned_user_id')
      .eq('org_id', orgId)
      .eq('id', params.id)
      .maybeSingle();

    if (matterError) {
      throw matterError;
    }

    if (!matter) {
      return NextResponse.json({ error: 'القضية غير موجودة.' }, { status: 404 });
    }

    if (!(matter as any).is_private) {
      return NextResponse.json(
        { error: 'لا يمكن تعديل الأعضاء إلا في القضايا الخاصة.' },
        { status: 400 },
      );
    }

    const { data: membership, error: membershipError } = await supabase
      .from('memberships')
      .select('role')
      .eq('org_id', orgId)
      .eq('user_id', currentUser.id)
      .maybeSingle();

    if (membershipError) {
      throw membershipError;
    }

    const isOwner = (membership as any)?.role === 'owner';
    const isAssignee = String((matter as any).assigned_user_id ?? '') === currentUser.id;

    if (!isOwner && !isAssignee) {
      return NextResponse.json(
        { error: 'لا تملك صلاحية إدارة أعضاء هذه القضية.' },
        { status: 403 },
      );
    }

    const targetUserId = parsed.data.user_id;

    const { count, error: countError } = await supabase
      .from('matter_members')
      .select('user_id', { count: 'exact', head: true })
      .eq('matter_id', String((matter as any).id));

    if (countError) {
      throw countError;
    }

    if ((count ?? 0) <= 1) {
      const { data: existing, error: existingError } = await supabase
        .from('matter_members')
        .select('user_id')
        .eq('matter_id', String((matter as any).id))
        .eq('user_id', targetUserId)
        .maybeSingle();

      if (existingError) {
        throw existingError;
      }

      if (existing) {
        return NextResponse.json(
          { error: 'لا يمكن إزالة آخر عضو من القضية الخاصة.' },
          { status: 409 },
        );
      }
    }

    const { error: deleteError } = await supabase
      .from('matter_members')
      .delete()
      .eq('matter_id', String((matter as any).id))
      .eq('user_id', targetUserId);

    if (deleteError) {
      throw deleteError;
    }

    await logAudit({
      action: 'matter.member_removed',
      entityType: 'matter',
      entityId: String((matter as any).id),
      meta: { matterId: String((matter as any).id), userIdRemoved: targetUserId },
      req: request,
    });

    logInfo('matter_member_removed', { matterId: String((matter as any).id) });

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (error) {
    const message = toUserMessage(error);
    logError('matter_member_remove_failed', { message });
    const status =
      message === 'الرجاء تسجيل الدخول.'
        ? 401
        : message === 'لا تملك صلاحية إدارة أعضاء هذه القضية.'
          ? 403
          : message === 'لا يمكن إزالة آخر عضو من القضية الخاصة.'
            ? 409
            : 400;
    return NextResponse.json({ error: message }, { status });
  }
}

function toUserMessage(error: unknown) {
  const message = error instanceof Error ? error.message : '';
  const normalized = message.toLowerCase();

  if (
    normalized.includes('permission denied') ||
    normalized.includes('violates row-level security') ||
    normalized.includes('not allowed')
  ) {
    return 'لا تملك صلاحية إدارة أعضاء هذه القضية.';
  }

  if (normalized.includes('not_found') || normalized.includes('no rows')) {
    return 'القضية غير موجودة.';
  }

  return message || 'تعذر إزالة العضو.';
}
