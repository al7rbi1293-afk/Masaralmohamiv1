import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import {
  generateSessionToken,
  SESSION_COOKIE_NAME,
  SESSION_COOKIE_OPTIONS,
} from '@/lib/auth-custom';
import { ensureTrialProvisionForUser } from '@/lib/onboarding';
import { getCurrentOrgIdForUserId } from '@/lib/org';
import { getLinkedPartnerForUserId } from '@/lib/partners/access';
import {
  isPartnerPortalPath,
  isPartnerUser,
  isPartnerOnlyUser,
  resolvePostSignInDestination,
} from '@/lib/partners/portal-routing';

const otpSignInSchema = z.object({
  email: z
    .string()
    .trim()
    .email('يرجى إدخال بريد إلكتروني صحيح.')
    .max(255, 'البريد الإلكتروني طويل جدًا.'),
  next: z.string().trim().optional(),
});

export async function POST(request: NextRequest) {
  let rawNext: string | undefined;
  try {
    const formData = await request.formData();
    rawNext = toText(formData, 'next') || undefined;
    const parsed = otpSignInSchema.safeParse({
      email: toText(formData, 'email').toLowerCase(),
      next: rawNext,
    });

    if (!parsed.success) {
      return redirectWithError(
        request,
        parsed.error.issues[0]?.message ?? 'تعذر إكمال عملية الدخول.',
        undefined,
        rawNext,
      );
    }

    const db = createSupabaseServerClient();

    // Look up user in app_users
    const { data: user, error: userError } = await db
      .from('app_users')
      .select('id, email, full_name, status, email_verified')
      .eq('email', parsed.data.email)
      .maybeSingle();

    if (userError || !user) {
      return redirectWithError(
        request,
        'البريد الإلكتروني غير مسجل في النظام.',
        parsed.data.email,
        parsed.data.next,
      );
    }

    if (user.status === 'suspended') {
      return redirectWithError(
        request,
        'تم تعليق الحساب. تواصل مع الإدارة.',
        parsed.data.email,
        parsed.data.next,
      );
    }

    if (!user.email_verified) {
      return redirectWithError(
        request,
        'الحساب موجود ولكنه غير مفعل. يرجى مراجعة بريدك الإلكتروني لتفعيل الحساب.',
        parsed.data.email,
        parsed.data.next,
      );
    }

    // Generate custom JWT session since OTP already verified in /api/auth/verify-otp
    const sessionToken = await generateSessionToken({ userId: user.id, email: user.email });

    const { data: adminRecord } = await db
      .from('app_admins')
      .select('user_id')
      .eq('user_id', user.id)
      .maybeSingle();

    const [orgId, linkedPartner] = await Promise.all([
      getCurrentOrgIdForUserId(user.id, null),
      getLinkedPartnerForUserId(user.id),
    ]);
    const partnerOnly = isPartnerOnlyUser({
      hasLinkedPartner: Boolean(linkedPartner),
      hasOrganization: Boolean(orgId),
      isAdmin: Boolean(adminRecord),
    });
    const partnerUser = isPartnerUser({
      hasLinkedPartner: Boolean(linkedPartner),
      isAdmin: Boolean(adminRecord),
    });
    let destination = resolvePostSignInDestination({
      requestedPath: safeNextPath(parsed.data.next),
      isAdmin: Boolean(adminRecord),
      isPartnerUser: partnerUser,
      isPartnerOnly: partnerOnly,
    });

    // Ensure trial provisioning for office accounts only.
    if (
      !adminRecord &&
      !partnerOnly &&
      !isPartnerPortalPath(destination) &&
      destination.startsWith('/app') &&
      !destination.startsWith('/app/api')
    ) {
      try {
        const provision = await ensureTrialProvisionForUser({ userId: user.id, firmName: null });
        if (provision.isExpired && !destination.startsWith('/app/settings/subscription')) {
          destination = '/app/settings/subscription?expired=1&source=trial';
        }
      } catch {
        // Keep login working even if provisioning fails.
      }
    }

    const response = NextResponse.redirect(new URL(destination, request.url), 303);

    response.cookies.set(SESSION_COOKIE_NAME, sessionToken, SESSION_COOKIE_OPTIONS);

    // Clear old Supabase cookies if they exist
    response.cookies.delete('masar-sb-access-token');
    response.cookies.delete('masar-sb-refresh-token');

    return response;
  } catch (error) {
    console.error('otp_login_failed_unexpected', error);
    return redirectWithError(request, 'تعذر تسجيل الدخول حالياً. حاول مرة أخرى.', undefined, rawNext);
  }
}

function redirectWithError(request: NextRequest, message: string, email?: string, next?: string) {
  const url = new URL('/signin', request.url);
  url.searchParams.set('error', message);
  if (email) {
    url.searchParams.set('email', email);
  }
  const nextPath = safeNextPath(next);
  if (nextPath) {
    url.searchParams.set('next', nextPath);
  }
  return NextResponse.redirect(url, 303);
}

function toText(formData: FormData, field: string) {
  const value = formData.get(field);
  return typeof value === 'string' ? value : '';
}

function safeNextPath(raw?: string) {
  if (!raw) return null;
  const value = raw.trim();
  if (!value.startsWith('/') || value.startsWith('//')) return null;
  if (value.includes('\n') || value.includes('\r')) return null;
  if (value.startsWith('/app')) {
    if (value.startsWith('/app/api')) return null;
    return value;
  }
  if (value.startsWith('/admin')) {
    if (value.startsWith('/admin/api')) return null;
    return value;
  }
  return null;
}
