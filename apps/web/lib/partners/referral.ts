import 'server-only';

import { createHash, randomUUID } from 'node:crypto';
import { cookies } from 'next/headers';
import type { NextRequest, NextResponse } from 'next/server';
import {
  DEFAULT_REFERRAL_WINDOW_DAYS,
  LEAD_STATUS_RANK,
  REFERRAL_COOKIE_CAPTURED_AT,
  REFERRAL_COOKIE_CLICK_ID,
  REFERRAL_COOKIE_CODE,
  REFERRAL_COOKIE_MAX_AGE_SECONDS,
  REFERRAL_COOKIE_PARTNER_ID,
  REFERRAL_COOKIE_SESSION_ID,
} from '@/lib/partners/constants';
import type { AttributionResult, PartnerLeadStatus, ReferralCaptureResult } from '@/lib/partners/types';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import {
  getRecentReferralWindowStart,
} from '@/lib/partners/referral-capture-utils';
import { normalizePartnerCode, shouldPromoteLeadStatus } from '@/lib/partners/utils';
import { getReferralAttributionWindowDays, getReferralIpHashSalt } from '@/lib/env';
import { isSelfReferral, isWithinAttributionWindow } from '@/lib/partners/rules';

const COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: 'lax' as const,
  secure: process.env.NODE_ENV === 'production',
  path: '/',
  maxAge: REFERRAL_COOKIE_MAX_AGE_SECONDS,
};

export type ReferralContext = {
  code: string | null;
  partnerId: string | null;
  sessionId: string | null;
  clickId: string | null;
  capturedAt: string | null;
};

export function readReferralContextFromCookies(): ReferralContext {
  const store = cookies();

  return {
    code: normalizePartnerCode(store.get(REFERRAL_COOKIE_CODE)?.value ?? null) || null,
    partnerId: store.get(REFERRAL_COOKIE_PARTNER_ID)?.value ?? null,
    sessionId: store.get(REFERRAL_COOKIE_SESSION_ID)?.value ?? null,
    clickId: store.get(REFERRAL_COOKIE_CLICK_ID)?.value ?? null,
    capturedAt: store.get(REFERRAL_COOKIE_CAPTURED_AT)?.value ?? null,
  };
}

export function setReferralCookies(response: NextResponse, context: {
  code: string;
  partnerId: string;
  sessionId: string;
  clickId: string;
  capturedAt?: string;
}) {
  const capturedAt = context.capturedAt || new Date().toISOString();

  response.cookies.set(REFERRAL_COOKIE_CODE, context.code, COOKIE_OPTIONS);
  response.cookies.set(REFERRAL_COOKIE_PARTNER_ID, context.partnerId, COOKIE_OPTIONS);
  response.cookies.set(REFERRAL_COOKIE_SESSION_ID, context.sessionId, COOKIE_OPTIONS);
  response.cookies.set(REFERRAL_COOKIE_CLICK_ID, context.clickId, COOKIE_OPTIONS);
  response.cookies.set(REFERRAL_COOKIE_CAPTURED_AT, capturedAt, COOKIE_OPTIONS);
}

function hashIp(ip: string) {
  const salt = getReferralIpHashSalt();
  return createHash('sha256').update(`${salt}:${ip}`).digest('hex');
}

function resolveRequestIp(request: NextRequest) {
  const forwardedFor = request.headers.get('x-forwarded-for');
  if (forwardedFor) {
    const first = forwardedFor.split(',')[0]?.trim();
    if (first) return first;
  }

  const realIp = request.headers.get('x-real-ip')?.trim();
  return realIp || 'unknown';
}

function isExpired(capturedAt: string | null, windowDays = getReferralAttributionWindowDays()) {
  return !isWithinAttributionWindow({
    capturedAt,
    windowDays,
  });
}

function isDuplicateKeyError(error: { message?: string | null } | null | undefined) {
  const message = String(error?.message || '').toLowerCase();
  return message.includes('duplicate') || message.includes('unique');
}

