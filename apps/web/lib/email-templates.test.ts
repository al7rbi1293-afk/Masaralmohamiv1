import assert from 'node:assert/strict';
import test from 'node:test';

import {
  CLIENT_PORTAL_OTP_EMAIL_HTML,
  CLIENT_PORTAL_OTP_EMAIL_SUBJECT,
  CLIENT_PORTAL_OTP_EMAIL_TEXT,
  CLIENT_PORTAL_WELCOME_EMAIL_HTML,
  CLIENT_PORTAL_WELCOME_EMAIL_SUBJECT,
  CLIENT_PORTAL_WELCOME_EMAIL_TEXT,
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
