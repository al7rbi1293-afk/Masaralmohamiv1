import 'server-only';

import type { NextRequest } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import { randomInt, randomUUID } from 'node:crypto';
import { generateSessionToken, verifyPassword, verifySessionToken } from '@/lib/auth-custom';
import { sendEmail } from '@/lib/email';
import { isSmtpConfigured } from '@/lib/env';
import {
  LOGIN_OTP_EMAIL_HTML,
  LOGIN_OTP_EMAIL_SUBJECT,
  LOGIN_OTP_EMAIL_TEXT,
  WELCOME_EMAIL_HTML,
  WELCOME_EMAIL_SUBJECT,
} from '@/lib/email-templates';
import { ensureTrialProvisionForUser } from '@/lib/onboarding';
import type { OrgRole } from '@/lib/org';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { isPartnerOnlyUser, isPartnerPortalPath, isPartnerUser, resolvePostSignInDestination } from '@/lib/partners/portal-routing';
import { normalizeDigits } from '@/lib/phone';

type AppUserRow = {
  id: string;
  email: string;
  full_name: string | null;
  password_hash: string;
  status: string;
  email_verified: boolean;
};

type AppUserAuthRow = Pick<AppUserRow, 'id' | 'email' | 'full_name' | 'password_hash' | 'status' | 'email_verified'> & {
  otp_code: string | null;
  otp_expires_at: string | null;
  email_verification_token: string | null;
  email_verification_expires_at: string | null;
};

type MembershipRow = {
  org_id: string;
  role: OrgRole;
  created_at: string;
};

type OrganizationRow = {
  id: string;
  name: string;
  logo_url: string | null;
};

type PartnerRow = {
  id: string;
  full_name: string | null;
  email: string | null;
  partner_code: string | null;
  referral_link: string | null;
  whatsapp_number: string | null;
};

export type MobileAppSessionContext = {
  db: SupabaseClient;
  token: string;
  user: {
    id: string;
    email: string;
    full_name: string | null;
  };
  org: {
    id: string;
    name: string;
    logo_url: string | null;
  } | null;
  role: OrgRole | null;
  isAdmin: boolean;
  partner: {
    id: string;
    full_name: string | null;
    email: string | null;
    partner_code: string | null;
    referral_link: string | null;
    whatsapp_number: string | null;
  } | null;
  hasOfficeAccess: boolean;
  hasPartnerAccess: boolean;
  partnerOnly: boolean;
  defaultPath: string;
};

type AppUserContext = Omit<MobileAppSessionContext, 'token'>;

const MOBILE_OTP_LENGTH = 6;
const MOBILE_OTP_TTL_MINUTES = 10;
const MOBILE_ACTIVATION_TTL_HOURS = 24;

function getRequestedOrgId(request?: NextRequest | Request) {
  const value =
    request?.headers.get('x-org-id')?.trim() ??
    (request ? new URL(request.url).searchParams.get('org_id')?.trim() ?? '' : '');
  return value || null;
}

export function getBearerToken(request: NextRequest | Request) {
  const authorization = request.headers.get('authorization') ?? '';
  const [scheme, token] = authorization.split(' ');
  if (scheme?.toLowerCase() !== 'bearer') {
    return null;
  }

  const normalizedToken = token?.trim() ?? '';
  return normalizedToken || null;
}

function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
}

function generateMobileOtpCode() {
  return String(randomInt(0, 10 ** MOBILE_OTP_LENGTH)).padStart(MOBILE_OTP_LENGTH, '0');
}

function getOtpExpiresAt() {
  return new Date(Date.now() + MOBILE_OTP_TTL_MINUTES * 60 * 1000).toISOString();
}

function getActivationExpiresAt() {
  const expiresAt = new Date();
  expiresAt.setHours(expiresAt.getHours() + MOBILE_ACTIVATION_TTL_HOURS);
  return expiresAt.toISOString();
}

function getAppUserOtpCode(code: string) {
  return normalizeDigits(code).replace(/\D+/g, '');
}

