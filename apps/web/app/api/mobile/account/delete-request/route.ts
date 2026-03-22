import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { authenticateMobileAppUser } from '@/lib/mobile/auth';
import { createDeleteRequest } from '@/lib/mobile/delete-request';

export const runtime = 'nodejs';

const bodySchema = z.object({
  message: z.string().trim().max(2000, 'الرسالة طويلة جدًا.').optional(),
});

export async function POST(request: NextRequest) {
  const auth = await authenticateMobileAppUser(request);
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

  try {
    const { context } = auth;
    await createDeleteRequest(context.db, {
      orgId: context.org?.id ?? null,
      userId: context.user.id,
      fullName: context.user.full_name,
      email: context.user.email,
      phone: context.partner?.whatsapp_number ?? null,
      firmName: context.org?.name ?? 'تطبيق مسار المحامي',
      message:
        parsed.data.message?.trim() ||
        (context.role === 'owner' ? 'طلب حذف الحساب والبيانات المرتبطة بالمكتب' : 'طلب حذف حساب التطبيق'),
      source: 'app',
    });

    return NextResponse.json({
      ok: true,
      message: 'تم استلام طلب حذف الحساب. سنؤكد الهوية ثم نتابع الإجراء.',
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'تعذر إرسال الطلب.' },
      { status: 500 },
    );
  }
}
