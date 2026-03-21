import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireOfficeAppContext } from '@/lib/mobile/auth';
import { setOfficeDocumentArchived } from '@/lib/mobile/office-documents-crud';
import { logError, logInfo } from '@/lib/logger';

export const runtime = 'nodejs';

const archiveSchema = z.object({
  archived: z.boolean().optional().default(true),
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
    const parsed = archiveSchema.safeParse(await request.json().catch(() => ({})));
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? 'تعذر تحديث حالة المستند.' },
        { status: 400 },
      );
    }

    const document = await setOfficeDocumentArchived(auth.context, params.id, parsed.data.archived);
    logInfo(parsed.data.archived ? 'mobile_office_document_archived' : 'mobile_office_document_restored', {
      documentId: document.id,
      orgId: auth.context.org?.id ?? null,
    });

    return NextResponse.json({ document });
  } catch (error) {
    const message = toUserMessage(error, 'تعذر تحديث حالة المستند.');
    logError('mobile_office_document_archive_failed', { message });
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
  if (normalized.includes('archive_not_supported')) return 'تحديث الأرشفة غير مدعوم في هذا المخطط.';
  if (normalized.includes('not_found')) return 'المستند غير موجود.';
  return message || fallback;
}

function toHttpStatus(message: string) {
  if (message === 'لا تملك صلاحية لهذا الإجراء.') return 403;
  if (message === 'المستند غير موجود.') return 404;
  return 400;
}

