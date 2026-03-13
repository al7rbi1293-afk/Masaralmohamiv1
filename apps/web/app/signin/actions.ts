'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import {
  SESSION_COOKIE_NAME,
  SESSION_COOKIE_OPTIONS,
  verifyPassword,
  generateSessionToken,
} from '@/lib/auth-custom';
import { ensureTrialProvisionForUser } from '@/lib/onboarding';
import { getCurrentOrgIdForUserId } from '@/lib/org';
import { getLinkedPartnerForUserId } from '@/lib/partners/access';
import {
  isPartnerOnlyUser,
  resolvePostSignInDestination,
} from '@/lib/partners/portal-routing';

export async function signInAction(formData: FormData) {
  const email = String(formData.get('email') ?? '').trim().toLowerCase();
  const password = String(formData.get('password') ?? '');

  if (!email || !password) {
    redirect(`/signin?error=${encodeURIComponent('يرجى إدخال البريد وكلمة المرور.')}`);
  }

  const db = createSupabaseServerClient();

  // Look up user in app_users
  const { data: user, error: userError } = await db
    .from('app_users')
    .select('id, email, password_hash, status, email_verified')
    .eq('email', email)
    .maybeSingle();

  if (userError || !user) {
    redirect(`/signin?error=${encodeURIComponent('البريد الإلكتروني أو كلمة المرور غير صحيحة.')}`);
  }

  if (user.status === 'suspended') {
    redirect(`/signin?error=${encodeURIComponent('تم تعليق الحساب. تواصل مع الإدارة.')}`);
  }

  if (!user.email_verified) {
    redirect(`/signin?error=${encodeURIComponent('الحساب موجود ولكنه غير مفعل. يرجى مراجعة بريدك الإلكتروني لتفعيل الحساب.')}`);
  }

  const passwordMatch = await verifyPassword(password, user.password_hash);
  if (!passwordMatch) {
    redirect(`/signin?error=${encodeURIComponent('البريد الإلكتروني أو كلمة المرور غير صحيحة.')}`);
  }

  // Generate custom JWT session
  const sessionToken = await generateSessionToken({ userId: user.id, email: user.email });

  const cookieStore = cookies();
  cookieStore.set(SESSION_COOKIE_NAME, sessionToken, SESSION_COOKIE_OPTIONS);
  // Clear old Supabase cookies
  cookieStore.delete('masar-sb-access-token');
  cookieStore.delete('masar-sb-refresh-token');

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

  let destination = resolvePostSignInDestination({
    requestedPath: null,
    isAdmin: Boolean(adminRecord),
    isPartnerOnly: partnerOnly,
  });

  if (!adminRecord && !partnerOnly && destination.startsWith('/app') && !destination.startsWith('/app/api')) {
    try {
      const provision = await ensureTrialProvisionForUser({ userId: user.id, firmName: null });
      if (provision.isExpired && !destination.startsWith('/app/settings/subscription')) {
        destination = '/app/settings/subscription?expired=1&source=trial';
      }
    } catch {
      // Keep login working even if provisioning fails.
    }
  }

  redirect(destination);
}
