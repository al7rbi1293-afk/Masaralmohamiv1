import { NextRequest, NextResponse } from 'next/server';
import { getRequestIp } from '@/lib/rateLimit';
import { logError, logInfo } from '@/lib/logger';
import {
  getActiveClientPortalAccess,
  resolvePortalUploadActorUserId,
} from '@/lib/client-portal/access';

export const runtime = 'nodejs';

const MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024;

type MatterRow = {
  id: string;
  title: string;
  assigned_user_id: string | null;
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
    const formData = await request.formData();
    const title = normalizeTitle(String(formData.get('title') ?? ''));
    const matterId = String(formData.get('matter_id') ?? '').trim();
    const fileValue = formData.get('file');

    if (title.length < 2) {
      return NextResponse.json({ error: 'العنوان مطلوب ويجب أن لا يقل عن حرفين.' }, { status: 400 });
    }

    if (!fileValue || typeof fileValue === 'string') {
      return NextResponse.json({ error: 'يرجى اختيار ملف قبل الرفع.' }, { status: 400 });
    }

    const file = fileValue;
    if (file.size <= 0) {
      return NextResponse.json({ error: 'الملف غير صالح.' }, { status: 400 });
    }

    if (file.size > MAX_FILE_SIZE_BYTES) {
      return NextResponse.json({ error: 'الحد الأقصى لحجم الملف هو 50 ميجابايت.' }, { status: 400 });
    }

    let matter: MatterRow | null = null;
    if (matterId) {
      const { data: matterRow, error: matterError } = await db
        .from('matters')
        .select('id, title, assigned_user_id')
        .eq('org_id', session.orgId)
        .eq('id', matterId)
        .eq('client_id', session.clientId)
        .maybeSingle();

      if (matterError) {
        logError('client_portal_document_upload_matter_lookup_failed', { message: matterError.message });
        return NextResponse.json({ error: 'تعذر التحقق من القضية المرتبطة.' }, { status: 400 });
      }

      if (!matterRow) {
        return NextResponse.json(
          { error: 'القضية المحددة غير متاحة لحسابك.' },
          { status: 403 },
        );
      }

      matter = matterRow as MatterRow;
    }

    const uploaderId = await resolvePortalUploadActorUserId({
      db,
      orgId: session.orgId,
      preferredUserId: matter?.assigned_user_id ?? null,
    });

    if (!uploaderId) {
      logError('client_portal_document_upload_actor_missing', { orgId: session.orgId });
      return NextResponse.json(
        { error: 'تعذر رفع المستند حالياً. يرجى التواصل مع المكتب.' },
        { status: 500 },
      );
    }

    const { data: document, error: documentError } = await db
      .from('documents')
      .insert({
        org_id: session.orgId,
        client_id: session.clientId,
        matter_id: matter?.id ?? null,
        title,
        folder: '/client-portal',
        tags: ['client_portal', 'uploaded_by_client'],
      })
      .select('id, title, matter_id, created_at')
      .single();

    if (documentError || !document) {
      logError('client_portal_document_upload_create_failed', {
        message: documentError?.message ?? 'unknown',
      });
      return NextResponse.json({ error: 'تعذر إنشاء سجل المستند.' }, { status: 400 });
    }

    const documentId = String((document as any).id);
    const safeFileName = toSafeFileName(file.name);
    const storagePath = buildStoragePath(session.orgId, documentId, safeFileName);

    const { error: uploadError } = await db.storage.from('documents').upload(storagePath, file, {
      upsert: false,
      contentType: file.type || undefined,
    });

    if (uploadError) {
      await db
        .from('documents')
        .delete()
        .eq('org_id', session.orgId)
        .eq('id', documentId);

      logError('client_portal_document_upload_storage_failed', {
        documentId,
        message: uploadError.message,
      });
      return NextResponse.json({ error: 'تعذر رفع الملف حالياً.' }, { status: 500 });
    }

    const { data: version, error: versionError } = await db
      .from('document_versions')
      .insert({
        org_id: session.orgId,
        document_id: documentId,
        version_no: 1,
        storage_path: storagePath,
        file_name: normalizeDisplayFileName(file.name),
        file_size: file.size,
        mime_type: file.type ? file.type.trim() : null,
        uploaded_by: uploaderId,
      })
      .select('id, document_id, version_no, storage_path, file_name, file_size, mime_type, created_at')
      .single();

    if (versionError || !version) {
      await db.storage.from('documents').remove([storagePath]);
      await db
        .from('documents')
        .delete()
        .eq('org_id', session.orgId)
        .eq('id', documentId);

      logError('client_portal_document_upload_version_failed', {
        documentId,
        message: versionError?.message ?? 'unknown',
      });
      return NextResponse.json({ error: 'تم رفع الملف لكن تعذر حفظ بيانات النسخة.' }, { status: 500 });
    }

    const ip = getRequestIp(request);
    await db.from('audit_logs').insert({
      org_id: session.orgId,
      user_id: null,
      action: 'client_portal_document_uploaded',
      entity_type: 'document',
      entity_id: documentId,
      meta: {
        portal_user_id: session.portalUserId,
        client_id: session.clientId,
        matter_id: matter?.id ?? null,
        file_name: (version as any).file_name,
        file_size: (version as any).file_size,
      },
      ip,
      user_agent: request.headers.get('user-agent') || null,
    });

    logInfo('client_portal_document_uploaded', {
      orgId: session.orgId,
      clientId: session.clientId,
      documentId,
      matterId: matter?.id ?? null,
    });

    return NextResponse.json(
      {
        ok: true,
        message: 'تم رفع المستند وربطه بملفك بنجاح.',
        document: {
          id: documentId,
          title: String((document as any).title ?? title),
          matter_id: matter?.id ?? null,
          matter_title: matter?.title ?? null,
          created_at: String((document as any).created_at ?? new Date().toISOString()),
        },
        version: {
          id: String((version as any).id),
          version_no: Number((version as any).version_no ?? 1),
          storage_path: String((version as any).storage_path ?? ''),
          file_name: String((version as any).file_name ?? ''),
          file_size: Number((version as any).file_size ?? 0),
          mime_type: (version as any).mime_type ? String((version as any).mime_type) : null,
          created_at: String((version as any).created_at ?? new Date().toISOString()),
        },
      },
      { status: 201 },
    );
  } catch (error) {
    logError('client_portal_document_upload_unhandled', {
      message: error instanceof Error ? error.message : 'unknown',
    });
    return NextResponse.json({ error: 'تعذر رفع المستند حالياً.' }, { status: 500 });
  }
}

function buildStoragePath(orgId: string, documentId: string, fileName: string) {
  return `org/${orgId}/doc/${documentId}/v1/${fileName}`;
}

function normalizeTitle(value: string) {
  return value.trim().slice(0, 200);
}

function normalizeDisplayFileName(value: string) {
  const cleaned = value.replaceAll('\u0000', '').trim();
  if (!cleaned) return 'file';
  return cleaned.slice(0, 180);
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
