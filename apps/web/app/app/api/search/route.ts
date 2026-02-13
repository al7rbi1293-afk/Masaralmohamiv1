import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { checkRateLimit, getRequestIp } from '@/lib/rateLimit';
import { requireOrgIdForUser } from '@/lib/org';
import { createSupabaseServerRlsClient } from '@/lib/supabase/server';
import { logInfo, logError } from '@/lib/logger';

const querySchema = z.object({
  q: z.string().trim().max(120).optional().nullable(),
});

export async function GET(request: NextRequest) {
  const ip = getRequestIp(request);
  const limit = checkRateLimit({
    key: `search:${ip}`,
    limit: 30,
    windowMs: 10 * 60 * 1000,
  });

  if (!limit.allowed) {
    return NextResponse.json({ error: 'طلبات كثيرة. حاول لاحقًا.' }, { status: 429 });
  }

  try {
    const parsed = querySchema.safeParse({
      q: request.nextUrl.searchParams.get('q'),
    });

    if (!parsed.success) {
      return NextResponse.json({ error: 'تعذر التحقق من البحث.' }, { status: 400 });
    }

    const q = cleanQuery(parsed.data.q ?? '');
    if (q.length < 2) {
      return NextResponse.json(
        { clients: [], matters: [], documents: [], tasks: [] },
        { status: 200 },
      );
    }

    const orgId = await requireOrgIdForUser();
    const supabase = createSupabaseServerRlsClient();
    const pattern = `%${q}%`;

    const [clients, matters, documents, tasks] = await Promise.all([
      supabase
        .from('clients')
        .select('id, name, email, phone, status, updated_at')
        .eq('org_id', orgId)
        .or(`name.ilike.${pattern},email.ilike.${pattern},phone.ilike.${pattern}`)
        .order('updated_at', { ascending: false })
        .limit(10),
      supabase
        .from('matters')
        .select('id, title, status, is_private, updated_at')
        .eq('org_id', orgId)
        .or(`title.ilike.${pattern},summary.ilike.${pattern}`)
        .order('updated_at', { ascending: false })
        .limit(10),
      supabase
        .from('documents')
        .select('id, title, matter_id, created_at')
        .eq('org_id', orgId)
        .or(`title.ilike.${pattern},description.ilike.${pattern}`)
        .order('created_at', { ascending: false })
        .limit(10),
      supabase
        .from('tasks')
        .select('id, title, status, due_at, matter_id, updated_at')
        .eq('org_id', orgId)
        .or(`title.ilike.${pattern},description.ilike.${pattern}`)
        .order('updated_at', { ascending: false })
        .limit(10),
    ]);

    if (clients.error) throw clients.error;
    if (matters.error) throw matters.error;
    if (documents.error) throw documents.error;
    if (tasks.error) throw tasks.error;

    logInfo('search_performed', {
      q_len: q.length,
      clients: clients.data?.length ?? 0,
      matters: matters.data?.length ?? 0,
      documents: documents.data?.length ?? 0,
      tasks: tasks.data?.length ?? 0,
    });

    return NextResponse.json(
      {
        clients: clients.data ?? [],
        matters: matters.data ?? [],
        documents: documents.data ?? [],
        tasks: tasks.data ?? [],
      },
      { status: 200 },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : 'تعذر البحث.';
    logError('search_failed', { message });
    return NextResponse.json({ error: 'تعذر البحث. حاول مرة أخرى.' }, { status: 400 });
  }
}

function cleanQuery(value: string) {
  return value
    .replaceAll(',', ' ')
    .replaceAll('\n', ' ')
    .replaceAll('\r', ' ')
    .trim()
    .slice(0, 80);
}