async function loadAppUserByEmail(db: SupabaseClient, email: string) {
  const normalizedEmail = normalizeEmail(email);
  const { data, error } = await db
    .from('app_users')
    .select(
      'id, email, full_name, password_hash, status, email_verified, otp_code, otp_expires_at, email_verification_token, email_verification_expires_at',
    )
    .eq('email', normalizedEmail)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return (data as AppUserAuthRow | null) ?? null;
}

async function clearAppUserOtp(db: SupabaseClient, userId: string) {
  const { error } = await db
    .from('app_users')
    .update({
      otp_code: null,
      otp_expires_at: null,
    })
    .eq('id', userId);

  if (error) {
    throw new Error(error.message);
  }
}

async function saveAppUserOtp(db: SupabaseClient, userId: string, otpCode: string) {
  const { error } = await db
    .from('app_users')
    .update({
      otp_code: otpCode,
      otp_expires_at: getOtpExpiresAt(),
    })
    .eq('id', userId);

  if (error) {
    throw new Error(error.message);
  }
}

async function saveAppUserActivationToken(db: SupabaseClient, userId: string, token: string) {
  const { error } = await db
    .from('app_users')
    .update({
      email_verification_token: token,
      email_verification_expires_at: getActivationExpiresAt(),
    })
    .eq('id', userId);

  if (error) {
    throw new Error(error.message);
  }
}

async function buildMobileAppSession(params: {
  db: SupabaseClient;
  userId: string;
  email: string;
  requestedOrgId?: string | null;
}) {
  const token = await generateSessionToken({
    userId: params.userId,
    email: params.email,
  });

  const context = await loadAppUserContext({
    db: params.db,
    userId: params.userId,
    email: params.email,
    requestedOrgId: params.requestedOrgId ?? null,
  });

  if (!context) {
    return null;
  }

  return {
    token,
    context: {
      ...context,
      token,
    },
  };
}

async function sendMobileOtpEmail(params: {
  email: string;
  fullName: string | null;
  code: string;
}) {
  await sendEmail({
    to: params.email,
    subject: LOGIN_OTP_EMAIL_SUBJECT,
    html: LOGIN_OTP_EMAIL_HTML({
      name: params.fullName || 'عميلنا الكريم',
      code: params.code,
      ttlMinutes: MOBILE_OTP_TTL_MINUTES,
    }),
    text: LOGIN_OTP_EMAIL_TEXT({
      name: params.fullName || 'عميلنا الكريم',
      code: params.code,
      ttlMinutes: MOBILE_OTP_TTL_MINUTES,
    }),
  });
}

async function sendMobileActivationEmail(params: {
  email: string;
  fullName: string | null;
  verificationLink: string;
}) {
  await sendEmail({
    to: params.email,
    subject: WELCOME_EMAIL_SUBJECT,
    html: WELCOME_EMAIL_HTML(params.fullName || 'عميلنا الكريم', params.verificationLink),
    text: `يرجى تفعيل حسابك عبر الرابط التالي: ${params.verificationLink}`,
  });
}

