import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireOfficeAppContext } from '@/lib/mobile/auth';
import { createOfficeDocumentDownloadUrl } from '@/lib/mobile/office-documents-crud';
import { logError, logInfo } from '@/lib/logger';

export const runtime = 'nodejs';

const bodySchema = z.object({
  storage_path: z.string().trim().min(5).max(800).optional(),
  version_id: z.string().uuid().optional(),
  version_no: z.number().int().positive().optional(),
});

type RouteProps = {
  params: {
    id: string;
  };
};

export async function POST(request: NextRequest, { params }: RouteProps) {
  const auth = await requireOfficeAppContext(request);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const parsed = bodySchema.safeParse(await request.json().catch(() => ({})));
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? 'تعذر تجهيز رابط التنزيل.' },
        { status: 400 },
      );
    }

    const result = await createOfficeDocumentDownloadUrl(auth.context, params.id, parsed.data);
    logInfo('mobile_office_document_download_url_created', {
      documentId: params.id,
      orgId: auth.context.org?.id ?? null,
    });

    return NextResponse.json(result);
  } catch (error) {
    const message = toUserMessage(error, 'تعذر تجهيز رابط التنزيل.');
    logError('mobile_office_document_download_url_failed', { message });
    return NextResponse.json({ error: message }, { status: toHttpStatus(message) });
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
  if (message === 'الخدمة غير متاحة مؤقتًا. حاول مرة أخرى بعد قليل.') return 503;
  return 400;
}
