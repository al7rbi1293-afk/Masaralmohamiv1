import { NextRequest, NextResponse } from 'next/server';
import { requireOfficeAppContext } from '@/lib/mobile/auth';
import { createOfficeDocumentUpload } from '@/lib/mobile/office-documents-crud';
import { logError, logInfo } from '@/lib/logger';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  const auth = await requireOfficeAppContext(request);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const formData = await request.formData();
    const title = String(formData.get('title') ?? '').trim();
    const description = normalizeOptionalString(formData.get('description'));
    const matterId = normalizeOptionalString(formData.get('matter_id'));
    const clientId = normalizeOptionalString(formData.get('client_id'));
    const folder = normalizeOptionalString(formData.get('folder'));
    const tags = formData.get('tags');
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

    if (file.size > 50 * 1024 * 1024) {
      return NextResponse.json({ error: 'الحد الأقصى لحجم الملف هو 50 ميجابايت.' }, { status: 400 });
    }

    const result = await createOfficeDocumentUpload(
      auth.context,
      {
        title,
        description,
        matter_id: matterId,
        client_id: clientId,
        folder,
        tags,
      },
      file,
    );

    logInfo('mobile_office_document_uploaded', {
      documentId: result.document.id,
      versionNo: result.version.version_no,
      orgId: auth.context.org?.id ?? null,
    });

    return NextResponse.json(
      {
        ok: true,
        document: result.document,
        version: result.version,
      },
      { status: 201 },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : 'تعذر رفع المستند.';
    logError('mobile_office_document_upload_failed', { message });
    const normalized = message.toLowerCase();
    const status =
      normalized.includes('client_not_found') || normalized.includes('matter_not_found')
        ? 404
        : normalized.includes('permission denied') || normalized.includes('violates row-level security')
          ? 403
          : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

function normalizeOptionalString(value: FormDataEntryValue | null) {
  const normalized = String(value ?? '').trim();
  return normalized || null;
}

