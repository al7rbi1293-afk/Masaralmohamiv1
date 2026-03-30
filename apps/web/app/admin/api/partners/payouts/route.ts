import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin';
import { adminPayoutActionSchema } from '@/lib/partners/validation';
import { listPartnerPayouts, updatePartnerPayout } from '@/lib/partners/service';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    await requireAdmin('admin.partners.read');
  } catch {
    return NextResponse.json({ error: 'غير مصرح.' }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const status = (searchParams.get('status') || 'all') as any;

  try {
    const payouts = await listPartnerPayouts({ status });
    return NextResponse.json({ payouts });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'تعذر جلب الدفعات.' },
      { status: 500 },
    );
  }
}

export async function PATCH(request: NextRequest) {
  let adminUserId: string;
  try {
    adminUserId = await requireAdmin('admin.partners.write');
  } catch {
    return NextResponse.json({ error: 'غير مصرح.' }, { status: 403 });
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: 'بيانات الطلب غير صالحة.' }, { status: 400 });
  }

  const parsed = adminPayoutActionSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message || 'بيانات الطلب غير صالحة.' }, { status: 400 });
  }

  try {
    const payout = await updatePartnerPayout({
      payoutId: parsed.data.id,
      action: parsed.data.action,
      adminUserId,
      referenceNumber: parsed.data.reference_number,
      notes: parsed.data.notes,
    });

    return NextResponse.json({ success: true, payout });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'تعذر تحديث حالة الدفعة.' },
      { status: 500 },
    );
  }
}
