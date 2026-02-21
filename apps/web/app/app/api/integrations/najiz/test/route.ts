import { NextRequest, NextResponse } from 'next/server';
import { checkRateLimit, getRequestIp, RATE_LIMIT_MESSAGE_AR } from '@/lib/rateLimit';
import { requireOwner } from '@/lib/org';
import { createSupabaseServerRlsClient } from '@/lib/supabase/server';
import { decryptJson } from '@/lib/crypto';
import { testNajizOAuth } from '@/lib/integrations/najizClient';
import { logError } from '@/lib/logger';

export const runtime = 'nodejs';

type NajizSecrets = {
  client_id: string;
  client_secret: string;
  scope?: string | null;
};

export async function POST(request: NextRequest) {
  const ip = getRequestIp(request);
  const limit = await checkRateLimit({
    key: `integrations:najiz:test:${ip}`,
    limit: 30,
    windowMs: 10 * 60 * 1000,
  });

  if (!limit.allowed) {
    return NextResponse.json({ error: RATE_LIMIT_MESSAGE_AR }, { status: 429 });
  }

  try {
    const { orgId } = await requireOwner();
    const rls = createSupabaseServerRlsClient();

    const { data, error } = await rls
      .from('org_integrations')
      .select('config, secret_enc')
      .eq('org_id', orgId)
      .eq('provider', 'najiz')
      .maybeSingle();

    if (error) {
      throw error;
    }

    if (!data || !(data as any).secret_enc) {
      return NextResponse.json({ error: 'لم يتم إعداد التكامل بعد.' }, { status: 400 });
    }

    const config = (data as any).config ?? {};
    const baseUrl = String((config as any).base_url ?? '').trim();
    if (!baseUrl) {
      return NextResponse.json({ error: 'رابط Najiz غير مضبوط.' }, { status: 400 });
    }

    const secrets = decryptJson<NajizSecrets>(String((data as any).secret_enc));
    const test = await testNajizOAuth({
      baseUrl,
      clientId: String(secrets.client_id ?? ''),
      clientSecret: String(secrets.client_secret ?? ''),
      scope: secrets.scope ? String(secrets.scope) : null,
    });

    const nextStatus = test.ok ? 'connected' : 'error';
    const nextConfig = {
      ...(typeof config === 'object' && config ? config : {}),
      last_error: test.ok ? null : test.message,
    };

    await rls
      .from('org_integrations')
      .update({ status: nextStatus, config: nextConfig })
      .eq('org_id', orgId)
      .eq('provider', 'najiz');

    return NextResponse.json(
      {
        ok: test.ok,
        status: nextStatus,
        message: test.message,
      },
      { status: test.ok ? 200 : 400 },
    );
  } catch (error) {
    const message = toUserMessage(error);
    logError('najiz_test_failed', { message });

    const statusCode =
      message === 'الرجاء تسجيل الدخول.' ? 401 : message === 'لا تملك صلاحية تنفيذ هذا الإجراء.' ? 403 : 400;
    return NextResponse.json({ error: message }, { status: statusCode });
  }
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

  return message || 'تعذر اختبار الاتصال. حاول مرة أخرى.';
}
