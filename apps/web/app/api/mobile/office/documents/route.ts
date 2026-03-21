import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireOfficeAppContext } from '@/lib/mobile/auth';
import { listOfficeDocuments } from '@/lib/mobile/office';
import { createOfficeDocument } from '@/lib/mobile/office-documents-crud';
import { logError, logInfo } from '@/lib/logger';

export const runtime = 'nodejs';

const createDocumentSchema = z.object({
  title: z.string().trim().min(2, 'العنوان مطلوب.').max(200, 'العنوان طويل جدًا.'),
  description: z.string().trim().max(2000, 'الوصف طويل جدًا.').optional().or(z.literal('')).nullable(),
  matter_id: z.union([z.string().uuid('القضية غير صحيحة.'), z.literal(''), z.null()]).optional(),
  client_id: z.union([z.string().uuid('العميل غير صحيح.'), z.literal(''), z.null()]).optional(),
  folder: z.union([z.string().trim().max(300, 'المجلد طويل جدًا.'), z.literal(''), z.null()]).optional(),
  tags: z.unknown().optional(),
});

export async function GET(request: NextRequest) {
  const auth = await requireOfficeAppContext(request);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { searchParams } = new URL(request.url);
  const data = await listOfficeDocuments(auth.context, {
    q: searchParams.get('q'),
    archived: (searchParams.get('archived') as 'active' | 'archived' | 'all' | null) ?? null,
    matterId: searchParams.get('matter_id'),
    clientId: searchParams.get('client_id'),
    page: Number(searchParams.get('page') ?? '1') || 1,
    limit: Number(searchParams.get('limit') ?? '20') || 20,
  });

  return NextResponse.json(data);
}

export async function POST(request: NextRequest) {
  const auth = await requireOfficeAppContext(request);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const parsed = createDocumentSchema.safeParse(await request.json().catch(() => ({})));
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? 'تعذر إنشاء المستند.' },
        { status: 400 },
      );
    }

    const document = await createOfficeDocument(auth.context, {
      title: parsed.data.title,
      description: emptyToNull(parsed.data.description),
      matter_id: emptyToNull(parsed.data.matter_id),
      client_id: emptyToNull(parsed.data.client_id),
      folder: emptyToNull(parsed.data.folder),
      tags: parsed.data.tags,
    });

    logInfo('mobile_office_document_created', { documentId: document.id, orgId: auth.context.org?.id ?? null });
    return NextResponse.json({ document }, { status: 201 });
  } catch (error) {
    const message = toUserMessage(error, 'تعذر إنشاء المستند.');
    logError('mobile_office_document_create_failed', { message });
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
  return message || fallback;
}

function toHttpStatus(message: string) {
  if (message === 'لا تملك صلاحية لهذا الإجراء.') return 403;
  if (message === 'العميل غير موجود.' || message === 'القضية غير موجودة.') return 404;
  return 400;
}
