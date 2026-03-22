import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireOfficeOwnerAppContext } from '@/lib/mobile/auth';
import {
  createMobileBankTransferRequest,
  getMobileOfficeSubscriptionOverview,
} from '@/lib/mobile/office-settings';
import { normalizePlanCode } from '@/lib/billing/plans';

export const runtime = 'nodejs';

const bankTransferSchema = z.object({
  plan_code: z.string().trim().min(1, 'الخطة مطلوبة.'),
  billing_period: z.enum(['monthly', 'yearly']),
  amount: z.coerce.number().positive('المبلغ يجب أن يكون أكبر من صفر.'),
  bank_reference: z.string().trim().min(3, 'يرجى إدخال مرجع بنكي صحيح.'),
});

function resolveSubscriptionError(error: unknown) {
  const message = error instanceof Error ? error.message : '';

  if (message === 'missing_org') {
    return { error: 'لا يوجد مكتب مفعّل لهذا الحساب.', status: 403 };
  }

  if (message === 'Invalid plan code') {
    return { error: 'الخطة المطلوبة غير صحيحة.', status: 400 };
  }

  if (message.includes('مرجع بنكي')) {
    return { error: message, status: 400 };
  }

  return { error: 'تعذر تنفيذ العملية.', status: 500 };
}

export async function GET(request: NextRequest) {
  const auth = await requireOfficeOwnerAppContext(request);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const overview = await getMobileOfficeSubscriptionOverview(auth.context);
  return NextResponse.json(overview);
}

export async function POST(request: NextRequest) {
  const auth = await requireOfficeOwnerAppContext(request);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const body = await request.json().catch(() => ({}));
  const parsed = bankTransferSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'بيانات طلب الاشتراك غير صالحة.', issues: parsed.error.flatten() }, { status: 400 });
  }

  const normalizedPlan = normalizePlanCode(parsed.data.plan_code, 'TRIAL');
  if (normalizedPlan === 'TRIAL') {
    return NextResponse.json({ error: 'الخطة المطلوبة غير صحيحة.' }, { status: 400 });
  }

  try {
    const requestRow = await createMobileBankTransferRequest(auth.context, {
      plan_code: normalizedPlan,
      billing_period: parsed.data.billing_period,
      amount: parsed.data.amount,
      bank_reference: parsed.data.bank_reference,
    });

    return NextResponse.json({ success: true, request: requestRow }, { status: 201 });
  } catch (error) {
    const resolved = resolveSubscriptionError(error);
    return NextResponse.json({ error: resolved.error }, { status: resolved.status });
  }
}
