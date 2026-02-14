import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireOrgIdForUser } from '@/lib/org';
import { createSupabaseServerClient, createSupabaseServerRlsClient } from '@/lib/supabase/server';
import { logAudit } from '@/lib/audit';
import { logError, logInfo, logWarn } from '@/lib/logger';
import { CircuitOpenError, TimeoutError, withCircuitBreaker, withTimeout } from '@/lib/runtime-safety';

const uploadUrlSchema = z.object({
  document_id: z.string().uuid(),
  file_name: z.string().trim().min(1, 'اسم الملف مطلوب.').max(255, 'اسم الملف طويل جدًا.'),
  file_size: z.number().int().positive('حجم الملف غير صالح.'),
  mime_type: z.string().trim().max(150).optional().or(z.literal('')),
});

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const parsed = uploadUrlSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? 'تعذر تجهيز رابط الرفع.' },
        { status: 400 },
      );
    }

    const orgId = await requireOrgIdForUser();
    const rls = createSupabaseServerRlsClient();

    const { data: document, error: docError } = await rls
      .from('documents')
      .select('id, org_id')
      .eq('org_id', orgId)
      .eq('id', parsed.data.document_id)
      .maybeSingle();

    if (docError) {
      logError('document_upload_requested_failed', { message: docError.message });
      return NextResponse.json({ error: 'تعذر تجهيز رابط الرفع.' }, { status: 400 });
    }

    if (!document) {
      return NextResponse.json({ error: 'لا تملك صلاحية الوصول.' }, { status: 403 });
    }

    const { data: latestVersion, error: versionError } = await rls
      .from('document_versions')
      .select('version_no')
      .eq('org_id', orgId)
      .eq('document_id', parsed.data.document_id)
      .order('version_no', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (versionError) {
      logError('document_upload_version_fetch_failed', { message: versionError.message });
      return NextResponse.json({ error: 'تعذر تجهيز رابط الرفع.' }, { status: 400 });
    }

    const nextVersionNo = (latestVersion?.version_no ?? 0) + 1;
    const safeFileName = toSafeFileName(parsed.data.file_name);
    const storagePath = buildStoragePath(orgId, parsed.data.document_id, nextVersionNo, safeFileName);

    const service = createSupabaseServerClient();
    let signed: { signedUrl: string; token: string } | null = null;
    let signError: { message?: string } | null = null;
    try {
      const result = (await withCircuitBreaker(
        'storage.signed_upload_url',
        { failureThreshold: 3, cooldownMs: 30_000 },
        () =>
          withTimeout(
            service.storage.from('documents').createSignedUploadUrl(storagePath),
            8_000,
            'تعذر تجهيز رابط الرفع. حاول مرة أخرى.',
          ),
      )) as { data: { signedUrl: string; token: string } | null; error: { message?: string } | null };
      signed = result.data;
      signError = result.error;
    } catch (error) {
      if (error instanceof TimeoutError || error instanceof CircuitOpenError) {
        logWarn('document_upload_sign_transient', { message: error.message });
        return NextResponse.json(
          { error: 'الخدمة غير متاحة مؤقتًا. حاول مرة أخرى بعد قليل.' },
          { status: 503 },
        );
      }

      throw error;
    }

    if (signError || !signed) {
      logError('document_upload_sign_failed', { message: signError?.message ?? 'unknown' });
      return NextResponse.json({ error: 'تعذر تجهيز رابط الرفع.' }, { status: 500 });
    }

    logInfo('document_upload_requested', {
      documentId: parsed.data.document_id,
      versionNo: nextVersionNo,
      fileSize: parsed.data.file_size,
    });

    await logAudit({
      action: 'document.upload_url_issued',
      entityType: 'document',
      entityId: parsed.data.document_id,
      meta: { version_no: nextVersionNo, file_size: parsed.data.file_size },
      req: request,
    });

    return NextResponse.json(
      {
        bucket: 'documents',
        storage_path: storagePath,
        version_no: nextVersionNo,
        token: signed.token,
        signedUrl: signed.signedUrl,
      },
      { status: 200 },
    );
  } catch (error) {
    logError('document_upload_requested_failed', {
      message: error instanceof Error ? error.message : 'unknown',
    });
    return NextResponse.json({ error: 'تعذر تجهيز رابط الرفع.' }, { status: 500 });
  }
}

function buildStoragePath(orgId: string, documentId: string, versionNo: number, fileName: string) {
  return `org/${orgId}/doc/${documentId}/v${versionNo}/${fileName}`;
}

function toSafeFileName(value: string) {
  const cleaned = value
    .replaceAll('\\', '_')
    .replaceAll('/', '_')
    .replaceAll('\u0000', '')
    .trim();

  const parts = cleaned.split('.').filter(Boolean);
  const ext = parts.length > 1 ? parts[parts.length - 1] : '';
  const base = parts.length > 1 ? parts.slice(0, -1).join('.') : cleaned;

  const safeBase = base
    .replace(/[^A-Za-z0-9 _-]/g, '_')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 80) || 'file';

  const safeExt = ext
    .replace(/[^A-Za-z0-9]/g, '')
    .slice(0, 12);

  return safeExt ? `${safeBase}.${safeExt}` : safeBase;
}
