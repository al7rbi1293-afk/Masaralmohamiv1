import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { normalizeDigits } from '@/lib/phone';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { checkRateLimit, getRequestIp, RATE_LIMIT_MESSAGE_AR } from '@/lib/rateLimit';
import { verifyClientPortalOtpCode } from '@/lib/client-portal/otp';
import {
  CLIENT_PORTAL_SESSION_COOKIE_NAME,
  CLIENT_PORTAL_SESSION_COOKIE_OPTIONS,
  generateClientPortalSessionToken,
} from '@/lib/client-portal/session';

export const runtime = 'nodejs';

const bodySchema = z.object({
  email: z.string().trim().toLowerCase().email('البريد الإلكتروني غير صالح.').max(255, 'البريد الإلكتروني غير صالح.'),
  code: z.string().trim().min(4, 'رمز التحقق غير صالح.').max(12, 'رمز التحقق غير صالح.'),
});

const INVALID_OTP_MESSAGE = 'رمز التحقق غير صحيح أو منتهي الصلاحية.';

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
  const normalizedCode = normalizeDigits(parsed.data.code).replace(/\D+/g, '');
  if (normalizedCode.length !== 6) {
    return NextResponse.json({ error: INVALID_OTP_MESSAGE }, { status: 400 });
  }

  const rate = await checkRateLimit({
    key: `client_portal:verify_otp:${ip}:${normalizedEmail}`,
    limit: 12,
    windowMs: 10 * 60 * 1000,
  });
  if (!rate.allowed) {
    return NextResponse.json({ error: RATE_LIMIT_MESSAGE_AR }, { status: 429 });
  }

  const db = createSupabaseServerClient();
  const { data: portalUser, error: userError } = await db
    .from('client_portal_users')
    .select('id, org_id, client_id, email, status')
    .eq('email', normalizedEmail)
    .maybeSingle();

  if (userError || !portalUser || String((portalUser as any).status || '') !== 'active') {
    return NextResponse.json({ error: INVALID_OTP_MESSAGE }, { status: 400 });
  }

  const { data: otpRow, error: otpError } = await db
    .from('client_portal_otp_codes')
    .select('id, code_hash, attempts, max_attempts, expires_at, consumed_at')
    .eq('client_portal_user_id', String((portalUser as any).id))
    .is('consumed_at', null)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (otpError || !otpRow) {
    return NextResponse.json({ error: INVALID_OTP_MESSAGE }, { status: 400 });
  }

  const otpId = String((otpRow as any).id);
  const attempts = Number((otpRow as any).attempts ?? 0);
  const maxAttempts = Number((otpRow as any).max_attempts ?? 5);
  const expiresAt = new Date(String((otpRow as any).expires_at || '')).getTime();
  const nowIso = new Date().toISOString();

  if (!Number.isFinite(expiresAt) || expiresAt < Date.now() || attempts >= maxAttempts) {
    await db
      .from('client_portal_otp_codes')
      .update({ consumed_at: nowIso })
      .eq('id', otpId);

    return NextResponse.json({ error: INVALID_OTP_MESSAGE }, { status: 400 });
  }

  const codeMatches = verifyClientPortalOtpCode(String((otpRow as any).code_hash || ''), normalizedCode);
  if (!codeMatches) {
    const nextAttempts = attempts + 1;
    await db
      .from('client_portal_otp_codes')
      .update({
        attempts: nextAttempts,
        consumed_at: nextAttempts >= maxAttempts ? nowIso : null,
      })
      .eq('id', otpId);

    return NextResponse.json({ error: INVALID_OTP_MESSAGE }, { status: 400 });
  }

  await Promise.all([
    db
      .from('client_portal_otp_codes')
      .update({
        attempts: attempts + 1,
        consumed_at: nowIso,
      })
      .eq('id', otpId),
    db
      .from('client_portal_users')
      .update({
        last_login_at: nowIso,
        updated_at: nowIso,
      })
      .eq('id', String((portalUser as any).id)),
    db.from('audit_logs').insert({
      org_id: String((portalUser as any).org_id),
      user_id: null,
      action: 'client_portal_login_success',
      entity_type: 'client',
      entity_id: String((portalUser as any).client_id),
      meta: {
        portal_user_id: String((portalUser as any).id),
        email: normalizedEmail,
      },
      ip,
      user_agent: request.headers.get('user-agent') || null,
    }),
  ]);

  const token = await generateClientPortalSessionToken({
    portalUserId: String((portalUser as any).id),
    clientId: String((portalUser as any).client_id),
    orgId: String((portalUser as any).org_id),
    email: normalizedEmail,
  });

  const response = NextResponse.json({ ok: true, redirect_to: '/client-portal' }, { status: 200 });
  response.cookies.set(CLIENT_PORTAL_SESSION_COOKIE_NAME, token, CLIENT_PORTAL_SESSION_COOKIE_OPTIONS);
  return response;
}
