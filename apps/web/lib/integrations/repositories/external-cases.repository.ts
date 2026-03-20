import 'server-only';

import { createSupabaseServerClient } from '@/lib/supabase/server';
import type { JsonObject, NormalizedExternalCase, NormalizedExternalCaseEvent } from '../domain/models';

type ExternalCaseRow = {
  id: string;
  org_id: string;
  external_id: string;
  source?: string | null;
  case_number: string | null;
  title: string;
  court: string | null;
  status: string | null;
  payload_json: JsonObject | null;
  synced_at: string;
  last_synced_at?: string | null;
  matter_id: string | null;
};

export type MatterExternalCaseSyncSummary = {
  matterId: string;
  source: string;
  syncedAt: string;
  externalId: string;
  caseNumber: string | null;
  status: string | null;
};

export async function getExternalCaseById(orgId: string, externalCaseId: string) {
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from('external_cases')
    .select('id, org_id, external_id, case_number, title, court, status, payload_json, synced_at, matter_id')
    .eq('org_id', orgId)
    .eq('id', externalCaseId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return (data as ExternalCaseRow | null) ?? null;
}

export async function linkExternalCaseToMatter(input: {
  orgId: string;
  externalCaseId: string;
  matterId: string;
}) {
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from('external_cases')
    .update({
      matter_id: input.matterId,
    })
    .eq('org_id', input.orgId)
    .eq('id', input.externalCaseId)
    .is('matter_id', null)
    .select('id, matter_id')
    .maybeSingle();

  if (error) {
    throw error;
  }

  return Boolean(data?.id);
}

export async function findMatterExternalCase(orgId: string, matterId: string, fallbackCaseNumber?: string | null) {
  const supabase = createSupabaseServerClient();

  const { data: linkedCase, error: linkedError } = await supabase
    .from('external_cases')
    .select('id, org_id, external_id, case_number, title, court, status, payload_json, synced_at, matter_id')
    .eq('org_id', orgId)
    .eq('matter_id', matterId)
    .order('synced_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (linkedError) {
    throw linkedError;
  }

  if (linkedCase) {
    return linkedCase as ExternalCaseRow;
  }

  const normalizedFallback = typeof fallbackCaseNumber === 'string' ? fallbackCaseNumber.trim() : '';
  if (!normalizedFallback) {
    return null;
  }

  const { data: fallbackCase, error: fallbackError } = await supabase
    .from('external_cases')
    .select('id, org_id, external_id, case_number, title, court, status, payload_json, synced_at, matter_id')
    .eq('org_id', orgId)
    .or(`external_id.eq.${normalizedFallback},case_number.eq.${normalizedFallback}`)
    .order('synced_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (fallbackError) {
    throw fallbackError;
  }

  return (fallbackCase as ExternalCaseRow | null) ?? null;
}

export async function upsertExternalCases(input: {
  orgId: string;
  linkedMatterId?: string | null;
  linkedBy?: string | null;
  cases: NormalizedExternalCase[];
}) {
  if (!input.cases.length) {
    return [] as ExternalCaseRow[];
  }

  const supabase = createSupabaseServerClient();
  const nowIso = new Date().toISOString();
  const payload = input.cases.map((item) => ({
    org_id: input.orgId,
    provider: item.provider,
    source: item.source,
    external_id: item.externalId,
    case_number: item.caseNumber,
    case_reference: item.caseReference,
    title: item.title,
    court: item.court,
    status: item.status,
    payload_json: item.payloadJson,
    meta: item.payloadJson,
    synced_at: item.syncedAt,
    last_synced_at: item.syncedAt,
    matter_id: input.linkedMatterId ?? null,
    linked_by: input.linkedBy ?? null,
    updated_at: nowIso,
  }));

  const { data, error } = await supabase
    .from('external_cases')
    .upsert(payload, { onConflict: 'org_id,provider,external_id' })
    .select('id, org_id, external_id, case_number, title, court, status, payload_json, synced_at, matter_id');

  if (error) {
    throw error;
  }

  return (data as ExternalCaseRow[] | null) ?? [];
}

export async function upsertExternalCaseEvents(input: {
  orgId: string;
  linkedMatterId?: string | null;
  events: NormalizedExternalCaseEvent[];
}) {
  if (!input.events.length) {
    return [] as NormalizedExternalCaseEvent[];
  }

  const supabase = createSupabaseServerClient();
  const externalCaseIds = [...new Set(input.events.map((event) => event.externalCaseId))];
  const { data: cases, error: casesError } = await supabase
    .from('external_cases')
    .select('id, external_id')
    .eq('org_id', input.orgId)
    .in('external_id', externalCaseIds);

  if (casesError) {
    throw casesError;
  }

  const caseIdMap = new Map<string, string>();
  for (const row of (cases as Array<{ id: string; external_id: string }> | null) ?? []) {
    caseIdMap.set(row.external_id, row.id);
  }

  const existingEventIds = input.events.map((event) => event.externalEventId);
  const { data: existingRows, error: existingError } = await supabase
    .from('external_case_events')
    .select('external_id')
    .eq('org_id', input.orgId)
    .in('external_id', existingEventIds);

  if (existingError) {
    throw existingError;
  }

  const existing = new Set(
    ((existingRows as Array<{ external_id: string }> | null) ?? []).map((row) => row.external_id),
  );

  const payload = input.events
    .map((event) => {
      const externalCaseDbId = caseIdMap.get(event.externalCaseId);
      if (!externalCaseDbId) {
        return null;
      }

      return {
        org_id: input.orgId,
        external_case_id: externalCaseDbId,
        matter_id: input.linkedMatterId ?? null,
        source: event.source,
        external_id: event.externalEventId,
        event_type: event.eventType,
        title: event.title,
        description: event.description,
        occurred_at: event.occurredAt,
        payload_json: event.payloadJson,
        synced_at: event.syncedAt,
      };
    })
    .filter(Boolean);

  if (!payload.length) {
    return [] as NormalizedExternalCaseEvent[];
  }

  const { error } = await supabase
    .from('external_case_events')
    .upsert(payload, { onConflict: 'org_id,source,external_case_id,external_id' });

  if (error) {
    throw error;
  }

  return input.events.filter((event) => !existing.has(event.externalEventId));
}

export async function listMatterExternalCaseOverview(orgId: string, matterId: string) {
  const supabase = createSupabaseServerClient();
  const externalCase = await findMatterExternalCase(orgId, matterId);

  if (!externalCase) {
    return {
      externalCase: null,
      events: [] as Array<{
        id: string;
        title: string;
        description: string | null;
        event_type: string;
        occurred_at: string | null;
        synced_at: string;
      }>,
    };
  }

  const { data: events, error } = await supabase
    .from('external_case_events')
    .select('id, title, description, event_type, occurred_at, synced_at')
    .eq('org_id', orgId)
    .eq('external_case_id', externalCase.id)
    .order('occurred_at', { ascending: false, nullsFirst: false })
    .limit(100);

  if (error) {
    throw error;
  }

  return {
    externalCase,
    events: (events as Array<{
      id: string;
      title: string;
      description: string | null;
      event_type: string;
      occurred_at: string | null;
      synced_at: string;
    }> | null) ?? [],
  };
}

export async function listMatterExternalCaseSyncSummaries(
  orgId: string,
  matters: Array<{ id: string; najizCaseNumber: string | null }>,
) {
  const normalizedMatters = matters
    .map((matter) => ({
      id: matter.id,
      najizCaseNumber: typeof matter.najizCaseNumber === 'string' ? matter.najizCaseNumber.trim() : '',
    }))
    .filter((matter) => matter.id);

  if (!normalizedMatters.length) {
    return new Map<string, MatterExternalCaseSyncSummary>();
  }

  const supabase = createSupabaseServerClient();
  const matterIds = normalizedMatters.map((matter) => matter.id);
  const fallbackCaseNumbers = [...new Set(normalizedMatters.map((matter) => matter.najizCaseNumber).filter(Boolean))];

  const [linkedResult, fallbackResult] = await Promise.all([
    supabase
      .from('external_cases')
      .select('matter_id, source, external_id, case_number, status, synced_at, last_synced_at')
      .eq('org_id', orgId)
      .in('matter_id', matterIds)
      .order('last_synced_at', { ascending: false, nullsFirst: false }),
    fallbackCaseNumbers.length
      ? supabase
          .from('external_cases')
          .select('matter_id, source, external_id, case_number, status, synced_at, last_synced_at')
          .eq('org_id', orgId)
          .or(
            `case_number.in.(${fallbackCaseNumbers.map(escapeSupabaseListValue).join(',')}),external_id.in.(${fallbackCaseNumbers.map(escapeSupabaseListValue).join(',')})`,
          )
          .order('last_synced_at', { ascending: false, nullsFirst: false })
      : Promise.resolve({ data: [], error: null } as const),
  ]);

  if (linkedResult.error) {
    throw linkedResult.error;
  }

  if (fallbackResult.error) {
    throw fallbackResult.error;
  }

  const linkedRows = ((linkedResult.data as Array<{
    matter_id: string | null;
    source: string | null;
    external_id: string;
    case_number: string | null;
    status: string | null;
    synced_at: string;
    last_synced_at: string | null;
  }> | null) ?? []);

  const fallbackRows = ((fallbackResult.data as Array<{
    matter_id: string | null;
    source: string | null;
    external_id: string;
    case_number: string | null;
    status: string | null;
    synced_at: string;
    last_synced_at: string | null;
  }> | null) ?? []);

  const summaryByMatterId = new Map<string, MatterExternalCaseSyncSummary>();

  for (const row of linkedRows) {
    const matterId = typeof row.matter_id === 'string' ? row.matter_id : '';
    if (!matterId || summaryByMatterId.has(matterId)) {
      continue;
    }

    summaryByMatterId.set(matterId, {
      matterId,
      source: normalizeOptionalString(row.source) ?? 'najiz',
      syncedAt: row.last_synced_at ?? row.synced_at,
      externalId: row.external_id,
      caseNumber: row.case_number,
      status: row.status,
    });
  }

  const fallbackByCaseNumber = new Map<string, MatterExternalCaseSyncSummary>();
  for (const row of fallbackRows) {
    const fallbackKey = normalizeOptionalString(row.case_number) ?? row.external_id;
    if (!fallbackKey || fallbackByCaseNumber.has(fallbackKey)) {
      continue;
    }

    fallbackByCaseNumber.set(fallbackKey, {
      matterId: typeof row.matter_id === 'string' ? row.matter_id : '',
      source: normalizeOptionalString(row.source) ?? 'najiz',
      syncedAt: row.last_synced_at ?? row.synced_at,
      externalId: row.external_id,
      caseNumber: row.case_number,
      status: row.status,
    });
  }

  for (const matter of normalizedMatters) {
    if (summaryByMatterId.has(matter.id) || !matter.najizCaseNumber) {
      continue;
    }

    const fallback = fallbackByCaseNumber.get(matter.najizCaseNumber);
    if (fallback) {
      summaryByMatterId.set(matter.id, {
        ...fallback,
        matterId: matter.id,
      });
    }
  }

  return summaryByMatterId;
}

function normalizeOptionalString(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function escapeSupabaseListValue(value: string) {
  return `"${value.replace(/["\\]/g, '\\$&')}"`;
}
