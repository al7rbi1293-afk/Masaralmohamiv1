import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireOfficeAppContext } from '@/lib/mobile/auth';
import { deleteOfficeDocument, getOfficeDocumentDetails, updateOfficeDocument } from '@/lib/mobile/office-documents-crud';
import { logError, logInfo } from '@/lib/logger';

export const runtime = 'nodejs';

const updateDocumentSchema = z.object({
  title: z.string().trim().min(2, 'العنوان مطلوب.').max(200, 'العنوان طويل جدًا.'),
  description: z.string().trim().max(2000, 'الوصف طويل جدًا.').optional().or(z.literal('')).nullable(),
  matter_id: z.union([z.string().uuid('القضية غير صحيحة.'), z.literal(''), z.null()]).optional(),
  client_id: z.union([z.string().uuid('العميل غير صحيح.'), z.literal(''), z.null()]).optional(),
  folder: z.union([z.string().trim().max(300, 'المجلد طويل جدًا.'), z.literal(''), z.null()]).optional(),
  tags: z.unknown().optional(),
});

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
    const record = await getOfficeDocumentDetails(auth.context, params.id);
    if (!record) {
      return NextResponse.json({ error: 'المستند غير موجود.' }, { status: 404 });
    }

    return NextResponse.json(record);
  } catch (error) {
    const message = toUserMessage(error, 'تعذر تحميل المستند.');
    logError('mobile_office_document_get_failed', { message });
    return NextResponse.json({ error: message }, { status: toHttpStatus(message) });
  }
}

export async function PATCH(request: NextRequest, { params }: RouteProps) {
  const auth = await requireOfficeAppContext(request);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const parsed = updateDocumentSchema.safeParse(await request.json().catch(() => ({})));
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? 'تعذر تحديث المستند.' },
        { status: 400 },
      );
    }

    const document = await updateOfficeDocument(auth.context, params.id, {
      title: parsed.data.title,
      description: emptyToNull(parsed.data.description),
      matter_id: emptyToNull(parsed.data.matter_id),
      client_id: emptyToNull(parsed.data.client_id),
      folder: emptyToNull(parsed.data.folder),
      tags: parsed.data.tags,
    });

    logInfo('mobile_office_document_updated', { documentId: document.id, orgId: auth.context.org?.id ?? null });
    return NextResponse.json({ document });
  } catch (error) {
    const message = toUserMessage(error, 'تعذر تحديث المستند.');
    logError('mobile_office_document_update_failed', { message });
    return NextResponse.json({ error: message }, { status: toHttpStatus(message) });
  }
}

export async function DELETE(request: NextRequest, { params }: RouteProps) {
  const auth = await requireOfficeAppContext(request);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    await deleteOfficeDocument(auth.context, params.id);
    logInfo('mobile_office_document_deleted', { documentId: params.id, orgId: auth.context.org?.id ?? null });
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = toUserMessage(error, 'تعذر حذف المستند.');
    logError('mobile_office_document_delete_failed', { message });
    return NextResponse.json({ error: message }, { status: toHttpStatus(message) });
  }
}

function emptyToNull(value?: string | null) {
  const normalized = String(value ?? '').trim();
  return normalized || null;
}

function toUserMessage(error: unknown, fallback: string) {
  const message = error instanceof Error ? error.message : '';
  const normalized = message.toLowerCase();

  if (message.includes('لا يوجد مكتب مفعّل')) return message;
  if (normalized.includes('permission denied') || normalized.includes('violates row-level security')) {
    return 'لا تملك صلاحية لهذا الإجراء.';
  }
  if (normalized.includes('client_not_found')) return 'العميل غير موجود.';
  if (normalized.includes('matter_not_found')) return 'القضية غير موجودة.';
  if (normalized.includes('not_found')) return 'المستند غير موجود.';
  return message || fallback;
}

function toHttpStatus(message: string) {
  if (message === 'لا تملك صلاحية لهذا الإجراء.') return 403;
  if (message === 'العميل غير موجود.' || message === 'القضية غير موجودة.' || message === 'المستند غير موجود.') {
    return 404;
  }
  return 400;
}

