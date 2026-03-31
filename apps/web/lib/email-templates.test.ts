import assert from 'node:assert/strict';
import test from 'node:test';

import {
  CLIENT_PORTAL_MATTER_EVENT_EMAIL_HTML,
  CLIENT_PORTAL_MATTER_EVENT_EMAIL_SUBJECT,
  CLIENT_PORTAL_MATTER_EVENT_EMAIL_TEXT,
  CLIENT_PORTAL_OTP_EMAIL_HTML,
  CLIENT_PORTAL_OTP_EMAIL_SUBJECT,
  CLIENT_PORTAL_OTP_EMAIL_TEXT,
  CLIENT_PORTAL_WELCOME_EMAIL_HTML,
  CLIENT_PORTAL_WELCOME_EMAIL_SUBJECT,
  CLIENT_PORTAL_WELCOME_EMAIL_TEXT,
  LOGIN_OTP_EMAIL_HTML,
  LOGIN_OTP_EMAIL_SUBJECT,
  LOGIN_OTP_EMAIL_TEXT,
  TEAM_INVITATION_EMAIL_HTML,
  TEAM_INVITATION_EMAIL_SUBJECT,
  TEAM_INVITATION_EMAIL_TEXT,
  TRIAL_ENDING_SOON_EMAIL_HTML,
  TRIAL_ENDING_SOON_EMAIL_SUBJECT,
  TRIAL_ENDING_SOON_EMAIL_TEXT,
  TRIAL_EXPIRED_EMAIL_HTML,
  TRIAL_EXPIRED_EMAIL_SUBJECT,
  TRIAL_EXPIRED_EMAIL_TEXT,
  TASK_REMINDER_EMAIL_HTML,
  TASK_REMINDER_EMAIL_SUBJECT,
  TASK_REMINDER_EMAIL_TEXT,
} from './email-templates';

test('client portal welcome email includes onboarding details and portal link', () => {
  const portalUrl = 'https://masar.example.com/client-portal/signin';
  const html = CLIENT_PORTAL_WELCOME_EMAIL_HTML({
    clientName: 'سارة أحمد',
    portalUrl,
  });
  const text = CLIENT_PORTAL_WELCOME_EMAIL_TEXT({
    clientName: 'سارة أحمد',
    portalUrl,
  });

  assert.match(CLIENT_PORTAL_WELCOME_EMAIL_SUBJECT, /بوابة العميل/);
  assert.match(html, /سارة أحمد/);
  assert.match(html, /خطوات الدخول/);
  assert.match(html, /متابعة القضايا/);
  assert.match(html, /https:\/\/masar\.example\.com\/client-portal\/signin/);
  assert.match(text, /استخدم رمز التحقق/);
});

test('client portal otp email highlights the code and validity window', () => {
  const portalUrl = 'https://masar.example.com/client-portal/signin';
  const html = CLIENT_PORTAL_OTP_EMAIL_HTML({
    code: '482913',
    ttlMinutes: 5,
    portalUrl,
  });
  const text = CLIENT_PORTAL_OTP_EMAIL_TEXT({
    code: '482913',
    ttlMinutes: 5,
    portalUrl,
  });

  assert.match(CLIENT_PORTAL_OTP_EMAIL_SUBJECT, /رمز التحقق/);
  assert.match(html, /482913/);
  assert.match(html, /5 دقائق/);
  assert.match(html, /فتح بوابة العميل/);
  assert.match(text, /482913/);
  assert.match(text, /صلاحية الرمز: 5 دقائق/);
});

test('client portal matter event email includes case timeline update details', () => {
  const portalUrl = 'https://masar.example.com/client-portal';
  const html = CLIENT_PORTAL_MATTER_EVENT_EMAIL_HTML({
    clientName: 'أحمد خالد',
    matterTitle: 'قضية مطالبة تجارية',
    eventType: 'hearing',
    eventDateLabel: '15 مارس 2026، 11:00 ص',
    note: 'تم تحديد جلسة للنظر في الطلب.',
    portalUrl,
  });
  const text = CLIENT_PORTAL_MATTER_EVENT_EMAIL_TEXT({
    clientName: 'أحمد خالد',
    matterTitle: 'قضية مطالبة تجارية',
    eventType: 'hearing',
    eventDateLabel: '15 مارس 2026، 11:00 ص',
    note: 'تم تحديد جلسة للنظر في الطلب.',
    portalUrl,
  });

  assert.match(CLIENT_PORTAL_MATTER_EVENT_EMAIL_SUBJECT, /تحديث جديد/);
  assert.match(html, /قضية مطالبة تجارية/);
  assert.match(html, /جلسة/);
  assert.match(html, /تم تحديد جلسة للنظر في الطلب/);
  assert.match(text, /نوع التحديث: جلسة/);
  assert.match(text, /https:\/\/masar\.example\.com\/client-portal/);
});

test('task reminder email includes status, due date, and office note', () => {
  const html = TASK_REMINDER_EMAIL_HTML({
    recipientName: 'محمد علي',
    taskTitle: 'توقيع وكالة القضية',
    matterTitle: 'قضية مطالبة مالية',
    dueLabel: '15 مارس 2026، 09:30 ص',
    statusLabel: 'قيد التنفيذ',
    message: 'يرجى إرسال النسخة الموقعة قبل نهاية اليوم.',
  });
  const text = TASK_REMINDER_EMAIL_TEXT({
    recipientName: 'محمد علي',
    taskTitle: 'توقيع وكالة القضية',
    matterTitle: 'قضية مطالبة مالية',
    dueLabel: '15 مارس 2026، 09:30 ص',
    statusLabel: 'قيد التنفيذ',
    message: 'يرجى إرسال النسخة الموقعة قبل نهاية اليوم.',
  });

  assert.match(TASK_REMINDER_EMAIL_SUBJECT('توقيع وكالة القضية'), /تنبيه مهمة/);
  assert.match(html, /محمد علي/);
  assert.match(html, /قضية مطالبة مالية/);
  assert.match(html, /قيد التنفيذ/);
  assert.match(html, /يرجى إرسال النسخة الموقعة قبل نهاية اليوم/);
  assert.match(text, /موعد الاستحقاق: 15 مارس 2026، 09:30 ص/);
});

