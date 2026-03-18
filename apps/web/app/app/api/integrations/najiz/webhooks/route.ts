import { NextRequest, NextResponse } from 'next/server';
import {
  enqueueNajizMatterRefreshForSystem,
  resolveNajizWebhookTarget,
} from '@/lib/integrations/domain/services/najiz-orchestration.service';
import { getIntegrationAccount } from '@/lib/integrations/repositories/integration-accounts.repository';
import { createWebhookEvent, updateWebhookEvent } from '@/lib/integrations/repositories/webhook-events.repository';
import type { JsonObject } from '@/lib/integrations/domain/models';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  if (!isWebhookAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const payload = await request.json().catch(() => null);
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
  }

  const body = payload as JsonObject;
  const orgId = pickString(body, ['org_id', 'organization_id', 'orgId', 'organizationId']);
  const eventType =
    pickString(body, ['event_type', 'eventType', 'type']) ??
    request.headers.get('x-najiz-event') ??
    'najiz.event';
  const deliveryId =
    request.headers.get('x-najiz-delivery-id') ??
    request.headers.get('x-request-id') ??
    pickString(body, ['delivery_id', 'deliveryId']);
  const externalEntityId = pickString(body, ['external_entity_id', 'externalEntityId', 'case_id', 'caseId']);

  const account = orgId ? await getIntegrationAccount(orgId, 'najiz').catch(() => null) : null;
  const event = await createWebhookEvent({
    orgId,
    integrationId: account?.id ?? null,
    provider: 'najiz',
    eventType,
    deliveryId,
    externalEntityId,
    headersJson: collectHeaders(request),
    payloadJson: body,
  });

  try {
    if (!orgId || !account) {
      await updateWebhookEvent(event.id, {
        status: 'ignored',
        processedAt: new Date().toISOString(),
        errorMessage: 'integration_account_not_found',
      });
      return NextResponse.json({ ok: true, accepted: false, reason: 'integration_account_not_found' }, { status: 202 });
    }

    const target = await resolveNajizWebhookTarget(orgId, body);
    if (!target.matterId) {
      await updateWebhookEvent(event.id, {
        status: 'ignored',
        processedAt: new Date().toISOString(),
        errorMessage: 'matter_not_resolved',
      });
      return NextResponse.json({ ok: true, accepted: false, reason: 'matter_not_resolved' }, { status: 202 });
    }

    const queued = await enqueueNajizMatterRefreshForSystem({
      orgId,
      matterId: target.matterId,
      caseNumber: target.caseNumber,
      preferredUserId: null,
      triggerMode: 'webhook',
      webhookEventId: event.id,
    });

    if (queued.reused) {
      await updateWebhookEvent(event.id, {
        status: 'processed',
        processedAt: new Date().toISOString(),
        errorMessage: 'merged_into_existing_job',
      });
    }

    return NextResponse.json(
      {
        ok: true,
        accepted: true,
        job_id: queued.job.id,
        reused: queued.reused,
      },
      { status: 202 },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : 'najiz_webhook_failed';
    await updateWebhookEvent(event.id, {
      status: 'failed',
      processedAt: new Date().toISOString(),
      errorMessage: message,
    }).catch(() => undefined);

    return NextResponse.json({ error: message }, { status: 500 });
  }
}

function isWebhookAuthorized(request: NextRequest) {
  const configuredSecret = process.env.NAJIZ_WEBHOOK_SECRET?.trim();
  if (!configuredSecret) {
    return process.env.NODE_ENV !== 'production';
  }

  const authorization = request.headers.get('authorization');
  const provided =
    request.headers.get('x-najiz-webhook-secret') ??
    request.headers.get('x-webhook-secret') ??
    (authorization?.startsWith('Bearer ') ? authorization.slice('Bearer '.length).trim() : null);

  return provided === configuredSecret;
}

function collectHeaders(request: NextRequest): JsonObject {
  const headers: JsonObject = {};
  request.headers.forEach((value, key) => {
    headers[key] = value;
  });
  return headers;
}

function pickString(source: JsonObject, keys: string[]) {
  for (const key of keys) {
    const value = source[key];
    if (typeof value === 'string' && value.trim()) {
      return value.trim();
    }
  }
  return null;
}