async function ensureVisitedLeadForClick(params: {
  db: ReturnType<typeof createSupabaseServerClient>;
  partnerId: string;
  clickId: string;
}) {
  const { data: existingLead, error: existingLeadError } = await params.db
    .from('partner_leads')
    .select('id, partner_id, status')
    .eq('click_id', params.clickId)
    .maybeSingle();

  if (existingLeadError) {
    throw new Error(existingLeadError.message);
  }

  if (existingLead) {
    return existingLead;
  }

  const { data: insertedLead, error: insertLeadError } = await params.db
    .from('partner_leads')
    .insert({
      partner_id: params.partnerId,
      click_id: params.clickId,
      signup_source: 'referral_visit',
      status: 'visited',
      attributed_at: new Date().toISOString(),
    })
    .select('id, partner_id, status')
    .single();

  if (!insertLeadError && insertedLead) {
    return insertedLead;
  }

  if (isDuplicateKeyError(insertLeadError)) {
    const { data: fallbackLead, error: fallbackLeadError } = await params.db
      .from('partner_leads')
      .select('id, partner_id, status')
      .eq('click_id', params.clickId)
      .maybeSingle();

    if (fallbackLeadError) {
      throw new Error(fallbackLeadError.message);
    }

    if (fallbackLead) {
      return fallbackLead;
    }
  }

  throw new Error(insertLeadError?.message || 'تعذر حفظ بيانات زيارة الإحالة.');
}

async function findRecentReferralClick(params: {
  db: ReturnType<typeof createSupabaseServerClient>;
  partnerId: string;
  sessionId: string;
  landingPage: string;
  refCode: string;
}) {
  const { data, error } = await params.db
    .from('partner_clicks')
    .select('id, created_at')
    .eq('partner_id', params.partnerId)
    .eq('session_id', params.sessionId)
    .eq('landing_page', params.landingPage)
    .eq('ref_code', params.refCode)
    .gte('created_at', getRecentReferralWindowStart())
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return data;
}

export async function captureReferralClick(params: {
  request: NextRequest;
  referralCode?: string | null;
  sessionId?: string | null;
  landingPage?: string | null;
  utmSource?: string | null;
  utmMedium?: string | null;
  utmCampaign?: string | null;
}): Promise<ReferralCaptureResult> {
  const db = createSupabaseServerClient();
  const normalizedRef = normalizePartnerCode(params.referralCode || null);

  if (!normalizedRef) {
    return {
      captured: false,
      partnerId: null,
      partnerCode: null,
      clickId: null,
      sessionId: params.sessionId || randomUUID(),
      reason: 'missing_ref',
    };
  }

  const { data: partner, error: partnerError } = await db
    .from('partners')
    .select('id, partner_code, is_active')
    .eq('partner_code', normalizedRef)
    .maybeSingle();

  if (partnerError) {
    throw new Error(partnerError.message);
  }

  if (!partner) {
    return {
      captured: false,
      partnerId: null,
      partnerCode: normalizedRef,
      clickId: null,
      sessionId: params.sessionId || randomUUID(),
      reason: 'invalid_ref',
    };
  }

  if (!partner.is_active) {
    return {
      captured: false,
      partnerId: String(partner.id),
      partnerCode: String(partner.partner_code),
      clickId: null,
      sessionId: params.sessionId || randomUUID(),
      reason: 'inactive_partner',
    };
  }

  const sessionId = params.sessionId || randomUUID();
  const requestIp = resolveRequestIp(params.request);
  const landingPage = String(params.landingPage || '/').slice(0, 1000);
  const userAgent = params.request.headers.get('user-agent') || null;
  const existingClick = await findRecentReferralClick({
    db,
    partnerId: String(partner.id),
    sessionId,
    landingPage,
    refCode: normalizedRef,
  });

  if (existingClick) {
    await ensureVisitedLeadForClick({
      db,
      partnerId: String(partner.id),
      clickId: String(existingClick.id),
    });

    return {
      captured: true,
      partnerId: String(partner.id),
      partnerCode: String(partner.partner_code),
      clickId: String(existingClick.id),
      sessionId,
      reason: 'already_captured',
    };
  }

  const { data: click, error: clickError } = await db
    .from('partner_clicks')
    .insert({
      partner_id: partner.id,
      partner_code: partner.partner_code,
      ref_code: normalizedRef,
      session_id: sessionId,
      landing_page: landingPage,
      utm_source: params.utmSource || null,
      utm_medium: params.utmMedium || null,
      utm_campaign: params.utmCampaign || null,
      ip_hash: hashIp(requestIp),
      user_agent: userAgent,
    })
    .select('id')
    .single();

  if (clickError || !click) {
    throw new Error(clickError?.message || 'تعذر تسجيل النقرة الإحالية.');
  }

  await ensureVisitedLeadForClick({
    db,
    partnerId: String(partner.id),
    clickId: String(click.id),
  });

  return {
    captured: true,
    partnerId: String(partner.id),
    partnerCode: String(partner.partner_code),
    clickId: String(click.id),
    sessionId,
    reason: 'ok',
  };
}

