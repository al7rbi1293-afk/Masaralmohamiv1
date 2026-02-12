import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createSupabaseServerAuthClient, createSupabaseServerClient } from '@/lib/supabase/server';
import { ACCESS_COOKIE_NAME } from '@/lib/supabase/constants';

const downloadUrlSchema = z.object({
  storage_path: z.string().trim().min(1, 'مسار الملف مطلوب.').max(800),
});

type VersionRow = {
  org_id: string;
  document_id: string;
};

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const parsed = downloadUrlSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { message: parsed.error.issues[0]?.message ?? 'تعذر التحقق من البيانات.' },
      { status: 400 },
    );
  }

  const userId = await getUserIdFromRequest(request);
  if (!userId) {
    return NextResponse.json({ message: 'غير مصرح.' }, { status: 401 });
  }

  const admin = createSupabaseServerClient();
  const { data: versionData, error: versionError } = await admin
    .from('document_versions')
    .select('org_id, document_id')
    .eq('storage_path', parsed.data.storage_path)
    .maybeSingle();

  if (versionError || !versionData) {
    return NextResponse.json({ message: 'الملف غير موجود.' }, { status: 404 });
  }

  const version = versionData as VersionRow;

  const { data: membership, error: membershipError } = await admin
    .from('memberships')
    .select('id')
    .eq('org_id', version.org_id)
    .eq('user_id', userId)
    .limit(1)
    .maybeSingle();

  if (membershipError) {
    return NextResponse.json({ message: 'تعذر التحقق من العضوية.' }, { status: 500 });
  }

  if (!membership) {
    return NextResponse.json({ message: 'غير مصرح.' }, { status: 403 });
  }

  const { data: signed, error: signedError } = await admin.storage
    .from('documents')
    .createSignedUrl(parsed.data.storage_path, 60 * 10);

  if (signedError || !signed?.signedUrl) {
    return NextResponse.json({ message: 'تعذر إنشاء رابط التحميل.' }, { status: 500 });
  }

  await admin.from('audit_logs').insert({
    org_id: version.org_id,
    user_id: userId,
    action: 'document_download_url_created',
    entity_type: 'document',
    entity_id: version.document_id,
    meta: { storage_path: parsed.data.storage_path },
    ip: getRequestIp(request),
    user_agent: request.headers.get('user-agent'),
  });

  return NextResponse.json(
    {
      signedDownloadUrl: signed.signedUrl,
    },
    { status: 200 },
  );
}

async function getUserIdFromRequest(request: NextRequest) {
  const accessToken =
    request.headers.get('x-masar-access-token')?.trim() ||
    request.cookies.get(ACCESS_COOKIE_NAME)?.value?.trim();

  if (!accessToken) {
    return null;
  }

  const auth = createSupabaseServerAuthClient();
  const { data, error } = await auth.auth.getUser(accessToken);
  if (error || !data.user) {
    return null;
  }

  return data.user.id;
}

function getRequestIp(request: NextRequest) {
  const forwardedFor = request.headers.get('x-forwarded-for');
  if (!forwardedFor) {
    return null;
  }
  return forwardedFor.split(',')[0]?.trim() ?? null;
}

