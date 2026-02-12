import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createSupabaseServerAuthClient, createSupabaseServerClient } from '@/lib/supabase/server';
import { ACCESS_COOKIE_NAME } from '@/lib/supabase/constants';
import { getPublicSiteUrl } from '@/lib/env';

const shareSchema = z.object({
  documentId: z.string().uuid('معرف المستند غير صحيح.'),
  expiresIn: z.enum(['1h', '24h', '7d']).default('24h'),
});

type DocumentRow = { id: string; org_id: string };

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const parsed = shareSchema.safeParse(body);
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
  const { data: documentData, error: documentError } = await admin
    .from('documents')
    .select('id, org_id')
    .eq('id', parsed.data.documentId)
    .maybeSingle();

  if (documentError || !documentData) {
    return NextResponse.json({ message: 'المستند غير موجود.' }, { status: 404 });
  }

  const document = documentData as DocumentRow;
  const { data: membership, error: membershipError } = await admin
    .from('memberships')
    .select('id')
    .eq('org_id', document.org_id)
    .eq('user_id', userId)
    .limit(1)
    .maybeSingle();

  if (membershipError) {
    return NextResponse.json({ message: 'تعذر التحقق من العضوية.' }, { status: 500 });
  }

  if (!membership) {
    return NextResponse.json({ message: 'غير مصرح.' }, { status: 403 });
  }

  const expiresAt = computeExpiry(parsed.data.expiresIn);
  const token = crypto.randomUUID();

  const { error: insertError } = await admin.from('document_shares').insert({
    org_id: document.org_id,
    document_id: document.id,
    token,
    expires_at: expiresAt.toISOString(),
    created_by: userId,
  });

  if (insertError) {
    return NextResponse.json({ message: 'تعذر إنشاء رابط المشاركة.' }, { status: 500 });
  }

  await admin.from('audit_logs').insert({
    org_id: document.org_id,
    user_id: userId,
    action: 'document_shared',
    entity_type: 'document',
    entity_id: document.id,
    meta: { token, expires_at: expiresAt.toISOString() },
    ip: getRequestIp(request),
    user_agent: request.headers.get('user-agent'),
  });

  const baseUrl = getPublicSiteUrl();
  return NextResponse.json(
    {
      token,
      expiresAt: expiresAt.toISOString(),
      shareUrl: `${baseUrl}/share/${token}`,
    },
    { status: 200 },
  );
}

function computeExpiry(expiresIn: '1h' | '24h' | '7d') {
  const now = Date.now();
  if (expiresIn === '1h') return new Date(now + 60 * 60 * 1000);
  if (expiresIn === '7d') return new Date(now + 7 * 24 * 60 * 60 * 1000);
  return new Date(now + 24 * 60 * 60 * 1000);
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

