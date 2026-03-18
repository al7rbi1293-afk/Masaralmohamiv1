import 'server-only';

import { getPlanDisplayLabel, normalizePlanCode } from '@/lib/billing/plans';
import { sendEmail } from '@/lib/email';
import { getBillingAlertEmails, getPublicSiteUrl, isSmtpConfigured } from '@/lib/env';
import { logError, logInfo, logWarn } from '@/lib/logger';
import { createSupabaseServerClient } from '@/lib/supabase/server';

type AlertResult = {
  sent: boolean;
  reason: string;
  recipients: string[];
};

type ContextRecord = {
  orgName: string | null;
  requesterName: string | null;
  requesterEmail: string | null;
};

type BankTransferAlertParams = {
  paymentRequestId: string;
  orgId: string;
  requestedByUserId?: string | null;
  planCode: string;
  billingPeriod: 'monthly' | 'yearly';
  amount: number;
  currency?: string | null;
  bankReference?: string | null;
  createdAt?: string | null;
};

type ManualSubscriptionRequestAlertParams = {
  subscriptionRequestId: string;
  orgId: string;
  requestedByUserId?: string | null;
  planCode: string;
  durationMonths: number;
  paymentMethod?: string | null;
  paymentReference?: string | null;
  requestedAt?: string | null;
};

type CardProvider = 'tap' | 'stripe';

type CardSubscriptionAlertParams = {
  provider: CardProvider;
  orgId: string;
  requestedByUserId?: string | null;
  planCode: string;
  billingPeriod: 'monthly' | 'yearly';
  amount?: number | null;
  currency?: string | null;
  chargeId?: string | null;
  providerSubscriptionId?: string | null;
  checkoutSessionId?: string | null;
  paidAt?: string | null;
};

const SUBJECTS = {
  bankTransfer: 'طلب تفعيل جديد عبر التحويل البنكي - مسار المحامي',
  manualRequest: 'طلب اشتراك يدوي جديد - مسار المحامي',
  cardActivated: 'اشتراك جديد عبر البطاقة - مسار المحامي',
} as const;

export async function sendAdminBankTransferRequestAlert(
  params: BankTransferAlertParams,
): Promise<AlertResult> {
  const context = await resolveContext(params.orgId, params.requestedByUserId ?? null);
  const planLabel = getPlanDisplayLabel(normalizePlanCode(params.planCode, 'SOLO'));
  const amountLabel = formatAmount(params.amount, params.currency);
  const createdAt = params.createdAt || new Date().toISOString();
  const periodLabel = formatBillingPeriod(params.billingPeriod);
  const adminUrl = `${getPublicSiteUrl()}/admin/requests`;

  return sendAlertEmail({
    subject: SUBJECTS.bankTransfer,
    eventKey: 'billing_admin_alert_bank_transfer_requested',
    metadata: {
      orgId: params.orgId,
      paymentRequestId: params.paymentRequestId,
      planCode: params.planCode,
    },
    textLines: [
      'تم استلام طلب تفعيل جديد عبر التحويل البنكي.',
      `المنشأة: ${context.orgName || 'غير محدد'}`,
      `المستخدم: ${context.requesterName || 'غير محدد'}`,
      `البريد: ${context.requesterEmail || 'غير محدد'}`,
      `الباقة: ${planLabel}`,
      `الدورة: ${periodLabel}`,
      `المبلغ: ${amountLabel}`,
      `مرجع التحويل: ${params.bankReference || 'غير مذكور'}`,
      `رقم الطلب: ${params.paymentRequestId}`,
      `وقت الطلب: ${createdAt}`,
      `لوحة الإدارة: ${adminUrl}`,
    ],
    htmlSections: [
      detailRow('نوع التنبيه', 'طلب تفعيل جديد عبر التحويل البنكي'),
      detailRow('المنشأة', context.orgName || 'غير محدد'),
      detailRow('المستخدم', context.requesterName || 'غير محدد'),
      detailRow('البريد', context.requesterEmail || 'غير محدد'),
      detailRow('الباقة', planLabel),
      detailRow('الدورة', periodLabel),
      detailRow('المبلغ', amountLabel),
      detailRow('مرجع التحويل', params.bankReference || 'غير مذكور'),
      detailRow('رقم الطلب', params.paymentRequestId),
      detailRow('وقت الطلب', createdAt),
      detailLink('لوحة الإدارة', adminUrl),
    ],
  });
}

