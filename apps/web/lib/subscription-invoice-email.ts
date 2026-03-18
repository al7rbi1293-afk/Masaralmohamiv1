import 'server-only';

import { isSmtpConfigured } from '@/lib/env';
import { INVOICE_EMAIL_HTML } from '@/lib/email-templates';
import { sendEmail } from '@/lib/email';
import { renderInvoicePdfBuffer } from '@/lib/invoice-pdf';
import { logError, logInfo, logWarn } from '@/lib/logger';
import { normalizePlanCode as normalizeCanonicalPlanCode } from '@/lib/billing/plans';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { getPricingPlanCardByCode } from '@/lib/subscription-pricing';

export type SubscriptionInvoiceSourceKind =
  | 'subscription_request'
  | 'payment_request'
  | 'tap'
  | 'manual_activation';

export type SubscriptionInvoiceEmailParams = {
  orgId: string;
  planCode: string;
  durationMonths?: number | null;
  billingPeriod?: 'monthly' | 'yearly' | null;
  amount?: number | null;
  currency?: string | null;
  requestedByUserId?: string | null;
  sourceKind: SubscriptionInvoiceSourceKind;
  sourceId?: string | null;
  sentByUserId?: string | null;
};

export type SubscriptionInvoiceEmailResult = {
  sent: boolean;
  reason: string;
  toEmail: string | null;
};

type AppUserRow = {
  id: string;
  email: string | null;
  full_name: string | null;
};

type Recipient = {
  userId: string | null;
  email: string | null;
  fullName: string | null;
};

const SUBSCRIPTION_INVOICE_SUBJECT = 'فاتورة الاشتراك - مسار المحامي';

export async function sendSubscriptionInvoiceEmail(
  params: SubscriptionInvoiceEmailParams,
): Promise<SubscriptionInvoiceEmailResult> {
  if (!isSmtpConfigured()) {
    logWarn('subscription_invoice_email_skipped', {
      orgId: params.orgId,
      sourceKind: params.sourceKind,
      reason: 'smtp_not_configured',
    });
    return { sent: false, reason: 'smtp_not_configured', toEmail: null };
  }

  const db = createSupabaseServerClient();

  try {
    const recipient = await resolveRecipient(db, params.orgId, params.requestedByUserId ?? null);
    if (!recipient.email) {
      logWarn('subscription_invoice_email_skipped', {
        orgId: params.orgId,
        sourceKind: params.sourceKind,
        reason: 'recipient_not_found',
      });
      return { sent: false, reason: 'recipient_not_found', toEmail: null };
    }

    const normalizedPlanCode = normalizeCanonicalPlanCode(params.planCode, 'SOLO');
    const planCard = getPricingPlanCardByCode(normalizedPlanCode);
    const durationMonths = resolveDurationMonths(params.durationMonths, params.billingPeriod);
    const amount =
      toPositiveNumber(params.amount) ??
      estimateAmountFromPricing({
        normalizedPlanCode,
        durationMonths,
      });

    if (!amount) {
      logWarn('subscription_invoice_email_skipped', {
        orgId: params.orgId,
        sourceKind: params.sourceKind,
        reason: 'amount_unknown',
        planCode: normalizedPlanCode,
      });
      return { sent: false, reason: 'amount_unknown', toEmail: recipient.email };
    }

    const currency = normalizeCurrency(params.currency);
    const amountLabel = `${formatMoney(amount)} ${currency}`;
    const planName = planCard?.title ?? normalizedPlanCode;
    const periodText =
      params.billingPeriod === 'yearly' || durationMonths >= 12
        ? 'سنوي'
        : 'شهري';
    const lineDescription =
      durationMonths > 1
        ? `اشتراك باقة ${planName} لمدة ${durationMonths} شهر`
        : `اشتراك باقة ${planName} (${periodText})`;

    const orgName = await resolveOrgName(db, params.orgId);
    const invoiceNumber = buildInvoiceNumber(params.sourceId ?? params.orgId);
    const issuedAt = new Date().toISOString();

    const { buffer, fileName } = await renderInvoicePdfBuffer({
      number: invoiceNumber,
      status: 'paid',
      currency,
      total: amount,
      subtotal: amount,
      tax: 0,
      paidAmount: amount,
      remaining: 0,
      issued_at: issuedAt,
      due_at: null,
      clientName: orgName || recipient.fullName || recipient.email,
      orgName: 'مسار المحامي لتقنية المعلومات',
      logoUrl: null,
      items: [{ desc: lineDescription, qty: 1, unit_price: amount }],
    });

    await sendEmail({
      to: recipient.email,
      subject: SUBSCRIPTION_INVOICE_SUBJECT,
      html: INVOICE_EMAIL_HTML(recipient.fullName ?? 'عميلنا الكريم', planName, amountLabel),
      attachments: [
        {
          filename: fileName,
          content: buffer,
          contentType: 'application/pdf',
        },
      ],
    });

    await insertEmailLogBestEffort({
      db,
      orgId: params.orgId,
      sentBy: params.sentByUserId ?? recipient.userId,
      toEmail: recipient.email,
      status: 'sent',
      meta: {
        source_kind: params.sourceKind,
        source_id: params.sourceId ?? null,
        plan_code: normalizedPlanCode,
        duration_months: durationMonths,
        amount,
        currency,
        invoice_number: invoiceNumber,
      },
    });

    logInfo('subscription_invoice_email_sent', {
      orgId: params.orgId,
      sourceKind: params.sourceKind,
      toEmail: recipient.email,
      planCode: normalizedPlanCode,
      amount,
      currency,
    });

    return { sent: true, reason: 'sent', toEmail: recipient.email };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'unknown_error';
    logError('subscription_invoice_email_failed', {
      orgId: params.orgId,
      sourceKind: params.sourceKind,
      message,
    });

    await insertEmailLogBestEffort({
      db,
      orgId: params.orgId,
      sentBy: params.sentByUserId ?? params.requestedByUserId ?? null,
      toEmail: null,
      status: 'failed',
      error: message.slice(0, 240),
      meta: {
        source_kind: params.sourceKind,
        source_id: params.sourceId ?? null,
        plan_code: normalizeCanonicalPlanCode(params.planCode, 'SOLO'),
      },
    });

    return { sent: false, reason: 'send_failed', toEmail: null };
  }
}

