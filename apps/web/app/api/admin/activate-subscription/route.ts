import { NextRequest, NextResponse } from 'next/server';
import { timingSafeEqual } from 'crypto';
import { z } from 'zod';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { getAdminActivationSecret } from '@/lib/env';
import { checkRateLimit, getRequestIp, RATE_LIMIT_MESSAGE_AR } from '@/lib/rateLimit';
import { logError, logInfo } from '@/lib/logger';

export const runtime = 'nodejs';

const bodySchema = z.object({
  org_id: z.string().uuid('معرّف المكتب غير صحيح.'),
  plan_code: z.string().trim().min(1, 'الخطة مطلوبة.').max(40, 'الخطة غير صحيحة.'),
  seats: z.preprocess((value) => Number(value), z.number().int().min(1).max(1000)),
  period_days: z.preprocess((value) => Number(value), z.number().int().min(1).max(3650)),
});

function safeEqual(a: string, b: string) {
  const aBuf = Buffer.from(a);
  const bBuf = Buffer.from(b);
  if (aBuf.length !== bBuf.length) return false;
  return timingSafeEqual(aBuf, bBuf);
}

export async function POST(request: NextRequest) {
  const ip = getRequestIp(request);
  const limit = await checkRateLimit({
    key: `admin_activate_subscription:${ip}`,
    limit: 30,
    windowMs: 10 * 60 * 1000,
  });

  if (!limit.allowed) {
    return NextResponse.json({ error: RATE_LIMIT_MESSAGE_AR }, { status: 429 });
  }

  const expected = getAdminActivationSecret();
  const provided = request.headers.get('x-admin-secret')?.trim() ?? '';

  if (!provided || !safeEqual(provided, expected)) {
    return NextResponse.json({ error: 'غير مصرح.' }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'تعذر قراءة البيانات المرسلة.' }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    const message = parsed.error.issues[0]?.message ?? 'تعذر التحقق من البيانات.';
    return NextResponse.json({ error: message }, { status: 400 });
  }

  const orgId = parsed.data.org_id;
  const planCode = parsed.data.plan_code.toUpperCase();
  const seats = parsed.data.seats;
  const periodDays = parsed.data.period_days;

  const now = new Date();
  const periodEnd = new Date(now.getTime() + periodDays * 24 * 60 * 60 * 1000);

  const service = createSupabaseServerClient();

  try {
    const { error: upsertError } = await service
      .from('subscriptions')
      .upsert(
        {
          org_id: orgId,
          plan_code: planCode,
          status: 'active',
          seats,
          current_period_start: now.toISOString(),
          current_period_end: periodEnd.toISOString(),
          cancel_at_period_end: false,
          provider: 'manual',
        },
        { onConflict: 'org_id' },
      );

    if (upsertError) {
      const normalized = String(upsertError.message ?? '').toLowerCase();
      if (normalized.includes('foreign key') || normalized.includes('violates foreign key')) {
        return NextResponse.json({ error: 'الخطة غير صحيحة.' }, { status: 400 });
      }
      throw upsertError;
    }

    const { error: eventError } = await service.from('subscription_events').insert({
      org_id: orgId,
      type: 'activated_manual',
      meta: { plan_code: planCode, seats, period_days: periodDays },
    });

    if (eventError) {
      // Activation succeeded; keep event best-effort.
      logError('subscription_event_insert_failed', {
        orgId,
        type: 'activated_manual',
        message: eventError.message,
      });
    }

    logInfo('subscription_activated_manual', {
      orgId,
      planCode,
      seats,
      periodDays,
    });

    return NextResponse.json(
      {
        ok: true,
      },
      { status: 200 },
    );
  } catch (error) {
    logError('subscription_activate_failed', { orgId, error: error instanceof Error ? error.message : 'unknown_error' });
    return NextResponse.json({ error: 'تعذر تفعيل الاشتراك.' }, { status: 500 });
  }
}
