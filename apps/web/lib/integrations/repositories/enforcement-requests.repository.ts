import 'server-only';

import { createSupabaseServerClient } from '@/lib/supabase/server';
import type { NormalizedEnforcementRequest, NormalizedEnforcementRequestEvent } from '../domain/models';

type EnforcementRequestRow = {
  id: string;
  org_id: string;
  external_case_id: string | null;
  matter_id: string | null;
  external_id: string;
  request_number: string | null;
  request_type: string;
  title: string;
  status: string;
  applicant_name: string | null;
  respondent_name: string | null;
  amount: number | null;
  currency: string;
  submitted_at: string | null;
  closed_at: string | null;
  payload_json: Record<string, unknown> | null;
  synced_at: string;
};

type EnforcementRequestEventInsert = {
  org_id: string;
  enforcement_request_id: string;
  matter_id: string | null;
  source: string;
  external_id: string;
  action_type: NormalizedEnforcementRequestEvent['actionType'];
  title: string;
  description: string | null;
  occurred_at: string | null;
  payload_json: NormalizedEnforcementRequestEvent['payloadJson'];
  synced_at: string;
};

export async function upsertEnforcementRequests(input: {
  orgId: string;
  matterId?: string | null;
  syncJobId?: string | null;
  externalCaseDbId?: string | null;
  requests: NormalizedEnforcementRequest[];
}) {
  if (!input.requests.length) {
    return [] as EnforcementRequestRow[];
  }

  const supabase = createSupabaseServerClient();
  const payload = input.requests.map((item) => ({
    org_id: input.orgId,
    external_case_id: input.externalCaseDbId ?? null,
    matter_id: input.matterId ?? null,
    sync_job_id: input.syncJobId ?? null,
    provider: item.provider,
    source: item.source,
    external_id: item.externalId,
    request_number: item.requestNumber,
    request_type: item.requestType,
    title: item.title,
    status: item.status,
    applicant_name: item.applicantName,
    respondent_name: item.respondentName,
    amount: item.amount,
    currency: item.currency,
    submitted_at: item.submittedAt,
    closed_at: item.closedAt,
    payload_json: item.payloadJson,
    synced_at: item.syncedAt,
  }));

  const { data, error } = await supabase
    .from('enforcement_requests')
    .upsert(payload, { onConflict: 'org_id,provider,external_id' })
    .select(
      'id, org_id, external_case_id, matter_id, external_id, request_number, request_type, title, status, applicant_name, respondent_name, amount, currency, submitted_at, closed_at, payload_json, synced_at',
    );

  if (error) {
    throw error;
  }

  return (data as EnforcementRequestRow[] | null) ?? [];
}

export async function upsertEnforcementRequestEvents(input: {
  orgId: string;
  matterId?: string | null;
  events: NormalizedEnforcementRequestEvent[];
}) {
  if (!input.events.length) {
    return [] as NormalizedEnforcementRequestEvent[];
  }

  const supabase = createSupabaseServerClient();
  const externalRequestIds = [...new Set(input.events.map((event) => event.externalRequestId))];
  const { data: requests, error: requestsError } = await supabase
    .from('enforcement_requests')
    .select('id, external_id')
    .eq('org_id', input.orgId)
    .in('external_id', externalRequestIds);

  if (requestsError) {
    throw requestsError;
  }

  const requestIdMap = new Map<string, string>();
  for (const row of (requests as Array<{ id: string; external_id: string }> | null) ?? []) {
    requestIdMap.set(row.external_id, row.id);
  }

  const payload = input.events
    .map((event) => {
      const enforcementRequestId = requestIdMap.get(event.externalRequestId);
      if (!enforcementRequestId) {
        return null;
      }

      return {
        org_id: input.orgId,
        enforcement_request_id: enforcementRequestId,
        matter_id: input.matterId ?? null,
        source: event.source,
        external_id: event.externalEventId,
        action_type: event.actionType,
        title: event.title,
        description: event.description,
        occurred_at: event.occurredAt,
        payload_json: event.payloadJson,
        synced_at: event.syncedAt,
      };
    })
    .filter((event): event is EnforcementRequestEventInsert => Boolean(event));

  if (!payload.length) {
    return [] as NormalizedEnforcementRequestEvent[];
  }

  const existingEventIds = payload.map((event) => event.external_id);
  const enforcementRequestIds = [...new Set(payload.map((event) => event.enforcement_request_id))];
  const { data: existingRows, error: existingError } = await supabase
    .from('enforcement_request_events')
    .select('enforcement_request_id, external_id')
    .eq('org_id', input.orgId)
    .in('enforcement_request_id', enforcementRequestIds)
    .in('external_id', existingEventIds);

  if (existingError) {
    throw existingError;
  }

  const existing = new Set(
    ((existingRows as Array<{ enforcement_request_id: string; external_id: string }> | null) ?? []).map(
      (row) => `${row.enforcement_request_id}:${row.external_id}`,
    ),
  );

  const { error } = await supabase
    .from('enforcement_request_events')
    .upsert(payload, { onConflict: 'org_id,source,enforcement_request_id,external_id' });

  if (error) {
    throw error;
  }

  return input.events.filter((event) => {
    const enforcementRequestId = requestIdMap.get(event.externalRequestId);
    if (!enforcementRequestId) {
      return false;
    }

    return !existing.has(`${enforcementRequestId}:${event.externalEventId}`);
  });
}

export async function listMatterEnforcementRequests(orgId: string, matterId: string) {
  const supabase = createSupabaseServerClient();
  const { data: requests, error: requestsError } = await supabase
    .from('enforcement_requests')
    .select(
      'id, org_id, external_case_id, matter_id, external_id, request_number, request_type, title, status, applicant_name, respondent_name, amount, currency, submitted_at, closed_at, payload_json, synced_at',
    )
    .eq('org_id', orgId)
    .eq('matter_id', matterId)
    .order('submitted_at', { ascending: false, nullsFirst: false })
    .order('synced_at', { ascending: false })
    .limit(100);

  if (requestsError) {
    throw requestsError;
  }

  const normalizedRequests = (requests as EnforcementRequestRow[] | null) ?? [];
  if (!normalizedRequests.length) {
    return [];
  }

  const requestIds = normalizedRequests.map((request) => request.id);
  const { data: events, error: eventsError } = await supabase
    .from('enforcement_request_events')
    .select('id, enforcement_request_id, action_type, title, description, occurred_at, synced_at')
    .eq('org_id', orgId)
    .in('enforcement_request_id', requestIds)
    .order('occurred_at', { ascending: false, nullsFirst: false })
    .order('synced_at', { ascending: false });

  if (eventsError) {
    throw eventsError;
  }

  const eventsByRequestId = new Map<
    string,
    Array<{
      id: string;
      action_type: string;
      title: string;
      description: string | null;
      occurred_at: string | null;
      synced_at: string;
    }>
  >();

  for (const event of (events as Array<{
    id: string;
    enforcement_request_id: string;
    action_type: string;
    title: string;
    description: string | null;
    occurred_at: string | null;
    synced_at: string;
  }> | null) ?? []) {
    const bucket = eventsByRequestId.get(event.enforcement_request_id) ?? [];
    bucket.push({
      id: event.id,
      action_type: event.action_type,
      title: event.title,
      description: event.description,
      occurred_at: event.occurred_at,
      synced_at: event.synced_at,
    });
    eventsByRequestId.set(event.enforcement_request_id, bucket);
  }

  return normalizedRequests.map((request) => ({
    ...request,
    events: eventsByRequestId.get(request.id) ?? [],
  }));
}
