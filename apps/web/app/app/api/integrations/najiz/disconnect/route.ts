import { NextRequest, NextResponse } from 'next/server';
import { checkRateLimit, getRequestIp, RATE_LIMIT_MESSAGE_AR } from '@/lib/rateLimit';
import { requireOwner } from '@/lib/org';
import { createSupabaseServerRlsClient } from '@/lib/supabase/server';
import { logError } from '@/lib/logger';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  const ip = getRequestIp(request);
  const limit = await checkRateLimit({
    key: `integrations:najiz:disconnect:${ip}`,
    limit: 15,
    windowMs: 10 * 60 * 1000,
  });

  if (!limit.allowed) {
    return NextResponse.json({ error: RATE_LIMIT_MESSAGE_AR }, { status: 429 });
  }

  try {
    const { orgId } = await requireOwner();
    const rls = createSupabaseServerRlsClient();

    const { data: existing, error: fetchError } = await rls
      .from('org_integrations')
      .select('config')
      .eq('org_id', orgId)
      .eq('provider', 'najiz')
      .maybeSingle();

    if (fetchError) {
      throw fetchError;
    }

    const config = (existing as any)?.config ?? {};
    const nextConfig = {
      ...(typeof config === 'object' && config ? config : {}),
      last_error: null,
    };

    const { error: updateError } = await rls
      .from('org_integrations')
      .update({
        status: 'disconnected',
        secret_enc: null,
        config: nextConfig,
      })
      .eq('org_id', orgId)
      .eq('provider', 'najiz');

    if (updateError) {
      throw updateError;
    }

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (error) {
    const message = toUserMessage(error);
    logError('najiz_disconnect_failed', { message });

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

  return message || 'تعذر فصل التكامل. حاول مرة أخرى.';
}

