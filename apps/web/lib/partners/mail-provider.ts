import 'server-only';

import { getPartnerAlertEmails, getPublicSiteUrl, isSmtpConfigured } from '@/lib/env';
import { sendEmail } from '@/lib/email';
import {
  PARTNER_WELCOME_EMAIL_HTML,
  PARTNER_WELCOME_EMAIL_SUBJECT,
} from '@/lib/email-templates';
import type { PartnerAccessMode } from '@/lib/partners/access';

type PartnerApplicationNotification = {
  applicationId: string;
  fullName: string;
  whatsappNumber: string;
  email: string;
  city: string;
  submittedAt: string;
  adminUrl?: string;
};

type PartnerApprovalNotification = {
  fullName: string;
  email: string;
  partnerCode: string;
  referralLink: string;
  accessMode: PartnerAccessMode;
  activationUrl: string | null;
  signInUrl: string;
  partnerPortalUrl: string;
};

export async function sendPartnerApplicationNotification(payload: PartnerApplicationNotification) {
  const recipients = getPartnerAlertEmails();
  if (!recipients.length) {
    return { sent: false, reason: 'missing_recipients' as const };
  }

  if (!isSmtpConfigured()) {
    console.warn('SMTP not configured. Partner application alert was skipped.');
    return { sent: false, reason: 'smtp_not_configured' as const };
  }

  const subject = 'طلب جديد في شركاء النجاح';
  const adminLink = payload.adminUrl || 'لوحة الإدارة';

  const text = [
    'تم استلام طلب جديد في برنامج شركاء النجاح.',
    `الاسم: ${payload.fullName}`,
    `رقم الواتساب: ${payload.whatsappNumber}`,
    `البريد الإلكتروني: ${payload.email}`,
    `المدينة: ${payload.city}`,
    `وقت الإرسال: ${payload.submittedAt}`,
    `رقم الطلب: ${payload.applicationId}`,
    `رابط الإدارة: ${adminLink}`,
  ].join('\n');

  const html = `
  <div dir="rtl" style="font-family: 'Segoe UI', Tahoma, sans-serif; line-height:1.7; color:#0f172a;">
    <h2 style="margin:0 0 12px;">طلب جديد في شركاء النجاح</h2>
    <p style="margin:4px 0;"><strong>الاسم:</strong> ${escapeHtml(payload.fullName)}</p>
    <p style="margin:4px 0;"><strong>رقم الواتساب:</strong> ${escapeHtml(payload.whatsappNumber)}</p>
    <p style="margin:4px 0;"><strong>البريد الإلكتروني:</strong> ${escapeHtml(payload.email)}</p>
    <p style="margin:4px 0;"><strong>المدينة:</strong> ${escapeHtml(payload.city)}</p>
    <p style="margin:4px 0;"><strong>وقت الإرسال:</strong> ${escapeHtml(payload.submittedAt)}</p>
    <p style="margin:4px 0;"><strong>رقم الطلب:</strong> ${escapeHtml(payload.applicationId)}</p>
    ${payload.adminUrl ? `<p style="margin:14px 0;"><a href="${escapeHtml(payload.adminUrl)}" style="color:#0ea5e9;">فتح الطلب في لوحة الإدارة</a></p>` : ''}
  </div>`;

  await sendEmail({
    to: recipients.join(','),
    subject,
    text,
    html,
  });

  return { sent: true as const };
}

export async function sendPartnerApprovalNotification(payload: PartnerApprovalNotification) {
  if (!payload.email.trim()) {
    return { sent: false, reason: 'missing_email' as const };
  }

  if (!isSmtpConfigured()) {
    console.warn('SMTP not configured. Partner approval email was skipped.');
    return { sent: false, reason: 'smtp_not_configured' as const };
  }

  const siteUrl = getPublicSiteUrl();
  const logoUrl = `${siteUrl}/masar-logo.png`;
  const supportEmail = 'masar.almohami@outlook.sa';
  const actionLabel = payload.accessMode === 'setup_required'
    ? 'إعداد حساب الشريك'
    : 'تسجيل الدخول إلى بوابة الشريك';
  const actionUrl = payload.accessMode === 'setup_required'
    ? payload.activationUrl || payload.signInUrl
    : payload.signInUrl;
  const actionHint = payload.accessMode === 'setup_required'
    ? 'استخدم هذا الرابط لإعداد كلمة المرور وتفعيل وصولك إلى بوابة الشريك. صلاحية الرابط 72 ساعة.'
    : 'لديك حساب جاهز بالفعل. سجّل الدخول وسيتم توجيهك مباشرة إلى بوابة الشريك.';

  const text = [
    `مرحباً ${payload.fullName}،`,
    'تم قبولك وتفعيلك بنجاح في برنامج شركاء النجاح لدى مسار المحامي.',
    '',
    `كود الشريك: ${payload.partnerCode}`,
    `رابط الإحالة: ${payload.referralLink}`,
    `${actionLabel}: ${actionUrl}`,
    `بوابة الشريك: ${payload.partnerPortalUrl}`,
    '',
    'شكراً مقدمًا على شراكتك وثقتك بنا.',
    `للدعم: ${supportEmail}`,
  ].join('\n');

  const html = PARTNER_WELCOME_EMAIL_HTML({
    fullName: escapeHtml(payload.fullName),
    partnerCode: escapeHtml(payload.partnerCode),
    referralLink: escapeHtml(payload.referralLink),
    actionLabel: escapeHtml(actionLabel),
    actionUrl: escapeHtml(actionUrl),
    actionHint: escapeHtml(actionHint),
    partnerPortalUrl: escapeHtml(payload.partnerPortalUrl),
    supportEmail: escapeHtml(supportEmail),
    siteUrl: escapeHtml(siteUrl),
    logoUrl: escapeHtml(logoUrl),
  });

  await sendEmail({
    to: payload.email,
    subject: PARTNER_WELCOME_EMAIL_SUBJECT,
    text,
    html,
  });

  return { sent: true as const };
}

function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}