async function findExistingLead(params: {
  userId?: string | null;
  email?: string | null;
}) {
  const db = createSupabaseServerClient();

  if (params.userId) {
    const { data, error } = await db
      .from('partner_leads')
      .select('*')
      .eq('user_id', params.userId)
      .order('attributed_at', { ascending: true })
      .limit(1)
      .maybeSingle();

    if (error) throw new Error(error.message);
    if (data) return data as any;
  }

  const normalizedEmail = params.email?.trim().toLowerCase();
  if (normalizedEmail) {
    const { data, error } = await db
      .from('partner_leads')
      .select('*')
      .eq('lead_email', normalizedEmail)
      .order('attributed_at', { ascending: true })
      .limit(1)
      .maybeSingle();

    if (error) throw new Error(error.message);
    if (data) return data as any;
  }

  return null;
}

export async function upsertPartnerLeadAttribution(params: {
  userId?: string | null;
  email?: string | null;
  phone?: string | null;
  status: Extract<PartnerLeadStatus, 'signed_up' | 'trial_started' | 'subscribed' | 'cancelled'>;
  signupSource: string;
}): Promise<AttributionResult> {
  const db = createSupabaseServerClient();
  const context = readReferralContextFromCookies();

  if (!context.code) {
    return {
      attributed: false,
      leadId: null,
      partnerId: null,
      partnerCode: null,
      blockedReason: 'missing_ref',
    };
  }

  if (isExpired(context.capturedAt)) {
    return {
      attributed: false,
      leadId: null,
      partnerId: context.partnerId,
      partnerCode: context.code,
      blockedReason: 'expired',
    };
  }

  const { data: partner, error: partnerError } = await db
    .from('partners')
    .select('id, partner_code, email, user_id, is_active')
    .eq('partner_code', context.code)
    .maybeSingle();

  if (partnerError) throw new Error(partnerError.message);

  if (!partner) {
    return {
      attributed: false,
      leadId: null,
      partnerId: null,
      partnerCode: context.code,
      blockedReason: 'invalid_ref',
    };
  }

  if (!partner.is_active) {
    return {
      attributed: false,
      leadId: null,
      partnerId: String(partner.id),
      partnerCode: String(partner.partner_code),
      blockedReason: 'inactive_partner',
    };
  }

  const normalizedEmail = params.email?.trim().toLowerCase() || null;
  const partnerEmail = String(partner.email || '').trim().toLowerCase();

  if (isSelfReferral({
    partnerEmail,
    partnerUserId: partner.user_id,
    customerEmail: normalizedEmail,
    customerUserId: params.userId || null,
  })) {
    return {
      attributed: false,
      leadId: null,
      partnerId: String(partner.id),
      partnerCode: String(partner.partner_code),
      blockedReason: 'self_referral',
    };
  }

  const existingLead = await findExistingLead({
    userId: params.userId,
    email: normalizedEmail,
  });

  if (existingLead) {
    const samePartner = String(existingLead.partner_id) === String(partner.id);

    if (!samePartner) {
      return {
        attributed: false,
        leadId: String(existingLead.id),
        partnerId: String(existingLead.partner_id),
        partnerCode: null,
        blockedReason: 'first_touch_locked',
      };
    }

    const currentStatus = String(existingLead.status) as PartnerLeadStatus;
    const nextStatus = params.status;

    const updatePayload: Record<string, unknown> = {
      signup_source: params.signupSource,
      updated_at: new Date().toISOString(),
      lead_phone: params.phone || existingLead.lead_phone || null,
      user_id: params.userId || existingLead.user_id || null,
      lead_email: normalizedEmail || existingLead.lead_email || null,
      click_id: context.clickId || existingLead.click_id || null,
    };

    if (shouldPromoteLeadStatus(currentStatus, nextStatus)) {
      updatePayload.status = nextStatus;
    }

    const { data: updated, error: updateError } = await db
      .from('partner_leads')
      .update(updatePayload)
      .eq('id', existingLead.id)
      .select('id, partner_id, status')
      .single();

    if (updateError || !updated) {
      throw new Error(updateError?.message || 'تعذر تحديث نسبة الإحالة.');
    }

    return {
      attributed: true,
      leadId: String(updated.id),
      partnerId: String(updated.partner_id),
      partnerCode: String(partner.partner_code),
    };
  }

  const { data: inserted, error: insertError } = await db
    .from('partner_leads')
    .insert({
      partner_id: partner.id,
      click_id: context.clickId || null,
      lead_email: normalizedEmail,
      lead_phone: params.phone || null,
      user_id: params.userId || null,
      signup_source: params.signupSource,
      status: params.status,
      attributed_at: context.capturedAt || new Date().toISOString(),
    })
    .select('id, partner_id')
    .single();

  if (insertError || !inserted) {
    // Race condition: fetch and return if already inserted by a parallel flow.
    if ((insertError?.message || '').toLowerCase().includes('duplicate')) {
      const fallbackLead = await findExistingLead({ userId: params.userId, email: normalizedEmail });
      if (fallbackLead) {
        return {
          attributed: true,
          leadId: String(fallbackLead.id),
          partnerId: String(fallbackLead.partner_id),
          partnerCode: String(partner.partner_code),
        };
      }
    }

    throw new Error(insertError?.message || 'تعذر حفظ بيانات الإحالة.');
  }

  return {
    attributed: true,
    leadId: String(inserted.id),
    partnerId: String(inserted.partner_id),
    partnerCode: String(partner.partner_code),
  };
}

