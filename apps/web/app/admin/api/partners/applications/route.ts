import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin';
import { adminApplicationActionSchema } from '@/lib/partners/validation';
import { listPartnerApplications, reviewPartnerApplication } from '@/lib/partners/service';

export const dynamic = 'force-dynamic';

const NO_STORE_HEADERS = {
  'Cache-Control': 'no-store, max-age=0, must-revalidate',
} as const;

export async function GET(request: NextRequest) {
  try {
    await requireAdmin('admin.partners.read');
  } catch {
    return NextResponse.json({ error: 'غير مصرح.' }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const status = (searchParams.get('status') || 'all') as any;
  const query = searchParams.get('query') || '';

  try {
    const applications = await listPartnerApplications({
      status,
      query,
    });

    return NextResponse.json({ applications }, { headers: NO_STORE_HEADERS });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'تعذر جلب طلبات الشركاء.' },
      { status: 500, headers: NO_STORE_HEADERS },
    );
  }
}

export async function PATCH(request: NextRequest) {
  let adminUserId: string;
  try {
    adminUserId = await requireAdmin('admin.partners.write');
  } catch {
    return NextResponse.json({ error: 'غير مصرح.' }, { status: 403, headers: NO_STORE_HEADERS });
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: 'بيانات الطلب غير صالحة.' }, { status: 400, headers: NO_STORE_HEADERS });
  }

  const parsed = adminApplicationActionSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message || 'بيانات الطلب غير صالحة.' },
      { status: 400, headers: NO_STORE_HEADERS },
    );
  }

  try {
    const result = await reviewPartnerApplication({
      applicationId: parsed.data.id,
      action: parsed.data.action,
      adminUserId,
      adminNotes: parsed.data.admin_notes,
    });

    return NextResponse.json({ success: true, result }, { headers: NO_STORE_HEADERS });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'تعذر تحديث الطلب.' },
      { status: 500, headers: NO_STORE_HEADERS },
    );
  }
}
