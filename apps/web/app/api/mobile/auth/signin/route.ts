import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { signInAppUserWithPassword } from '@/lib/mobile/auth';

export const runtime = 'nodejs';

const bodySchema = z.object({
  email: z.string().trim().toLowerCase().email('يرجى إدخال بريد إلكتروني صحيح.').max(255),
  password: z.string().min(1, 'يرجى إدخال كلمة المرور.').max(72),
  org_id: z.string().trim().uuid().optional().nullable(),
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

  const result = await signInAppUserWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
    requestedOrgId: parsed.data.org_id ?? null,
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  const { context, token } = result;
  return NextResponse.json({
    token,
    user: context.user,
    role: {
      name: context.role,
      is_admin: context.isAdmin,
      has_office_access: context.hasOfficeAccess,
      has_partner_access: context.hasPartnerAccess,
      partner_only: context.partnerOnly,
      default_path: context.defaultPath,
    },
    org: context.org,
    partner: context.partner
      ? {
          id: context.partner.id,
          partner_code: context.partner.partner_code,
        }
      : null,
  });
}
