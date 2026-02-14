import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireOrgIdForUser } from '@/lib/org';
import { createSupabaseServerClient, createSupabaseServerRlsClient } from '@/lib/supabase/server';
import { logError, logInfo, logWarn } from '@/lib/logger';
import { CircuitOpenError, TimeoutError, withCircuitBreaker, withTimeout } from '@/lib/runtime-safety';

const downloadSchema = z.object({
  storage_path: z.string().trim().min(5, 'المسار غير صالح.').max(800),
});

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const parsed = downloadSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? 'تعذر تجهيز رابط التنزيل.' },
        { status: 400 },
      );
    }

    const orgId = await requireOrgIdForUser();
    const rls = createSupabaseServerRlsClient();

    const { data: version, error } = await rls
      .from('document_versions')
      .select('id, document_id, storage_path')
      .eq('org_id', orgId)
      .eq('storage_path', parsed.data.storage_path)
      .maybeSingle();

    if (error) {
      logError('document_download_signed_failed', { message: error.message });
      return NextResponse.json({ error: 'تعذر تجهيز رابط التنزيل.' }, { status: 400 });
    }

    if (!version) {
      return NextResponse.json({ error: 'لا تملك صلاحية الوصول.' }, { status: 403 });
    }

    const service = createSupabaseServerClient();
    let signedUrl: string | null = null;
    let signError: { message?: string } | null = null;
    try {
      const result = (await withCircuitBreaker(
        'storage.signed_download_url',
        { failureThreshold: 3, cooldownMs: 30_000 },
        () =>
          withTimeout(
            service.storage.from('documents').createSignedUrl(parsed.data.storage_path, 300),
            6_000,
            'تعذر تجهيز رابط التنزيل. حاول مرة أخرى.',
          ),
      )) as { data: { signedUrl: string } | null; error: { message?: string } | null };
      signedUrl = result.data?.signedUrl ?? null;
      signError = result.error;
    } catch (error) {
      if (error instanceof TimeoutError || error instanceof CircuitOpenError) {
        logWarn('document_download_signed_transient', { message: error.message });
        return NextResponse.json(
          { error: 'الخدمة غير متاحة مؤقتًا. حاول مرة أخرى بعد قليل.' },
          { status: 503 },
        );
      }
      throw error;
    }

    if (signError || !signedUrl) {
      logError('document_download_signed_failed', { message: signError?.message ?? 'unknown' });
      return NextResponse.json({ error: 'تعذر تجهيز رابط التنزيل.' }, { status: 500 });
    }

    logInfo('document_download_signed', { storagePath: parsed.data.storage_path });
    return NextResponse.json({ signedDownloadUrl: signedUrl }, { status: 200 });
  } catch (error) {
    logError('document_download_signed_failed', {
      message: error instanceof Error ? error.message : 'unknown',
    });
    return NextResponse.json({ error: 'تعذر تجهيز رابط التنزيل.' }, { status: 500 });
  }
}
