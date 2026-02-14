import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireOrgIdForUser } from '@/lib/org';
import { createSupabaseServerRlsClient } from '@/lib/supabase/server';
import { logAudit } from '@/lib/audit';
import { logError, logInfo } from '@/lib/logger';

const createDocumentSchema = z.object({
  title: z.string().trim().min(2, 'العنوان مطلوب.').max(200, 'العنوان طويل جدًا.'),
  matter_id: z.string().uuid().optional().or(z.literal('')),
  client_id: z.string().uuid().optional().or(z.literal('')),
  folder: z.string().trim().max(300, 'المجلد طويل جدًا.').optional().or(z.literal('')),
  tags: z.unknown().optional(),
});

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const parsed = createDocumentSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? 'تعذر إنشاء المستند.' },
        { status: 400 },
      );
    }

    const orgId = await requireOrgIdForUser();
    const supabase = createSupabaseServerRlsClient();

    const tags = normalizeTags(parsed.data.tags);
    const folder = normalizeFolder(parsed.data.folder);

    const { data, error } = await supabase
      .from('documents')
      .insert({
        org_id: orgId,
        title: parsed.data.title,
        matter_id: emptyToNull(parsed.data.matter_id),
        client_id: emptyToNull(parsed.data.client_id),
        folder,
        tags,
      })
      .select('id, org_id, title, description, folder, tags, matter_id, client_id, created_at')
      .single();

    if (error || !data) {
      logError('document_create_failed', { message: error?.message ?? 'unknown' });
      return NextResponse.json({ error: 'تعذر إنشاء المستند.' }, { status: 400 });
    }

    await logAudit({
      action: 'document.created',
      entityType: 'document',
      entityId: String(data.id),
      meta: {
        has_matter: Boolean((data as any).matter_id),
        has_client: Boolean((data as any).client_id),
      },
      req: request,
    });

    logInfo('document_created', { documentId: data.id });
    return NextResponse.json({ document: data }, { status: 201 });
  } catch (error) {
    logError('document_create_failed', {
      message: error instanceof Error ? error.message : 'unknown',
    });
    return NextResponse.json({ error: 'تعذر إنشاء المستند.' }, { status: 500 });
  }
}

function emptyToNull(value?: string) {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}

function normalizeFolder(value?: string) {
  const normalized = (value ?? '').trim();
  if (!normalized) return '/';
  if (normalized === '/') return '/';
  return normalized.startsWith('/') ? normalized : `/${normalized}`;
}

function normalizeTags(value: unknown) {
  if (!value) return [];

  if (Array.isArray(value)) {
    return value
      .map((item) => String(item ?? '').trim())
      .filter(Boolean)
      .slice(0, 20);
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return [];
    try {
      const parsed = JSON.parse(trimmed);
      return normalizeTags(parsed);
    } catch {
      // comma-separated fallback
      return trimmed
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean)
        .slice(0, 20);
    }
  }

  return [];
}
