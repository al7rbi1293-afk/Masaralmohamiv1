import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { checkRateLimit, getRequestIp, RATE_LIMIT_MESSAGE_AR } from '@/lib/rateLimit';
import { requireOwner } from '@/lib/org';
import { createSupabaseServerRlsClient } from '@/lib/supabase/server';
import { decryptJson } from '@/lib/crypto';
import { getNajizAccessToken, najizFetch } from '@/lib/integrations/najizClient';
import { logAudit } from '@/lib/audit';
import { logError, logInfo } from '@/lib/logger';

export const runtime = 'nodejs';

const bodySchema = z.object({
  endpoint_path: z
    .string()
    .trim()
    .min(1, 'مسار Endpoint مطلوب.')
    .max(300, 'مسار Endpoint طويل جدًا.')
    .optional(),
});

type NajizSecrets = {
  client_id: string;
  client_secret: string;
  scope?: string | null;
};

type ExternalCaseRow = {
  org_id: string;
  provider: 'najiz';
  external_id: string;
  title: string;
  court: string | null;
  status: string | null;
  meta: Record<string, any>;
  last_synced_at: string;
};

export async function POST(request: NextRequest) {
  const startedAt = Date.now();
  const ip = getRequestIp(request);
  const limit = checkRateLimit({
    key: `integrations:najiz:sync:${ip}`,
    limit: 10,
    windowMs: 10 * 60 * 1000,
  });

  if (!limit.allowed) {
    return NextResponse.json({ error: RATE_LIMIT_MESSAGE_AR }, { status: 429 });
  }

  const body = await request.json().catch(() => ({}));
  const parsed = bodySchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'البيانات غير صحيحة.' },
      { status: 400 },
    );
  }

  const rls = createSupabaseServerRlsClient();
  let orgId = '';
  let userId = '';
  let endpointPath = '';
  let receivedCount = 0;
  let importedCount = 0;

  try {
    const owner = await requireOwner();
    orgId = owner.orgId;
    userId = owner.userId;

    const { data: integration, error: integrationError } = await rls
      .from('org_integrations')
      .select('config, secret_enc')
      .eq('org_id', orgId)
      .eq('provider', 'najiz')
      .maybeSingle();

    if (integrationError) {
      throw integrationError;
    }

    if (!integration || !(integration as any).secret_enc) {
      return NextResponse.json({ error: 'لم يتم إعداد التكامل بعد.' }, { status: 400 });
    }

    const configRaw = (integration as any).config ?? {};
    const config = typeof configRaw === 'object' && configRaw ? (configRaw as Record<string, any>) : {};

    const baseUrl = String(config.base_url ?? '').trim();
    if (!baseUrl) {
      return NextResponse.json({ error: 'رابط Najiz غير مضبوط.' }, { status: 400 });
    }

    endpointPath = normalizeEndpointPath(
      parsed.data.endpoint_path ?? (config.sync_path ? String(config.sync_path) : ''),
    );

    if (!endpointPath) {
      return NextResponse.json({ error: 'حدد مسار Endpoint للمزامنة أولاً.' }, { status: 400 });
    }

    const secrets = decryptJson<NajizSecrets>(String((integration as any).secret_enc));
    if (!secrets?.client_id || !secrets?.client_secret) {
      return NextResponse.json({ error: 'بيانات Najiz غير مكتملة.' }, { status: 400 });
    }

    // Persist the sync path as part of the integration config.
    const nextConfig = {
      ...config,
      sync_path: endpointPath,
      last_error: null,
    };

    await rls
      .from('org_integrations')
      .update({ config: nextConfig })
      .eq('org_id', orgId)
      .eq('provider', 'najiz');

    const accessToken = await getNajizAccessToken({
      baseUrl,
      clientId: String(secrets.client_id),
      clientSecret: String(secrets.client_secret),
      scope: secrets.scope ? String(secrets.scope) : null,
    });

    const url = buildEndpointUrl(baseUrl, endpointPath);
    const response = await najizFetch(
      url,
      {
        method: 'GET',
        headers: {
          Accept: 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        cache: 'no-store',
      },
      { throttleKey: baseUrl, maxAttempts: 3, timeoutMs: 15_000 },
    );

    if (!response.ok) {
      throw new Error(`فشل طلب المزامنة (${response.status}). تحقق من endpoint.`);
    }

    const json = (await response.json().catch(() => null)) as any;
    const items = extractItems(json);
    receivedCount = items.length;

    if (!items.length) {
      return NextResponse.json(
        { error: 'لم يتم العثور على بيانات قابلة للاستيراد. تحقق من endpoint.' },
        { status: 400 },
      );
    }

    const nowIso = new Date().toISOString();
    const normalized = normalizeExternalCases(items.slice(0, 200), orgId, nowIso);
    importedCount = normalized.length;

    if (!normalized.length) {
      return NextResponse.json(
        { error: 'لم يتم العثور على عناصر صالحة (بدون معرف خارجي).' },
        { status: 400 },
      );
    }

    for (const chunk of chunkArray(normalized, 100)) {
      const { error: upsertError } = await rls
        .from('external_cases')
        .upsert(chunk, { onConflict: 'org_id,provider,external_id' });

      if (upsertError) {
        throw upsertError;
      }
    }

    await rls.from('najiz_sync_runs').insert({
      org_id: orgId,
      provider: 'najiz',
      endpoint_path: endpointPath,
      status: 'completed',
      imported_count: importedCount,
      error: null,
      created_by: userId,
    });

    await rls
      .from('org_integrations')
      .update({ status: 'connected', config: nextConfig })
      .eq('org_id', orgId)
      .eq('provider', 'najiz');

    await logAudit({
      action: 'najiz.sync_run',
      entityType: 'integration',
      entityId: null,
      meta: { imported_count: importedCount },
      req: request,
    });

    logInfo('najiz_sync_completed', {
      org_id: orgId,
      imported_count: importedCount,
      received_count: receivedCount,
      duration_ms: Date.now() - startedAt,
    });

    return NextResponse.json(
      {
        ok: true,
        imported_count: importedCount,
        received_count: receivedCount,
      },
      { status: 200 },
    );
  } catch (error) {
    const message = toUserMessage(error);
    logError('najiz_sync_failed', {
      org_id: orgId || undefined,
      imported_count: importedCount,
      received_count: receivedCount,
      duration_ms: Date.now() - startedAt,
      message,
    });

    if (orgId && userId && endpointPath) {
      await rls.from('najiz_sync_runs').insert({
        org_id: orgId,
        provider: 'najiz',
        endpoint_path: endpointPath,
        status: 'failed',
        imported_count: 0,
        error: message.slice(0, 240),
        created_by: userId,
      });

      // Best-effort integration status update.
      await rls
        .from('org_integrations')
        .update({
          status: 'error',
          config: { last_error: message, sync_path: endpointPath },
        })
        .eq('org_id', orgId)
        .eq('provider', 'najiz');
    }

    const statusCode =
      message === 'الرجاء تسجيل الدخول.' ? 401 : message === 'لا تملك صلاحية تنفيذ هذا الإجراء.' ? 403 : 400;
    return NextResponse.json({ error: message }, { status: statusCode });
  }
}

