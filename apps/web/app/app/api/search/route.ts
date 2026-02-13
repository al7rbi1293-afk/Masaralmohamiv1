import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { checkRateLimit, getRequestIp, RATE_LIMIT_MESSAGE_AR } from '@/lib/rateLimit';
import { createSupabaseServerRlsClient } from '@/lib/supabase/server';
import { getCurrentAuthUser } from '@/lib/supabase/auth-session';
import { requireOrgIdForUser } from '@/lib/org';
import { logAudit } from '@/lib/audit';
import { logError } from '@/lib/logger';

export const runtime = 'nodejs';

const querySchema = z
  .string()
  .trim()
  .min(2, 'اكتب كلمتين على الأقل للبحث.')
  .max(80, 'نص البحث طويل جدًا.');

type SearchGroup<T> = {
  items: T[];
  total?: number;
};

type ClientItem = {
  id: string;
  name: string;
  type: 'person' | 'company';
  status: 'active' | 'archived';
};

type MatterItem = {
  id: string;
  title: string;
  status: string;
  is_private: boolean;
  client_id: string;
  summary: string | null;
};

type DocumentItem = {
  id: string;
  title: string;
  matter_id: string | null;
  client_id: string | null;
  description: string | null;
};

type TaskItem = {
  id: string;
  title: string;
  status: string;
  due_at: string | null;
  matter_id: string | null;
  description: string | null;
};

export async function GET(request: NextRequest) {
  const ip = getRequestIp(request);
  const limit = checkRateLimit({
    key: `search:${ip}`,
    limit: 60,
    windowMs: 10 * 60 * 1000,
  });

  if (!limit.allowed) {
    return NextResponse.json(
      { error: RATE_LIMIT_MESSAGE_AR },
      { status: 429 },
    );
  }

  const qRaw = request.nextUrl.searchParams.get('q') ?? '';
  const parsed = querySchema.safeParse(qRaw);

  if (!parsed.success) {
    const message = parsed.error.issues[0]?.message ?? 'اكتب كلمتين على الأقل للبحث.';
    return NextResponse.json({ error: message }, { status: 400 });
  }

  const q = normalizeSearchInput(parsed.data);

  try {
    const user = await getCurrentAuthUser();
    if (!user) {
      return NextResponse.json({ error: 'الرجاء تسجيل الدخول.' }, { status: 401 });
    }

    let orgId: string | null = null;
    try {
      orgId = await requireOrgIdForUser();
    } catch (error) {
      const msg = error instanceof Error ? error.message : '';
      if (msg.includes('لا يوجد مكتب')) {
        return NextResponse.json(
          emptyResult(q, 'لا يوجد مكتب مفعّل لهذا الحساب.'),
          { status: 200 },
        );
      }
      throw error;
    }

    if (!orgId) {
      return NextResponse.json(emptyResult(q, 'لا يوجد مكتب مفعّل لهذا الحساب.'), {
        status: 200,
      });
    }

    const supabase = createSupabaseServerRlsClient();
    const pattern = `%${escapeOrTerm(q)}%`;

    const [clientsRes, mattersRes, documentsRes, tasksRes] = await Promise.all([
      supabase
        .from('clients')
        .select('id, name, type, status', { count: 'exact' })
        .eq('org_id', orgId)
        .or(`name.ilike.${pattern},email.ilike.${pattern},phone.ilike.${pattern}`)
        .order('updated_at', { ascending: false })
        .range(0, 9),
      supabase
        .from('matters')
        .select('id, title, status, is_private, client_id, summary', { count: 'exact' })
        .eq('org_id', orgId)
        .or(`title.ilike.${pattern},summary.ilike.${pattern}`)
        .order('updated_at', { ascending: false })
        .range(0, 9),
      supabase
        .from('documents')
        .select('id, title, matter_id, client_id, description', { count: 'exact' })
        .eq('org_id', orgId)
        .or(`title.ilike.${pattern},description.ilike.${pattern}`)
        .order('created_at', { ascending: false })
        .range(0, 9),
      supabase
        .from('tasks')
        .select('id, title, status, due_at, matter_id, description', { count: 'exact' })
        .eq('org_id', orgId)
        .or(`title.ilike.${pattern},description.ilike.${pattern}`)
        .order('updated_at', { ascending: false })
        .range(0, 9),
    ]);

    const response = {
      q,
      clients: normalizeGroup<ClientItem>(clientsRes),
      matters: normalizeGroup<MatterItem>(mattersRes, (row) => ({
        ...row,
        summary: truncateText(row.summary ?? null, 120),
      })),
      documents: normalizeGroup<DocumentItem>(documentsRes, (row) => ({
        ...row,
        description: truncateText(row.description ?? null, 120),
      })),
      tasks: normalizeGroup<TaskItem>(tasksRes, (row) => ({
        ...row,
        description: truncateText(row.description ?? null, 120),
      })),
    } as const;

    // Optional audit logging without storing the query itself.
    await logAudit({
      action: 'search.performed',
      entityType: null,
      entityId: null,
      meta: { length: q.length },
      req: request,
    });

    return NextResponse.json(response, { status: 200 });
  } catch (error) {
    const message = toUserMessage(error);
    logError('search_failed', { message });
    const status =
      message === 'الرجاء تسجيل الدخول.' ? 401 : message === 'اكتب كلمتين على الأقل للبحث.' ? 400 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}

function emptyResult(q: string, message: string) {
  return {
    q,
    message,
    clients: { items: [] as ClientItem[], total: 0 },
    matters: { items: [] as MatterItem[], total: 0 },
    documents: { items: [] as DocumentItem[], total: 0 },
    tasks: { items: [] as TaskItem[], total: 0 },
  };
}

function normalizeGroup<T extends Record<string, any>>(
  result: { data: unknown; error: any; count?: number | null },
  mapper?: (row: any) => any,
): SearchGroup<T> {
  if (result.error) {
    throw result.error;
  }

  const rows = (result.data as any[] | null) ?? [];
  const items = mapper ? rows.map(mapper) : rows;

  return {
    items: items as T[],
    total: typeof result.count === 'number' ? result.count : undefined,
  };
}

function truncateText(value: string | null, max: number) {
  if (!value) return null;
  const trimmed = value.trim();
  if (trimmed.length <= max) return trimmed;
  return `${trimmed.slice(0, max)}...`;
}

function normalizeSearchInput(value: string) {
  return value.replace(/\s+/g, ' ').trim();
}

// Prevent PostgREST `or()` string injection by removing filter delimiters.
function escapeOrTerm(value: string) {
  return value.replace(/[(),]/g, ' ').replace(/\s+/g, ' ').trim();
}

function toUserMessage(error: unknown) {
  const message = error instanceof Error ? error.message : '';
  const normalized = message.toLowerCase();

  if (
    normalized.includes('permission denied') ||
    normalized.includes('violates row-level security') ||
    normalized.includes('not allowed')
  ) {
    return 'لا تملك صلاحية الوصول.';
  }

  return message || 'تعذر البحث. حاول مرة أخرى.';
}
