import test from 'node:test';
import assert from 'node:assert/strict';

import {
  PARTNER_WELCOME_EMAIL_HTML,
  PARTNER_WELCOME_EMAIL_SUBJECT,
} from '@/lib/email-templates';

test('partner approval email template supports setup flow with partner code and referral link', () => {
  const html = PARTNER_WELCOME_EMAIL_HTML({
    fullName: 'أحمد السالم',
    partnerCode: 'MASAR-AB12CD',
    referralLink: 'https://masaralmohami.com/?ref=MASAR-AB12CD',
    actionLabel: 'إعداد حساب الشريك',
    actionUrl: 'https://masaralmohami.com/partner-access?email=ahmad%40example.com&token=abc',
    actionHint: 'استخدم هذا الرابط لإعداد كلمة المرور.',
    partnerPortalUrl: 'https://masaralmohami.com/app/partners',
    supportEmail: 'masar.almohami@outlook.sa',
    siteUrl: 'https://masaralmohami.com',
    logoUrl: 'https://masaralmohami.com/masar-logo.png',
  });

  assert.match(PARTNER_WELCOME_EMAIL_SUBJECT, /شركاء النجاح/);
  assert.match(html, /MASAR-AB12CD/);
  assert.match(html, /https:\/\/masaralmohami\.com\/\?ref=MASAR-AB12CD/);
  assert.match(html, /إعداد حساب الشريك/);
  assert.match(html, /partner-access\?email=ahmad%40example\.com&token=abc/);
  assert.match(html, /masar-logo\.png/);
});

test('partner approval email template supports ready sign-in flow', () => {
  const html = PARTNER_WELCOME_EMAIL_HTML({
    fullName: 'أحمد السالم',
    partnerCode: 'MASAR-AB12CD',
    referralLink: 'https://masaralmohami.com/?ref=MASAR-AB12CD',
    actionLabel: 'تسجيل الدخول إلى بوابة الشريك',
    actionUrl: 'https://masaralmohami.com/auth/switch-account?email=ahmad%40example.com&next=%2Fapp%2Fpartners',
    actionHint: 'لديك حساب جاهز بالفعل.',
    partnerPortalUrl: 'https://masaralmohami.com/app/partners',
    supportEmail: 'masar.almohami@outlook.sa',
    siteUrl: 'https://masaralmohami.com',
    logoUrl: 'https://masaralmohami.com/masar-logo.png',
  });

  assert.match(html, /تسجيل الدخول إلى بوابة الشريك/);
  assert.match(html, /auth\/switch-account\?email=ahmad%40example\.com&next=%2Fapp%2Fpartners/);
});