function normalizeEndpointPath(value: string) {
  const trimmed = String(value || '').trim();
  if (!trimmed) return '';
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) return trimmed;
  if (trimmed.startsWith('/')) return trimmed;
  return `/${trimmed}`;
}

function buildEndpointUrl(baseUrl: string, endpointPath: string) {
  if (endpointPath.startsWith('http://') || endpointPath.startsWith('https://')) {
    return endpointPath;
  }
  const base = String(baseUrl || '').trim().replace(/\/+$/, '');
  const path = String(endpointPath || '').trim();
  return `${base}${path.startsWith('/') ? '' : '/'}${path}`;
}

function extractItems(payload: any): any[] {
  if (Array.isArray(payload)) return payload;
  if (!payload || typeof payload !== 'object') return [];

  const candidates = ['items', 'data', 'results', 'cases', 'sessions'];
  for (const key of candidates) {
    const value = (payload as any)[key];
    if (Array.isArray(value)) return value;
  }

  return [];
}

function normalizeExternalCases(items: any[], orgId: string, nowIso: string): ExternalCaseRow[] {
  const rows: ExternalCaseRow[] = [];

  for (const item of items) {
    const externalId = pickString(item, [
      'external_id',
      'externalId',
      'case_id',
      'caseId',
      'id',
      'number',
      'case_number',
      'caseNumber',
      'reference',
      'ref',
    ]);

    if (!externalId) {
      continue;
    }

    const title =
      pickString(item, ['title', 'case_title', 'caseTitle', 'subject', 'name', 'case_name', 'caseName']) ||
      `قضية ${externalId}`;

    const court = pickString(item, ['court', 'court_name', 'courtName', 'courtTitle']) || null;
    const status = pickString(item, ['status', 'state', 'case_status', 'caseStatus']) || null;

    rows.push({
      org_id: orgId,
      provider: 'najiz',
      external_id: externalId,
      title,
      court,
      status,
      meta: item && typeof item === 'object' ? item : { value: item },
      last_synced_at: nowIso,
    });
  }

  return rows;
}

function pickString(obj: any, keys: string[]) {
  if (!obj || typeof obj !== 'object') return '';
  for (const key of keys) {
    const value = (obj as any)[key];
    if (typeof value === 'string') {
      const trimmed = value.trim();
      if (trimmed) return trimmed;
    }
    if (typeof value === 'number' && Number.isFinite(value)) {
      return String(value);
    }
  }
  return '';
}

function chunkArray<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

function toUserMessage(error: unknown) {
  if (error instanceof Error) {
    const message = error.message || '';
    const normalized = message.toLowerCase();

    if (message.includes('aborted')) {
      return 'انتهت مهلة الاتصال بـ Najiz. حاول مرة أخرى.';
    }

    if (message.includes('INTEGRATION_ENCRYPTION_KEY')) {
      return 'متغير INTEGRATION_ENCRYPTION_KEY غير مضبوط.';
    }

    if (normalized.includes('unable to authenticate data') || normalized.includes('bad decrypt')) {
      return 'تعذر فك تشفير بيانات التكامل. تحقق من INTEGRATION_ENCRYPTION_KEY ثم أعد حفظ الإعدادات.';
    }

    return message;
  }
  return 'تعذر تنفيذ المزامنة. حاول مرة أخرى.';
}
