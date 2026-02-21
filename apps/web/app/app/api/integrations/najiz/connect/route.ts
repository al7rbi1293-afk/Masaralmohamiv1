import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { checkRateLimit, getRequestIp, RATE_LIMIT_MESSAGE_AR } from '@/lib/rateLimit';
import { requireOwner } from '@/lib/org';
import { createSupabaseServerRlsClient } from '@/lib/supabase/server';
import { decryptJson, encryptJson } from '@/lib/crypto';
import { testNajizOAuth } from '@/lib/integrations/najizClient';
import { logError } from '@/lib/logger';

export const runtime = 'nodejs';

const bodySchema = z.object({
  environment: z.enum(['sandbox', 'production'], {
    errorMap: () => ({ message: 'بيئة Najiz غير صحيحة.' }),
  }),
  base_url: z.string().trim().url('رابط Najiz غير صحيح.'),
  client_id: z.string().trim().min(1, 'معرّف العميل مطلوب.').max(200, 'معرّف العميل طويل جدًا.').optional(),
  client_secret: z.string().trim().min(1, 'سر العميل مطلوب.').max(500, 'سر العميل طويل جدًا.').optional(),
  scope_optional: z.string().trim().max(400, 'قيمة scope طويلة جدًا.').optional(),
});

type NajizSecrets = {
  client_id: string;
  client_secret: string;
  scope?: string | null;
};

export async function POST(request: NextRequest) {
  const ip = getRequestIp(request);
  const limit = await checkRateLimit({
    key: `integrations:najiz:connect:${ip}`,
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

  try {
    const { orgId, userId } = await requireOwner();
    const rls = createSupabaseServerRlsClient();

    const { data: existing, error: existingError } = await rls
      .from('org_integrations')
      .select('id, status, config, secret_enc, updated_at')
      .eq('org_id', orgId)
      .eq('provider', 'najiz')
      .maybeSingle();

    if (existingError) {
      throw existingError;
    }

    const prevConfig =
      existing && typeof (existing as any).config === 'object' && (existing as any).config
        ? ((existing as any).config as Record<string, any>)
        : {};

    const existingSecrets = (existing as any)?.secret_enc
      ? decryptJson<NajizSecrets>(String((existing as any).secret_enc))
      : null;

    const mergedClientId = parsed.data.client_id ?? existingSecrets?.client_id ?? '';
    const mergedClientSecret = parsed.data.client_secret ?? existingSecrets?.client_secret ?? '';
    const mergedScope =
      typeof parsed.data.scope_optional === 'string'
        ? parsed.data.scope_optional || null
        : existingSecrets?.scope ?? null;

    if (!mergedClientId || !mergedClientSecret) {
      return NextResponse.json(
        { error: 'أدخل بيانات OAuth (Client ID و Client Secret) لإعداد التكامل.' },
        { status: 400 },
      );
    }

    const config = {
      ...prevConfig,
      environment: parsed.data.environment,
      base_url: normalizeBaseUrl(parsed.data.base_url),
      last_error: null,
      last_tested_at: new Date().toISOString(),
      previous_status: (existing as any)?.status ?? null,
      previous_updated_at: (existing as any)?.updated_at ?? null,
    };

    const shouldRotateSecrets = Boolean(parsed.data.client_id || parsed.data.client_secret || parsed.data.scope_optional);
    const secret_enc = shouldRotateSecrets
      ? encryptJson({
          client_id: mergedClientId,
          client_secret: mergedClientSecret,
          scope: mergedScope,
        })
      : ((existing as any)?.secret_enc as string | null);

    if (existing) {
      const updatePayload: Record<string, any> = {
        status: 'disconnected',
        config,
      };

      if (secret_enc) {
        updatePayload.secret_enc = secret_enc;
      }

      const { error: updateError } = await rls
        .from('org_integrations')
        .update(updatePayload)
        .eq('org_id', orgId)
        .eq('provider', 'najiz');

      if (updateError) {
        throw updateError;
      }
    } else {
      const { error: insertError } = await rls.from('org_integrations').insert({
        org_id: orgId,
        provider: 'najiz',
        status: 'disconnected',
        config,
        secret_enc: secret_enc ?? encryptJson({ client_id: mergedClientId, client_secret: mergedClientSecret, scope: mergedScope }),
        created_by: userId,
      });

      if (insertError) {
        throw insertError;
      }
    }

    const test = await testNajizOAuth({
      baseUrl: config.base_url,
      clientId: mergedClientId,
      clientSecret: mergedClientSecret,
      scope: mergedScope,
    });

    const nextStatus = test.ok ? 'connected' : 'error';
    const nextConfig = {
      ...config,
      last_error: test.ok ? null : test.message,
      ...(test.ok ? { last_connected_at: new Date().toISOString() } : {}),
    };

    const { error: updateError } = await rls
      .from('org_integrations')
      .update({ status: nextStatus, config: nextConfig })
      .eq('org_id', orgId)
      .eq('provider', 'najiz');

    if (updateError) {
      throw updateError;
    }

    return NextResponse.json(
      {
        ok: test.ok,
        status: nextStatus,
        message: test.message,
        config: nextConfig,
      },
      { status: test.ok ? 200 : 400 },
    );
  } catch (error) {
    const message = toUserMessage(error);
    logError('najiz_connect_failed', { message });

    const statusCode =
      message === 'الرجاء تسجيل الدخول.' ? 401 : message === 'لا تملك صلاحية تنفيذ هذا الإجراء.' ? 403 : 400;
    return NextResponse.json({ error: message }, { status: statusCode });
  }
}

function normalizeBaseUrl(value: string) {
  return String(value || '').trim().replace(/\/+$/, '');
}

function toUserMessage(error: unknown) {
  const message = error instanceof Error ? error.message : '';
  const normalized = message.toLowerCase();

  if (
    normalized.includes('permission denied') ||
    normalized.includes('violates row-level security') ||
    normalized.includes('not allowed')
  ) {
    return 'لا تملك صلاحية تنفيذ هذا الإجراء.';
  }

  if (message.includes('INTEGRATION_ENCRYPTION_KEY')) {
    return 'متغير INTEGRATION_ENCRYPTION_KEY غير مضبوط.';
  }

  if (normalized.includes('unable to authenticate data') || normalized.includes('bad decrypt')) {
    return 'تعذر فك تشفير بيانات التكامل. تحقق من INTEGRATION_ENCRYPTION_KEY ثم أعد حفظ الإعدادات.';
  }

  return message || 'تعذر ربط التكامل. حاول مرة أخرى.';
}
