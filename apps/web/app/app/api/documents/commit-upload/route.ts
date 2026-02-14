import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireOrgIdForUser } from '@/lib/org';
import { createSupabaseServerRlsClient } from '@/lib/supabase/server';
import { getCurrentAuthUser } from '@/lib/supabase/auth-session';
import { logAudit } from '@/lib/audit';
import { logError, logInfo } from '@/lib/logger';

const commitSchema = z.object({
  document_id: z.string().uuid(),
  version_no: z.number().int().positive(),
  storage_path: z.string().trim().min(5),
  file_name: z.string().trim().min(1).max(255),
  file_size: z.number().int().positive(),
  mime_type: z.string().trim().max(150).optional().or(z.literal('')),
});

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const parsed = commitSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? 'تعذر حفظ النسخة.' },
        { status: 400 },
      );
    }

    const orgId = await requireOrgIdForUser();
    const currentUser = await getCurrentAuthUser();
    if (!currentUser) {
      return NextResponse.json({ error: 'غير مصرح.' }, { status: 401 });
    }

    const rls = createSupabaseServerRlsClient();

    const { data: document, error: docError } = await rls
      .from('documents')
      .select('id')
      .eq('org_id', orgId)
      .eq('id', parsed.data.document_id)
      .maybeSingle();

    if (docError) {
      logError('document_version_commit_failed', { message: docError.message });
      return NextResponse.json({ error: 'تعذر حفظ النسخة.' }, { status: 400 });
    }

    if (!document) {
      return NextResponse.json({ error: 'لا تملك صلاحية الوصول.' }, { status: 403 });
    }

    const { data: version, error } = await rls
      .from('document_versions')
      .insert({
        org_id: orgId,
        document_id: parsed.data.document_id,
        version_no: parsed.data.version_no,
        storage_path: parsed.data.storage_path,
        file_name: parsed.data.file_name,
        file_size: parsed.data.file_size,
        mime_type: emptyToNull(parsed.data.mime_type),
        uploaded_by: currentUser.id,
      })
      .select(
        'id, org_id, document_id, version_no, storage_path, file_name, file_size, mime_type, checksum, uploaded_by, created_at',
      )
      .single();

    if (error || !version) {
      logError('document_version_commit_failed', { message: error?.message ?? 'unknown' });
      return NextResponse.json({ error: 'تعذر حفظ النسخة.' }, { status: 400 });
    }

    logInfo('document_version_committed', {
      documentId: parsed.data.document_id,
      versionNo: parsed.data.version_no,
    });

    await logAudit({
      action: 'document.version_committed',
      entityType: 'document_version',
      entityId: String((version as any).id),
      meta: {
        document_id: parsed.data.document_id,
        version_no: parsed.data.version_no,
        file_size: parsed.data.file_size,
      },
      req: request,
    });

    return NextResponse.json({ version }, { status: 201 });
  } catch (error) {
    logError('document_version_commit_failed', {
      message: error instanceof Error ? error.message : 'unknown',
    });
    return NextResponse.json({ error: 'تعذر حفظ النسخة.' }, { status: 500 });
  }
}

function emptyToNull(value?: string) {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}
