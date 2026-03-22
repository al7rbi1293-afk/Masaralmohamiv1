import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireClientPortalContext } from '@/lib/mobile/client-portal';
import { createDeleteRequest } from '@/lib/mobile/delete-request';

export const runtime = 'nodejs';

const bodySchema = z.object({
  message: z.string().trim().max(2000, 'الرسالة طويلة جدًا.').optional(),
});

type ClientRow = {
  name: string;
  phone: string | null;
};

export async function POST(request: NextRequest) {
  const auth = await requireClientPortalContext(request);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const parsed = bodySchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'تعذر التحقق من البيانات.' },
      { status: 400 },
    );
  }

  const { db, session } = auth.context;
  const { data: client, error: clientError } = await db
    .from('clients')
    .select('name, phone')
    .eq('id', session.clientId)
    .eq('org_id', session.orgId)
    .maybeSingle();

  if (clientError) {
    return NextResponse.json({ error: clientError.message }, { status: 500 });
  }

  const clientRow = client as ClientRow | null;
  if (!clientRow) {
    return NextResponse.json({ error: 'تعذر العثور على حساب العميل المرتبط.' }, { status: 404 });
  }

  try {
    await createDeleteRequest(db, {
      orgId: session.orgId,
      userId: null,
      fullName: clientRow.name,
      email: session.email,
      phone: clientRow.phone,
      firmName: 'بوابة العميل',
      message: parsed.data.message?.trim() || 'طلب حذف حساب بوابة العميل',
      source: 'contact',
    });

    return NextResponse.json({
      ok: true,
      message: 'تم استلام طلب حذف الحساب. سيؤكد المكتب الهوية ويتابع الإجراء.',
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'تعذر إرسال الطلب.' },
      { status: 500 },
    );
  }
}