export async function sendAdminManualSubscriptionRequestAlert(
  params: ManualSubscriptionRequestAlertParams,
): Promise<AlertResult> {
  const normalizedPaymentMethod = String(params.paymentMethod || '').trim().toLowerCase();
  if (normalizedPaymentMethod && normalizedPaymentMethod !== 'bank_transfer') {
    return {
      sent: false,
      reason: 'payment_method_not_bank_transfer',
      recipients: [],
    };
  }

  const context = await resolveContext(params.orgId, params.requestedByUserId ?? null);
  const planLabel = getPlanDisplayLabel(normalizePlanCode(params.planCode, 'SOLO'));
  const requestedAt = params.requestedAt || new Date().toISOString();
  const adminUrl = `${getPublicSiteUrl()}/admin/requests`;

  return sendAlertEmail({
    subject: SUBJECTS.manualRequest,
    eventKey: 'billing_admin_alert_manual_subscription_requested',
    metadata: {
      orgId: params.orgId,
      subscriptionRequestId: params.subscriptionRequestId,
      planCode: params.planCode,
    },
    textLines: [
      'تم استلام طلب اشتراك/تفعيل يدوي جديد.',
      `المنشأة: ${context.orgName || 'غير محدد'}`,
      `المستخدم: ${context.requesterName || 'غير محدد'}`,
      `البريد: ${context.requesterEmail || 'غير محدد'}`,
      `الباقة: ${planLabel}`,
      `المدة: ${params.durationMonths} شهر`,
      `وسيلة الدفع: ${params.paymentMethod || 'غير محددة'}`,
      `مرجع الدفع: ${params.paymentReference || 'غير مذكور'}`,
      `رقم الطلب: ${params.subscriptionRequestId}`,
      `وقت الطلب: ${requestedAt}`,
      `لوحة الإدارة: ${adminUrl}`,
    ],
    htmlSections: [
      detailRow('نوع التنبيه', 'طلب اشتراك/تفعيل يدوي'),
      detailRow('المنشأة', context.orgName || 'غير محدد'),
      detailRow('المستخدم', context.requesterName || 'غير محدد'),
      detailRow('البريد', context.requesterEmail || 'غير محدد'),
      detailRow('الباقة', planLabel),
      detailRow('المدة', `${params.durationMonths} شهر`),
      detailRow('وسيلة الدفع', params.paymentMethod || 'غير محددة'),
      detailRow('مرجع الدفع', params.paymentReference || 'غير مذكور'),
      detailRow('رقم الطلب', params.subscriptionRequestId),
      detailRow('وقت الطلب', requestedAt),
      detailLink('لوحة الإدارة', adminUrl),
    ],
  });
}

