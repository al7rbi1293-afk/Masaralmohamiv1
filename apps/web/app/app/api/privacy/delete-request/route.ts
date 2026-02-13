import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireOwner } from '@/lib/org';
import { getCurrentAuthUser } from '@/lib/supabase/auth-session';
import { createSupabaseServerRlsClient } from '@/lib/supabase/server';
import { logError, logInfo } from '@/lib/logger';

export const runtime = 'nodejs';

const bodySchema = z.object({
  message: z.string().trim().max(2000, 'الرسالة طويلة جدًا.').optional(),
});

type ProfileRow = {
  full_name: string | null;
  phone: string | null;
};

type OrgRow = {
  name: string;
};

function isMissingColumnError(message?: string) {
  const normalized = String(message ?? '').toLowerCase();
  return normalized.includes('column') && normalized.includes('does not exist');
}

export async function POST(request: NextRequest) {
  let orgId = '';
  let userId = '';

  try {
    const owner = await requireOwner();
    orgId = owner.orgId;
    userId = owner.userId;
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    if (message === 'الرجاء تسجيل الدخول.') {
      return NextResponse.json({ error: message }, { status: 401 });
    }
    if (message === 'لا تملك صلاحية تنفيذ هذا الإجراء.') {
      return NextResponse.json({ error: 'لا تملك صلاحية الوصول.' }, { status: 403 });
    }
    return NextResponse.json({ error: message || 'تعذر تنفيذ الطلب.' }, { status: 400 });
  }

  const user = await getCurrentAuthUser();
  if (!user?.email) {
    return NextResponse.json({ error: 'الرجاء تسجيل الدخول.' }, { status: 401 });
  }

  let payload: unknown = {};
  try {
    payload = await request.json();
  } catch {
    payload = {};
  }

  const parsed = bodySchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'تعذر التحقق من البيانات.' },
      { status: 400 },
    );
  }

  const supabase = createSupabaseServerRlsClient();

  try {
    const [profileResult, orgResult] = await Promise.all([
      supabase
        .from('profiles')
        .select('full_name, phone')
        .eq('user_id', userId)
        .maybeSingle(),
      supabase.from('organizations').select('name').eq('id', orgId).maybeSingle(),
    ]);

    if (profileResult.error) throw profileResult.error;
    if (orgResult.error) throw orgResult.error;

    const profile = profileResult.data as ProfileRow | null;
    const org = orgResult.data as OrgRow | null;

    const message = parsed.data.message?.trim() || 'طلب حذف بيانات المكتب';

    const { error: insertError } = await supabase.from('full_version_requests').insert({
      org_id: orgId,
      user_id: userId,
      full_name: profile?.full_name ?? null,
      email: user.email.toLowerCase(),
      phone: profile?.phone ?? null,
      firm_name: org?.name ?? null,
      message,
      source: 'app',
      type: 'delete_request',
    } as any);

    if (insertError) {
      if (isMissingColumnError(insertError.message)) {
        return NextResponse.json(
          { error: 'لم يتم إعداد نموذج طلب الحذف بعد. تأكد من تطبيق مِجريشن Phase 9.2.1.' },
          { status: 500 },
        );
      }
      throw insertError;
    }

    logInfo('org_delete_request_created', { orgId });

    return NextResponse.json(
      {
        ok: true,
        message: 'تم استلام طلب حذف البيانات. سنتواصل معك لتأكيد الهوية.',
      },
      { status: 200 },
    );
  } catch (error) {
    logError('org_delete_request_failed', {
      orgId,
      message: error instanceof Error ? error.message : 'unknown_error',
    });
    return NextResponse.json({ error: 'تعذر إرسال الطلب. حاول مرة أخرى.' }, { status: 500 });
  }
}

