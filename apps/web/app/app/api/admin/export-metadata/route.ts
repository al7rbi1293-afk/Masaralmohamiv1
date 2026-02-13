import { NextRequest, NextResponse } from 'next/server';
import { requireOwner } from '@/lib/org';
import { createSupabaseServerRlsClient } from '@/lib/supabase/server';
import { logError, logInfo } from '@/lib/logger';

export const runtime = 'nodejs';

type DateRange = {
  firstCreatedAt: string | null;
  lastCreatedAt: string | null;
};

async function countRows(params: {
  supabase: ReturnType<typeof createSupabaseServerRlsClient>;
  table: string;
  orgId: string;
}) {
  const { supabase, table, orgId } = params;
  const { count, error } = await supabase
    .from(table)
    .select('id', { count: 'exact', head: true })
    .eq('org_id', orgId);

  if (error) {
    throw new Error(error.message);
  }

  return count ?? 0;
}

async function getCreatedAtRange(params: {
  supabase: ReturnType<typeof createSupabaseServerRlsClient>;
  table: string;
  orgId: string;
  column?: string;
}): Promise<DateRange> {
  const { supabase, table, orgId } = params;
  const column = params.column ?? 'created_at';

  const [first, last] = await Promise.all([
    supabase
      .from(table)
      .select(column)
      .eq('org_id', orgId)
      .order(column, { ascending: true })
      .limit(1)
      .maybeSingle(),
    supabase
      .from(table)
      .select(column)
      .eq('org_id', orgId)
      .order(column, { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  if (first.error) {
    throw new Error(first.error.message);
  }
  if (last.error) {
    throw new Error(last.error.message);
  }

  return {
    firstCreatedAt: (first.data as any)?.[column] ? String((first.data as any)[column]) : null,
    lastCreatedAt: (last.data as any)?.[column] ? String((last.data as any)[column]) : null,
  };
}

export async function GET(_request: NextRequest) {
  let orgId = '';
  let userId = '';

  try {
    const owner = await requireOwner();
    orgId = owner.orgId;
    userId = owner.userId;
  } catch (error) {
    const message = error instanceof Error ? error.message : '';

    if (message === 'الرجاء تسجيل الدخول.') {
      return NextResponse.json({ error: message }, { status: 401 });
    }

    if (message === 'لا تملك صلاحية تنفيذ هذا الإجراء.') {
      return NextResponse.json({ error: 'لا تملك صلاحية الوصول.' }, { status: 403 });
    }

    return NextResponse.json({ error: message || 'تعذر تنفيذ الطلب.' }, { status: 400 });
  }

  const supabase = createSupabaseServerRlsClient();

  try {
    const [orgResult, trialResult, subscriptionResult] = await Promise.all([
      supabase
        .from('organizations')
        .select('id, name, created_at')
        .eq('id', orgId)
        .maybeSingle(),
      supabase
        .from('trial_subscriptions')
        .select('started_at, ends_at, status, updated_at')
        .eq('org_id', orgId)
        .maybeSingle(),
      supabase
        .from('subscriptions')
        .select('plan_code, status, seats, current_period_start, current_period_end, provider, created_at')
        .eq('org_id', orgId)
        .maybeSingle(),
    ]);

    if (orgResult.error) throw new Error(orgResult.error.message);
    if (trialResult.error) throw new Error(trialResult.error.message);
    if (subscriptionResult.error) throw new Error(subscriptionResult.error.message);

    const counts = await Promise.all([
      countRows({ supabase, table: 'memberships', orgId }),
      countRows({ supabase, table: 'clients', orgId }),
      countRows({ supabase, table: 'matters', orgId }),
      countRows({ supabase, table: 'documents', orgId }),
      countRows({ supabase, table: 'document_versions', orgId }),
      countRows({ supabase, table: 'tasks', orgId }),
      countRows({ supabase, table: 'quotes', orgId }),
      countRows({ supabase, table: 'invoices', orgId }),
      countRows({ supabase, table: 'payments', orgId }),
      countRows({ supabase, table: 'audit_logs', orgId }),
    ]);

    const ranges = await Promise.all([
      getCreatedAtRange({ supabase, table: 'clients', orgId }),
      getCreatedAtRange({ supabase, table: 'matters', orgId }),
      getCreatedAtRange({ supabase, table: 'documents', orgId }),
      getCreatedAtRange({ supabase, table: 'tasks', orgId }),
      getCreatedAtRange({ supabase, table: 'invoices', orgId, column: 'issued_at' }),
    ]);

    logInfo('admin_export_metadata', { orgId });

    return NextResponse.json(
      {
        generatedAt: new Date().toISOString(),
        org: orgResult.data ?? null,
        trial: trialResult.data ?? null,
        subscription: subscriptionResult.data ?? null,
        counts: {
          members: counts[0],
          clients: counts[1],
          matters: counts[2],
          documents: counts[3],
          document_versions: counts[4],
          tasks: counts[5],
          quotes: counts[6],
          invoices: counts[7],
          payments: counts[8],
          audit_logs: counts[9],
        },
        ranges: {
          clients: ranges[0],
          matters: ranges[1],
          documents: ranges[2],
          tasks: ranges[3],
          invoices: ranges[4],
        },
        requestedBy: {
          userId,
        },
      },
      { status: 200 },
    );
  } catch (error) {
    logError('admin_export_metadata_failed', {
      orgId,
      message: error instanceof Error ? error.message : 'unknown_error',
    });
    return NextResponse.json({ error: 'تعذر تصدير البيانات.' }, { status: 500 });
  }
}
