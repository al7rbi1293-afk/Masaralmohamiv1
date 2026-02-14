import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { checkRateLimit, getRequestIp, RATE_LIMIT_MESSAGE_AR } from '@/lib/rateLimit';
import { requireOwner } from '@/lib/org';
import { createSupabaseServerRlsClient } from '@/lib/supabase/server';
import { encryptJson } from '@/lib/crypto';
import { testNajizOAuth } from '@/lib/integrations/najizClient';
import { logError } from '@/lib/logger';

export const runtime = 'nodejs';

const bodySchema = z.object({
  environment: z.enum(['sandbox', 'production'], {
    errorMap: () => ({ message: 'بيئة Najiz غير صحيحة.' }),
  }),
  base_url: z.string().trim().url('رابط Najiz غير صحيح.'),
  client_id: z.string().trim().min(1, 'معرّف العميل مطلوب.').max(200, 'معرّف العميل طويل جدًا.'),
  client_secret: z.string().trim().min(1, 'سر العميل مطلوب.').max(500, 'سر العميل طويل جدًا.'),
  scope_optional: z.string().trim().max(400, 'قيمة scope طويلة جدًا.').optional(),
});

export async function POST(request: NextRequest) {
  const ip = getRequestIp(request);
  const limit = checkRateLimit({
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

    const config = {
      environment: parsed.data.environment,
      base_url: normalizeBaseUrl(parsed.data.base_url),
      last_error: null,
    };

    const secret_enc = encryptJson({
      client_id: parsed.data.client_id,
      client_secret: parsed.data.client_secret,
      scope: parsed.data.scope_optional ? parsed.data.scope_optional : null,
    });

    const { error: upsertError } = await rls
      .from('org_integrations')
      .upsert(
        {
          org_id: orgId,
          provider: 'najiz',
          status: 'disconnected',
          config,
          secret_enc,
          created_by: userId,
        },
        { onConflict: 'org_id,provider' },
      );

    if (upsertError) {
      throw upsertError;
    }

    const test = await testNajizOAuth({
      baseUrl: config.base_url,
      clientId: parsed.data.client_id,
      clientSecret: parsed.data.client_secret,
      scope: parsed.data.scope_optional ? parsed.data.scope_optional : null,
    });

    const nextStatus = test.ok ? 'connected' : 'error';
    const nextConfig = {
      ...config,
      last_error: test.ok ? null : test.message,
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

  return message || 'تعذر ربط التكامل. حاول مرة أخرى.';
}

