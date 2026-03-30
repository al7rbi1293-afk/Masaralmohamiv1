import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin';
import { adminPartnerActionSchema } from '@/lib/partners/validation';
import { listPartners, updatePartner } from '@/lib/partners/service';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    await requireAdmin('admin.partners.read');
  } catch {
    return NextResponse.json({ error: 'غير مصرح.' }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const query = searchParams.get('query') || '';
  const active = (searchParams.get('active') || 'all') as 'all' | 'active' | 'inactive';

  try {
    const partners = await listPartners({ query, active });
    return NextResponse.json({ partners });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'تعذر جلب قائمة الشركاء.' },
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

  const parsed = adminPartnerActionSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message || 'بيانات الطلب غير صالحة.' }, { status: 400 });
  }

  try {
    const partner = await updatePartner({
      partnerId: parsed.data.id,
      action: parsed.data.action,
      adminUserId,
    });

    return NextResponse.json({ success: true, partner });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'تعذر تحديث الشريك.' },
      { status: 500 },
    );
  }
}
