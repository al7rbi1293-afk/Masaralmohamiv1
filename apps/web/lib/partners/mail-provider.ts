import 'server-only';

import { getPartnerAlertEmails, isSmtpConfigured } from '@/lib/env';
import { sendEmail } from '@/lib/email';

type PartnerApplicationNotification = {
  applicationId: string;
  fullName: string;
  whatsappNumber: string;
  email: string;
  city: string;
  submittedAt: string;
  adminUrl?: string;
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

function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}