async function loadAppUserContext(params: {
  db: SupabaseClient;
  userId: string;
  email: string;
  requestedOrgId?: string | null;
}): Promise<AppUserContext | null> {
  const [userRes, adminRes, membershipsRes, partnerRes] = await Promise.all([
    params.db
      .from('app_users')
      .select('id, email, full_name, status')
      .eq('id', params.userId)
      .eq('email', params.email)
      .maybeSingle(),
    params.db
      .from('app_admins')
      .select('user_id')
      .eq('user_id', params.userId)
      .maybeSingle(),
    params.db
      .from('memberships')
      .select('org_id, role, created_at')
      .eq('user_id', params.userId)
      .order('created_at', { ascending: false }),
    params.db
      .from('partners')
      .select('id, full_name, email, partner_code, referral_link, whatsapp_number')
      .eq('user_id', params.userId)
      .maybeSingle(),
  ]);

  const user = userRes.data as Pick<AppUserRow, 'id' | 'email' | 'full_name' | 'status'> | null;
  if (!user || String(user.status ?? '') === 'suspended') {
    return null;
  }

  const memberships = (membershipsRes.data as MembershipRow[] | null) ?? [];
  const requestedOrgId = String(params.requestedOrgId ?? '').trim();
  const selectedMembership = requestedOrgId
    ? memberships.find((membership) => membership.org_id === requestedOrgId) ?? null
    : memberships[0] ?? null;

  let organization: OrganizationRow | null = null;
  if (selectedMembership?.org_id) {
    const orgRes = await params.db
      .from('organizations')
      .select('id, name, logo_url')
      .eq('id', selectedMembership.org_id)
      .maybeSingle();

    organization = (orgRes.data as OrganizationRow | null) ?? null;
  }

  const isAdmin = Boolean(adminRes.data);
  const partner = (partnerRes.data as PartnerRow | null) ?? null;
  const hasOfficeAccess = Boolean(selectedMembership?.org_id);
  const hasPartnerAccess = Boolean(partner);
  const partnerOnly = isPartnerOnlyUser({
    hasLinkedPartner: hasPartnerAccess,
    hasOrganization: hasOfficeAccess,
    isAdmin,
  });
  const partnerUser = isPartnerUser({
    hasLinkedPartner: hasPartnerAccess,
    isAdmin,
  });

  let defaultPath = resolvePostSignInDestination({
    requestedPath: null,
    isAdmin,
    isPartnerUser: partnerUser,
    isPartnerOnly: partnerOnly,
  });

  if (
    !isAdmin &&
    !partnerOnly &&
    hasOfficeAccess &&
    !isPartnerPortalPath(defaultPath) &&
    defaultPath.startsWith('/app') &&
    !defaultPath.startsWith('/app/api')
  ) {
    try {
      const provision = await ensureTrialProvisionForUser({ userId: user.id, firmName: null });
      if (provision.isExpired && !defaultPath.startsWith('/app/settings/subscription')) {
        defaultPath = '/app/settings/subscription?expired=1&source=trial';
      }
    } catch {
      // Keep API auth usable even if provisioning fails.
    }
  }

  return {
    db: params.db,
    user: {
      id: user.id,
      email: user.email,
      full_name: user.full_name ?? null,
    },
    org: organization
      ? {
          id: organization.id,
          name: organization.name,
          logo_url: organization.logo_url ?? null,
        }
      : null,
    role: selectedMembership?.role ?? null,
    isAdmin,
    partner: partner
      ? {
          id: partner.id,
          full_name: partner.full_name ?? null,
          email: partner.email ?? null,
          partner_code: partner.partner_code ?? null,
          referral_link: partner.referral_link ?? null,
          whatsapp_number: partner.whatsapp_number ?? null,
        }
      : null,
    hasOfficeAccess,
    hasPartnerAccess,
    partnerOnly,
    defaultPath,
  };
}

export async function requestMobileAppUserOtp(params: { email: string }) {
  try {
    const db = createSupabaseServerClient();
    const user = await loadAppUserByEmail(db, params.email);

    if (!user) {
      return { ok: false as const, status: 404, error: 'البريد الإلكتروني غير مسجل في النظام.' };
    }

    if (user.status === 'suspended') {
      return { ok: false as const, status: 403, error: 'تم تعليق الحساب. تواصل مع الإدارة.' };
    }

    if (!user.email_verified) {
      return {
        ok: false as const,
        status: 403,
        error: 'الحساب موجود ولكنه غير مفعل. يرجى إعادة إرسال رابط التفعيل أولاً.',
      };
    }

    if (!isSmtpConfigured()) {
      return {
        ok: false as const,
        status: 503,
        error: 'تعذر إرسال رمز التحقق حالياً لأن إعداد البريد الإلكتروني غير مكتمل.',
      };
    }

    const otpCode = generateMobileOtpCode();

    try {
      await saveAppUserOtp(db, user.id, otpCode);
    } catch (updateError) {
      console.error('mobile_auth_request_otp_update_failed', updateError);
      return { ok: false as const, status: 500, error: 'حدث خطأ أثناء إعداد رمز التحقق. حاول لاحقاً.' };
    }

    try {
      await sendMobileOtpEmail({
        email: user.email,
        fullName: user.full_name,
        code: otpCode,
      });
    } catch (sendError) {
      await clearAppUserOtp(db, user.id).catch(() => null);
      console.error('mobile_auth_request_otp_email_failed', sendError);
      return { ok: false as const, status: 500, error: 'حدث خطأ أثناء إرسال البريد الإلكتروني. حاول مرة أخرى.' };
    }
  } catch (error) {
    console.error('mobile_auth_request_otp_failed', error);
    return { ok: false as const, status: 500, error: 'تعذر معالجة طلب رمز التحقق. حاول مرة أخرى.' };
  }

  return {
    ok: true as const,
    status: 200,
    message: 'تم إرسال رمز التحقق إلى بريدك الإلكتروني بنجاح.',
    ttl_minutes: MOBILE_OTP_TTL_MINUTES,
  };
}

