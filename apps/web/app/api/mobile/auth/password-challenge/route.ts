import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requestMobileAppUserOtpAfterPassword } from '@/lib/mobile/auth';

export const runtime = 'nodejs';

const bodySchema = z.object({
  email: z.string().trim().toLowerCase().email('يرجى إدخال بريد إلكتروني صحيح.').max(255),
  password: z.string().min(1, 'يرجى إدخال كلمة المرور.').max(72),
});

export async function POST(request: NextRequest) {
  let payload: unknown = {};
  try {
    payload = await request.json();
  } catch {
    payload = {};
  }

  const parsed = bodySchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'تعذر التحقق من البيانات.' },
      { status: 400 },
    );
  }

  const result = await requestMobileAppUserOtpAfterPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json(
    {
      ok: true,
      message: result.message,
      ttl_minutes: result.ttl_minutes,
    },
    { status: 200 },
  );
}
