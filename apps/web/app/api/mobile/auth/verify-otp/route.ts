import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { checkRateLimit, getRequestIp, RATE_LIMIT_MESSAGE_AR } from '@/lib/rateLimit';
import { verifyMobileAppUserOtp } from '@/lib/mobile/auth';

export const runtime = 'nodejs';

const bodySchema = z.object({
  email: z.string().trim().toLowerCase().email('يرجى إدخال بريد إلكتروني صحيح.').max(255),
  code: z.string().trim().min(4, 'رمز التحقق غير صالح.').max(12, 'رمز التحقق غير صالح.'),
  org_id: z.string().trim().uuid().optional().nullable(),
});

export async function POST(request: NextRequest) {
  const ip = getRequestIp(request);

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

  const normalizedEmail = parsed.data.email.trim().toLowerCase();

  const rate = await checkRateLimit({
    key: `mobile_auth:verify_otp:${ip}:${normalizedEmail}`,
    limit: 12,
    windowMs: 10 * 60 * 1000,
  });
  if (!rate.allowed) {
    return NextResponse.json({ error: RATE_LIMIT_MESSAGE_AR }, { status: 429 });
  }

  const result = await verifyMobileAppUserOtp({
    email: normalizedEmail,
    code: parsed.data.code,
    requestedOrgId: parsed.data.org_id ?? null,
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json({
    ok: true,
    token: result.token,
    user: result.context.user,
    role: {
      name: result.context.role,
      is_admin: result.context.isAdmin,
      has_office_access: result.context.hasOfficeAccess,
      has_partner_access: result.context.hasPartnerAccess,
      partner_only: result.context.partnerOnly,
      default_path: result.context.defaultPath,
    },
    org: result.context.org,
    partner: result.context.partner
      ? {
          id: result.context.partner.id,
          partner_code: result.context.partner.partner_code,
        }
      : null,
  });
}
