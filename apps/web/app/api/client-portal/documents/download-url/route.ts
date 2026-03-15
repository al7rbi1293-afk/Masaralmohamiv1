import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getRequestIp } from '@/lib/rateLimit';
import { logError, logInfo } from '@/lib/logger';
import { getActiveClientPortalAccess } from '@/lib/client-portal/access';

export const runtime = 'nodejs';

const bodySchema = z.object({
  storage_path: z.string().trim().min(5, 'المسار غير صالح.').max(800, 'المسار غير صالح.'),
});

type DocumentRow = {
  id: string;
  client_id: string | null;
};

type VersionRow = {
  id: string;
  document_id: string;
  file_name: string;
};

export async function POST(request: NextRequest) {
  const access = await getActiveClientPortalAccess();
  if (!access) {
    return NextResponse.json(
      { error: 'انتهت جلسة بوابة العميل. يرجى تسجيل الدخول مرة أخرى.' },
      { status: 401 },
    );
  }

  const { db, session } = access;

  try {
    const body = await request.json().catch(() => ({}));
    const parsed = bodySchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? 'تعذر تجهيز رابط التنزيل.' },
        { status: 400 },
      );
    }

    const { data: version, error: versionError } = await db
      .from('document_versions')
      .select('id, document_id, file_name')
      .eq('org_id', session.orgId)
      .eq('storage_path', parsed.data.storage_path)
      .maybeSingle();

    if (versionError || !version) {
      if (versionError) {
        logError('client_portal_document_download_lookup_failed', { message: versionError.message });
      }
      return NextResponse.json({ error: 'المستند غير متاح.' }, { status: 404 });
    }

    const versionRow = version as VersionRow;
    const { data: document, error: documentError } = await db
      .from('documents')
      .select('id, client_id')
      .eq('org_id', session.orgId)
      .eq('id', versionRow.document_id)
      .maybeSingle();

    if (documentError || !document) {
      if (documentError) {
        logError('client_portal_document_download_doc_lookup_failed', { message: documentError.message });
      }
      return NextResponse.json({ error: 'المستند غير متاح.' }, { status: 404 });
    }

    const documentRow = document as DocumentRow;
    if (String(documentRow.client_id ?? '') !== session.clientId) {
      return NextResponse.json({ error: 'لا تملك صلاحية الوصول لهذا الملف.' }, { status: 403 });
    }

    const downloadName = sanitizeDownloadFileName(versionRow.file_name) || 'document';
    const { data: signed, error: signError } = await db
      .storage
      .from('documents')
      .createSignedUrl(parsed.data.storage_path, 300, {
        download: downloadName,
      });

    if (signError || !signed?.signedUrl) {
      logError('client_portal_document_download_sign_failed', {
        message: signError?.message ?? 'unknown',
      });
      return NextResponse.json({ error: 'تعذر تجهيز رابط التنزيل.' }, { status: 500 });
    }

    const ip = getRequestIp(request);
    await db.from('audit_logs').insert({
      org_id: session.orgId,
      user_id: null,
      action: 'client_portal_document_download_signed',
      entity_type: 'document_version',
      entity_id: versionRow.id,
      meta: {
        portal_user_id: session.portalUserId,
        document_id: versionRow.document_id,
      },
      ip,
      user_agent: request.headers.get('user-agent') || null,
    });

    logInfo('client_portal_document_download_signed', {
      orgId: session.orgId,
      clientId: session.clientId,
      documentId: versionRow.document_id,
    });

    return NextResponse.json({ signedDownloadUrl: signed.signedUrl }, { status: 200 });
  } catch (error) {
    logError('client_portal_document_download_unhandled', {
      message: error instanceof Error ? error.message : 'unknown',
    });
    return NextResponse.json({ error: 'تعذر تجهيز رابط التنزيل.' }, { status: 500 });
  }
}

function sanitizeDownloadFileName(value: string | null | undefined) {
  const normalized = String(value ?? '')
    .replaceAll('\u0000', '')
    .replace(/[\r\n]+/g, ' ')
    .trim();

  if (!normalized) {
    return '';
  }

  return normalized
    .replace(/[\\/]/g, '_')
    .replace(/\s+/g, ' ')
    .slice(0, 180);
}
