import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireOrgIdForUser } from '@/lib/org';
import { createSupabaseServerClient, createSupabaseServerRlsClient } from '@/lib/supabase/server';
import { logError, logInfo } from '@/lib/logger';

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
    const { data: signed, error: signError } = await service.storage
      .from('documents')
      .createSignedUrl(parsed.data.storage_path, 300);

    if (signError || !signed?.signedUrl) {
      logError('document_download_signed_failed', { message: signError?.message ?? 'unknown' });
      return NextResponse.json({ error: 'تعذر تجهيز رابط التنزيل.' }, { status: 500 });
    }

    logInfo('document_download_signed', { storagePath: parsed.data.storage_path });
    return NextResponse.json({ signedDownloadUrl: signed.signedUrl }, { status: 200 });
  } catch (error) {
    logError('document_download_signed_failed', {
      message: error instanceof Error ? error.message : 'unknown',
    });
    return NextResponse.json({ error: 'تعذر تجهيز رابط التنزيل.' }, { status: 500 });
  }
}
