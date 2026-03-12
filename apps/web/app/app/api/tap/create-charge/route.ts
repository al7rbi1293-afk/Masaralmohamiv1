import { NextRequest, NextResponse } from 'next/server';
import { getCurrentAuthUser } from '@/lib/supabase/auth-session';
import { requireOwner } from '@/lib/org';
import { tapCreateChargeSchema } from '@/lib/partners/validation';
import { resolveBillingPlan } from '@/lib/partners/plan';
import { createTapCharge, normalizeTapStatus } from '@/lib/partners/tap';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { readReferralContextFromCookies } from '@/lib/partners/referral';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  const user = await getCurrentAuthUser();
  if (!user) {
    return NextResponse.json({ error: 'الرجاء تسجيل الدخول.' }, { status: 401 });
  }

  let orgId: string;
  try {
    const owner = await requireOwner();
    orgId = owner.orgId;
  } catch {
    return NextResponse.json({ error: 'لا تملك صلاحية إنشاء عملية الدفع.' }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'تعذر قراءة بيانات الدفع.' }, { status: 400 });
  }

  const parsed = tapCreateChargeSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message || 'بيانات الدفع غير صالحة.' }, { status: 400 });
  }

  let resolvedPlan;
  try {
    resolvedPlan = resolveBillingPlan({
      planCode: parsed.data.plan_code,
      period: parsed.data.billing_period,
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'الخطة غير صالحة.' }, { status: 400 });
  }

  const db = createSupabaseServerClient();

  const { data: appUser, error: appUserError } = await db
    .from('app_users')
    .select('id, email, full_name, phone')
    .eq('id', user.id)
    .maybeSingle();

  if (appUserError || !appUser) {
    return NextResponse.json({ error: 'تعذر تحديد بيانات المستخدم.' }, { status: 500 });
  }

  const referralContext = readReferralContextFromCookies();

  const [firstName, ...restNames] = String(appUser.full_name || 'عميل').trim().split(/\s+/);
  const lastName = restNames.join(' ') || 'مسار';

  try {
    const charge = await createTapCharge({
      amount: resolvedPlan.amount,
      currency: parsed.data.currency?.toUpperCase() || 'SAR',
      customer: {
        first_name: firstName || 'عميل',
        last_name: lastName,
        email: appUser.email,
        phone: {
          country_code: '966',
          number: normalizePhoneNumber(appUser.phone),
        },
      },
      planCode: resolvedPlan.normalizedCode,
      billingPeriod: resolvedPlan.period,
      userId: user.id,
      orgId,
      redirectPath: '/app/billing/result?provider=tap',
      metadata: {
        referral_code: referralContext.code,
        referral_partner_id: referralContext.partnerId,
      },
    });

    const paymentStatus = normalizeTapStatus(charge.status);

    const { error: insertError } = await db
      .from('tap_payments')
      .upsert(
        {
          tap_charge_id: charge.id,
          tap_reference: charge.reference?.transaction || charge.reference?.order || null,
          user_id: user.id,
          org_id: orgId,
          plan_id: resolvedPlan.normalizedCode,
          amount: resolvedPlan.amount,
          currency: parsed.data.currency?.toUpperCase() || 'SAR',
          status: paymentStatus,
          gateway_response: charge,
          metadata: {
            org_id: orgId,
            user_id: user.id,
            plan_id: resolvedPlan.normalizedCode,
            billing_period: resolvedPlan.period,
            referral_code: referralContext.code,
            referral_partner_id: referralContext.partnerId,
          },
          is_recurring: true,
          tap_customer_id: charge.customer?.id || null,
          tap_card_id: charge.card?.id || null,
          tap_agreement_id: charge.payment_agreement?.id || null,
        },
        { onConflict: 'tap_charge_id' },
      );

    if (insertError) {
      throw insertError;
    }

    return NextResponse.json({
      success: true,
      charge_id: charge.id,
      payment_url: charge.transaction?.url || null,
      status: paymentStatus,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'تعذر إنشاء عملية الدفع عبر Tap.',
      },
      { status: 500 },
    );
  }
}

function normalizePhoneNumber(value: string | null | undefined) {
  const digits = String(value || '').replace(/\D+/g, '');
  if (digits.length >= 9) {
    return digits.slice(-9);
  }

  return '500000000';
}
