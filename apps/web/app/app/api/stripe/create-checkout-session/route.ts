import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { checkRateLimit, getRequestIp, RATE_LIMIT_MESSAGE_AR } from '@/lib/rateLimit';
import { getStripePriceId, getPublicSiteUrl } from '@/lib/env';
import { getStripe } from '@/lib/stripe';
import { ensureSubscriptionRowExists } from '@/lib/subscriptions';
import { getCurrentAuthUser } from '@/lib/supabase/auth-session';
import { requireOwner } from '@/lib/org';
import { logError, logInfo } from '@/lib/logger';
import { isMissingRelationError } from '@/lib/shared-utils';

export const runtime = 'nodejs';

const bodySchema = z.object({
  plan_code: z.enum(['SOLO', 'TEAM', 'PRO'], {
    errorMap: () => ({ message: 'الخطة غير صحيحة.' }),
  }),
});



export async function POST(request: NextRequest) {
  const ip = getRequestIp(request);
  const limit = await checkRateLimit({
    key: `stripe_checkout:${ip}`,
    limit: 10,
    windowMs: 10 * 60 * 1000,
  });

  if (!limit.allowed) {
    return NextResponse.json({ error: RATE_LIMIT_MESSAGE_AR }, { status: 429 });
  }

  const user = await getCurrentAuthUser();
  if (!user) {
    return NextResponse.json({ error: 'الرجاء تسجيل الدخول.' }, { status: 401 });
  }

  let parsedBody: unknown = {};
  try {
    parsedBody = await request.json();
  } catch {
    // ignore
  }

  const parsed = bodySchema.safeParse(parsedBody);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'تعذر التحقق من البيانات.' },
      { status: 400 },
    );
  }

  const planCode = parsed.data.plan_code.toUpperCase();

  try {
    const { orgId } = await requireOwner();

    // Ensure a subscription row exists (owner-only, RLS enforced).
    const subscription = await ensureSubscriptionRowExists();

    // If the org already has an active subscription period, avoid creating duplicates (MVP behavior).
    const periodEnd = subscription.current_period_end ? new Date(subscription.current_period_end) : null;
    if (
      (subscription.status === 'active' || subscription.status === 'past_due') &&
      periodEnd &&
      !Number.isNaN(periodEnd.getTime()) &&
      periodEnd.getTime() > Date.now()
    ) {
      return NextResponse.json({ error: 'الاشتراك نشط بالفعل.' }, { status: 409 });
    }

    let priceId = '';
    try {
      priceId = getStripePriceId(planCode);
    } catch {
      return NextResponse.json({ error: 'هذه الخطة غير متاحة للدفع الإلكتروني حالياً.' }, { status: 400 });
    }

    const siteUrl = getPublicSiteUrl();
    const stripe = getStripe();

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      line_items: [{ price: priceId, quantity: 1 }],
      customer: subscription.provider_customer_id || undefined,
      customer_email: subscription.provider_customer_id ? undefined : user.email,
      success_url: `${siteUrl}/app/settings/subscription?success=1`,
      cancel_url: `${siteUrl}/app/settings/subscription?canceled=1`,
      client_reference_id: orgId,
      metadata: {
        org_id: orgId,
        plan_code: planCode,
        user_id: user.id,
      },
      subscription_data: {
        metadata: {
          org_id: orgId,
          plan_code: planCode,
        },
      },
    });

    logInfo('stripe_checkout_session_created', { orgId, planCode });

    if (!session.url) {
      return NextResponse.json({ error: 'تعذر إنشاء جلسة الدفع.' }, { status: 500 });
    }

    return NextResponse.json({ url: session.url }, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'unknown_error';
    if (isMissingRelationError(message)) {
      return NextResponse.json(
        { error: 'لم يتم إعداد جداول الاشتراك بعد. طبّق مِجريشن الاشتراكات أولاً.' },
        { status: 500 },
      );
    }
    logError('stripe_checkout_session_failed', { message });
    return NextResponse.json({ error: 'تعذر إنشاء جلسة الدفع.' }, { status: 500 });
  }
}
