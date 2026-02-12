import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createSupabaseServerAuthClient, createSupabaseServerClient } from '@/lib/supabase/server';
import { ACCESS_COOKIE_NAME } from '@/lib/supabase/constants';

const uploadUrlSchema = z.object({
  documentId: z.string().uuid('معرف المستند غير صحيح.'),
  fileName: z.string().trim().min(1, 'يرجى اختيار ملف.').max(255, 'اسم الملف طويل جدًا.'),
  mimeType: z.string().trim().max(120).optional().or(z.literal('')),
  fileSize: z.number().int().nonnegative(),
});

type MembershipRow = { org_id: string };
type VersionRow = { version_no: number };
type DocumentRow = { id: string; org_id: string };

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const parsed = uploadUrlSchema.safeParse(body);
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

  const { data: documentData, error: documentError } = await admin
    .from('documents')
    .select('id, org_id')
    .eq('id', parsed.data.documentId)
    .maybeSingle();

  if (documentError || !documentData) {
    return NextResponse.json({ message: 'المستند غير موجود.' }, { status: 404 });
  }

  const document = documentData as DocumentRow;
  if (document.org_id !== orgId) {
    return NextResponse.json({ message: 'غير مصرح.' }, { status: 403 });
  }

  const { data: latestVersionData } = await admin
    .from('document_versions')
    .select('version_no')
    .eq('org_id', orgId)
    .eq('document_id', document.id)
    .order('version_no', { ascending: false })
    .limit(1)
    .maybeSingle();

  const latest = (latestVersionData as VersionRow | null)?.version_no ?? 0;
  const versionNo = latest + 1;

  const safeFileName = sanitizeFileName(parsed.data.fileName);
  const storagePath = `org/${orgId}/doc/${document.id}/v${versionNo}/${safeFileName}`;

  const { data: versionRow, error: versionError } = await admin
    .from('document_versions')
    .insert({
      org_id: orgId,
      document_id: document.id,
      version_no: versionNo,
      storage_path: storagePath,
      file_name: safeFileName,
      file_size: parsed.data.fileSize,
      mime_type: parsed.data.mimeType || null,
      checksum: null,
      uploaded_by: userId,
    })
    .select('id')
    .single();

  if (versionError || !versionRow?.id) {
    return NextResponse.json({ message: 'تعذر إنشاء نسخة المستند.' }, { status: 500 });
  }

  const bucketReady = await ensureDocumentsBucket(admin);
  if (!bucketReady) {
    return NextResponse.json(
      { message: 'إعداد التخزين غير مكتمل. يرجى إنشاء حاوية documents في Supabase Storage.' },
      { status: 500 },
    );
  }

  const { data: signed, error: signedError } = await admin.storage
    .from('documents')
    // supabase-js returns { signedUrl, path, token }
    .createSignedUploadUrl(storagePath);

  if (signedError || !signed?.signedUrl) {
    return NextResponse.json({ message: 'تعذر إنشاء رابط الرفع.' }, { status: 500 });
  }

  await admin.from('audit_logs').insert({
    org_id: orgId,
    user_id: userId,
    action: 'document_version_created',
    entity_type: 'document',
    entity_id: document.id,
    meta: { versionNo, storagePath },
    ip: getRequestIp(request),
    user_agent: request.headers.get('user-agent'),
  });

  return NextResponse.json(
    {
      documentId: document.id,
      versionId: versionRow.id,
      versionNo,
      storage_path: storagePath,
      signedUploadUrl: signed.signedUrl,
      token: signed.token,
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

function sanitizeFileName(input: string) {
  const normalized = input.replaceAll('\\', '/');
  const last = normalized.split('/').pop() ?? 'file';
  return last.replaceAll(/[^A-Za-z0-9._-]/g, '_').slice(0, 120) || 'file';
}

function getRequestIp(request: NextRequest) {
  const forwardedFor = request.headers.get('x-forwarded-for');
  if (!forwardedFor) {
    return null;
  }
  return forwardedFor.split(',')[0]?.trim() ?? null;
}

async function ensureDocumentsBucket(admin: ReturnType<typeof createSupabaseServerClient>) {
  try {
    const { data } = await admin.storage.getBucket('documents');
    if (data?.name) {
      return true;
    }
  } catch {
    // ignore
  }

  const { error } = await admin.storage.createBucket('documents', { public: false }).catch((err) => ({
    error: err,
  }));

  if (!error) {
    return true;
  }

  // If it already exists (race), treat as ready.
  const message = typeof (error as any)?.message === 'string' ? (error as any).message.toLowerCase() : '';
  if (message.includes('already exists')) {
    return true;
  }

  return false;
}