export async function updateLeadStatusForUser(params: {
  userId: string;
  status: Extract<PartnerLeadStatus, 'trial_started' | 'subscribed' | 'cancelled'>;
}) {
  const db = createSupabaseServerClient();

  const { data: lead, error: leadError } = await db
    .from('partner_leads')
    .select('id, status')
    .eq('user_id', params.userId)
    .order('attributed_at', { ascending: true })
    .limit(1)
    .maybeSingle();

  if (leadError || !lead) {
    return null;
  }

  const currentStatus = String(lead.status) as PartnerLeadStatus;
  const shouldUpdate = params.status === 'cancelled'
    ? true
    : LEAD_STATUS_RANK[params.status] >= LEAD_STATUS_RANK[currentStatus];

  if (!shouldUpdate) {
    return lead;
  }

  const { data: updated, error: updateError } = await db
    .from('partner_leads')
    .update({
      status: params.status,
      updated_at: new Date().toISOString(),
    })
    .eq('id', lead.id)
    .select('*')
    .single();

  if (updateError) {
    throw new Error(updateError.message);
  }

  return updated;
}

export async function getEligibleAttributionForUser(params: {
  userId: string;
  email?: string | null;
}) {
  const db = createSupabaseServerClient();
  const windowDays = getReferralAttributionWindowDays() || DEFAULT_REFERRAL_WINDOW_DAYS;
  const fromDate = new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000).toISOString();

  let query = db
    .from('partner_leads')
    .select('*, partner:partners(*)')
    .gte('attributed_at', fromDate)
    .order('attributed_at', { ascending: true })
    .limit(1)
    .eq('user_id', params.userId);

  let { data, error } = await query.maybeSingle();
  if (error) throw new Error(error.message);

  if (!data && params.email) {
    const normalizedEmail = params.email.toLowerCase();
    ({ data, error } = await db
      .from('partner_leads')
      .select('*, partner:partners(*)')
      .gte('attributed_at', fromDate)
      .order('attributed_at', { ascending: true })
      .limit(1)
      .eq('lead_email', normalizedEmail)
      .maybeSingle());

    if (error) throw new Error(error.message);
  }

  return data as any;
}
