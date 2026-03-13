import 'server-only';

import { createSupabaseServerClient } from '@/lib/supabase/server';
import { getPublicSiteUrl } from '@/lib/env';

export type PartnerAccessMode = 'setup_required' | 'sign_in_ready';

export type PartnerPortalAccess = {
  userId: string;
  email: string;
  accessMode: PartnerAccessMode;
  activationUrl: string | null;
  signInUrl: string;
  partnerPortalUrl: string;
};

export type PartnerAccessRequest = {
  userId: string;
  email: string;
  fullName: string;
  token: string;
  expiresAt: string;
};

const PARTNER_ACCESS_TOKEN_TTL_HOURS = 72;

function buildPartnerAccessToken() {
  return crypto.randomUUID().replace(/-/g, '') + crypto.randomUUID().replace(/-/g, '');
}

function getPartnerAccessExpiresAt() {
  const expiresAt = new Date();
  expiresAt.setHours(expiresAt.getHours() + PARTNER_ACCESS_TOKEN_TTL_HOURS);
  return expiresAt.toISOString();
}

export function buildPartnerPortalUrl() {
  return `${getPublicSiteUrl()}/app/partners`;
}

export function buildPartnerSignInUrl(email: string) {
  const url = new URL('/auth/switch-account', `${getPublicSiteUrl()}/`);
  url.searchParams.set('email', email);
  url.searchParams.set('next', '/app/partners');
  return url.toString();
}

export function buildPartnerAccessUrl(params: {
  email: string;
  token: string;
}) {
  const url = new URL('/partner-access', `${getPublicSiteUrl()}/`);
  url.searchParams.set('email', params.email);
  url.searchParams.set('token', params.token);
  return url.toString();
}

export async function getLinkedPartnerForUserId(userId: string) {
  const db = createSupabaseServerClient();
  const { data, error } = await db
    .from('partners')
    .select('id, full_name, partner_code, referral_link, user_id')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return data;
}

export async function ensurePartnerPortalAccess(params: {
  partnerId: string;
  email: string;
  fullName: string;
  phone?: string | null;
}) : Promise<PartnerPortalAccess> {
  const db = createSupabaseServerClient();
  const normalizedEmail = params.email.trim().toLowerCase();
  const partnerPortalUrl = buildPartnerPortalUrl();
  const signInUrl = buildPartnerSignInUrl(normalizedEmail);

  const { data: existingUser, error: existingUserError } = await db
    .from('app_users')
    .select('id, email, full_name, phone, password_hash, email_verified')
    .eq('email', normalizedEmail)
    .maybeSingle();

  if (existingUserError) {
    throw new Error(existingUserError.message);
  }

  let userId: string;
  let accessMode: PartnerAccessMode;
  let activationUrl: string | null = null;

  if (existingUser) {
    userId = String(existingUser.id);
    const hasPassword = String(existingUser.password_hash || '').trim().length > 0;
    const requiresSetup = !existingUser.email_verified || !hasPassword;

    const updatePayload: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (!String(existingUser.full_name || '').trim()) {
      updatePayload.full_name = params.fullName;
    }

    if (!String(existingUser.phone || '').trim() && params.phone?.trim()) {
      updatePayload.phone = params.phone.trim();
    }

    if (requiresSetup) {
      const token = buildPartnerAccessToken();
      updatePayload.email_verification_token = token;
      updatePayload.email_verification_expires_at = getPartnerAccessExpiresAt();
      activationUrl = buildPartnerAccessUrl({
        email: normalizedEmail,
        token,
      });
      accessMode = 'setup_required';
    } else {
      accessMode = 'sign_in_ready';
    }

    const shouldUpdate = Object.keys(updatePayload).length > 1;
    if (shouldUpdate) {
      const { error: updateUserError } = await db
        .from('app_users')
        .update(updatePayload)
        .eq('id', userId);

      if (updateUserError) {
        throw new Error(updateUserError.message);
      }
    }
  } else {
    const token = buildPartnerAccessToken();
    const { data: insertedUser, error: insertUserError } = await db
      .from('app_users')
      .insert({
        email: normalizedEmail,
        password_hash: '',
        full_name: params.fullName,
        phone: params.phone?.trim() || null,
        status: 'active',
        email_verified: false,
        email_verification_token: token,
        email_verification_expires_at: getPartnerAccessExpiresAt(),
      })
      .select('id')
      .single();

    if (insertUserError || !insertedUser) {
      throw new Error(insertUserError?.message || 'تعذر إنشاء حساب الشريك.');
    }

    userId = String(insertedUser.id);
    accessMode = 'setup_required';
    activationUrl = buildPartnerAccessUrl({
      email: normalizedEmail,
      token,
    });
  }

  const { error: profileError } = await db
    .from('profiles')
    .upsert({
      user_id: userId,
      full_name: params.fullName,
      phone: params.phone?.trim() || null,
    }, { onConflict: 'user_id' });

  if (profileError) {
    throw new Error(profileError.message);
  }

  const { error: partnerUpdateError } = await db
    .from('partners')
    .update({
      user_id: userId,
      updated_at: new Date().toISOString(),
    })
    .eq('id', params.partnerId);

  if (partnerUpdateError) {
    throw new Error(partnerUpdateError.message);
  }

  return {
    userId,
    email: normalizedEmail,
    accessMode,
    activationUrl,
    signInUrl,
    partnerPortalUrl,
  };
}

export async function getPartnerAccessRequest(params: {
  email: string;
  token: string;
}) : Promise<PartnerAccessRequest | null> {
  const db = createSupabaseServerClient();
  const normalizedEmail = params.email.trim().toLowerCase();

  const { data: user, error: userError } = await db
    .from('app_users')
    .select('id, email, full_name, email_verification_token, email_verification_expires_at')
    .eq('email', normalizedEmail)
    .maybeSingle();

  if (userError) {
    throw new Error(userError.message);
  }

  if (!user) {
    return null;
  }

  const storedToken = String((user as any).email_verification_token || '');
  const expiresAt = String((user as any).email_verification_expires_at || '');
  if (!storedToken || storedToken !== params.token || !expiresAt) {
    return null;
  }

  if (new Date(expiresAt).getTime() < Date.now()) {
    return null;
  }

  return {
    userId: String((user as any).id),
    email: String((user as any).email),
    fullName: String((user as any).full_name || ''),
    token: storedToken,
    expiresAt,
  };
}