export async function requestMobileAppUserOtpAfterPassword(params: {
  email: string;
  password: string;
}) {
  try {
    const db = createSupabaseServerClient();
    const normalizedEmail = normalizeEmail(params.email);
    const user = await loadAppUserByEmail(db, normalizedEmail);

    if (!user) {
      return { ok: false as const, status: 401, error: 'البريد الإلكتروني أو كلمة المرور غير صحيحة.' };
    }

    if (user.status === 'suspended') {
      return { ok: false as const, status: 403, error: 'تم تعليق الحساب. تواصل مع الإدارة.' };
    }

    if (!user.email_verified) {
      return {
        ok: false as const,
        status: 403,
        error: 'الحساب موجود ولكنه غير مفعل. يرجى إعادة إرسال رابط التفعيل أولاً.',
      };
    }

    if (!isSmtpConfigured()) {
      return {
        ok: false as const,
        status: 503,
        error: 'تعذر إرسال رمز التحقق حالياً لأن إعداد البريد الإلكتروني غير مكتمل.',
      };
    }

    const passwordMatch = await verifyPassword(params.password, user.password_hash);
    if (!passwordMatch) {
      return { ok: false as const, status: 401, error: 'البريد الإلكتروني أو كلمة المرور غير صحيحة.' };
    }

    const otpCode = generateMobileOtpCode();

    try {
      await saveAppUserOtp(db, user.id, otpCode);
    } catch (updateError) {
      console.error('mobile_auth_password_challenge_update_failed', updateError);
      return { ok: false as const, status: 500, error: 'حدث خطأ أثناء إعداد رمز التحقق. حاول لاحقاً.' };
    }

    try {
      await sendMobileOtpEmail({
        email: user.email,
        fullName: user.full_name,
        code: otpCode,
      });
    } catch (sendError) {
      await clearAppUserOtp(db, user.id).catch(() => null);
      console.error('mobile_auth_password_challenge_email_failed', sendError);
      return { ok: false as const, status: 500, error: 'حدث خطأ أثناء إرسال البريد الإلكتروني. حاول مرة أخرى.' };
    }

    return {
      ok: true as const,
      status: 200,
      message: 'تم التحقق من كلمة المرور وإرسال رمز التحقق إلى بريدك الإلكتروني.',
      ttl_minutes: MOBILE_OTP_TTL_MINUTES,
    };
  } catch (error) {
    console.error('mobile_auth_password_challenge_failed', error);
    return { ok: false as const, status: 500, error: 'تعذر بدء التحقق بخطوتين. حاول مرة أخرى.' };
  }
}

