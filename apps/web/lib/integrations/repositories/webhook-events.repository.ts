import 'server-only';

import { createSupabaseServerClient } from '@/lib/supabase/server';
import type { IntegrationProviderKey, IntegrationWebhookEventRecord, JsonObject } from '../domain/models';

type WebhookEventRow = {
  id: string;
  org_id: string | null;
  integration_id: string | null;
  provider: IntegrationProviderKey;
  source: string;
  event_type: string;
  delivery_id: string | null;
  external_entity_id: string | null;
  status: IntegrationWebhookEventRecord['status'];
  headers_json: JsonObject | null;
  payload_json: JsonObject | null;
  received_at: string;
  processed_at: string | null;
  error_message: string | null;
  created_at: string;
  updated_at: string;
};

const WEBHOOK_SELECT = [
  'id',
  'org_id',
  'integration_id',
  'provider',
  'source',
  'event_type',
  'delivery_id',
  'external_entity_id',
  'status',
  'headers_json',
  'payload_json',
  'received_at',
  'processed_at',
  'error_message',
  'created_at',
  'updated_at',
].join(', ');

function normalizeRow(row: WebhookEventRow): IntegrationWebhookEventRecord {
  return {
    id: row.id,
    orgId: row.org_id,
    integrationId: row.integration_id,
    provider: row.provider,
    source: row.source,
    eventType: row.event_type,
    deliveryId: row.delivery_id,
    externalEntityId: row.external_entity_id,
    status: row.status,
    headersJson: row.headers_json ?? {},
    payloadJson: row.payload_json ?? {},
    receivedAt: row.received_at,
    processedAt: row.processed_at,
    errorMessage: row.error_message,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function createWebhookEvent(input: {
  orgId?: string | null;
  integrationId?: string | null;
  provider: IntegrationProviderKey;
  source?: string;
  eventType: string;
  deliveryId?: string | null;
  externalEntityId?: string | null;
  headersJson?: JsonObject;
  payloadJson?: JsonObject;
}) {
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from('integration_webhook_events')
    .insert({
      org_id: input.orgId ?? null,
      integration_id: input.integrationId ?? null,
      provider: input.provider,
      source: input.source ?? input.provider,
      event_type: input.eventType,
      delivery_id: input.deliveryId ?? null,
      external_entity_id: input.externalEntityId ?? null,
      headers_json: input.headersJson ?? {},
      payload_json: input.payloadJson ?? {},
      status: 'pending',
    })
    .select(WEBHOOK_SELECT)
    .single();

  if (error) {
    throw error;
  }

  return normalizeRow((data as unknown) as WebhookEventRow);
}

export async function updateWebhookEvent(
  eventId: string,
  update: Partial<{
    orgId: string | null;
    integrationId: string | null;
    status: IntegrationWebhookEventRecord['status'];
    processedAt: string | null;
    errorMessage: string | null;
    payloadJson: JsonObject;
  }>,
) {
  const supabase = createSupabaseServerClient();
  const payload: Record<string, unknown> = {};
  if (update.orgId !== undefined) payload.org_id = update.orgId;
  if (update.integrationId !== undefined) payload.integration_id = update.integrationId;
  if (update.status !== undefined) payload.status = update.status;
  if (update.processedAt !== undefined) payload.processed_at = update.processedAt;
  if (update.errorMessage !== undefined) payload.error_message = update.errorMessage;
  if (update.payloadJson !== undefined) payload.payload_json = update.payloadJson;

  const { data, error } = await supabase
    .from('integration_webhook_events')
    .update(payload)
    .eq('id', eventId)
    .select(WEBHOOK_SELECT)
    .single();

  if (error) {
    throw error;
  }

  return normalizeRow((data as unknown) as WebhookEventRow);
}

export async function listRecentWebhookEvents(options: { provider?: IntegrationProviderKey; limit?: number } = {}) {
  const supabase = createSupabaseServerClient();
  let query = supabase
    .from('integration_webhook_events')
    .select(WEBHOOK_SELECT)
    .order('received_at', { ascending: false })
    .limit(options.limit ?? 100);

  if (options.provider) {
    query = query.eq('provider', options.provider);
  }

  const { data, error } = await query;
  if (error) {
    throw error;
  }

  return ((((data as unknown) as WebhookEventRow[] | null) ?? [])).map(normalizeRow);
}
