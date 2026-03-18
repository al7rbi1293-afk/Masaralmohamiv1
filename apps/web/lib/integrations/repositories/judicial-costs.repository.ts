import 'server-only';

import { createSupabaseServerClient } from '@/lib/supabase/server';
import type { NormalizedJudicialCost } from '../domain/models';

export async function upsertJudicialCosts(input: {
  orgId: string;
  matterId?: string | null;
  syncJobId?: string | null;
  externalCaseDbId?: string | null;
  costs: NormalizedJudicialCost[];
}) {
  if (!input.costs.length) {
    return [];
  }

  const supabase = createSupabaseServerClient();
  const payload = input.costs.map((item) => ({
    org_id: input.orgId,
    external_case_id: input.externalCaseDbId ?? null,
    matter_id: input.matterId ?? null,
    sync_job_id: input.syncJobId ?? null,
    provider: item.provider,
    source: item.source,
    external_id: item.externalId,
    cost_type: item.costType,
    title: item.title,
    amount: item.amount,
    currency: item.currency,
    status: item.status,
    invoice_reference: item.invoiceReference,
    due_at: item.dueAt,
    payload_json: item.payloadJson,
    synced_at: item.syncedAt,
  }));

  const { data, error } = await supabase
    .from('judicial_costs')
    .upsert(payload, { onConflict: 'org_id,provider,external_id' })
    .select('*');

  if (error) {
    throw error;
  }

  return data ?? [];
}

export async function listMatterJudicialCosts(orgId: string, matterId: string) {
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from('judicial_costs')
    .select('*')
    .eq('org_id', orgId)
    .eq('matter_id', matterId)
    .order('synced_at', { ascending: false })
    .limit(100);

  if (error) {
    throw error;
  }

  return data ?? [];
}
