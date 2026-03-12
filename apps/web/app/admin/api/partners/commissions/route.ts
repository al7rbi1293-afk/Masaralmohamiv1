import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin';
import { adminCommissionActionSchema } from '@/lib/partners/validation';
import { listPartnerCommissions, updatePartnerCommission } from '@/lib/partners/service';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    await requireAdmin();
  } catch {
    return NextResponse.json({ error: 'غير مصرح.' }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const status = (searchParams.get('status') || 'all') as any;
  const query = searchParams.get('query') || '';

  try {
    const commissions = await listPartnerCommissions({ status, query });
    return NextResponse.json({ commissions });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'تعذر جلب العمولات.' },
      { status: 500 },
    );
  }
}

export async function PATCH(request: NextRequest) {
  let adminUserId: string;
  try {
    adminUserId = await requireAdmin();
  } catch {
    return NextResponse.json({ error: 'غير مصرح.' }, { status: 403 });
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: 'بيانات الطلب غير صالحة.' }, { status: 400 });
  }

  const parsed = adminCommissionActionSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message || 'بيانات الطلب غير صالحة.' }, { status: 400 });
  }

  try {
    const commission = await updatePartnerCommission({
      commissionId: parsed.data.id,
      action: parsed.data.action,
      adminUserId,
      notes: parsed.data.notes,
    });

    return NextResponse.json({ success: true, commission });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'تعذر تحديث العمولة.' },
      { status: 500 },
    );
  }
}