export async function verifyMobileAppUserOtp(params: {
  email: string;
  code: string;
  requestedOrgId?: string | null;
}) {
  try {
    const db = createSupabaseServerClient();
    const normalizedEmail = normalizeEmail(params.email);
    const normalizedCode = getAppUserOtpCode(params.code);

    if (normalizedCode.length !== MOBILE_OTP_LENGTH) {
      return { ok: false as const, status: 400, error: 'رمز التحقق غير صحيح أو منتهي الصلاحية.' };
    }

    const user = await loadAppUserByEmail(db, normalizedEmail);
    if (!user) {
      return { ok: false as const, status: 400, error: 'رمز التحقق غير صحيح أو منتهي الصلاحية.' };
    }

    if (user.status === 'suspended') {
      return { ok: false as const, status: 403, error: 'تم تعليق الحساب. تواصل مع الإدارة.' };
    }

    if (!user.email_verified) {
      return {
        ok: false as const,
        status: 403,
        error: 'الحساب موجود ولكنه غير مفعل. يرجى إعادة إرسال رابط التفعيل أولاً.',
      };
    }

    const expiresAt = user.otp_expires_at ? new Date(user.otp_expires_at).getTime() : NaN;
    if (!user.otp_code || !user.otp_expires_at || !Number.isFinite(expiresAt) || expiresAt < Date.now()) {
      return { ok: false as const, status: 400, error: 'رمز التحقق غير صحيح أو منتهي الصلاحية.' };
    }

    if (user.otp_code !== normalizedCode) {
      return { ok: false as const, status: 400, error: 'رمز التحقق غير صحيح أو منتهي الصلاحية.' };
    }

    await clearAppUserOtp(db, user.id);

    const session = await buildMobileAppSession({
      db,
      userId: user.id,
      email: user.email,
      requestedOrgId: params.requestedOrgId ?? null,
    });

    if (!session) {
      return { ok: false as const, status: 401, error: 'تعذر التحقق من الجلسة.' };
    }

    return {
      ok: true as const,
      status: 200,
      token: session.token,
      context: session.context,
    };
  } catch (error) {
    console.error('mobile_auth_verify_otp_failed', error);
    return { ok: false as const, status: 500, error: 'تعذر إكمال تسجيل الدخول. حاول مرة أخرى.' };
  }
}

export async function resendMobileAppUserActivation(params: { email: string; siteUrl: string }) {
  try {
    const db = createSupabaseServerClient();
    const user = await loadAppUserByEmail(db, params.email);

    if (!user) {
      return { ok: false as const, status: 404, error: 'البريد الإلكتروني غير مسجل في النظام.' };
    }

    if (user.status === 'suspended') {
      return { ok: false as const, status: 403, error: 'تم تعليق الحساب. تواصل مع الإدارة.' };
    }

    if (user.email_verified) {
      return {
        ok: true as const,
        status: 200,
        message: 'الحساب مفعل مسبقاً. يمكنك تسجيل الدخول الآن.',
      };
    }

    if (!isSmtpConfigured()) {
      return {
        ok: false as const,
        status: 503,
        error: 'تعذر إرسال رابط التفعيل حالياً لأن إعداد البريد الإلكتروني غير مكتمل.',
      };
    }

    const verificationToken = randomUUID().replace(/-/g, '') + randomUUID().replace(/-/g, '');

    try {
      await saveAppUserActivationToken(db, user.id, verificationToken);
    } catch (updateError) {
      console.error('mobile_auth_resend_activation_update_failed', updateError);
      return { ok: false as const, status: 500, error: 'تعذر إعادة إرسال رابط التفعيل. حاول مرة أخرى.' };
    }

    const verificationLink = new URL('/api/verify-email', params.siteUrl);
    verificationLink.searchParams.set('token', verificationToken);
    verificationLink.searchParams.set('email', user.email);

    try {
      await sendMobileActivationEmail({
        email: user.email,
        fullName: user.full_name,
        verificationLink: verificationLink.toString(),
      });
    } catch (sendError) {
      console.error('mobile_auth_resend_activation_email_failed', sendError);
      return { ok: false as const, status: 500, error: 'حدث خطأ أثناء إرسال البريد الإلكتروني. حاول مرة أخرى.' };
    }
  } catch (error) {
    console.error('mobile_auth_resend_activation_failed', error);
    return { ok: false as const, status: 500, error: 'تعذر إعادة إرسال رابط التفعيل. حاول مرة أخرى.' };
  }

  return {
    ok: true as const,
    status: 200,
    message: 'تم إرسال رابط التفعيل إلى بريدك الإلكتروني بنجاح.',
  };
}