export async function sendAdminCardSubscriptionActivatedAlert(
  params: CardSubscriptionAlertParams,
): Promise<AlertResult> {
  const db = createSupabaseServerClient();
  const eventType =
    params.provider === 'tap'
      ? 'tap.payment.captured.admin_alert_sent'
      : 'stripe.checkout_completed.admin_alert_sent';

  const dedupeMeta =
    params.provider === 'tap'
      ? { tap_charge_id: String(params.chargeId || '').trim() }
      : {
          stripe_session_id: String(params.checkoutSessionId || '').trim(),
          provider_subscription_id: String(params.providerSubscriptionId || '').trim(),
        };

  if (await hasMatchingSubscriptionEvent(db, params.orgId, eventType, dedupeMeta)) {
    logInfo('billing_admin_alert_skipped_duplicate', {
      provider: params.provider,
      orgId: params.orgId,
      ...dedupeMeta,
    });

    return {
      sent: false,
      reason: 'already_sent',
      recipients: [],
    };
  }

  const context = await resolveContext(params.orgId, params.requestedByUserId ?? null);
  const planLabel = getPlanDisplayLabel(normalizePlanCode(params.planCode, 'SOLO'));
  const amountLabel = formatAmount(params.amount, params.currency);
  const paidAt = params.paidAt || new Date().toISOString();
  const periodLabel = formatBillingPeriod(params.billingPeriod);
  const adminUrl = `${getPublicSiteUrl()}/admin`;
  const providerLabel = params.provider === 'tap' ? 'Tap' : 'Stripe';

  const result = await sendAlertEmail({
    subject: SUBJECTS.cardActivated,
    eventKey: 'billing_admin_alert_card_subscription_activated',
    metadata: {
      provider: params.provider,
      orgId: params.orgId,
      ...dedupeMeta,
    },
    textLines: [
      'تم تفعيل اشتراك جديد عبر البطاقة.',
      `مزوّد الدفع: ${providerLabel}`,
      `المنشأة: ${context.orgName || 'غير محدد'}`,
      `المستخدم: ${context.requesterName || 'غير محدد'}`,
      `البريد: ${context.requesterEmail || 'غير محدد'}`,
      `الباقة: ${planLabel}`,
      `الدورة: ${periodLabel}`,
      `المبلغ: ${amountLabel}`,
      `مرجع العملية: ${params.chargeId || params.checkoutSessionId || params.providerSubscriptionId || 'غير مذكور'}`,
      `وقت التفعيل: ${paidAt}`,
      `لوحة الإدارة: ${adminUrl}`,
    ],
    htmlSections: [
      detailRow('نوع التنبيه', 'اشتراك جديد عبر البطاقة'),
      detailRow('مزوّد الدفع', providerLabel),
      detailRow('المنشأة', context.orgName || 'غير محدد'),
      detailRow('المستخدم', context.requesterName || 'غير محدد'),
      detailRow('البريد', context.requesterEmail || 'غير محدد'),
      detailRow('الباقة', planLabel),
      detailRow('الدورة', periodLabel),
      detailRow('المبلغ', amountLabel),
      detailRow(
        'مرجع العملية',
        params.chargeId || params.checkoutSessionId || params.providerSubscriptionId || 'غير مذكور',
      ),
      detailRow('وقت التفعيل', paidAt),
      detailLink('لوحة الإدارة', adminUrl),
    ],
  });

  if (!result.sent) {
    return result;
  }

  const { error } = await db.from('subscription_events').insert({
    org_id: params.orgId,
    type: eventType,
    meta: {
      provider: params.provider,
      plan_code: normalizePlanCode(params.planCode, 'SOLO'),
      billing_period: params.billingPeriod,
      amount: toPositiveNumber(params.amount),
      currency: normalizeCurrency(params.currency),
      requested_by_user_id: params.requestedByUserId ?? null,
      ...dedupeMeta,
    },
  });

  if (error) {
    logError('billing_admin_alert_mark_failed', {
      provider: params.provider,
      orgId: params.orgId,
      message: error.message,
      ...dedupeMeta,
    });
  }

  return result;
}

async function sendAlertEmail(params: {
  subject: string;
  eventKey: string;
  metadata: Record<string, unknown>;
  textLines: string[];
  htmlSections: string[];
}): Promise<AlertResult> {
  if (!isSmtpConfigured()) {
    logWarn(`${params.eventKey}_skipped`, {
      reason: 'smtp_not_configured',
      ...params.metadata,
    });
    return { sent: false, reason: 'smtp_not_configured', recipients: [] };
  }

  const recipients = getBillingAlertEmails();
  if (!recipients.length) {
    logWarn(`${params.eventKey}_skipped`, {
      reason: 'no_recipients',
      ...params.metadata,
    });
    return { sent: false, reason: 'no_recipients', recipients: [] };
  }

  try {
    await sendEmail({
      to: recipients.join(','),
      subject: params.subject,
      text: params.textLines.join('\n'),
      html: renderHtml(params.subject, params.htmlSections),
    });

    logInfo(params.eventKey, {
      recipients,
      ...params.metadata,
    });

    return { sent: true, reason: 'sent', recipients };
  } catch (error) {
    logError(`${params.eventKey}_failed`, {
      message: error instanceof Error ? error.message : 'unknown_error',
      recipients,
      ...params.metadata,
    });
    return { sent: false, reason: 'send_failed', recipients };
  }
}

