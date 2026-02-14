import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireOrgIdForUser } from '@/lib/org';
import { createSupabaseServerClient, createSupabaseServerRlsClient } from '@/lib/supabase/server';
import { logAudit } from '@/lib/audit';
import { logError, logInfo, logWarn } from '@/lib/logger';
import { CircuitOpenError, TimeoutError, withCircuitBreaker, withTimeout } from '@/lib/runtime-safety';

const downloadSchema = z.object({
  storage_path: z.string().trim().min(1, 'مسار الملف مطلوب.').max(800, 'مسار الملف طويل جدًا.'),
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

    const { data: version, error: versionError } = await rls
      .from('template_versions')
      .select('id, template_id')
      .eq('org_id', orgId)
      .eq('storage_path', parsed.data.storage_path)
      .maybeSingle();

    if (versionError) {
      logError('template_download_lookup_failed', { message: versionError.message });
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
        'storage.templates.signed_download_url',
        { failureThreshold: 3, cooldownMs: 30_000 },
        () =>
          withTimeout(
            service.storage.from('templates').createSignedUrl(parsed.data.storage_path, 300),
            8_000,
            'تعذر تجهيز رابط التنزيل. حاول مرة أخرى.',
          ),
      )) as { data: { signedUrl: string } | null; error: { message?: string } | null };

      signedUrl = result.data?.signedUrl ?? null;
      signError = result.error;
    } catch (error) {
      if (error instanceof TimeoutError || error instanceof CircuitOpenError) {
        logWarn('template_download_sign_transient', { message: error.message });
        return NextResponse.json(
          { error: 'الخدمة غير متاحة مؤقتًا. حاول مرة أخرى بعد قليل.' },
          { status: 503 },
        );
      }
      throw error;
    }

    if (signError || !signedUrl) {
      logError('template_download_sign_failed', { message: signError?.message ?? 'unknown' });
      return NextResponse.json({ error: 'تعذر تجهيز رابط التنزيل.' }, { status: 500 });
    }

    logInfo('template_download_signed', { templateId: version.template_id });

    await logAudit({
      action: 'template.download_signed',
      entityType: 'template',
      entityId: version.template_id,
      meta: {},
      req: request,
    });

    return NextResponse.json({ signedDownloadUrl: signedUrl }, { status: 200 });
  } catch (error) {
    logError('template_download_failed', {
      message: error instanceof Error ? error.message : 'unknown',
    });
    return NextResponse.json({ error: 'تعذر تجهيز رابط التنزيل.' }, { status: 500 });
  }
}

