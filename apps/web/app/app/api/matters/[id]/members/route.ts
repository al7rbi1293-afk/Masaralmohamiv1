import { NextResponse } from 'next/server';
import { createSupabaseServerRlsClient } from '@/lib/supabase/server';
import { getCurrentAuthUser } from '@/lib/supabase/auth-session';
import { requireOrgIdForUser } from '@/lib/org';
import { enrichOrgMembers } from '@/lib/matter-members';
import { logError } from '@/lib/logger';

export const runtime = 'nodejs';

export async function GET(
  _request: Request,
  { params }: { params: { id: string } },
) {
  try {
    const user = await getCurrentAuthUser();
    if (!user) {
      return NextResponse.json({ error: 'الرجاء تسجيل الدخول.' }, { status: 401 });
    }

    const orgId = await requireOrgIdForUser();
    const supabase = createSupabaseServerRlsClient();

    const { data: matter, error: matterError } = await supabase
      .from('matters')
      .select('id, org_id, is_private')
      .eq('org_id', orgId)
      .eq('id', params.id)
      .maybeSingle();

    if (matterError) {
      throw matterError;
    }

    if (!matter) {
      return NextResponse.json({ error: 'القضية غير موجودة.' }, { status: 404 });
    }

    const { data: members, error: membersError } = await supabase
      .from('matter_members')
      .select('user_id')
      .eq('matter_id', params.id);

    if (membersError) {
      throw membersError;
    }

    const userIds = ((members as any[] | null) ?? [])
      .map((row) => String(row.user_id ?? '').trim())
      .filter(Boolean);

    const enriched = await enrichOrgMembers(String((matter as any).org_id), userIds);

    return NextResponse.json({ members: enriched }, { status: 200 });
  } catch (error) {
    const message = toUserMessage(error);
    logError('matter_members_list_failed', { message });
    const status = message === 'الرجاء تسجيل الدخول.' ? 401 : 400;
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
    return 'لا تملك صلاحية الوصول.';
  }

  return message || 'تعذر تحميل الأعضاء. حاول مرة أخرى.';
}