async function resolveContext(orgId: string, requestedByUserId: string | null): Promise<ContextRecord> {
  const db = createSupabaseServerClient();

  const [orgResult, userResult] = await Promise.all([
    db.from('organizations').select('name').eq('id', orgId).maybeSingle(),
    requestedByUserId
      ? db.from('app_users').select('full_name, email').eq('id', requestedByUserId).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
  ]);

  if (orgResult.error) {
    throw orgResult.error;
  }

  if (userResult.error) {
    throw userResult.error;
  }

  const orgRow = (orgResult.data as { name?: string | null } | null) ?? null;
  const userRow = (userResult.data as { full_name?: string | null; email?: string | null } | null) ?? null;

  return {
    orgName: orgRow?.name ?? null,
    requesterName: userRow?.full_name ?? null,
    requesterEmail: userRow?.email ?? null,
  };
}

async function hasMatchingSubscriptionEvent(
  db: ReturnType<typeof createSupabaseServerClient>,
  orgId: string,
  eventType: string,
  meta: Record<string, unknown>,
) {
  const filteredMeta = Object.fromEntries(
    Object.entries(meta).filter(([, value]) => String(value ?? '').trim() !== ''),
  );

  if (!Object.keys(filteredMeta).length) {
    return false;
  }

  const { data, error } = await db
    .from('subscription_events')
    .select('id')
    .eq('org_id', orgId)
    .eq('type', eventType)
    .contains('meta', filteredMeta)
    .limit(1)
    .maybeSingle();

  if (error) {
    logWarn('billing_admin_alert_duplicate_lookup_failed', {
      orgId,
      eventType,
      message: error.message,
      meta: filteredMeta,
    });
    return false;
  }

  return Boolean((data as { id?: string | null } | null)?.id);
}

function renderHtml(title: string, sections: string[]) {
  return [
    '<div dir="rtl" style="font-family:Tahoma,Arial,sans-serif;background:#f8fafc;padding:24px;color:#0f172a">',
    '<div style="max-width:640px;margin:0 auto;background:#ffffff;border:1px solid #e2e8f0;border-radius:16px;padding:24px">',
    `<h2 style="margin:0 0 16px;font-size:20px;color:#0f172a">${escapeHtml(title)}</h2>`,
    '<div style="display:grid;gap:10px">',
    ...sections,
    '</div>',
    '</div>',
    '</div>',
  ].join('');
}

function detailRow(label: string, value: string) {
  return [
    '<div style="padding:12px 14px;border:1px solid #e2e8f0;border-radius:12px;background:#f8fafc">',
    `<div style="font-size:12px;color:#475569;margin-bottom:4px">${escapeHtml(label)}</div>`,
    `<div style="font-size:14px;font-weight:700;color:#0f172a">${escapeHtml(value)}</div>`,
    '</div>',
  ].join('');
}

function detailLink(label: string, href: string) {
  return [
    '<div style="padding:12px 14px;border:1px solid #dbeafe;border-radius:12px;background:#eff6ff">',
    `<div style="font-size:12px;color:#1d4ed8;margin-bottom:4px">${escapeHtml(label)}</div>`,
    `<a href="${escapeHtml(href)}" style="font-size:14px;font-weight:700;color:#1d4ed8;text-decoration:none">${escapeHtml(
      href,
    )}</a>`,
    '</div>',
  ].join('');
}

function formatBillingPeriod(period: 'monthly' | 'yearly') {
  return period === 'yearly' ? 'سنوي' : 'شهري';
}

function formatAmount(amount: number | null | undefined, currency: string | null | undefined) {
  const normalizedAmount = toPositiveNumber(amount);
  if (normalizedAmount === null) {
    return 'غير محدد';
  }

  return `${formatMoney(normalizedAmount)} ${normalizeCurrency(currency)}`;
}

function formatMoney(value: number) {
  return new Intl.NumberFormat('ar-SA', {
    minimumFractionDigits: Number.isInteger(value) ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function normalizeCurrency(value: string | null | undefined) {
  const normalized = String(value || 'SAR').trim().toUpperCase();
  return normalized || 'SAR';
}

function toPositiveNumber(value: unknown) {
  const parsed = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return null;
  }
  return parsed;
}

function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}