async function resolveRecipient(
  db: ReturnType<typeof createSupabaseServerClient>,
  orgId: string,
  requestedByUserId: string | null,
): Promise<Recipient> {
  if (requestedByUserId) {
    const direct = await resolveAppUser(db, requestedByUserId);
    if (direct.email) {
      return direct;
    }
  }

  const { data: ownerMembership, error: ownerError } = await db
    .from('memberships')
    .select('user_id')
    .eq('org_id', orgId)
    .eq('role', 'owner')
    .limit(1)
    .maybeSingle();

  if (ownerError) {
    throw ownerError;
  }

  const ownerUserId = String((ownerMembership as { user_id?: string | null } | null)?.user_id ?? '').trim();
  if (!ownerUserId) {
    return {
      userId: requestedByUserId,
      email: null,
      fullName: null,
    };
  }

  const owner = await resolveAppUser(db, ownerUserId);
  if (owner.email) {
    return owner;
  }

  return {
    userId: ownerUserId,
    email: null,
    fullName: null,
  };
}

async function resolveAppUser(
  db: ReturnType<typeof createSupabaseServerClient>,
  userId: string,
): Promise<Recipient> {
  const { data, error } = await db
    .from('app_users')
    .select('id, email, full_name')
    .eq('id', userId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  const row = (data as AppUserRow | null) ?? null;
  return {
    userId: row?.id ?? userId,
    email: row?.email ?? null,
    fullName: row?.full_name ?? null,
  };
}

async function resolveOrgName(
  db: ReturnType<typeof createSupabaseServerClient>,
  orgId: string,
) {
  const { data } = await db
    .from('organizations')
    .select('name')
    .eq('id', orgId)
    .maybeSingle();

  const rawName = (data as { name?: string | null } | null)?.name;
  return rawName?.trim() || 'مسار المحامي';
}

async function insertEmailLogBestEffort(params: {
  db: ReturnType<typeof createSupabaseServerClient>;
  orgId: string;
  sentBy: string | null;
  toEmail: string | null;
  status: 'sent' | 'failed';
  error?: string;
  meta: Record<string, unknown>;
}) {
  if (!params.sentBy) {
    return;
  }

  const safeToEmail = params.toEmail ?? 'unknown@local.invalid';
  const { error } = await params.db.from('email_logs').insert({
    org_id: params.orgId,
    sent_by: params.sentBy,
    to_email: safeToEmail,
    subject: SUBSCRIPTION_INVOICE_SUBJECT,
    template: 'invoice',
    status: params.status,
    error: params.error ?? null,
    meta: params.meta,
  });

  if (error) {
    logWarn('subscription_invoice_email_log_failed', {
      orgId: params.orgId,
      message: error.message,
      status: params.status,
    });
  }
}

function resolveDurationMonths(
  durationMonths: number | null | undefined,
  billingPeriod: 'monthly' | 'yearly' | null | undefined,
) {
  const normalizedDuration = toPositiveInteger(durationMonths);
  if (normalizedDuration) return normalizedDuration;
  return billingPeriod === 'yearly' ? 12 : 1;
}

function estimateAmountFromPricing(params: {
  normalizedPlanCode: string;
  durationMonths: number;
}) {
  const card = getPricingPlanCardByCode(params.normalizedPlanCode);
  if (!card || card.priceMonthly === null) {
    return null;
  }

  if (params.durationMonths >= 12 && params.durationMonths % 12 === 0) {
    const years = params.durationMonths / 12;
    const yearlyPrice = card.priceAnnual ?? card.priceMonthly * 10;
    return round2(yearlyPrice * years);
  }

  return round2(card.priceMonthly * params.durationMonths);
}

function buildInvoiceNumber(sourceId: string) {
  const datePart = new Date().toISOString().slice(0, 10).replaceAll('-', '');
  const compact = sourceId.replaceAll('-', '').replaceAll('_', '').toUpperCase();
  const suffix = compact.slice(0, 8) || 'SUB';
  return `SUB-${datePart}-${suffix}`;
}

function normalizeCurrency(value: string | null | undefined) {
  const normalized = String(value ?? 'SAR').trim().toUpperCase();
  return normalized || 'SAR';
}

function toPositiveNumber(value: number | null | undefined) {
  if (!Number.isFinite(value)) return null;
  const safe = Number(value);
  if (safe <= 0) return null;
  return round2(safe);
}

function toPositiveInteger(value: number | null | undefined) {
  if (!Number.isFinite(value)) return null;
  const safe = Math.floor(Number(value));
  if (safe <= 0) return null;
  return safe;
}

function formatMoney(value: number) {
  return value.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function round2(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}
