import { NextRequest, NextResponse } from 'next/server';
import { requireOfficeAppContext } from '@/lib/mobile/auth';
import { addOfficeDocumentVersion, listOfficeDocumentVersions } from '@/lib/mobile/office-documents-crud';
import { logError, logInfo } from '@/lib/logger';

export const runtime = 'nodejs';

type RouteProps = {
  params: {
    id: string;
  };
};

export async function GET(request: NextRequest, { params }: RouteProps) {
  const auth = await requireOfficeAppContext(request);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const versions = await listOfficeDocumentVersions(auth.context, params.id);
    return NextResponse.json({ versions });
  } catch (error) {
    const message = toUserMessage(error, 'تعذر تحميل النسخ.');
    logError('mobile_office_document_versions_get_failed', { message });
    return NextResponse.json({ error: message }, { status: toHttpStatus(message) });
  }
}

export async function POST(request: NextRequest, { params }: RouteProps) {
  const auth = await requireOfficeAppContext(request);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const formData = await request.formData();
    const fileValue = formData.get('file');
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

    const result = await addOfficeDocumentVersion(auth.context, params.id, file);
    logInfo('mobile_office_document_version_added', {
      documentId: params.id,
      versionNo: result.version.version_no,
      orgId: auth.context.org?.id ?? null,
    });

    return NextResponse.json({ version: result.version }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'تعذر رفع النسخة.';
    logError('mobile_office_document_versions_create_failed', { message });
    const normalized = message.toLowerCase();
    const status =
      normalized.includes('not_found')
        ? 404
        : normalized.includes('permission denied') || normalized.includes('violates row-level security')
          ? 403
          : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

function toUserMessage(error: unknown, fallback: string) {
  const message = error instanceof Error ? error.message : '';
  const normalized = message.toLowerCase();

  if (message.includes('لا يوجد مكتب مفعّل')) return message;
  if (normalized.includes('permission denied') || normalized.includes('violates row-level security')) {
    return 'لا تملك صلاحية لهذا الإجراء.';
  }
  if (normalized.includes('not_found')) return 'المستند غير موجود.';
  return message || fallback;
}

function toHttpStatus(message: string) {
  if (message === 'لا تملك صلاحية لهذا الإجراء.') return 403;
  if (message === 'المستند غير موجود.') return 404;
  return 400;
}