export async function signInAppUserWithPassword(params: {
  email: string;
  password: string;
  requestedOrgId?: string | null;
}) {
  const db = createSupabaseServerClient();
  const normalizedEmail = params.email.trim().toLowerCase();

  const { data: user, error } = await db
    .from('app_users')
    .select('id, email, full_name, password_hash, status, email_verified')
    .eq('email', normalizedEmail)
    .maybeSingle();

  if (error || !user) {
    return { ok: false as const, status: 401, error: 'البريد الإلكتروني أو كلمة المرور غير صحيحة.' };
  }

  const typedUser = user as AppUserRow;
  if (typedUser.status === 'suspended') {
    return { ok: false as const, status: 403, error: 'تم تعليق الحساب. تواصل مع الإدارة.' };
  }

  if (!typedUser.email_verified) {
    return {
      ok: false as const,
      status: 403,
      error: 'الحساب موجود ولكنه غير مفعل. يرجى مراجعة بريدك الإلكتروني لتفعيل الحساب.',
    };
  }

  const passwordMatch = await verifyPassword(params.password, typedUser.password_hash);
  if (!passwordMatch) {
    return { ok: false as const, status: 401, error: 'البريد الإلكتروني أو كلمة المرور غير صحيحة.' };
  }

  const token = await generateSessionToken({
    userId: typedUser.id,
    email: typedUser.email,
  });

  const context = await loadAppUserContext({
    db,
    userId: typedUser.id,
    email: typedUser.email,
    requestedOrgId: params.requestedOrgId ?? null,
  });

  if (!context) {
    return { ok: false as const, status: 401, error: 'تعذر التحقق من الجلسة.' };
  }

  return {
    ok: true as const,
    status: 200,
    token,
    context: {
      ...context,
      token,
    },
  };
}

export async function authenticateMobileAppUser(request: NextRequest | Request) {
  const token = getBearerToken(request) || new URL(request.url).searchParams.get('access_token')?.trim() || null;
  if (!token) {
    return { ok: false as const, status: 401, error: 'مطلوب رمز وصول صالح.' };
  }

  const session = await verifySessionToken(token);
  if (!session) {
    return { ok: false as const, status: 401, error: 'رمز الوصول غير صالح أو منتهي الصلاحية.' };
  }

  const db = createSupabaseServerClient();
  const context = await loadAppUserContext({
    db,
    userId: session.userId,
    email: session.email,
    requestedOrgId: getRequestedOrgId(request),
  });

  if (!context) {
    return { ok: false as const, status: 401, error: 'تعذر التحقق من الجلسة.' };
  }

  return {
    ok: true as const,
    status: 200,
    context: {
      ...context,
      token,
    },
  };
}

export async function requireOfficeAppContext(request: NextRequest | Request) {
  const auth = await authenticateMobileAppUser(request);
  if (!auth.ok) {
    return auth;
  }

  if (!auth.context.hasOfficeAccess || !auth.context.org) {
    return { ok: false as const, status: 403, error: 'هذا الحساب لا يملك وصولاً إلى المكتب.' };
  }

  return auth;
}

export async function requireOfficeOwnerAppContext(request: NextRequest | Request) {
  const auth = await requireOfficeAppContext(request);
  if (!auth.ok) {
    return auth;
  }

  if (auth.context.role !== 'owner') {
    return { ok: false as const, status: 403, error: 'لا تملك صلاحية تنفيذ هذا الإجراء.' };
  }

  return auth;
}

export async function requireMobileOfficeOwnerContext(request: NextRequest | Request) {
  const auth = await requireOfficeAppContext(request);
  if (!auth.ok) {
    return auth;
  }

  if (auth.context.role !== 'owner') {
    return { ok: false as const, status: 403, error: 'هذا الحساب لا يملك صلاحية إدارة الفريق.' };
  }

  return auth;
}

export async function requirePartnerAppContext(request: NextRequest | Request) {
  const auth = await authenticateMobileAppUser(request);
  if (!auth.ok) {
    return auth;
  }

  if (!auth.context.hasPartnerAccess || !auth.context.partner) {
    return { ok: false as const, status: 403, error: 'هذا الحساب لا يملك وصولاً إلى بوابة الشريك.' };
  }

  return auth;
}

export async function requireAdminAppContext(request: NextRequest | Request) {
  const auth = await authenticateMobileAppUser(request);
  if (!auth.ok) {
    return auth;
  }

  if (!auth.context.isAdmin) {
    return { ok: false as const, status: 403, error: 'هذا الحساب لا يملك وصولاً إلى لوحة الإدارة.' };
  }

  return auth;
}