test('login otp email uses the shared branded template and text copy', () => {
  const html = LOGIN_OTP_EMAIL_HTML({
    name: 'عبدالعزيز',
    code: '654321',
    ttlMinutes: 10,
  });
  const text = LOGIN_OTP_EMAIL_TEXT({
    name: 'عبدالعزيز',
    code: '654321',
    ttlMinutes: 10,
  });

  assert.match(LOGIN_OTP_EMAIL_SUBJECT, /رمز التحقق/);
  assert.match(html, /عبدالعزيز/);
  assert.match(html, /654321/);
  assert.match(html, /10 دقائق/);
  assert.match(html, /تحقق ثنائي/);
  assert.match(text, /654321/);
  assert.match(text, /صلاحية الرمز: 10 دقائق/);
});

test('team invitation email includes sign-in, invite, and password reset links', () => {
  const html = TEAM_INVITATION_EMAIL_HTML({
    recipientName: 'سارة أحمد',
    recipientEmail: 'sara@example.com',
    orgName: 'مكتب الأفق للمحاماة',
    role: 'lawyer',
    inviteUrl: 'https://masar.example.com/invite/token123',
    signInUrl: 'https://masar.example.com/signin?token=token123&email=sara%40example.com',
    forgotPasswordUrl: 'https://masar.example.com/forgot-password?email=sara%40example.com',
    expiresAtLabel: '31 مارس 2026، 11:00 ص',
    invitedByName: 'عبدالله',
  });
  const text = TEAM_INVITATION_EMAIL_TEXT({
    recipientName: 'سارة أحمد',
    recipientEmail: 'sara@example.com',
    orgName: 'مكتب الأفق للمحاماة',
    role: 'lawyer',
    inviteUrl: 'https://masar.example.com/invite/token123',
    signInUrl: 'https://masar.example.com/signin?token=token123&email=sara%40example.com',
    forgotPasswordUrl: 'https://masar.example.com/forgot-password?email=sara%40example.com',
    expiresAtLabel: '31 مارس 2026، 11:00 ص',
    invitedByName: 'عبدالله',
  });

  assert.match(TEAM_INVITATION_EMAIL_SUBJECT, /فريق المكتب/);
  assert.match(html, /سارة أحمد/);
  assert.match(html, /مكتب الأفق للمحاماة/);
  assert.match(html, /تسجيل الدخول وقبول الدعوة/);
  assert.match(html, /forgot-password\?email=sara%40example\.com/);
  assert.match(html, /invite\/token123/);
  assert.match(text, /sara@example\.com/);
  assert.match(text, /رابط تسجيل الدخول التالي/);
  assert.match(text, /إذا لم تكن تعرف كلمة المرور/);
});

test('trial ending soon email includes office name, urgency, and upgrade link', () => {
  const upgradeUrl = 'https://masar.example.com/upgrade';
  const html = TRIAL_ENDING_SOON_EMAIL_HTML({
    recipientName: 'مكتب الأفق للمحاماة',
    orgName: 'مكتب الأفق للمحاماة',
    daysLeft: 2,
    endsAtLabel: '25 مارس 2026',
    upgradeUrl,
    supportEmail: 'support@example.com',
  });
  const text = TRIAL_ENDING_SOON_EMAIL_TEXT({
    recipientName: 'مكتب الأفق للمحاماة',
    orgName: 'مكتب الأفق للمحاماة',
    daysLeft: 2,
    endsAtLabel: '25 مارس 2026',
    upgradeUrl,
    supportEmail: 'support@example.com',
  });

  assert.match(TRIAL_ENDING_SOON_EMAIL_SUBJECT(2), /يومان/);
  assert.match(html, /مكتب الأفق للمحاماة/);
  assert.match(html, /25 مارس 2026/);
  assert.match(html, /طلب التفعيل الآن/);
  assert.match(html, /https:\/\/masar\.example\.com\/upgrade/);
  assert.match(text, /لم يتبقَ عليها سوى يومان/);
  assert.match(text, /support@example.com/);
});

test('trial expired email reassures data retention and points to activation flow', () => {
  const upgradeUrl = 'https://masar.example.com/upgrade';
  const html = TRIAL_EXPIRED_EMAIL_HTML({
    recipientName: 'سارة',
    orgName: 'مكتب سارة للمحاماة',
    endedAtLabel: '27 مارس 2026',
    upgradeUrl,
    supportEmail: 'support@example.com',
  });
  const text = TRIAL_EXPIRED_EMAIL_TEXT({
    recipientName: 'سارة',
    orgName: 'مكتب سارة للمحاماة',
    endedAtLabel: '27 مارس 2026',
    upgradeUrl,
    supportEmail: 'support@example.com',
  });

  assert.match(TRIAL_EXPIRED_EMAIL_SUBJECT, /انتهت التجربة/);
  assert.match(html, /مكتب سارة للمحاماة/);
  assert.match(html, /تم حفظ بياناتكم/);
  assert.match(html, /استكمال التفعيل/);
  assert.match(text, /بياناتكم ما تزال محفوظة/);
  assert.match(text, /https:\/\/masar\.example\.com\/upgrade/);
});
