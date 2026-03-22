import 'server-only';

import { sendEmail } from '@/lib/email';
import {
    TRIAL_ENDING_SOON_EMAIL_HTML,
    TRIAL_ENDING_SOON_EMAIL_SUBJECT,
    TRIAL_ENDING_SOON_EMAIL_TEXT,
    TRIAL_EXPIRED_EMAIL_HTML,
    TRIAL_EXPIRED_EMAIL_SUBJECT,
    TRIAL_EXPIRED_EMAIL_TEXT,
} from '@/lib/email-templates';
import { getPublicSiteUrl, isSmtpConfigured } from '@/lib/env';
import { logInfo, logWarn } from '@/lib/logger';

const SITE_NAME = 'مسار المحامي';
const SUPPORT_EMAIL = 'masar.almohami@outlook.sa';

type TransactionalEmailResult = {
    sent: boolean;
    subject: string;
};

export async function sendWelcomeEmail(params: { to: string; fullName: string }) {
    if (!isSmtpConfigured()) {
        logWarn('email_skipped', { type: 'welcome', reason: 'smtp_not_configured', to: params.to });
        return;
    }

    const subject = `مرحبًا بك في ${SITE_NAME}`;
    const text = [
        `مرحبًا ${params.fullName}،`,
        '',
        `شكرًا لتسجيلك في ${SITE_NAME}!`,
        'لديك فترة تجربة مجانية لمدة 14 يومًا للاستمتاع بجميع خصائص المنصة.',
        '',
        'يمكنك البدء من خلال:',
        '• إضافة بيانات العملاء',
        '• إنشاء القضايا',
        '• تعيين المهام',
        '• رفع المستندات',
        '',
        'في حال احتجت أي مساعدة، لا تتردد بالتواصل معنا.',
        '',
        `فريق ${SITE_NAME}`,
    ].join('\n');

    await sendEmail({ to: params.to, subject, text });
    logInfo('email_sent', { type: 'welcome', to: params.to });
}

export async function sendTrialDay12Reminder(params: {
    to: string;
    fullName: string;
    daysLeft: number;
    orgName?: string | null;
    endsAt?: string | null;
    upgradeUrl?: string | null;
}): Promise<TransactionalEmailResult> {
    const subject = TRIAL_ENDING_SOON_EMAIL_SUBJECT(params.daysLeft);
    const upgradeUrl = params.upgradeUrl?.trim() || `${getPublicSiteUrl()}/upgrade`;
    const endsAtLabel = formatArabicDate(params.endsAt ?? null);

    if (!isSmtpConfigured()) {
        logWarn('email_skipped', { type: 'trial_reminder', reason: 'smtp_not_configured', to: params.to });
        return { sent: false, subject };
    }

    const text = TRIAL_ENDING_SOON_EMAIL_TEXT({
        recipientName: params.fullName,
        orgName: params.orgName,
        daysLeft: params.daysLeft,
        endsAtLabel,
        upgradeUrl,
        supportEmail: SUPPORT_EMAIL,
    });
    const html = TRIAL_ENDING_SOON_EMAIL_HTML({
        recipientName: params.fullName,
        orgName: params.orgName,
        daysLeft: params.daysLeft,
        endsAtLabel,
        upgradeUrl,
        supportEmail: SUPPORT_EMAIL,
    });

    await sendEmail({ to: params.to, subject, text, html });
    logInfo('email_sent', { type: 'trial_reminder', to: params.to, daysLeft: params.daysLeft });
    return { sent: true, subject };
}

export async function sendTrialExpiredEmail(params: {
    to: string;
    fullName: string;
    orgName?: string | null;
    endedAt?: string | null;
    upgradeUrl?: string | null;
}): Promise<TransactionalEmailResult> {
    const subject = TRIAL_EXPIRED_EMAIL_SUBJECT;
    const upgradeUrl = params.upgradeUrl?.trim() || `${getPublicSiteUrl()}/upgrade`;
    const endedAtLabel = formatArabicDate(params.endedAt ?? null);

    if (!isSmtpConfigured()) {
        logWarn('email_skipped', { type: 'trial_expired', reason: 'smtp_not_configured', to: params.to });
        return { sent: false, subject };
    }

    const text = TRIAL_EXPIRED_EMAIL_TEXT({
        recipientName: params.fullName,
        orgName: params.orgName,
        endedAtLabel,
        upgradeUrl,
        supportEmail: SUPPORT_EMAIL,
    });
    const html = TRIAL_EXPIRED_EMAIL_HTML({
        recipientName: params.fullName,
        orgName: params.orgName,
        endedAtLabel,
        upgradeUrl,
        supportEmail: SUPPORT_EMAIL,
    });

    await sendEmail({ to: params.to, subject, text, html });
    logInfo('email_sent', { type: 'trial_expired', to: params.to });
    return { sent: true, subject };
}

function formatArabicDate(value: string | null) {
    if (!value) {
        return null;
    }

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
        return null;
    }

    return new Intl.DateTimeFormat('ar-SA', {
        dateStyle: 'long',
    }).format(date);
}
