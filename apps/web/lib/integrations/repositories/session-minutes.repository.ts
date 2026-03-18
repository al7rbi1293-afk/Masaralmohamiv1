import 'server-only';

import { createSupabaseServerClient } from '@/lib/supabase/server';
import type { NormalizedSessionMinute } from '../domain/models';

type SessionMinuteRow = {
  id: string;
  org_id: string;
  external_case_id: string | null;
  matter_id: string | null;
  external_id: string;
  session_reference: string | null;
  title: string;
  summary: string | null;
  occurred_at: string | null;
  minute_document_external_id: string | null;
  payload_json: Record<string, unknown> | null;
  synced_at: string;
};

const SESSION_MINUTE_SELECT = [
  'id',
  'org_id',
  'external_case_id',
  'matter_id',
  'external_id',
  'session_reference',
  'title',
  'summary',
  'occurred_at',
  'minute_document_external_id',
  'payload_json',
  'synced_at',
].join(', ');

export async function upsertSessionMinutes(input: {
  orgId: string;
  matterId?: string | null;
  externalCaseDbId?: string | null;
  syncJobId?: string | null;
  minutes: NormalizedSessionMinute[];
}) {
  if (!input.minutes.length) {
    return {
      rows: [] as SessionMinuteRow[],
      createdRows: [] as SessionMinuteRow[],
    };
  }

  const supabase = createSupabaseServerClient();
  const externalIds = input.minutes.map((item) => item.externalId);
  const { data: existingRows, error: existingError } = await supabase
    .from('session_minutes')
    .select('external_id')
    .eq('org_id', input.orgId)
    .in('external_id', externalIds);

  if (existingError) {
    throw existingError;
  }

  const existingExternalIds = new Set(
    ((existingRows as Array<{ external_id: string }> | null) ?? []).map((row) => row.external_id),
  );

  const payload = input.minutes.map((item) => ({
    org_id: input.orgId,
    external_case_id: input.externalCaseDbId ?? null,
    matter_id: input.matterId ?? null,
    sync_job_id: input.syncJobId ?? null,
    provider: item.provider,
    source: item.source,
    external_id: item.externalId,
    session_reference: item.sessionReference,
    title: item.title,
    summary: item.summary,
    occurred_at: item.occurredAt,
    minute_document_external_id: item.minuteDocumentExternalId,
    payload_json: item.payloadJson,
    synced_at: item.syncedAt,
  }));

  const { data, error } = await supabase
    .from('session_minutes')
    .upsert(payload, { onConflict: 'org_id,provider,external_id' })
    .select(SESSION_MINUTE_SELECT);

  if (error) {
    throw error;
  }

  const rows = (((data as unknown) as SessionMinuteRow[] | null) ?? []);
  return {
    rows,
    createdRows: rows.filter((row) => !existingExternalIds.has(row.external_id)),
  };
}

export async function listMatterSessionMinutes(orgId: string, matterId: string) {
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from('session_minutes')
    .select(SESSION_MINUTE_SELECT)
    .eq('org_id', orgId)
    .eq('matter_id', matterId)
    .order('occurred_at', { ascending: false, nullsFirst: false })
    .order('synced_at', { ascending: false })
    .limit(100);

  if (error) {
    throw error;
  }

  return (((data as unknown) as SessionMinuteRow[] | null) ?? []);
}
