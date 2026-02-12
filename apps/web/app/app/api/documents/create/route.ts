import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createSupabaseServerAuthClient, createSupabaseServerClient } from '@/lib/supabase/server';
import { ACCESS_COOKIE_NAME } from '@/lib/supabase/constants';

const createDocumentSchema = z.object({
  title: z.string().trim().min(1, 'يرجى إدخال عنوان المستند.').max(200, 'العنوان طويل جدًا.'),
  description: z.string().trim().max(2000, 'الوصف طويل جدًا.').optional().or(z.literal('')),
  folder: z.string().trim().max(300, 'اسم المجلد طويل جدًا.').optional().or(z.literal('')),
  tags: z.array(z.string().trim().max(40)).optional(),
  matterId: z.string().uuid().optional().or(z.literal('')),
  clientId: z.string().uuid().optional().or(z.literal('')),
});

type MembershipRow = { org_id: string };

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const parsed = createDocumentSchema.safeParse(body);
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
  const { data: membership, error: membershipError } = await admin
    .from('memberships')
    .select('org_id')
    .eq('user_id', userId)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();

  if (membershipError) {
    return NextResponse.json({ message: 'تعذر التحقق من العضوية.' }, { status: 500 });
  }

  const orgId = (membership as MembershipRow | null)?.org_id ?? null;
  if (!orgId) {
    return NextResponse.json({ message: 'لا يوجد مكتب مرتبط بهذا الحساب بعد.' }, { status: 400 });
  }

  const tags = parsed.data.tags ?? [];
  const folder = parsed.data.folder?.trim() ? parsed.data.folder.trim() : '/';

  const { data, error } = await admin
    .from('documents')
    .insert({
      org_id: orgId,
      title: parsed.data.title,
      description: emptyToNull(parsed.data.description),
      folder,
      tags,
      matter_id: parsed.data.matterId ? parsed.data.matterId : null,
      client_id: parsed.data.clientId ? parsed.data.clientId : null,
    })
    .select('id')
    .single();

  if (error || !data?.id) {
    return NextResponse.json({ message: 'تعذر إنشاء المستند.' }, { status: 500 });
  }

  await admin.from('audit_logs').insert({
    org_id: orgId,
    user_id: userId,
    action: 'document_created',
    entity_type: 'document',
    entity_id: data.id,
    meta: {},
    ip: getRequestIp(request),
    user_agent: request.headers.get('user-agent'),
  });

  return NextResponse.json({ documentId: data.id }, { status: 200 });
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

function emptyToNull(value?: string) {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}

function getRequestIp(request: NextRequest) {
  const forwardedFor = request.headers.get('x-forwarded-for');
  if (!forwardedFor) {
    return null;
  }
  return forwardedFor.split(',')[0]?.trim() ?? null;
}

