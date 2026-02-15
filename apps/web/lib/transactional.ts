import 'server-only';

import { sendEmail } from '@/lib/email';
import { isSmtpConfigured } from '@/lib/env';
import { logInfo, logWarn } from '@/lib/logger';

const SITE_NAME = 'مسار المحامي';

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
}) {
    if (!isSmtpConfigured()) {
        logWarn('email_skipped', { type: 'trial_reminder', reason: 'smtp_not_configured', to: params.to });
        return;
    }

    const subject = `تبقى ${params.daysLeft} يوم على انتهاء التجربة — ${SITE_NAME}`;
    const text = [
        `مرحبًا ${params.fullName}،`,
        '',
        `تبقى ${params.daysLeft} يوم فقط على انتهاء فترة التجربة المجانية.`,
        '',
        'لضمان استمرارية عملك، يمكنك ترقية اشتراكك بالتواصل مع فريقنا:',
        '• البريد: masar.almohami@outlook.sa',
        '• صفحة الترقية على المنصة',
        '',
        `فريق ${SITE_NAME}`,
    ].join('\n');

    await sendEmail({ to: params.to, subject, text });
    logInfo('email_sent', { type: 'trial_reminder', to: params.to, daysLeft: params.daysLeft });
}

export async function sendTrialExpiredEmail(params: { to: string; fullName: string }) {
    if (!isSmtpConfigured()) {
        logWarn('email_skipped', { type: 'trial_expired', reason: 'smtp_not_configured', to: params.to });
        return;
    }

    const subject = `انتهت فترة التجربة — ${SITE_NAME}`;
    const text = [
        `مرحبًا ${params.fullName}،`,
        '',
        'انتهت فترة التجربة المجانية الخاصة بك.',
        'بياناتك محفوظة بأمان ويمكنك ترقية اشتراكك في أي وقت للعودة.',
        '',
        'للترقية:',
        '• البريد: masar.almohami@outlook.sa',
        '• صفحة الترقية على المنصة',
        '',
        `فريق ${SITE_NAME}`,
    ].join('\n');

    await sendEmail({ to: params.to, subject, text });
    logInfo('email_sent', { type: 'trial_expired', to: params.to });
}
